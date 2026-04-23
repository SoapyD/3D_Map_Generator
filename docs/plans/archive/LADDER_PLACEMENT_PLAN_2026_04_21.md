# Ladder Placement Plan

**Created:** 2026-04-21
**Archived:** 2026-04-23 — implemented and shipped (see deltas below)
**Depends on:** Connectivity (complete), Floors (complete), Roofs (complete), Walls (complete)

---

## Deltas vs. as-built

The pipeline landed close to this plan but diverged in several places as the debug workflow revealed better ergonomics:

- **Pipeline position reversed.** Ladders now run *before* walls so the candidate scan sees `SHELL`/`FLOOR_*` labels rather than wall cells. Ladder-stamped `CELL.DOOR` cells then suppress wall segments in the subsequent walls stage.
- **Culling became advisory, not destructive.** `mapEdge`, `connection`, `building`, `cell` checks collect into cull sets and tag each group with a `cullReasons[]` array + `isCulled` flag. Hard filtering happens only at the debug-path-building stage (externals + non-culled). Visualiser color-codes groups by cull reason.
- **Full-height culling removed.** `cullFullHeight` / 30% chance dropped entirely — didn't survive debugging and was never re-enabled.
- **Clearance values retuned.** `mapEdgeClearance: 3` (from 5), `connectionClearance: 2` (from 4), `buildingClearance: 4`, `pathSpacing: 6`. Adjacent-building ray ignores `SHELL`/`EMPTY`; only non-empty occupied cells count.
- **Path system replaced with debug paths.** Phase 3/4 of the original plan (DFS chain finding + quota-based selection with proximity/side-limit relaxation) is present as `phase3Paths` / `phase4Select` but the actual ladder output uses a separate `buildDebugPaths` path. It greedily walks up from ground to roof, picks an external non-culled ladder per step, advances 1–2 tiers at a time, and emits `ladderPaths[]`. Quotas: small/ruins-small=1, medium=2, large=3. Small ruins gated behind a 40% RNG roll.
- **Multi-path spacing = 3 units** (not 6) between new ladders and already-placed ones on the same building.
- **Segment-level trimming.** Each path segment carries `keptBottomY`/`keptTopY` (the rendered portion) and optionally `deletedBottomY`/`deletedTopY` for the visualiser's red "cut" overlay when a segment doesn't reach the next target tier.
- **Door stamping per floor.** At each floor the segment crosses, a 3-wide × 3-tall block of `CELL.DOOR` is stamped (spread perpendicular to facing direction) so walls get suppressed at every landing, not just the top.
- **Ladder dimensions.** 1" wide (up from the planned 0.75"), 0.25" thick, flush to the wall face via a directional offset.
- **`data.ladders` is empty.** The output shape is `{ ladderCandidates, ladderGroups, ladderPaths }`. Geometry builder iterates `ladderPaths[].segments[]` and builds one ladder primitive per segment using `buildLadderPrimitive`.
- **No `LADDERS` block in config** was needed as a separate file — clearances live directly in `src/config.js` under `LADDERS`.

---

## Overview

Generates context-aware ladder placements for each building. Ladders are placed on building faces derived from floor/roof edge labels already stamped into the collision matrix. The system works in five phases:

1. **Candidate scan** — scan matrix for edge labels, apply exclusion rules, emit per-cell candidates
2. **Column grouping** — group candidates by XZ position into ladder records with heights
3. **Path discovery** — find chains of ladders covering ground-to-roof per building
4. **Path selection** — pick paths per building according to size rules
5. **Output** — emit finalised ladder geometry records

Visualiser: thin 0.25" rect per ladder face. Exporter: toggle between 3D mesh and flat quad via `LADDER_DISPLAY.showMeshLadders` / `showBoxLadders` (config already exists in `src/config.js`).

---

## Terminology

| Term | Meaning |
|---|---|
| **Trigger cell** | A matrix cell carrying a directional floor/roof edge label (`FLOOR_N/S/E/W`, `IFLOOR_*`, `ROOF_*`, `IROOF_*`) |
| **Facing direction** | The direction the label faces — same as anchor logic: facing *away* from the building surface (a `FLOOR_N` cell faces N) |
| **Candidate** | A single trigger cell that passes all exclusion rules |
| **Ladder** | A group of vertically-stacked candidates at the same (cx, cz) with a computed height span |
| **Path** | An ordered chain of ladders whose tier spans connect ground to roof without overlap |

---

## Eligible label set

Scan every cell in the matrix. A cell is a trigger if its value belongs to any of:

