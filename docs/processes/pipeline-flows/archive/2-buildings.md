# Stage 2: Building Footprints

> Last verified: 2026-04-18

## Overview

Places rectangular building footprints within each city block. Each building is assigned a tier height (how many floors it will have). Plaza blocks are skipped. The output is an abstract layout — no geometry yet, just rectangles and metadata.

## Input Contract

```js
{
  blocks: Block[],         // from Stage 1
  streets: Street[],       // from Stage 1
  tiers: number,           // max tier count (default 4)
  rng: RNG,
}
```

## Algorithm

1. For each non-plaza block:
   a. Determine how many buildings fit: 1-3, weighted by block size
   b. Subdivide the block into building slots, leaving alleyway gaps between them (minimum 1" gap)
   c. For each slot, create an axis-aligned rectangular footprint
   d. Optionally combine two adjacent rectangles into an L-shape or T-shape (simple union, not a complex polygon)
2. Assign a height tier to each building:
   - Taller buildings are biased toward map centre (optional, controlled by config)
   - Heights range from 1 to `config.tiers`
   - Distribution is weighted: more 1-2 tier buildings than 3-4 tier buildings
3. Tag each building with a `damage` factor (0-1), sampled per-building from the RNG, used later by the floor and wall stages

## Output Contract

```js
{
  // all Stage 1 output fields carried forward, plus:
  buildings: [
    {
      id: string,             // unique building ID
      blockId: number,        // index of the parent block
      footprint: {            // bounding rectangle
        x: number, z: number,
        width: number, depth: number,
      },
      shape: Rect[],          // 1-2 rects (for L/T shapes)
      maxTier: number,        // highest tier this building reaches (1-indexed)
      damage: number,         // 0-1 damage factor
    }
  ],
}
```

## Key Files

- `src/generators/buildings/index.js` — public entry, iterates blocks
- `src/generators/buildings/place-footprints.js` — subdivides a block into building slots
- `src/generators/buildings/assign-heights.js` — tier and damage assignment
- `src/generators/building-lookup/` — helper index for querying buildings by block or position
- `src/generators/selectors/` — shared selector functions (e.g., buildings at a given tier)

## Edge Cases & Constraints

- Very small blocks (below a threshold) get 0 buildings — they become open ground, not plazas
- L/T shapes are only generated when there is space; the second rectangle is not forced
- `damage` is stored here but not applied until Stages 3-4 — storing it here ensures floors and walls use the same per-building damage factor

## Testing Notes

- Tests verify all building footprints are within their parent block bounds
- Tests verify no two buildings within the same block overlap (alleyway gaps are preserved)
- Tests verify all `maxTier` values are within [1, config.tiers]
