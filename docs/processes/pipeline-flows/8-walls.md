# Stage 8: Wall Generation

> Last verified: 2026-04-23

## Overview

Derives wall geometry from floor-edge labels in the collision matrix. Each exposed floor edge becomes a wall segment that is subdivided, optionally damaged, optionally windowed, then merged back into the fewest rectangles. Merged segments are written to the matrix as `CELL.WALL_N/S/E/W`, skipping any cells already marked `CELL.DOOR`. Runs after Connectivity so door markers are already present.

## Input Contract

```js
data: {
  floors: FloorRecord[],
  buildings: Building[],
  connections: { candidates, doors, ... },   // from Stage 5 (Connectivity)
  // all prior fields carried forward
}
config: {
  tierHeight: number,
  slabThickness: number,
  damageLevel: number,
}
rng: RNG
matrix: CollisionMatrix
// WALL config flags: applySegmentCull, applyBlobDamage, applyWindows
```

## Algorithm

**1. Extract wall segments (`extractWallSegments`)**

Reads the matrix and the `floors[]` data to derive raw wall candidates. For each floor slab's exposed-edge cells (labelled `FLOOR_N/S/E/W` etc.), a wall segment is produced: a box starting at `Y = floor.yCollisionLevel + slabThickness` and rising for `tierHeight` cells, facing the exposed direction.

**2. Optional: cull to max sides (`cullToMaxSides`)** — controlled by `WALL.applySegmentCull`

For each `(buildingIndex, floorY)` pair, collect the set of wall directions present. The maximum number of directions kept depends on building type:
- Ruin buildings (`ruins-*`): keep at most **2** directions.
- All others: keep at most **3** directions.

When culling is required:
- `ruins-medium-h`: keep one long-axis direction (N or S) and one short-axis direction (E or W), chosen by `rng.pick`.
- All others: pick directions at random up to the applicable maximum.

This produces the ruined look — ruin buildings have walls on at most 2 sides; standard buildings on at most 3.

**3. Build window plans (`buildWindowPlans`)**

Per building, produce a window placement plan for N-S walls and a separate plan for E-W walls. The plan is seeded by the RNG and controls where window openings appear during subdivision.

**4. Per-wall pipeline**

For each surviving wall segment:

a. `subdivideWall(wall)` — divides the wall rectangle into a 2D grid of cells (each cell = 1 inch wide × 1 inch tall).

b. `applyBlobDamage(grid, rng)` — if `WALL.applyBlobDamage`, randomly zeros out contiguous blobs of cells to simulate crumbling sections.

c. `applyWindowPlan(grid, wall, plan, building)` — if `WALL.applyWindows`, punches window openings according to the building's plan.

d. `mergeWallCells(grid, wall)` — run-length merges adjacent solid cells into the fewest axis-aligned boxes.

**5. Write to matrix**

For each merged segment:
- `matrix.setWriteContext(STAGE.WALLS, walls.length)`
- `matrix.fillBoxUnless(seg.x, seg.y, seg.z, seg.w, seg.h, seg.d, WALL_CELL[direction], CELL.DOOR)` — skips cells marked as door openings.

Internal walls (from `extractWallSegments`) are written separately with `CELL.INTERNAL_WALL_N/S/E/W` (80–83) and stored in `internalWalls[]`.

## Output Contract

```js
{
  // all prior fields carried forward, plus:
  walls: [
    {
      x, y, z,          // world origin
      w, h, d,          // dimensions
      direction: 'N'|'S'|'E'|'W',
      floorY: number,   // Y of the floor slab this wall sits on
    }
  ],
  internalWalls: [      // same shape; walls facing into a shell interior
    { x, y, z, w, h, d, direction, floorY }
  ],
}
```

## Key Files

- [src/generators/walls/index.js](../../../../src/generators/walls/index.js) — entry; orchestrates extraction, culling, windowing, per-wall pipeline, matrix writes
- [src/generators/walls/extract-wall-segments.js](../../../../src/generators/walls/extract-wall-segments.js) — derives raw wall boxes from floor-edge labels
- [src/generators/walls/subdivide-wall.js](../../../../src/generators/walls/subdivide-wall.js) — divides a wall rect into a per-cell grid
- [src/generators/walls/apply-blob-damage.js](../../../../src/generators/walls/apply-blob-damage.js) — stochastic blob-damage pass
- [src/generators/walls/place-windows.js](../../../../src/generators/walls/place-windows.js) — window plan generation and application
- [src/generators/walls/merge-wall-cells.js](../../../../src/generators/walls/merge-wall-cells.js) — run-length merge of solid cells back to boxes

## Edge Cases & Constraints

- `fillBoxUnless(..., CELL.DOOR)` is the mechanism by which door openings carved in Stage 5 survive wall generation — no cell already marked `CELL.DOOR` is overwritten.
- Wall generator runs **after** Ladders and Connectivity (`src/index.js` pipeline order). If the order is reversed, door markers won't exist yet and openings will be filled in.
- `cullToMaxSides` is only applied when `WALL.applySegmentCull` is true. With it off, all four sides get walls.
- Internal walls are written at `CELL.INTERNAL_WALL_*` (80–83) — these are marker values only; geometry is still generated from them.