| Group | Cell values | Facing |
|---|---|---|
| Exterior floor edges | `FLOOR_N/S/E/W` (10–13), `FLOOR_NE/NW/SE/SW` (14–17), `FLOOR_END_N/S/E/W` (30–33), `FLOOR_ISLAND` (34) | Direction of the label |
| Interior floor edges | `IFLOOR_N/S/E/W` (60–63), `IFLOOR_NE/NW/SE/SW` (64–67), `IFLOOR_END_N/S/E/W` (70–73), `IFLOOR_ISLAND` (74) | Direction of the label |
| Exterior roof edges | `ROOF_N/S/E/W` (41–44), `ROOF_NE/NW/SE/SW` (45–48), `ROOF_END_N/S/E/W` (100–103), `ROOF_ISLAND` (104) | Direction of the label |
| Interior roof edges | `IROOF_N/S/E/W` (91–94), `IROOF_NE/NW/SE/SW` (95–98), `IROOF_END_N/S/E/W` (100–103), `IROOF_ISLAND` (104) | Direction of the label |

For **corner cells** (`FLOOR_NE/NW/SE/SW`, `IFLOOR_NE/NW/SE/SW`, `ROOF_NE/NW/SE/SW`, `IROOF_NE/NW/SE/SW`): emit **two candidates** from the same cell — one for each exposed direction (e.g. `FLOOR_NE` → one candidate facing N, one facing E). Each candidate is evaluated independently against the exclusion rules.

For **end and island cells**, emit one candidate per exposed direction in the same way (end cells have 3 exposed directions, island cells have 4).

---

## Phase 1 — Candidate scan

### Step 1a — Scan the matrix

For every cell `(cx, cy, cz)` that carries an eligible label, extract:
- `direction`: facing direction (N/S/E/W)
- `isExternal`: true if label starts with `FLOOR_` or `ROOF_`; false for `IFLOOR_` / `IROOF_`
- `isRoof`: true if label is a `ROOF_*` or `IROOF_*` cell
- `buildingIndex`: resolve via `findBuildingIndex(cx, cz, buildings)` — the building whose shell this edge belongs to
- `tier`: floor index derived from `cy` using the standard formula `floorIndex = Math.round((cy + slabThickness) / (tierHeight + slabThickness))`

### Step 1b — Exclusion rules

Reject any candidate that fails any of the following:

**1. Map edge clearance (5 units)**
Convert `(cx, cz)` to world coordinates. Reject if:
```
worldX < 5 || worldX > mapWidth - 5 ||
worldZ < 5 || worldDepth - 5
```

**2. Connection proximity (4 units)**
Scan all cells within a 4-unit radius (Chebyshev distance, same cy) of `(cx, cz)`. Reject if any cell value is `CELL.WALKWAY (105)`, `CELL.WALKWAY_CROSSING (106)`, or `CELL.DOOR (90)`.

**3. Adjacent building clearance (4 units)**
Cast a ray from `(cx, cz)` in the candidate's facing direction, up to 4 cells. Reject if any cell along the ray carries `CELL.SHELL (0)` belonging to a *different* building than `buildingIndex`.

---

## Phase 2 — Column grouping into ladder records

### Step 2a — Group by (cx, cz, direction, buildingIndex)

Collect all passing candidates. Group by the key `${cx},${cz},${direction},${buildingIndex}`. Each group represents a single vertical column of triggers at one face position — these form one ladder.

### Step 2b — Compute height span

For each group, sort trigger cells by `cy` ascending. Then determine `bottomY` and `topY`:

**External ladders** (`isExternal = true` on any cell in the group):
- `bottomY = 0` (world ground — the ladder always reaches the ground)
- `topY = world top of the highest trigger cell = highestCy + 1`

**Internal ladders** (all cells in group are `IFLOOR_*` / `IROOF_*`):
- `bottomY = world Y of the floor of the tier *below* the lowest trigger cell`
  - `lowestTier = floorIndex(lowestCy)`
  - `bottomY = slabY(max(lowestTier - 1, 0))` using `slabY(i) = i * (tierHeight + slabThickness) - slabThickness`
- `topY = world top of the highest trigger cell = highestCy + 1`

**Roof cap:** if the highest trigger is a `ROOF_*` / `IROOF_*` cell AND no further triggers exist in the group above it, `topY` stays at that cell's top (no extension beyond the building).

### Step 2c — Full-height culling (30% chance)

