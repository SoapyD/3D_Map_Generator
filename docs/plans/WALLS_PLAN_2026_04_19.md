# Walls Sub-Plan

**Created:** 2026-04-19  
**Last updated:** 2026-04-20  
**Parent plan:** PIPELINE_MIGRATION_PLAN_2026_04_19.md  
**Depends on:** FLOORS_PLAN_2026_04_19.md

---

# Phase 1 — Exterior Wall Generation

**Status:** ✅ Complete

---

## Wall thickness

`wallThickness: 0.25"` — outer face flush with cell edge, body extends inward.

---

## Implementation summary

### Pass 1 — Direction labelling ✅

**File:** `src/generators/floors/label-floor-cells.js` (moved to floors stage — runs at end of `generateFloors`)

Uses shared utility `src/generators/utils/label-cells.js`.

For each FLOOR cell at a known slab Y level, counts exposed cardinal edges and assigns a label. Precedence (highest first):

| Count | Label assigned |
|---|---|
| 4 exposed | `CELL.FLOOR_ISLAND` |
| 3 exposed | `CELL.FLOOR_END_N/S/E/W` (named by the one connected face) |
| 2 exposed, right-angle pair | `CELL.FLOOR_NE/NW/SE/SW` |
| 1 exposed | `CELL.FLOOR_N/S/E/W` |
| 0 exposed | stays `CELL.FLOOR` (interior cell) |

**Divergence from original plan:**
- Diagonal checks (internal concave corner logic) were removed — not needed in practice.
- Corner types `FLOOR_NE/NW/SE/SW` (values 14–17) were added beyond the original `N/S/E/W` set.
- End types `FLOOR_END_N/S/E/W` (values 30–33) and `FLOOR_ISLAND` (34) were added for 3- and 4-exposed-edge cells.
- Internal corner walls were explicitly removed (diagonal check pass dropped).

### Pass 2 — Segment grouping ✅

**File:** `src/generators/walls/extract-wall-segments.js`

Each direction (N/S/E/W) collects its own label set plus both corner types that include it:

| Direction | Floor labels collected |
|---|---|
| N | `FLOOR_N`, `FLOOR_NE`, `FLOOR_NW` |
| S | `FLOOR_S`, `FLOOR_SE`, `FLOOR_SW` |
| E | `FLOOR_E`, `FLOOR_NE`, `FLOOR_SE` |
| W | `FLOOR_W`, `FLOOR_NW`, `FLOOR_SW` |

Contiguous runs along the shared axis are grouped into single wall rects.

**Corner truncation:** N/S walls are trimmed by `wallThickness` at each end where an E/W wall meets them, preventing 0.25"×0.25" corner overlaps. E/W walls run full length.

**End and island cells** are handled in a separate per-cell pass after the main direction loop. N/S faces on end/island cells are trimmed where E/W faces co-exist on the same cell.

### Wall world position

```
t  = wallThickness (0.25")
s  = cellSize (1")
wallY      = floor.yCollisionLevel + slabThickness   // top of slab
wallHeight = tierHeight                               // 3"

N: z = oz + cz*s,           d = t,  x = ox + run_start*s,     w = runLength*s
S: z = oz + (cz+1)*s - t,   d = t,  x = ox + run_start*s,     w = runLength*s
E: x = ox + (cx+1)*s - t,   w = t,  z = oz + run_start*s,     d = runLength*s
W: x = ox + cx*s,            w = t,  z = oz + run_start*s,     d = runLength*s
```

Walls are also written into the collision matrix as `CELL.WALL_N/S/E/W` (values 20–23).  
Walls are **never placed above roof slabs** — the wall stage only reads `data.floors`, not `data.roofs`.

---

## Files produced

| File | Purpose |
|---|---|
| `src/generators/walls/index.js` | Entry point — calls segment extraction, returns `{ ...data, walls }` |
| `src/generators/walls/extract-wall-segments.js` | Pass 2 — grouping, truncation, end/island handling |

*(Pass 1 labelling moved to `src/generators/floors/label-floor-cells.js`)*

---

## Output contract

```js
{
  walls: [
    {
      direction: 'N' | 'S' | 'E' | 'W',
      floorY: number,
      x, y, z,   // world position (y = top of slab)
      w, h, d,   // width, height (tierHeight), depth
    }
  ]
}
```

---

---

# Phase 1 Correction — Internal Wall Detection

**Status:** ⬜ Not started  
**Priority:** Must be done before Phase 2 — affects what gets damaged

---

## Problem

The current wall generation emits an exterior wall for every labelled floor edge cell (FLOOR_N/S/E/W etc.) regardless of what occupies the cell on the other side of that exposed face. This is wrong: a floor slab damaged by quadrant removal leaves exposed edges that face **into** the building shell volume, not outside it. Generating walls there would wall off an open interior void.

