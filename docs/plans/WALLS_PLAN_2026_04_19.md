# Walls Sub-Plan

**Date:** 2026-04-19
**Parent plan:** PIPELINE_MIGRATION_PLAN_2026_04_19.md
**Depends on:** FLOORS_PLAN_2026_04_19.md (floors must be in collision matrix first)

---

## Wall thickness

- `wallThickness: 0.25"` — quarter-inch, confirmed.

---

## Algorithm overview

Two passes after floor generation:

1. **Direction pass** — label each FLOOR cell in the matrix with which direction(s) it faces outward
2. **Segment pass** — group labelled cells into contiguous runs, emit one wall rect per run

---

## Pass 1 — Direction labelling

Iterate the collision matrix at each known floor Y level (`yCollisionLevel` from the floor records).

For each cell where `matrix.getCell(cx, cy, cz) === CELL.FLOOR`:

### Cardinal checks (in priority order)

Check the four neighbours **at the same Y level**. A neighbour is "open" if it is not `CELL.FLOOR`.

| Condition | Label |
|---|---|
| North `(cx, cy, cz-1)` is open | `N` |
| South `(cx, cy, cz+1)` is open | `S` |
| East  `(cx+1, cy, cz)` is open | `E` |
| West  `(cx-1, cy, cz)` is open | `W` |

A cell can match multiple cardinal directions (outer corner). Apply checks **in N → S → E → W order**, writing over previous label — last match wins, so corner cells end up labelled by the final direction in sequence. This means NE outer corners become `E`, SE outer corners become `E`, SW corners become `W`, NW corners become `W`. (Consistent with "apply in sequence" rule.)

> **Alternative if needed:** keep the first match (break on first hit). Either is valid — pick one and stick to it. Recommended: **keep first match** so N/S take priority over E/W on outer corners, which keeps horizontal wall runs longer.

### Diagonal checks (internal concave corners)

After cardinal checks, for cells where **all four cardinals are FLOOR** (no cardinal wall found), check diagonals:

| Condition | Label |
|---|---|
| NE `(cx+1, cy, cz-1)` is open | `N` (priority: N before E) |
| NW `(cx-1, cy, cz-1)` is open | `N` |
| SE `(cx+1, cy, cz+1)` is open | `S` |
| SW `(cx-1, cy, cz+1)` is open | `S` |

This catches the inner concave corner of an L-shaped floor where all four cardinal neighbours are floor cells but the diagonal gap means a wall piece is required to close the corner.

### Write label to matrix

Add two new `CELL` constants to `matrix.js`:

| Constant | Value | Meaning |
|---|---|---|
| `CELL.WALL_N` | `10` | floor cell facing north |
| `CELL.WALL_S` | `11` | floor cell facing south |
| `CELL.WALL_E` | `12` | floor cell facing east |
| `CELL.WALL_W` | `13` | floor cell facing west |

Overwrite the cell's value in the matrix with its direction label. Unlabelled cells (interior, no open neighbour) remain `CELL.FLOOR`.

---

## Pass 2 — Segment grouping

After all cells are labelled, iterate the floor records again and collect walls.

### Grouping rules

For each direction, cells share one fixed axis value:

| Direction | Fixed axis | Sort axis | Wall runs along |
|---|---|---|---|
| N | `cz` (all at same Z face) | `cx` ascending | X axis |
| S | `cz` | `cx` ascending | X axis |
| E | `cx` (all at same X face) | `cz` ascending | Z axis |
| W | `cx` | `cz` ascending | Z axis |

1. Collect all cells labelled `WALL_N` at this floor's Y level
2. Group by fixed axis value (e.g. all `WALL_N` cells at `cz = 5`)
3. Within each group, sort by sort axis (`cx`)
4. Walk the sorted list — each contiguous run (no gap > 1 cell) becomes one wall segment
5. A wall segment's bounds = `min(sort axis)` to `max(sort axis) + 1` (the far edge of the last cell)

