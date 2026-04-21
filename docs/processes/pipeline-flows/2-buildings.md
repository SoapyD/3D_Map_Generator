# Stage 2: Building Placement

> Last verified: 2026-04-21

## Overview

Fills each city block with building footprints using a treemap algorithm. Buildings are snapped to the BBD grid and come in four size classes. Each building gets a `maxTier` (random height). Building shells are written into the collision matrix as `CELL.SHELL`.

## Input Contract

```js
data: {
  blocks: [{ x, z, w, d }],       // from Stage 1
  streetBounds: [...],
  activeArea: { x, z, w, d },
}
config: {
  tiers: number,          // maximum tiers for any building
  tierHeight: number,
  slabThickness: number,
}
rng: RNG
matrix: CollisionMatrix
```

## Algorithm

1. `treemapBuildings(blocks, rng, tiers)` — for each block, recursively subdivide its area into building footprints:
   - Buildings are sized as multiples of BBD: `small` (2×2), `ruins-small` (1×1), `ruins-medium-h` (2×1), `ruins-medium-v` (1×2), `largeA` (2×3), `largeB` (3×2).
   - Each building is assigned a random `maxTier` between 1 and `config.tiers`.
   - Buildings are packed into the block with no gaps (treemap fill).
2. For each placed building, write its shell into the collision matrix:
   - `matrix.setWriteContext(STAGE.BUILDINGS, buildingIndex)`
   - `matrix.fillBox(b.x, -slabThickness, b.z, b.w, b.maxTier * levelHeight - tierHeight, b.d, CELL.SHELL)`
   - Shells start at `Y = -slabThickness` so walls can begin at `Y = 0`.

## Output Contract

```js
{
  // all Stage 1 fields carried forward, plus:
  buildings: [
    {
      x, z,           // world origin (inches)
      w, d,           // footprint dimensions (inches, multiples of BBD)
      maxTier,        // number of tiers (1-indexed)
      size,           // 'small' | 'ruins-small' | 'ruins-medium-h' | 'ruins-medium-v' | 'largeA' | 'largeB'
      blockIndex,     // index into blocks[]
    }
  ],
}
```

## Key Files

- [src/generators/buildings/generateBuildings.js](../../../../src/generators/buildings/generateBuildings.js) — entry point; calls treemap, writes shells
- [src/generators/buildings/treemap-buildings.js](../../../../src/generators/buildings/treemap-buildings.js) — treemap subdivision algorithm
- [src/generators/buildings/building-sizes.js](../../../../src/generators/buildings/building-sizes.js) — size class definitions
- [src/generators/buildings/foundation-grid.js](../../../../src/generators/buildings/foundation-grid.js) — BBD grid snap helpers

## Edge Cases & Constraints

- Shell height is `maxTier * levelHeight - tierHeight` — this stops the shell below the roof slab, which is written by the Roofs stage.
- `ruins-small` buildings (1×1 BBD) are very small; they get a different floor decomposition in Stage 3.
- The treemap guarantees full block coverage with no overlapping footprints.