**Rule:** A labelled floor edge cell whose exposed face neighbour is `CELL.SHELL` is an *internal wall face* — the edge is inside the building. Its neighbour being `CELL.EMPTY` (or out-of-bounds) means the edge faces outside — an *exterior wall face*.

---

## New collision cell constants

Add to `CELL` in `src/generators/collision/matrix.js`:

**Internal floor edge labels** — written by the labelling pass in place of the exterior variants when the exposed face neighbour is `CELL.SHELL`:

| Value | Constant | Meaning |
|---|---|---|
| `60` | `CELL.IFLOOR_N`  | Interior-facing floor edge, north exposed |
| `61` | `CELL.IFLOOR_S`  | Interior-facing floor edge, south exposed |
| `62` | `CELL.IFLOOR_E`  | Interior-facing floor edge, east exposed |
| `63` | `CELL.IFLOOR_W`  | Interior-facing floor edge, west exposed |
| `64` | `CELL.IFLOOR_NE` | Interior corner, north+east exposed |
| `65` | `CELL.IFLOOR_NW` | Interior corner, north+west exposed |
| `66` | `CELL.IFLOOR_SE` | Interior corner, south+east exposed |
| `67` | `CELL.IFLOOR_SW` | Interior corner, south+west exposed |
| `70` | `CELL.IFLOOR_END_N` | Interior end cell, south+east+west exposed |
| `71` | `CELL.IFLOOR_END_S` | Interior end cell, north+east+west exposed |
| `72` | `CELL.IFLOOR_END_E` | Interior end cell, north+south+west exposed |
| `73` | `CELL.IFLOOR_END_W` | Interior end cell, north+south+east exposed |
| `74` | `CELL.IFLOOR_ISLAND` | Interior island, all four edges exposed |

**Internal wall markers** — written by wall generation at the wall's world position (not the floor cell):

| Value | Constant | Meaning |
|---|---|---|
| `80` | `CELL.INTERNAL_WALL_N` | Internal wall face, north-facing — logged, no geometry |
| `81` | `CELL.INTERNAL_WALL_S` | Internal wall face, south-facing |
| `82` | `CELL.INTERNAL_WALL_E` | Internal wall face, east-facing |
| `83` | `CELL.INTERNAL_WALL_W` | Internal wall face, west-facing |

---

## Mixed-face cells

A floor cell at the exact intersection of a damage edge and the building perimeter may have some exposed faces pointing to `CELL.EMPTY` (exterior) and some pointing to `CELL.SHELL` (interior). Since each matrix cell stores a single byte, these cannot be fully encoded in one label.

**Convention:** a cell with mixed exposures keeps its **exterior** label (existing FLOOR_N/NE/etc.), because exterior wall generation takes precedence. The wall generator performs a per-face neighbour check on all labelled cells, so internal faces on externally-labelled cells are still caught and routed to `internalWalls`. Future stages that need internal floor edges on mixed cells must also do the per-face check rather than relying on the IFLOOR labels alone.

In practice mixed cells are rare — they occur only where a damaged quadrant corner aligns with the building perimeter.

---

## Changes required

### 1 — `src/generators/floors/label-floor-cells.js`

The label assigned to each exposed-edge floor cell must now depend on what occupies the neighbour in each exposed direction, not just whether the neighbour is a floor cell.

**For single-direction cells (currently FLOOR_N/S/E/W):**
- Check the neighbour in the exposed direction at slab level (same Y, ±1 in X or Z).
- Neighbour is `CELL.SHELL` → assign `CELL.IFLOOR_N/S/E/W`.
- Neighbour is `CELL.EMPTY` or out-of-bounds → assign existing `CELL.FLOOR_N/S/E/W`.

**For corner cells (FLOOR_NE/NW/SE/SW):**
- Check both exposed neighbours.
- Both SHELL → assign `CELL.IFLOOR_NE/NW/SE/SW`.
- Both EMPTY/OOB → assign `CELL.FLOOR_NE/NW/SE/SW`.
- Mixed → keep exterior label `CELL.FLOOR_NE/NW/SE/SW` (see mixed-face convention above).

**For end cells (FLOOR_END_*) and FLOOR_ISLAND:**
- Check all exposed neighbours (3 or 4).
- All SHELL → assign the matching `CELL.IFLOOR_END_*` / `CELL.IFLOOR_ISLAND`.
- Any EMPTY/OOB → keep exterior label.

### 2 — `src/generators/walls/extract-wall-segments.js`

- The direction scan sets and END/ISLAND pass must **exclude all IFLOOR labels** — they are not sources for exterior wall generation.
- Add a parallel scan over `IFLOOR` label sets (same grouping/run logic as the exterior pass) that pushes candidates to `internalWalls` and writes `CELL.INTERNAL_WALL_*` to the matrix. No geometry is emitted.
- Mixed-face cells carry exterior labels, so the exterior pass will pick them up. For each candidate in the exterior pass, additionally check the per-face neighbour: if `CELL.SHELL` → route that face to `internalWalls` instead of `walls`. This catches the rare mixed case.

