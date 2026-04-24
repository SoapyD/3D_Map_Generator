# Stage 7: Texturing

> Last verified: 2026-04-18

## Overview

Assigns materials and UV coordinates to all geometry data before export. Axis-aligned geometry makes UV mapping trivial: box projection maps each face to the texture using world-space coordinates, which produces natural tiling without any explicit UV unwrap. This stage does not construct Three.js geometry — it annotates the data with material keys and UV parameters that the geometry builder uses.

## Input Contract

```js
{
  floors: Floor[],
  walls: Wall[],
  connections: Connection[],
  coverElements: CoverElement[],
  textureSet: string,           // e.g. "gothic", "ruins"
}
```

## Algorithm

1. Load the texture manifest for `config.textureSet` — a JSON map of `materialKey → { file, tileSize }`
2. For each element across all collections (floors, walls, connections, coverElements):
   a. The element already has a `materialKey` (set when the element was created, e.g. `"stone_floor"`, `"brick_wall"`)
   b. Look up the material's tile size from the manifest (e.g. stone floor tiles every 1 inch)
   c. Compute UV scale factors: `uvScaleX = element.width / tileSize`, `uvScaleZ = element.depth / tileSize`
   d. Attach UV parameters to the element: `{ uvScale: { x, z }, textureFile }`
3. Deduplicate materials: collect the unique set of texture files referenced across all elements
4. Return the full annotated dataset plus the deduplicated material list

## Output Contract

```js
{
  // all prior output fields carried forward, each element now includes:
  // element.uvScale: { x: number, z: number }
  // element.textureFile: string   (relative path in assets/textures/)

  materials: [
    {
      key: string,         // e.g. "stone_floor"
      file: string,        // e.g. "assets/textures/stone_floor.png"
      tileSize: number,    // inches per texture tile
    }
  ],
}
```

## Key Files

- `src/generators/generate-textures.js` — main entry, iterates all element collections
- `src/generators/floor-texture-key.js` — selects floor material key from floor properties
- `src/generators/wall-texture-key.js` — selects wall material key from wall properties
- `assets/textures/` — texture image files

## Edge Cases & Constraints

- If a `materialKey` has no entry in the texture manifest, a fallback material (`"missing"`) is assigned and a warning is logged
- Tile size is in world-space inches; very large elements will tile the texture many times across their surface (intentional — it produces natural tiling for stone/brick)
- The `textureSet` config key selects which manifest file to load; currently only "gothic" is implemented

## Testing Notes

- Tests verify every element in the output has a `uvScale` and `textureFile` property
- Tests verify the `materials[]` list contains no duplicates
- Tests verify UV scale values are positive and non-zero
