# Stage 11: Scene Build and Export

> Last verified: 2026-04-24

## Overview

Converts geometry primitives into a Three.js scene, then exports the scene and geometry to all output formats. This stage is entirely outside the generation pipeline — it consumes the `{ version, primitives }` handover object and produces files on disk.

## Input Contract

```js
geometry: {
  version: 1,
  primitives: object[],
}
config: {
  debug: boolean,
  textureSet: string,      // e.g. 'base' or 'loaded'
  flatLadders: boolean,    // true = flat 2D quads, false = 3D pole+rung boxes (default true)
  outputDir: string,
  // other CLI args
}
```

## Scene Build (`buildScene`)

1. If not debug: build texture pools via `buildTexturePools(config.textureSet)`.
2. For each primitive in `geometry.primitives`:
   - Call `buildPrimitiveMesh(prim, getMaterial, ladderOpts)` → returns an array of `THREE.Mesh`.
   - Add all meshes to the scene.
3. Material resolution:
   - `debug=true` → `resolveDebugMaterial(prim.name)` — flat colour per primitive type.
   - `debug=false` → `resolveTexturedMaterial(prim.textureKey, pools)` — UV-mapped from the atlas.

Texture categories loaded by `buildTexturePools`:
`walls`, `landmark_walls`, `floors`, `objects`, `ladders`, `walkways`, `courtyards`, `base_map`, `roofs`, `rivers`, `river_banks`, `streets`, `pavements`, `map_skirt`.

## Export

Three output files are always written:

| Output | Function | File |
|---|---|---|
| GLB | `exportToGlb(scene, outputPath)` | `<baseName>.glb` |
| OBJ + texture atlas PNG | `exportToObj(geometry, config, dir, baseName)` | `<baseName>.obj` / `.png` |
| Collision OBJ | `exportCollisionObj(geometry, dir, baseName)` | `<baseName>_collision.obj` |

Plus two data files:

| Output | Contents | File |
|---|---|---|
| Geometry JSON | `{ version, primitives, collisionMatrix }` | `<baseName>_geometry.json` |
| Debug frames JSON | Recorder frame data (only when `--visualize`) | `debug_frames.json` |
| Matrix history JSON | Per-cell write history (only when `--debugMatrix`) | `<baseName>_matrix_history.json` |

### OBJ ladder mode

Controlled by `config.flatLadders` (CLI flags `--flat-ladders` / `--3d-ladders`, default `true`):

- `true` — flat 2D quads offset slightly from the adjacent wall face.
- `false` — full 3D geometry: two pole boxes + individual rung boxes per rung.

### Collision OBJ

`exportCollisionObj` filters `geometry.primitives` to `type === 'slab'` and matches primitive names against a prefix allowlist. Included prefixes:

`skirt_`, `river_`, `street_`, `pavement_`, `base_floor`, `floor_`, `roof_`, `cover_`, `interior_cover_`, `street_scatter_`, `walkway_`, `bridge_`, `pillar_`, `ladder_platform_`, `junction_platform_`, `deleted_`.

Bridge wall and battlement slabs (`_wall_`, `_batt_` in name) are excluded so only the walkable deck surface is collidable.

### Wall end-cap coverage

`wallEdgeCovered(wallPrim, side, allWallPrims)` decides whether to suppress a wall's end-cap face. N/S walls are trimmed at corners to yield to E/W walls — so the check must verify the covering wall spans the **full face extent**, not just the edge point:

- For axis=`'x'` walls: covering wall must contain `edgeX` AND fully span `[edgeZ, edgeZ + wallPrim.d]`.
- For axis=`'z'` walls: covering wall must fully span `[edgeX, edgeX + wallPrim.w]` AND contain `edgeZ`.

A margin of 0.01 is used for floating-point safety. The previous 0.5 margin incorrectly suppressed E/W end caps at trimmed corners, leaving transparent corner slots.

## Key Files

- [src/generators/scene/build-scene.js](../../../../src/generators/scene/build-scene.js)
- [src/generators/scene/buildTexturePools.js](../../../../src/generators/scene/buildTexturePools.js)
- [src/generators/scene/resolve-textured-material.js](../../../../src/generators/scene/resolve-textured-material.js)
- [src/export/glb-exporter.js](../../../../src/export/glb-exporter.js)
- [src/export/obj-geometry/export-to-obj.js](../../../../src/export/obj-geometry/export-to-obj.js)
- [src/export/obj-geometry/emit-ladder.js](../../../../src/export/obj-geometry/emit-ladder.js) — flat vs 3D ladder dispatch
- [src/export/obj-geometry/wall-edge-covered.js](../../../../src/export/obj-geometry/wall-edge-covered.js) — end-cap suppression
- [src/export/collision-exporter.js](../../../../src/export/collision-exporter.js)
- [src/generators/generate-textures.js](../../../../src/generators/generate-textures.js) — generates placeholder PNGs for `base` and `loaded` packs

## Edge Cases & Constraints

- GLB and OBJ are always exported together — there is no flag to suppress either.
- `--visualize` enables the debug recorder which captures per-stage snapshots consumed by the preview visualiser.
- The `map_skirt` texture must exist in both `assets/textures/base/map_skirt/` and `assets/textures/loaded/map_skirt/`. Run `node src/generators/generate-textures.js` to regenerate if missing.