A ladder is **full-height** if its `startTier === 0` and `endTier === building.maxTier - 1` (spans ground to roof slab).

The world Y top of the building shell is derivable as: `topWorldY = -slabThickness + building.maxTier * (tierHeight + slabThickness) - tierHeight`, confirmed from the `fillBox` call in `generateBuildings.js`.

For full-height ladders, roll `rng.chance(0.30)`. If true, randomly trim the top, bottom, or both ends:

1. Determine how many tiers the ladder spans: `tiers = endTier - startTier`
2. If `tiers <= 1` — skip culling (nothing to trim and stay valid)
3. Otherwise:
   - Roll whether to cull top, bottom, or both (equal 1/3 probability each)
   - For each culled end, remove between 1 and `tiers - 1` tiers (leaving at least 1 tier remaining across the whole ladder after both ends are applied)
   - Recalculate `bottomY` / `topY` and `startTier` / `endTier` from trimmed span
   - Constraint: `endTier - startTier >= 1` must hold after culling

### Step 2d — Build the ladder record

```js
{
  id:           string,          // unique, e.g. `ladder_${buildingIndex}_${i}`
  buildingIndex: number,
  cx, cz,                        // collision cell position
  direction:    'N'|'S'|'E'|'W',
  isExternal:   bool,
  startTier:    number,          // floor index of bottom (0 = ground)
  endTier:      number,          // floor index of top (= building maxTier for roof-reaching ladders)
  bottomY:      number,          // world Y of ladder base
  topY:         number,          // world Y of ladder top
  height:       number,          // topY - bottomY
  triggers:     [{ cx, cy, cz, isRoof }],  // ordered trigger cells, ascending cy
}
```

---

## Phase 3 — Path discovery

A **path** is an ordered chain of ladders whose tier spans connect ground to roof with no gaps and no overlapping tiers.

### Step 3a — Per-building available pool

Group ladder records by `buildingIndex`. Determine the building's roof tier: `roofTier = building.maxTier`.

### Step 3b — Path chain rules

- A chain starts with a ladder where `startTier === 0` (reaches ground)
- Each subsequent ladder's `startTier` must equal the previous ladder's `endTier` (exact adjacency, no overlap, no gap)
- A chain is complete when the last ladder's `endTier === roofTier`

> **Note:** Tier overlap in chains is explicitly disallowed for now to avoid ambiguity. A ladder spanning tier 0→2 followed by one spanning tier 1→roof is **not** a valid chain. Revisit if map variety requires it.

### Step 3c — Discovery loop

For each building:

1. `available = [...allBuildingLadders]`
2. `paths = []`
3. Repeat until no valid path can be found:
   a. Use DFS to find any valid chain from `startTier=0` to `endTier=roofTier` using only ladders in `available`
   b. If found: record the path, **remove those ladders from `available`**
   c. If not found: break
4. Discard any ladders remaining in `available` (they cannot form a complete path)

For the DFS: at each step, pick the ladder in `available` whose `startTier` matches the current frontier tier. Among multiple candidates, prefer the one with the largest `endTier - startTier` span (greedily extend upward as far as possible).

### Step 3d — Path record

```js
{
  ladders:      [ladder, ...],   // ordered chain, ground→roof
  totalLadders: number,
  directions:   Set<'N'|'S'|'E'|'W'>,  // unique facing directions across all ladders
  hasExternal:  bool,
  hasInternal:  bool,
}
```

---

## Phase 4 — Path selection

### Step 4a — Quota by building size

| Building size | Paths to select | Constraint on selection order |
|---|---|---|
| `ruins-small`, `small` | 1 | Random |
| `medium`, `ruins-medium-h`, `ruins-medium-v` | 2 | Last selected must have the most ladders (`totalLadders`) |
| `largeA`, `largeB` | 3 | Last 2 selected must have the most ladders (descending) |

> **Note:** No `ruins-large` size exists in the current codebase. If added later, treat as large.

If a building has fewer valid paths than its quota, select all available paths.

### Step 4b — Selection loop (per building)

Maintain a `placed` set (ladders already assigned to this building across all selected paths).

For each path selection:

1. Build the **candidate path list**: all discovered paths not yet selected
2. For the final 1 (medium) or final 2 (large) selections, filter to only paths with `totalLadders === max(totalLadders across remaining paths)`
3. Among the remaining candidates, prefer paths whose `directions` set contains at least one direction not yet in `placed`
4. Apply the **proximity constraint**: a candidate path is only valid if every ladder in it is ≥ 6 units (world distance) from every ladder in `placed`
5. Apply the **side limit constraint**: selecting this path must not push any single facing direction over 2 ladders total in `placed`
6. From the valid candidates, pick one at random (seeded RNG)
7. Add its ladders to `placed`; record the selected path
8. If no valid candidate passes all constraints, relax in this order:
   a. Relax direction-novelty preference (allow repeat directions)
   b. Relax proximity constraint
   c. Relax side limit
   d. If still none, skip this selection slot