### 3 — `src/generators/walls/index.js`

Return `internalWalls` alongside `walls`:

```js
export function generateWalls(data, config, rng, matrix) {
  const { walls, internalWalls } = extractWallSegments(data, config, matrix);
  return { ...data, walls, internalWalls };
}
```

### 4 — Output contract (updated)

```js
{
  walls: [
    { direction, floorY, x, y, z, w, h, d }  // exterior only — geometry generated
  ],
  internalWalls: [
    { direction, floorY, x, y, z, w, h, d }  // interior facing — logged, no geometry yet
  ]
}
```

### 5 — `src/preview/debug-recorder.js`

`wallElements` renders only `data.walls`. No change needed for now — `internalWalls` is ignored by the recorder until geometry is planned. Add a TODO comment.

---

## Execution order

1. Add `CELL.IFLOOR_*` and `CELL.INTERNAL_WALL_*` constants to `matrix.js`
2. Update `label-floor-cells.js` to assign internal labels where neighbour is SHELL
3. Update `extractWallSegments` to exclude IFLOOR labels from exterior pass, add internal pass
4. Update `walls/index.js` to return both arrays
5. Update `docs/architecture/collision_matrix.md`

---

# Phase 2 — Wall Damage & Interior Walls

**Status:** ⬜ Not started

---

## Phase 2a — Wall Damage

**Source:** `_old_system/walls/apply-wall-damage.js`, `_old_system/walls/merge-segments.js`

Each exterior wall segment is subdivided into a column × 2-row quadrant grid. Quadrants are randomly removed (adjacency-spreading) to produce the ruined aesthetic.

### Algorithm (port directly)

1. `cols = Math.max(1, Math.round(wallLength / WALL.quadSize))`
2. Each cell = `(wallLength / cols)` wide × `(wallHeight / 2)` tall
3. **Upper row** removal: random start column, spread adjacently; remove up to `externalUpperRemovalRatio` of columns
4. **Lower row** removal: only remove columns adjacent to an already-removed upper cell; remove up to `externalLowerRemovalRatio`
5. Merge contiguous same-row runs back into rect segments (`merge-segments.js`)
6. Output segments replace the original wall entry

### Config (already in `src/config.js`)

```js
export const WALL = {
  wallThickness: 0.25,
  quadSize: 1.5,
  externalUpperRemovalRatio: 0.7,
  externalLowerRemovalRatio: 0.5,
  internalUpperRemovalRatio: 0.6,
  internalLowerRemovalRatio: 0.3,
  interiorWallChance: { medium: 0.75, largeA: 1.0, largeB: 1.0 },
};
```

### New files

| File | Purpose |
|---|---|
| `src/generators/walls/apply-wall-damage.js` | Port — quadrant subdivision + removal |
| `src/generators/walls/merge-segments.js` | Port — merges contiguous wall segments |

---

## Phase 2b — Interior Walls

**Source:** `_old_system/walls/generate-interior-walls.js`

For medium and large buildings, place internal dividing walls through the centre of each floor room.

### Eligibility

- Building `size` is `medium`, `largeA`, or `largeB`
- Per-floor random chance: `WALL.interiorWallChance[building.size]`
- Only place if the floor above (`floorIndex + 1`) exists and has ≥ 2 quadrants present

### Variants (port directly)

| Variant | Description |
|---|---|
| `centreNS` | Wall from north edge midpoint, runs half-depth toward centre, with door gap |
| `centreSN` | Same from south edge midpoint |
| `centreEW` | From west edge midpoint, runs half-width toward centre, with door gap |
| `centreWE` | From east edge midpoint |
| `cross` | Two crossing walls through building centre |

Weights: `cross = 0.3`, each centre variant = `0.175`. Door gap = `WALL.quadSize` (1.5").

### Adaptation notes

- Old system used `data.buildingQuadrants[bi].tiers[tier+1]`. New system: find `floors` where `buildingIndex === bi && floorIndex === i + 1`, check `4 - floor.removedQuadrants.length >= 2`.
- `pickInteriorVariant` is in `src/generators/selectors/pickInteriorVariant.js` — re-enable its export in `selectors/index.js`.
- Apply `applyWallDamage(def, rng, 'internal')` to each interior wall before pushing.

### New files

| File | Purpose |
|---|---|
| `src/generators/walls/generate-interior-walls.js` | Port + adapt from old system |

---

## Phase 2 execution order

1. Port `merge-segments.js`
2. Port and adapt `apply-wall-damage.js`
3. Integrate damage into Phase 1 exterior walls
4. Port and adapt `generate-interior-walls.js`
5. Wire interior walls into `walls/index.js`
6. Re-enable `pickInteriorVariant` export in `selectors/index.js`
7. Verify visually: interior walls appear in medium/large buildings, damage on both exterior and interior
