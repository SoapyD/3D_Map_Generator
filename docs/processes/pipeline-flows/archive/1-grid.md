# Stage 1: Grid Partitioning

> Last verified: 2026-04-18

## Overview

Divides the play area into a 2D grid of city blocks separated by streets. Uses Binary Space Partitioning (BSP) to produce irregular block sizes that avoid a regular checkerboard appearance. The output is the foundation every subsequent stage builds on.

## Input Contract

```js
{
  seed: number,           // RNG seed (passed through from CLI)
  mapWidth: number,       // Map width in inches (default 48)
  mapDepth: number,       // Map depth in inches (default 48)
  streetWidth: number,    // Minimum street width in inches (default 3.5)
  rng: RNG,              // Seeded RNG instance
}
```

## Algorithm

1. Initialise a seeded RNG from the seed value
2. Start with a single rectangle covering the full map area
3. Recursively split the rectangle using BSP:
   - Choose a split axis (alternating horizontal/vertical, or choose by longest dimension)
   - Choose a split position within the rectangle, biased toward the centre (not a pure random position — prevents extremely thin blocks)
   - Recurse on both halves until blocks reach a minimum size threshold
4. After BSP, carve streets between all adjacent blocks:
   - Streets are carved from the shared edge inward by `streetWidth / 2` on each side
   - This produces street corridors of at least `streetWidth` width
5. Tag some blocks as open plazas (no buildings): blocks below a size threshold or selected randomly (~15% of blocks)
6. Return the final list of block rectangles and the street network

## Output Contract

```js
{
  blocks: [
    {
      x: number, z: number,        // block origin (inches)
      width: number, depth: number, // block dimensions (inches)
      isPlaza: boolean,            // true = open area, no buildings placed
    }
  ],
  streets: [
    {
      x: number, z: number,
      width: number, depth: number, // street corridor rectangle
    }
  ],
  rng: RNG,   // same RNG instance, advanced past this stage's calls
}
```

## Key Files

- `src/generators/grid.js` — BSP split logic and street carving
- `src/generators/bsp-split.js` — recursive BSP implementation
- `src/generators/extract-streets.js` — derives street rectangles from block adjacency
- `src/core/rng.js` — seeded RNG utility

## Edge Cases & Constraints

- Minimum block size is enforced to prevent blocks too small for any building
- Street carving must not reduce a block to zero width — the minimum block size implicitly prevents this
- On very small maps (< 24" square), BSP depth is reduced to avoid over-partitioning

## Testing Notes

- Tests verify block coverage: total block area + street area ≈ map area (±small rounding)
- Tests verify no block overlaps with any other block
- Seed 42 is the regression anchor — block count and approximate dimensions are snapshot-tested
