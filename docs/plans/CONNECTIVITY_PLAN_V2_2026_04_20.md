# Connectivity Plan v2

**Created:** 2026-04-20
**Last updated:** 2026-04-20
**Supersedes:** `CONNECTIVITY_PLAN_2026_04_20.md` (v1 — Delaunay + MST approach)
**Depends on:** Walls Phase 2 (complete), Floors (complete)
**Source reference:** `src/generators/_old_system/connectivity/`

---

## Why a v2

V1 proposed a TinyKeep-style graph approach (Delaunay + MST + loop edges). In discussion the following weaknesses surfaced:

- Building-centroid nodes don't map cleanly onto axis-aligned walkway geometry — many Delaunay edges get rejected by the 50% landing check, producing fewer loops than configured.
- BLOCKER A (connection point definition) remained unresolved.
- It discards the rich per-cell labelling that Floors and Walls already stamp into the collision matrix.

V2 flips the approach: **the collision matrix itself is the connection graph.** No centroids, no triangulation — the floor edge labels (`FLOOR_N/S/E/W`, `IFLOOR_N/S/E/W` and variants) already describe every possible walkway attachment point. We just need a disciplined way to pick aligned ones.

---

## Core approach — Anchor grid scan (per tier)

Each tier's collision matrix is scanned twice — once along the N-S axis (for walkways that run N-S) and once along the W-E axis (for walkways that run W-E). A periodic counter forces anchor points onto a fixed grid, so walkways across the whole map share visual rhythm.

```
Per tier:
  1. N-S scan → emit N-facing and S-facing anchors
  2. W-E scan → emit W-facing and E-facing anchors
  3. Pair anchors that face each other across empty space
  4. For each accepted pair, stamp an axis-aligned walkway into the matrix
  5. Validate (wall collision flags `blocked=true`)
```

Cross-tier movement (ladders, pillars, platforms) is handed off to later sub-stages — out of scope for this document.

---

## Terminology

| Term | Meaning |
|---|---|
| **Trigger cell** | The labelled floor edge cell (`FLOOR_<dir>` or `IFLOOR_<dir>`) detected during the scan at `C=0`. |
| **Anchor cell** | The empty cell immediately opposite the trigger, one step in the direction the label faces. The walkway geometry starts here, not on the floor cell. |
| **Anchor pair** | Two anchors facing each other across an empty span — the endpoints of a candidate walkway. |
| **P** | Period of the grid counter. Controls how often anchors are allowed to spawn along the scan axis. |
| **C** | The grid counter, resets every P cells. |

---

## Step 1 — The two scan passes

For each tier:

- **N-S pass** sweeps every column of the tier's collision matrix. Looks for walkways running N-S, which attach to floor edges facing N or S — i.e. cells labelled `FLOOR_N`, `FLOOR_S`, `IFLOOR_N`, `IFLOOR_S` (plus relevant corner/end/island variants).
- **W-E pass** sweeps every row. Looks for walkways running W-E, attaching to `FLOOR_W`, `FLOOR_E`, `IFLOOR_W`, `IFLOOR_E` (and variants).

The two passes are independent — a single building can generate anchors on all four sides if its foundation happens to align with both grids.

---

## Step 2 — Counter-gated anchor emission

During a scan, tick a counter `C` that resets every `P` cells (`0, 1, 2, … P-1, 0, 1, …`).

At every `C=0` tick, evaluate the **anchor condition**:

