# Connectivity Plan v2

**Created:** 2026-04-20
**Last updated:** 2026-04-21
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

- **N-S pass** sweeps every column of the tier's collision matrix. Looks for walkways running N-S, which attach to floor or roof edges facing N or S — i.e. cells labelled `FLOOR_N`, `FLOOR_S`, `IFLOOR_N`, `IFLOOR_S`, `ROOF_N`, `ROOF_S` (plus relevant corner/end/island variants).
- **W-E pass** sweeps every row. Looks for walkways running W-E, attaching to `FLOOR_W`, `FLOOR_E`, `IFLOOR_W`, `IFLOOR_E`, `ROOF_W`, `ROOF_E` (and variants).

The two passes are independent — a single building can generate anchors on all four sides if its foundation happens to align with both grids.

---

## Step 2 — Counter-gated anchor emission

During a scan, tick a counter `C` that resets every `P` cells (`0, 1, 2, … P-1, 0, 1, …`).

At every `C=0` tick, evaluate the **anchor condition**:

1. The current cell carries a floor edge label facing the scan direction
2. The next cell along the scan axis (`C=1`) carries the same-direction label
3. The cells *opposite* the edge (one step in the label's facing direction) have a value of `255` (`cell.empty`) or `0` (`cell.shell`) for both trigger cells — both are considered empty for generation purposes
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
| Roof edges | `ROOF_N/S/E/W` | Roof perimeter, generated by the same labelling pass as floors but with ROOF_ prefix |
| Roof corners | `ROOF_NE/NW/SE/SW` | |
| Roof ends | `ROOF_END_N/S/E/W` | |
| Roof islands | `ROOF_ISLAND` | |

Including `IFLOOR_*` allows walkways to span *internal* gaps within a single building (e.g. bridging a blown-out quadrant). Including `ROOF_*` allows walkways to attach to rooftop edges, enabling connections between raised surfaces generated by the same roof-labelling mechanism.

---

## Phase 2 — Anchor pair discovery

Phase 1 (Steps 1–4) produced a set of anchors per tier. Phase 2 turns those anchors into candidate connections. Overlaps and redundancy are **not** resolved here — this phase only asks *"which anchors can see each other?"*. Pruning happens later.

### Step 5a — Anchor record

Each anchor must carry enough metadata for Phase 2 and beyond:

```js
{
  direction: 'N' | 'S' | 'W' | 'E',
  buildingId:       'b12',  // the building whose edge this anchor sits on — set in Phase 1
  pairedBuildingId: 'b17',  // the building on the other end — null until paired in Phase 2
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

Phase 2 produced every possible anchor pair. Phase 3 trims that list down to a curated set per tier. It begins by collapsing vertically-stacked duplicates across all tiers before any per-tier filtering runs.

### Step 6a — Vertical stacking detection and cull ✅ IMPLEMENTED

A vertical stack occurs when two or more candidates overlap in the same XZ lane — same axis, same perpendicular coordinate, and their spans along the travel axis overlap (even partially). These represent walkways that would stack on top of each other between the same pair of wall faces.

Implementation uses **union-find (path-halving)** to group overlapping candidates within each lane:

1. Compute a lane key: `"${axis}|${perp}"` where perp is `z` for WE axis, `x` for NS axis
2. Within each lane, union-find any pair where their travel-axis spans overlap
3. For each connected component of 2+, pick the longest span as the survivor (seeded RNG breaks ties among equally-long candidates)
4. Mark all others `stackCulled: true`; mark their anchors `stackCulled: true` if all their connections were culled

`src/generators/connectivity/index.js` — stacking logic runs as the first pass in `generateConnectivity`.

### Step 6b — Group and sort ✅ IMPLEMENTED

For each tier's remaining candidate list:
1. Group candidates by `fromBuildingId`
2. Within each group, sort by `length` ascending

### Step 6c — Per-building selection strategy ✅ IMPLEMENTED

A config key `filterStrategy` selects one of:

| Strategy | Behaviour |
|---|---|
| `longestAndShortest` | Keep the N longest *and* N shortest per building (up to 2N total) |
| `longest` | Keep the N longest per building |
| `shortest` | Keep the N shortest per building |
| `random` | Keep N seeded-random per building |

`src/generators/connectivity/filter-candidates.js`

### Step 6d — Per-building filter loop ✅ IMPLEMENTED

For each building's sorted candidate list:

1. Take the next candidate in strategy order (e.g. shortest-first for `shortest`)
2. Check the **tier's filtered registry** for an existing connection between this pair of buildings. Building-pair match is bidirectional — `(A, B) == (B, A)` — because from/to can swap depending on which anchor fired first during Phase 2.
3. If a connection between this pair already exists in the filtered registry → skip this candidate, try the next one
4. If no existing connection → append to the filtered registry
5. Repeat until N has been satisfied for this building, or no candidates remain
6. Move to the next building

### Step 6e — Per-tier scope ✅ IMPLEMENTED

Each tier's filter runs independently and writes into its own filtered array. The same two buildings *can* be connected at multiple tiers — vertical stacking has already been resolved by Step 6a, so any multi-tier connections that survive to this point are genuinely distinct paths.

---

## Step 7 — Doorway carving and walkway rasterisation

⚠️ **Pipeline order change (2026-04-21):** `generateWalls` must be called **after** `generateConnectivity` in `src/index.js`. This allows the wall generator to receive the final surviving anchor list and carve doorways as part of its own subdivide → damage → windows → **carve doorways** → merge pass, rather than connectivity reaching back into wall data.

### Step 7a — Connectivity outputs anchor/trigger data

`generateConnectivity` must attach `triggerCells` to each anchor before returning. Trigger cells carry the collision matrix cell coordinates (`cx`, `cy`, `cz`) needed by the wall generator to locate the correct wall segments:

```js
// on each anchor:
triggerCells: [{ cx, cy, cz }, { cx, cy, cz }]  // the 2 floor-edge cells the anchor fired from
```

This was implemented then reverted during earlier work — must be re-added to `emit-anchors.js` (`makeAnchor`) when Step 7 is built.

### Step 7b — Door cell stamping and wall carving

#### Step 7b-i — Derive orientation and stamp `CELL.DOOR` into collision matrix

Each surviving connection carries `axis: 'NS' | 'WE'` (set during Phase 2 pairing). This directly encodes the door orientation — no recalculation needed.

For each surviving connection, stamp a door volume at **both** ends (`conn.from` and `conn.to` anchors):

**Door geometry:**
- **Width:** 2 cells — the two trigger cells sit side-by-side along the axis perpendicular to the anchor's facing direction.
  - N/S-facing anchor → trigger cells are adjacent along the W-E axis
  - E/W-facing anchor → trigger cells are adjacent along the N-S axis
- **Height:** 3 cells — full room height, starting at `triggerCell.cy + 1` (first cell above the floor slab) up to `triggerCell.cy + 3` inclusive

**Stamping:**
```js
// For each of the 2 trigger cells in the anchor:
matrix.fillBox(triggerCell.cx, triggerCell.cy + 1, triggerCell.cz, 1, 3, 1, CELL.DOOR);
// (repeat for both trigger cells to get the full 2-wide opening)
```

`CELL.DOOR` must be registered as a new constant in `src/generators/collision/matrix.js` and documented in `docs/architecture/collision_matrix.md`. Suggested value: **90**, written by the Connectivity stage.

**Debug visualisation:**
After all door cells are stamped, emit a grey debug rectangle for each door volume. Each rect covers the 2×3 column of cells (XZ footprint = 2×1, height = 3 cells). Use the same debug recorder pattern as other stages — colour: grey (e.g. `0x888888`).

#### Step 7b-ii — Wall generator carves doorways

Wall generation receives the surviving anchor list. For each anchor's trigger cells, it:

1. Locates the outward wall face at that position (direction matches the anchor direction)
2. Carves a 2-cell-wide × `tierHeight`-tall opening — re-subdivide the wall segment, kill columns overlapping `[openStart, openEnd]`, re-merge
3. Carves both ends of each connection (both `conn.from` and `conn.to` anchors)

The opening is carved **during the wall pipeline** so subdivide/merge runs naturally around doorways rather than needing to be re-applied after the fact.

### Step 7c — Walkway rasterisation

After doorways are carved, stamp each surviving walkway rect into the collision matrix with `CELL.WALKWAY` for downstream stages (Cover etc.) to read.

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

**Updated order (2026-04-21):**

```
generateGrid → generateBuildings → generateFloors → generateRoofs
  → generateConnectivity        ← reads FLOOR_*/IFLOOR_* labels, outputs surviving anchors
  → generateWalls               ← receives anchor list, carves doorways during wall pipeline
  → Cover
```

Previously walls ran before connectivity. They must now run after so the wall generator can receive the final anchor set and carve doorways in a single coordinated pass.

`src/index.js` stage order change is **pending** — not yet applied.

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

### Phase 5 — Doorway carving *(approach defined, not yet implemented — see Step 7)*

Superseded by the pipeline order change. Doorway carving now belongs in the wall generator rather than as a post-connectivity phase. See **Step 7** above for the revised approach.

All three files from the earlier attempt have been deleted: `carve-doorways.js`, `identify-doorway-walls.js`, `carve-opening.js`. The wall generator will need a new carve-opening implementation when Step 7 is built.

---

## ⚠️ IMPORTANT — Walkway end connection geometry *(approach established, not yet implemented)*

How the walkway physically meets the building edge is defined as follows:

- Each walkway end is **0.25 inches deep** and meets the **shy (inner) face** of the anchor cell — i.e. it butts up to the facing side of the collision cell rather than extending into or through it.
- End tiles are **stamped individually into the collision matrix** as discrete connection tiles (e.g. `CELL.CONNECTION_END`), not as part of the walkway rect.
- Before stamping each end tile, **check the collision matrix at that position.** If a connection tile is already present there (from a prior connection's end), **skip this tile** — do not overwrite or double-stamp.
- This approach ensures that when two connections cross on the same tier, their end tiles cannot overlap each other, and the generated shapes remain non-intersecting even at crossing points.

The 0.25" depth is intentionally shallow so end tiles consume minimal matrix space while still providing an accurate collision footprint for downstream generation stages.

---

## Open questions

1. **Walkway cell value** — introduce `CELL.WALKWAY` or reuse an existing label?
2. **P tuning** — is `P=4` (= 4" in Mordheim scale) the right cadence? Should it scale with `walkwayWidth`?
3. **Orphan anchors** — anchors that fail to pair. Drop silently, or pass to the ladder sub-stage as candidates?
4. **Interior-only walkways** — `IFLOOR_*` anchors can pair with each other within one building. Is that desirable, or should those be filtered?
5. **Phase 3 processing order** — when iterating buildings for the filter loop, does order matter? (Alphabetical by buildingId? Shuffled by seeded RNG?) Early buildings may "claim" connections before later buildings get a chance.
6. **Perpendicular walkway crossings** — Phase 3 only culls same-axis XZ overlaps across tiers. A same-tier N-S walkway crossing a same-tier W-E walkway is not filtered. Intentional or a gap?

---

## Implementation status

| Phase | Steps | Status |
|---|---|---|
| Phase 1 — Anchor emission | Steps 1–4 | ✅ Complete |
| Phase 2 — Pair discovery | Steps 5a–5d | ✅ Complete |
| Phase 3 — Filter pass | Steps 6a–6e | ✅ Complete |
| Pipeline reorder — walls after connectivity | `src/index.js` | ✅ Complete |
| Step 7a — Trigger cells on anchors | `emit-anchors.js` | ⏳ Pending |
| Step 7b-i — Door cell stamping + debug draw | Connectivity output pass | ⏳ Pending |
| Step 7b-ii — Wall pipeline doorway carving | `generateWalls` | ⏳ Pending |
| Step 7c — Walkway rasterisation | Post-wall pass | ✅ Complete |

## Next steps

1. ~~Move `generateWalls` to after `generateConnectivity` in `src/index.js`~~ ✅ Done
2. Re-add `triggerCells` to anchors in `emit-anchors.js` (`makeAnchor`)
3. Register `CELL.DOOR = 90` in `src/generators/collision/matrix.js`; document in `docs/architecture/collision_matrix.md`
4. After `generateConnectivity` returns surviving connections, iterate each connection's `from`/`to` anchors, stamp `CELL.DOOR` (2×3 per anchor), emit grey debug rects
5. Pass surviving anchors into `generateWalls`; implement carve-opening logic in the wall pipeline (Step 7b-ii)
6. Stamp walkway rects into the collision matrix (`CELL.WALKWAY`) (Step 7c)
7. Tune `filterStrategy` and `filterN` after visual inspection
8. Design Phase 4 (final connection culling — perpendicular crossings, density limits)
