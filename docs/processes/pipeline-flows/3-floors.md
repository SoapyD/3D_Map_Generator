# Stage 3: Floor Plate Generation

> Last verified: 2026-04-21

## Overview

Generates interior floor slabs for every building at every tier. Quadrant-based damage escalates upward — higher floors lose more area, biased by `damageLevel`. The topmost slab per building is withheld from the matrix write and passed to the Roofs stage as `roofSlabs`. After all slabs are written, a label pass stamps directional values (`FLOOR_N/S/E/W` and variants) onto exposed-edge cells.

## Input Contract

```js
data: {
  buildings: Building[],   // from Stage 2
  // all prior fields carried forward
}
config: {
  tierHeight: number,
  slabThickness: number,
  damageLevel: number,     // 0–1; influences quadrant removal probability
}
rng: RNG
matrix: CollisionMatrix
```

## Algorithm

**Per building (`processBuildingFloors`):**

Each building has `maxTier` levels (index 0 = ground, index `maxTier-1` = roof). A `removed` set tracks which quadrants (0–3, NW/NE/SW/SE) have been removed.

For each tier level `i`:
1. If the building is **not** ruins:
   - If no quadrants removed: occasionally escalate by removing one quadrant (`maxIntactFloors` cap + `tier1EscalateChance`).
   - If 1 quadrant removed: roll `tier2EscalateChance` to remove an adjacent quadrant.
   - If 2 quadrants removed: roll `tier3EscalateChance` to remove an adjacent quadrant.
2. Compute `present` quadrants = `{0,1,2,3}` minus `removed`.
3. Decompose the building footprint into rects given the present quadrants:
   - `ruins-small`: single-quadrant decomposition via `ruinsToSections`.
   - Other ruins: full building rect (no quadrant damage).
   - Normal buildings: `quadrantsToSections` maps present quadrants → rect list.
4. Compute `yCollisionLevel = i * (tierHeight + slabThickness) - slabThickness`.
5. Push a floor record. If this is the **last** tier (`floorIndex === maxTier - 1`), push to `roofSlabs` instead of `floors`.

**Writing to matrix:**
- Interior floors only: `matrix.setWriteContext(STAGE.FLOORS, floors.length)` then `matrix.fillBox(rect.x, yCollisionLevel, rect.z, rect.w, slabThickness, rect.d, CELL.FLOOR)`.
- Roof slabs are **not** written here.

**Label pass (`labelFloorCells`):**
- Scans all floor-level Y values in the matrix.
- Overwrites `CELL.FLOOR` cells that have an exposed edge (neighbour is `CELL.EMPTY` or `CELL.SHELL`) with the appropriate directional constant:
  - Cardinal: `FLOOR_N/S/E/W` (10–13)
  - Corner: `FLOOR_NE/NW/SE/SW` (14–17)
  - End: `FLOOR_END_N/S/E/W` (30–33)
  - Island: `FLOOR_ISLAND` (34)
  - Interior variants (`IFLOOR_*` 60–74) — used when the neighbour is `CELL.SHELL` (edge faces into a damaged quadrant).

## Output Contract

```js
{
  // all prior fields carried forward, plus:
  floors: [
    {
      buildingId: string,       // e.g. 'b3'
      buildingIndex: number,
      floorIndex: number,       // 0 = ground, maxTier-2 = highest interior
      yCollisionLevel: number,  // Y position of slab in collision matrix
      rects: [{ x, z, w, d }], // present quadrant decomposition
      removedQuadrants: number[],
      materialKey: 'stone_floor',
    }
  ],
  roofSlabs: [                  // same shape as floors[], index = maxTier-1 per building
    { buildingId, buildingIndex, floorIndex, yCollisionLevel, rects, removedQuadrants }
  ],
}
```

## Key Files

- [src/generators/floors/index.js](../../../../src/generators/floors/index.js) — entry; iterates buildings, separates floors from roofSlabs, calls label pass
- [src/generators/floors/process-building-floors.js](../../../../src/generators/floors/process-building-floors.js) — per-building damage escalation and rect decomposition
- [src/generators/floors/quadrants-to-sections.js](../../../../src/generators/floors/quadrants-to-sections.js) — maps present quadrant set → rect list
- [src/generators/floors/ruins-small-to-sections.js](../../../../src/generators/floors/ruins-small-to-sections.js) — ruins-small subdivision
- [src/generators/floors/label-floor-cells.js](../../../../src/generators/floors/label-floor-cells.js) — directional label pass

## Edge Cases & Constraints

- Damage escalation is stochastic but always upward — lower tiers can never have more damage than higher tiers.
- `ruins-small` and `ruins-medium-*` buildings skip the quadrant escalation logic; ruins-small gets a fixed sub-footprint decomposition.
- The label pass must run after all buildings' floors are written, so cross-building adjacency is resolved correctly.
- `roofSlabs` uses the same damage state as the highest interior floor — no separate damage roll for the roof tier.