### Wall world position

Given a segment and its direction. Each wall's **outer face** is flush with the cell's edge in the facing direction; the wall body (0.25") extends inward.

```
t  = config.wallThickness   // 0.25"
s  = config.cellSize        // 1" (from GLOBAL_GRID)
wallY      = floor.yCollisionLevel + config.slabThickness   // top of slab
wallHeight = config.tierHeight                               // 3"

// Cell (cx, cz) world bounds: X ∈ [ox + cx*s, ox + (cx+1)*s],  Z ∈ [oz + cz*s, oz + (cz+1)*s]
// Outer face at cell edge; wall body extends inward by t.

N wall: outer face at Z = oz + cz*s     → z = oz + cz*s,           d = t,  x = ox + cx_min*s, w = runLength*s
S wall: outer face at Z = oz + (cz+1)*s → z = oz + (cz+1)*s - t,   d = t,  x = ox + cx_min*s, w = runLength*s
E wall: outer face at X = ox + (cx+1)*s → x = ox + (cx+1)*s - t,   w = t,  z = oz + cz_min*s, d = runLength*s
W wall: outer face at X = ox + cx*s     → x = ox + cx*s,            w = t,  z = oz + cz_min*s, d = runLength*s
```

### Write walls to collision matrix

After computing wall rects, write each wall into the matrix:
```js
matrix.fillBox(wall.x, wall.y, wall.z, wall.w, wall.h, wall.d, CELL.WALL)
```

`CELL.WALL = 2` already exists.

---

## Output contract

```js
{
  // all prior fields forwarded, plus:
  walls: [
    {
      direction: 'N' | 'S' | 'E' | 'W',
      buildingId: string,
      floorIndex: number,
      x: number, y: number, z: number,
      w: number, h: number, d: number,
    }
  ]
}
```

---

## New files

| File | Purpose |
|---|---|
| `src/generators/walls/index.js` | Entry point — calls both passes, returns `{ ...data, walls }` |
| `src/generators/walls/label-floor-cells.js` | Pass 1 — direction labelling |
| `src/generators/walls/extract-wall-segments.js` | Pass 2 — segment grouping and world-rect computation |

---

## Config additions

```js
// src/config.js
wallThickness: 0.25,  // wall slab depth (inches) — outer face flush with cell edge, body extends inward
```

---

## Collision matrix additions

Add to `CELL` in `matrix.js`:
```js
WALL_N: 10, WALL_S: 11, WALL_E: 12, WALL_W: 13
```

---

## Visualizer additions

- Add `WALL` (`value: 2`) to `CELL_TYPES` in the grid dropdown (`color: 0x88cc44`)
- Add directional labels as optional types (value 10–13) if fine-grained debug is needed
- Add stage 5 recorder entry — one element per wall, coloured by direction:
  - N = `#4488ff`, S = `#ff8844`, E = `#44ff88`, W = `#ff44cc`

---

## Execution order (Phase 1)

1. Add `wallThickness` to `config.js`
2. Add `WALL_N/S/E/W` constants to `matrix.js`
3. Implement `label-floor-cells.js`
4. Implement `extract-wall-segments.js`
5. Implement `walls/index.js` and wire into `src/index.js` after floors stage
6. Update visualizer grid dropdown to show WALL type
7. Add recorder capture for stage 5
8. Verify visually: walls appear on all four sides of floor plates, correct height and direction colouring

---

---

# Phase 2 — Wall Damage & Interior Walls

Port the damage and interior wall systems from `_old_system/walls/`. Depends on Phase 1 walls being verified end-to-end first.

---

## Phase 2a — Wall Damage

**Source:** `_old_system/walls/apply-wall-damage.js`, `_old_system/walls/merge-segments.js`

Each exterior wall segment generated in Phase 1 is subdivided into a column × 2-row quadrant grid. Quadrants are randomly removed (adjacency-spreading) to produce the ruined aesthetic.

### Algorithm (port directly, no structural changes needed)

1. `cols = Math.max(1, Math.round(wallLength / WALL.quadSize))` — column count
2. Each cell = `(wallLength / cols)` wide × `(wallHeight / 2)` tall
3. **Upper row** removal: pick a random start column, spread adjacently; remove up to `externalUpperRemovalRatio` of columns
4. **Lower row** removal: can only remove columns that are adjacent to an already-removed upper cell; remove up to `externalLowerRemovalRatio` of columns
5. Remaining cells → merge contiguous same-row runs back into rect segments (`merge-segments.js`)
6. Each output segment replaces the original wall entry

### Config additions

```js
// src/config.js  WALL constants block:
export const WALL = {
  quadSize: 1.5,                    // inches per damage column (old system value)
  externalUpperRemovalRatio: 0.7,   // max fraction of upper row removed on exterior walls
  externalLowerRemovalRatio: 0.5,   // max fraction of lower row removed on exterior walls
  internalUpperRemovalRatio: 0.6,   // interior walls
  internalLowerRemovalRatio: 0.3,
  interiorWallChance: { medium: 0.75, largeA: 1.0, largeB: 1.0 },
};
```

> Note: old system used a single `large` size; new system has `largeA` and `largeB` — both get `1.0` chance.

### New files

| File | Purpose |
|---|---|
| `src/generators/walls/apply-wall-damage.js` | Port from old system — quadrant subdivision + removal |
| `src/generators/walls/merge-segments.js` | Port from old system — merges contiguous wall segments |

### Integration

- Call `applyWallDamage(wallDef, rng, 'external')` on every wall segment produced by Phase 1 before pushing to the output array
- `walls/index.js` replaces the flat segment push with the damage-expanded list

---

## Phase 2b — Interior Walls

**Source:** `_old_system/walls/generate-interior-walls.js`

For medium and large buildings, place internal dividing walls through the centre of each floor room. Walls have a door gap and are also damage-processed.

### Eligibility

- Building `size` is `medium`, `largeA`, or `largeB`
- Per-floor random chance: `WALL.interiorWallChance[building.size]`
- Only place if the floor above (floorIndex + 1) exists and has ≥ 2 quadrants present

### Variants (port directly from old system)

| Variant | Description |
|---|---|
| `centreNS` | Wall from north edge midpoint, runs half-depth toward centre, with door gap |
| `centreSN` | Same from south edge midpoint |
| `centreEW` | From west edge midpoint, runs half-width toward centre, with door gap |
| `centreWE` | From east edge midpoint |
| `cross` | Two crossing walls through building centre (no door gap on cross variant) |

Weights from old system: `cross = 0.3`, each centre variant = `0.175`.

Door gap = `WALL.quadSize` (1.5") cut from the midpoint of each interior wall segment.

### Adaptation notes

- Old system used `data.buildingQuadrants[bi].tiers[tier+1]` to check quadrant count above. New system: find the floor record with `buildingIndex === bi && floorIndex === i + 1` and check `4 - floor.removedQuadrants.length >= 2`
- `pickInteriorVariant` selector is already in `src/generators/selectors/pickInteriorVariant.js` — uncomment its export in `selectors/index.js`
- Apply `applyWallDamage(def, rng, 'internal')` to each interior wall definition before pushing

### New files

| File | Purpose |
|---|---|
| `src/generators/walls/generate-interior-walls.js` | Port + adapt from old system |

---

## Phase 2 execution order

1. Port `merge-segments.js`
2. Port and adapt `apply-wall-damage.js`
3. Integrate damage into Phase 1 exterior walls — verify walls still appear correctly but now show ruined segments
4. Port and adapt `generate-interior-walls.js`
5. Wire interior walls into `walls/index.js`
6. Re-enable `pickInteriorVariant` export in `selectors/index.js`
7. Verify visually: interior walls appear in medium/large buildings, damage applied to both exterior and interior
