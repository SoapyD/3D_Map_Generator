# Stage 4: Wall Generation

> Last verified: 2026-04-18

## Overview

Places vertical wall slabs along the outer edges of each floor plate. Applies damage in the form of doorways, window openings, and broken/missing wall sections. The walls give buildings their ruined-city silhouette. Like floors, walls are generated as abstract data — geometry construction happens separately.

## Input Contract

```js
{
  floors: Floor[],           // from Stage 3
  buildings: Building[],     // from Stage 2
  tierHeight: number,
  wallThickness: number,     // wall slab thickness (inches, default 0.25)
  rng: RNG,
}
```

## Algorithm

**For each building, for each tier the building occupies:**

1. Derive the outer edges of the floor plate's rect decomposition
2. For each outer edge segment (shared with exterior or alleyway, not interior between rooms):
   a. Place a wall slab: `wallThickness` thick, `tierHeight` tall, positioned flush against the edge
   b. Apply openings:
      - **Ground floor doorways**: 1-2 doorways per wall face, ~1.5" wide × 2" tall
      - **Upper floor windows**: 0-3 windows per wall face, ~1" × 1"
      - Doorways and windows are cut out of the wall as rectangular voids
   c. Apply top damage:
      - Randomly remove sections from the wall's top edge (stepped cuts — axis-aligned notches down from the top)
      - Higher `building.damage` and higher tier → more and deeper notches
   d. Apply section removal:
      - Some wall segments are removed entirely (probability scales with `building.damage`)
      - A removed segment leaves a gap in the exterior wall
3. Interior walls: for buildings with large floor area (> 8" in either dimension), occasionally add a partial interior wall to subdivide the space

## Output Contract

```js
{
  // all prior output fields carried forward, plus:
  walls: [
    {
      buildingId: string,
      tier: number,
      edge: 'N' | 'S' | 'E' | 'W',
      rect: Rect,               // XZ footprint of the wall slab
      y: number,                // Y of wall base (= floor.y of this tier)
      height: number,           // wall height in inches (≤ tierHeight)
      openings: [               // doorways + windows cut from this wall
        { x: number, y: number, width: number, height: number }
      ],
      topProfile: Rect[],       // rect decomposition of the remaining wall after top damage
      isInterior: boolean,
      materialKey: string,      // e.g. "brick_wall", "stone_wall"
    }
  ],
}
```

## Key Files

- `src/generators/walls/index.js` — public entry, iterates buildings and tiers
- `src/generators/walls/` — wall placement, opening generation, top damage
- `src/generators/wall-texture-key.js` — maps wall type to material key
- `src/generators/get-wall-bounds.js` — derives wall edge positions from floor rects
- `src/generators/rect-collides-with-wall.js` — collision helper for opening placement

## Edge Cases & Constraints

- A wall segment that would be fully consumed by openings is instead removed entirely (the gap itself is the doorway)
- Top damage notches must not reduce the wall below a minimum height of 0.5" at any point — walls never disappear into the floor
- Interior walls are only placed when floor area exceeds the threshold — no interior walls in small rooms
- Section removal is not applied to walls adjacent to walkway connection points (Stage 5 needs solid wall material to attach to)

## Testing Notes

- Tests verify all wall rects are positioned at the correct Y for their tier
- Tests verify no opening exceeds the wall dimensions it is cut from
- Tests verify walls are positioned flush against their floor's outer edge (within floating-point tolerance)
