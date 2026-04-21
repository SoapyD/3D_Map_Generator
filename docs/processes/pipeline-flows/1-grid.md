# Stage 1: Grid Partitioning

> Last verified: 2026-04-21

## Overview

Divides the map into city blocks separated by streets. The active area is first snapped to the BBD grid (any remainder becomes a symmetric skirt). A strategy — `centerFirst` or `bspTopLeft`, chosen 50/50 — then recursively splits the active area using BSP. Street rectangles are derived from the gaps between blocks. The collision matrix is then initialised and ground-slab placeholders are written.

## Input Contract

```js
config: {
  mapWidth: number,       // map width in inches
  mapDepth: number,       // map depth in inches
  streetWidth: number,    // gap between blocks (inches)
}
rng: RNG
```

## Algorithm

1. Snap active area: `activeW = floor(mapWidth / bbd) * bbd`, same for depth. Remainder split equally as `skirtX` / `skirtZ`.
2. Pick a BSP strategy at random (50/50):
   - `centerFirst` — biases splits toward the centre of each region
   - `bspTopLeft` — biases splits toward the top-left
3. Recursively split the active area via `bspSplit`:
   - A region can be split on X if `w > minBlockSize * 2 + streetWidth`, same rule for Z.
   - Split axis and position chosen by the active strategy.
   - Split position is snapped to BBD and clamped inside the valid range.
   - Recursion terminates when no further split is possible — leaf nodes become blocks.
4. Derive street rectangles from block gaps via `deriveStreetRects`.
5. Create the collision matrix from `activeArea`, `config.tiers`, `config.tierHeight`, `config.slabThickness`.
6. Write ground-slab placeholders into the matrix at `Y = -slabThickness`:
   - `CELL.FOUNDATION_PLACEHOLDER` for each block rect
   - `CELL.STREET_PLACEHOLDER` for each street rect

## Output Contract

```js
{
  blocks: [{ x, z, w, d }],          // one per BSP leaf
  streetBounds: [{ x, z, w, d }],    // derived from block gaps
  activeArea: { x, z, w, d },        // BBD-snapped usable area
  skirt: { x, z },                   // per-side remainder (equal on both sides)
}
// plus matrix (created and partially written here, passed to all subsequent stages)
```

## Key Files

- [src/generators/foundations/grid.js](../../../../src/generators/foundations/grid.js) — entry point; snaps active area, picks strategy, calls bspSplit, derives streets
- [src/generators/foundations/bsp-split.js](../../../../src/generators/foundations/bsp-split.js) — recursive BSP implementation
- [src/generators/foundations/strategies/center-first.js](../../../../src/generators/foundations/strategies/center-first.js) — centerFirst strategy
- [src/generators/foundations/strategies/bsp-top-left.js](../../../../src/generators/foundations/strategies/bsp-top-left.js) — bspTopLeft strategy
- [src/generators/streets/derive-street-rects.js](../../../../src/generators/streets/derive-street-rects.js) — derives street rects from block gaps
- [src/generators/collision/matrix.js](../../../../src/generators/collision/matrix.js) — collision matrix; created after grid is known

## Edge Cases & Constraints

- Minimum block size (`GRID.minBlockSize`) prevents blocks too small for any building.
- BSP snap to BBD means split positions are always on the same grid as building foundations.
- Skirt is purely geometric — no buildings or streets are placed in the skirt.