### Step 4c — Output

For each building, collect all ladders from all selected paths. These are the **final placed ladders** — the only ones passed to geometry builders.

---

## Phase 5 — Output and geometry

### Step 5a — Output shape

```js
data.ladders = [
  {
    id:            string,
    buildingIndex: number,
    direction:     'N'|'S'|'E'|'W',
    isExternal:    bool,
    cx, cz,
    x, z,          // world position (left edge of ladder face)
    bottomY:       number,
    topY:          number,
    height:        number,
    startTier:     number,
    endTier:       number,
  },
  ...
]
```

### Step 5b — Visualiser

Each ladder renders as a flat 0.25"-thick rect against its building face:
- Position: world XZ of the trigger cell, offset 0 in the facing direction
- Width: 1 cell (1")
- Height: `ladder.height`
- Depth: 0.25"
- Colour: distinguish external (`#88aaff`) vs internal (`#ffaa44`)

### Step 5c — GLB / OBJ export

Controlled by existing config constants in `LADDER_DISPLAY`:
- `showBoxLadders`: emit simple box slab (debug/legacy)
- `showMeshLadders`: emit detailed pole + rung mesh (production)

Texture key: `ladder:${buildingIndex % ladderTextures.length}`

---

## Config additions

Add to the `CONNECTIVITY` block in `src/config.js` (or a new `LADDERS` block):

```js
export const LADDERS = {
  mapEdgeClearance:    5,   // units from map edge — no ladders within this distance
  connectionClearance: 4,   // units from any WALKWAY/DOOR cell
  buildingClearance:   4,   // units from another building's SHELL cells
  pathSpacing:         6,   // min world distance between ladders of different paths
  maxSideCount:        2,   // max ladders per facing direction per building
  fullHeightCullChance: 0.30, // chance to trim a full-height ladder
};
```

---

## Files to create / modify

| File | Change |
|---|---|
| `src/generators/ladders/generate-ladders.js` | **New** — full five-phase pipeline |
| `src/generators/ladders/index.js` | **New** — entry point, calls generate-ladders, returns `data.ladders` |
| `src/generators/geometry/build-ladder-primitive.js` | Update to consume new ladder record shape |
| `src/generators/geometry/build-geometry.js` | Wire in ladder primitives from `data.ladders` |
| `src/preview/debug-recorder.js` | Add ladder visualiser elements |
| `src/config.js` | Add `LADDERS` config block |
| `src/index.js` | Call `generateLadders` after `generateWalls` |
| `docs/architecture/collision_matrix.md` | No new cell values needed — ladders read but do not write |

---

## Pipeline position

```
generateGrid → generateBuildings → generateFloors → generateRoofs
  → generateConnectivity
  → generateWalls
  → generateLadders    ← reads FLOOR_*/IFLOOR_*/ROOF_*/IROOF_* from matrix; reads building.maxTier
  → export
```

---

## Resolved questions

| Question | Resolution |
|---|---|
| `building.maxTier` existence | ✅ Confirmed — field exists on all building records, used throughout floors/roofs pipeline |
| Internal ladder bottom at ground floor | Not applicable — no `IFLOOR_*` triggers exist at the ground floor level; internal triggers only appear at elevated tiers |
| Corner cell candidates | Emit one candidate per exposed direction — `FLOOR_NE` → 2 candidates (N and E), end cells → 3, island cells → 4 |
| `ruins-large` quota | No such size exists in the codebase — not applicable |

---

## Implementation status

| Step | Status |
|---|---|
| Phase 1 — Candidate scan | ✅ Done (culling became advisory) |
| Phase 2 — Column grouping + culling | ✅ Done (full-height cull dropped) |
| Phase 3 — Path discovery | ✅ Done (present but superseded by debug paths) |
| Phase 4 — Path selection | ✅ Done (present but superseded by debug paths) |
| Phase 5 — Output + geometry wiring | ✅ Done (via `ladderPaths` → `buildLadderPrimitive`) |
| Config additions | ✅ Done |
| Visualiser support | ✅ Done (cull colors + path kept/cut/door rects) |
