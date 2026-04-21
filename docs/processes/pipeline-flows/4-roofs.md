# Stage 4: Roof Slab Generation

> Last verified: 2026-04-21

## Overview

Consumes `data.roofSlabs` (the topmost slab per building, pre-computed with quadrant damage by Stage 3). Writes each rect as `CELL.ROOF`, then runs a direction-labelling pass to produce `ROOF_N/S/E/W` on exposed exterior edges and `IROOF_*` on interior edges (edges facing a `CELL.SHELL` neighbour — i.e. the face of a damaged quadrant). `roofSlabs` is dropped from the output; downstream stages see only `data.roofs`.

## Input Contract

```js
data: {
  roofSlabs: [{ buildingId, buildingIndex, floorIndex, yCollisionLevel, rects, removedQuadrants }],
  // all prior fields carried forward
}
config: {
  slabThickness: number,
}
matrix: CollisionMatrix
```

## Algorithm

1. For each slab in `data.roofSlabs`:
   - `matrix.setWriteContext(STAGE.ROOFS, roofs.length)`
   - Write each rect: `matrix.fillBox(rect.x, slab.yCollisionLevel, rect.z, rect.w, slabThickness, rect.d, CELL.ROOF)`.
   - Push a roof record to `roofs[]` (same shape as the slab, minus the raw slab fields).
2. Call `labelRoofCells(roofData, matrix)`:
   - Scans all roof-level Y values.
   - Overwrites `CELL.ROOF` cells with directional labels wherever an edge is exposed:
     - Exterior (neighbour is `CELL.EMPTY`): `ROOF_N/S/E/W` (41–44), `ROOF_NE/NW/SE/SW` (45–48)
     - Interior (neighbour is `CELL.SHELL`): `IROOF_N/S/E/W` (91–94), corners (95–98), ends (100–103), island (104)
3. Drop `roofSlabs` from the output object.

## Output Contract

```js
{
  // all prior fields carried forward (roofSlabs removed), plus:
  roofs: [
    {
      buildingId: string,
      buildingIndex: number,
      yCollisionLevel: number,   // Y of the roof slab in the collision matrix
      rects: [{ x, z, w, d }],  // present-quadrant rect decomposition (same damage as top interior floor)
      removedQuadrants: number[],
    }
  ],
}
```

## Key Files

- [src/generators/roofs/index.js](../../../../src/generators/roofs/index.js) — entry; writes CELL.ROOF, pushes roof records, calls label pass, drops roofSlabs
- [src/generators/roofs/label-roof-cells.js](../../../../src/generators/roofs/label-roof-cells.js) — directional label pass for ROOF_* and IROOF_* values

## Edge Cases & Constraints

- Roof damage matches the topmost interior floor — there is no separate damage roll for the roof tier.
- `IROOF_*` labels are essential for the Connectivity stage: they let anchor emission fire from rooftop edges that face into a damaged quadrant, enabling walkways between raised surfaces.
- The label pass must run after all roof slabs are written, so edge checks are accurate across adjacent buildings.