1. The current cell carries a floor edge label facing the scan direction
2. The next cell along the scan axis (`C=1`) carries the same-direction label
3. The cells *opposite* the edge (one step in the label's facing direction) are **empty** for both trigger cells
4. If all pass → emit a 2-cell-wide anchor at those opposite empty positions

The counter enforces two properties:

- **Alignment** — every anchor starts on a multiple of `P`, so walkways on opposite sides of the map line up cleanly.
- **Implicit 50% landing check** — requiring two consecutive edge cells at `C=0` and `C=1` guarantees the walkway end is always fully seated on the building, never partially hanging off.

---

## Step 3 — Foundation alignment (expected behaviour)

Because BSP places foundations at arbitrary offsets, a building's floor edges may or may not fall on `C=0` ticks. For a minimal 1 BDD ruin:

| Foundation alignment vs. grid | Anchors produced |
|---|---|
| Aligned on both N-S and W-E scan grids | 4 (N, S, W, E) |
| Aligned on W-E scan only | 2 (W, E) |
| Aligned on N-S scan only | 2 (N, S) |
| Aligned on neither | 0 |

This is a **feature, not a bug** — map density self-regulates. Larger buildings always span enough cells to hit the counter on multiple sides; small ruins are hit-or-miss depending on foundation offset, which produces natural variety.

---

## Step 4 — Eligible label set

An anchor can only trigger from cells with a directional floor label. The full eligible set is:

| Label group | Cell values | Notes |
|---|---|---|
| Exterior edges | `FLOOR_N/S/E/W` (10–13) | Standard building perimeter |
| Exterior corners | `FLOOR_NE/NW/SE/SW` (14–17) | Two exposed sides |
| Exterior ends | `FLOOR_END_N/S/E/W` (30–33) | Three exposed sides |
| Exterior islands | `FLOOR_ISLAND` (34) | All four exposed |
| Interior edges | `IFLOOR_N/S/E/W` (60–63) | Cliff into a damaged quadrant |
| Interior corners | `IFLOOR_NE/NW/SE/SW` (64–67) | |
| Interior ends | `IFLOOR_END_N/S/E/W` (70–73) | |
| Interior islands | `IFLOOR_ISLAND` (74) | |

Including `IFLOOR_*` allows walkways to span *internal* gaps within a single building (e.g. bridging a blown-out quadrant).

---

## Phase 2 — Anchor pair discovery

Phase 1 (Steps 1–4) produced a set of anchors per tier. Phase 2 turns those anchors into candidate connections. Overlaps and redundancy are **not** resolved here — this phase only asks *"which anchors can see each other?"*. Pruning happens later.

### Step 5a — Anchor record

Each anchor must carry enough metadata for Phase 2 and beyond:

```js
{
  direction: 'N' | 'S' | 'W' | 'E',
  buildingId: 'b12',            // the shell the anchor attaches to
  cells: [{ cx, cz }, { cx, cz }], // the 2 empty cells the anchor occupies
  tier: 1,
}
```

### Step 5b — Projection

For each anchor, cast a ray outward along its `direction` cell-by-cell. The ray terminates on one of:

| Termination | Outcome |
|---|---|
| Distance reaches `maxConnectionLength` | Anchor dies — no connection registered |
| Hits another anchor facing the **opposite** direction (N↔S, W↔E) | Candidate pair found → proceed to 5c |
| (Anchors only sit in empty cells, so the ray travels through empty space until it either meets another anchor or expires) | — |

Same-facing or perpendicular-facing anchors are **not** valid partners. An N-facing anchor can only pair with an S-facing anchor; a W-facing with an E-facing.

### Step 5c — Duplicate check and registration

Before registering a candidate pair `(A, B)`:

1. Check the current tier's connection registry for an existing entry where `{from, to} == {A, B}` or `{B, A}`.
2. If already present → skip (both anchors fire rays, so every pair is discovered twice).
3. Otherwise → append a new connection record:

```js
{
  from: anchorA,
  to: anchorB,
  fromBuildingId: 'b12',
  toBuildingId:   'b17',
  startXZ: { x, z },             // from-anchor cell position
  endXZ:   { x, z },             // to-anchor cell position
  length: distanceInCells,       // also the length in inches (1 cell = 1")
  axis: 'NS' | 'WE',
}
```

### Step 5d — Per-tier scope

Every tier runs its own Phase 2 pass and writes into its own registry array. No cross-tier pairing happens here — vertical movement is for the ladder sub-stage.

### What this phase explicitly does **not** do

- It does **not** prune overlapping walkways (perpendicular crossings are allowed through for now)
- It does **not** prune redundant routes (multiple walkways between the same pair of buildings are allowed if distinct anchors pair)
- It does **not** check for walls along the span (Step 6 does that, as a `blocked` flag)
- It does **not** sort or prioritise — every valid pair is kept

Pruning, prioritisation, and conflict resolution happen in Phase 3.

---

## Phase 3 — Filter pass

Phase 2 produced every possible anchor pair. Phase 3 trims that list down to a curated set per tier, then removes vertical duplicates across tiers.

### Step 6a — Group and sort

For each tier's candidate list:
1. Group candidates by `fromBuildingId`
2. Within each group, sort by `length` ascending

### Step 6b — Per-building selection strategy

A config key `filterStrategy` selects one of:

| Strategy | Behaviour |
|---|---|
| `longestAndShortest` | Keep the N longest *and* N shortest per building (up to 2N total) |
| `longest` | Keep the N longest per building |
| `shortest` | Keep the N shortest per building |
| `random` | Keep N seeded-random per building |

### Step 6c — Per-building filter loop

For each building's sorted candidate list:

1. Take the next candidate in strategy order (e.g. shortest-first for `shortest`)
2. Check the **tier's filtered registry** for an existing connection between this pair of buildings. Building-pair match is bidirectional — `(A, B) == (B, A)` — because from/to can swap depending on which anchor fired first during Phase 2.
3. If a connection between this pair already exists in the filtered registry → skip this candidate, try the next one
4. If no existing connection → append to the filtered registry
5. Repeat until N has been satisfied for this building, or no candidates remain
6. Move to the next building

### Step 6d — Per-tier scope

Each tier's filter runs independently and writes into its own filtered array. The same two buildings *can* be connected at multiple tiers — that's desirable for verticality. Cross-tier stacking is addressed next.

### Step 6e — Cross-tier overlap cull

Tier 1 is exempt (ground is the baseline — no walkways below it to compare).

For every tier N > 1:

1. For each filtered connection at tier N, test its `(startXZ, endXZ)` span against every filtered connection at tier N-1
2. If the two spans **overlap along the same axis** (any XZ overlap — not just exact match, because connections may be different lengths reaching different floor segments of the same buildings) → **discard the tier N connection**
3. The lower connection is never culled — always the upper

Rationale: a tier 2 walkway running directly above a tier 1 walkway produces stacked connections with identical top-down footprint, which reads as redundant clutter on the tabletop.

---

## Step 7 — Walkway rasterisation and validation

After Phase 3 has produced the filtered per-tier connection list, for each surviving connection:

1. Stamp the walkway rect into the collision matrix with a dedicated cell value (e.g. `CELL.WALKWAY`)
2. Scan the walkway span for wall cells (`20–23`) encountered along the way
3. If walls intersect the span → flag walkway as `blocked = true` (carry-over from v1)
4. No fallback routing — blocked walkways remain blocked; downstream culling or ladders handle fallback

---

## Config values

| Key | Proposed default | Notes |
|---|---|---|
| `anchorPeriod` (P) | 4 | Cells between anchor slots. Smaller = more anchors, denser connections. |
| `walkwayWidth` | 2 (cells) | Two consecutive C=0/C=1 edge cells → width = 2. If changed, the "two consecutive edge cells" check becomes "P-aligned run of W cells". |
| `maxConnectionLength` | `mapSize / 2` | Carried from v1. |
| `filterStrategy` | `longestAndShortest` | One of: `longestAndShortest`, `longest`, `shortest`, `random`. |
| `filterN` | 2 | Quota per building per tier. For `longestAndShortest` this is N *each* (up to 2N total). |

---

## Pipeline position

Runs after Walls Phase 2 and before Cover.
Reads `FLOOR_*`, `IFLOOR_*`, and wall cells from the collision matrix.
Writes accepted walkways to `data.connections.walkways` **and** back into the collision matrix (so Cover and later sub-stages see them as occupied).

---

## Output shape

```js
data.connections = {
  tier1: [
    {
      from: anchor,           // { direction, buildingId, cells, tier }
      to: anchor,
      fromBuildingId: 'b12',
      toBuildingId:   'b17',
      startXZ: { x, z },
      endXZ:   { x, z },
      length: 7,              // in cells / inches
      axis: 'NS' | 'WE',
      blocked: false,         // set by Step 7 if walls intersect
    },
    ...
  ],
  tier2: [ ... ],
  tier3: [ ... ],
}
```

Only Phase 3's filtered connections survive to this output — Phase 2's raw candidate list is discarded.
One array per tier. Ladders, pillars, and platforms are added by subsequent sub-stages (not covered here).

---

## Comparison — v1 vs v2

| Aspect | v1 (Delaunay + MST) | v2 (Anchor grid scan) |
|---|---|---|
| Node definition | Per-building centroid (BLOCKER A) | Per-cell labelled edge (resolved by Floors stage) |
| Edge generation | Delaunay triangulation | Two axis-aligned matrix scans |
| Pruning | Kruskal's MST | Counter-gated (P period) + anchor pairing |
| Loops / extras | Re-add 15% of non-MST edges | Emergent — every aligned anchor can pair |
| Landing validation | Post-hoc 50% overlap check | Built into the anchor condition (2 consecutive edge cells) |
| Diagonals | Routed away in Step 5 | Impossible by construction |
| Small ruins | Always get a centroid node | Only anchor if foundation aligns with grid |
| Uses collision matrix labelling | Reads only | Reads + writes |

---

## Dropped from v1

| Step | Reason |
|---|---|
| Delaunay triangulation | Replaced by matrix scan — anchors emerge from labels, not geometry |
| Kruskal's MST | Replaced by counter-gated anchor emission + pairing |
| Loop edge re-addition | Not needed — anchor pairing naturally produces multiple connections per building |
| BLOCKER A (connection point definition) | Resolved — every labelled edge cell is a potential anchor point |

---

## Kept from v1

| Item | Notes |
|---|---|
| Axis-aligned walkways only | Enforced by scan direction, not post-hoc |
| Wall collision → `blocked = true` flag | Identical behaviour |
| Per-tier independence | Each tier scanned separately |
| `maxConnectionLength` cap | Applied to anchor pairing in Step 5 |
| No fallback routing | Rejected walkways are rejected |

---

## ⚠️ IMPORTANT — Phases still to be designed

Two further phases must be specified before this plan is implementation-ready. They cannot be skipped — the pipeline will produce structurally valid but gameplay-broken maps without them. Design work on both should begin **once Phases 1–3 are prototyped and visualised** so the actual output shapes can inform the design.

### Phase 4 — Final connection culling *(not yet designed)*

Phase 3 filters per-building and removes cross-tier stacks, but the surviving set may still contain:

- Perpendicular same-tier crossings (N-S walkway intersecting a W-E walkway)
- Visually cluttered clusters of short connections around dense building groups
- Connections that pass too close to other connections or structural features

Phase 4 must define the final pass that resolves these conflicts. Open question already flagged (#6). Strategy, priority rules, and config keys TBD.

### Phase 5 — Trigger/anchor doorway deletion *(not yet designed)*

The trigger cell (the `FLOOR_*` / `IFLOOR_*` edge where an anchor fired from) may have a wall cell directly above it. Without removal, the walkway connects to a floor edge that is *behind* a wall — the player can reach the walkway but cannot step from the walkway onto the building.

Phase 5 must define how trigger-point walls are cleared to form doorways:

- Which wall cells get removed (trigger cell, anchor cell, or both sides of the gap?)
- Doorway height and width (carry over from the old `carveLadderDoorway` logic?)
- Interaction with partial walls (`FLOOR_NE` corner cells border two wall runs)
- What happens when a walkway is flagged `blocked=true` by Step 7 — skip the doorway carve?

Equivalent to the old system's `carve-ladder-doorway.js` but applied to walkway trigger points.

---

## Open questions

1. **Walkway cell value** — introduce `CELL.WALKWAY` or reuse an existing label?
2. **P tuning** — is `P=4` (= 4" in Mordheim scale) the right cadence? Should it scale with `walkwayWidth`?
3. **Orphan anchors** — anchors that fail to pair. Drop silently, or pass to the ladder sub-stage as candidates?
4. **Interior-only walkways** — `IFLOOR_*` anchors can pair with each other within one building. Is that desirable, or should those be filtered?
5. **Phase 3 processing order** — when iterating buildings for the filter loop, does order matter? (Alphabetical by buildingId? Shuffled by seeded RNG?) Early buildings may "claim" connections before later buildings get a chance.
6. **Perpendicular walkway crossings** — Phase 3 only culls same-axis XZ overlaps across tiers. A same-tier N-S walkway crossing a same-tier W-E walkway is not filtered. Intentional or a gap?

---

## Next steps

- Prototype Phase 1 (anchor emission) + Phase 2 (pair discovery) + Phase 3 (filter) against an existing seed and visualise each phase's output in the preview tool
- Tune `filterStrategy` and `filterN` defaults after visual inspection
- Revisit `anchorPeriod` default after visual inspection
