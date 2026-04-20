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
  length: distanceInCells,  // also the length in inches (1 cell = 1")
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

Pruning, prioritisation, and conflict resolution are deferred to a later phase (TBD).

---

## Step 6 — Walkway rasterisation and validation

Once a pair is accepted:

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
      length: 7,              // in cells / inches
      axis: 'NS' | 'WE',
      blocked: false,         // set by Step 6 if walls intersect
    },
    ...
  ],
  tier2: [ ... ],
  tier3: [ ... ],
}
```

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

## Open questions

1. **Pruning / conflict resolution** — Phase 2 allows overlaps and redundancy. A later phase (TBD) must decide which connections survive. Strategy not yet defined.
2. **Walkway cell value** — introduce `CELL.WALKWAY` or reuse an existing label?
3. **P tuning** — is `P=4` (= 4" in Mordheim scale) the right cadence? Should it scale with `walkwayWidth`?
4. **Orphan anchors** — anchors that fail to pair. Drop silently, or pass to the ladder sub-stage as candidates?
5. **Interior-only walkways** — `IFLOOR_*` anchors can pair with each other within one building. Is that desirable, or should those be filtered?

---

## Next steps

- Prototype Phase 1 (anchor emission) + Phase 2 (pair discovery) against an existing seed and visualise in the preview tool
- Define the pruning phase (overlap resolution, redundancy culling)
- Revisit `anchorPeriod` default after visual inspection
