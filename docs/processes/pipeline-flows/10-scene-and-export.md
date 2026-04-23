# Stage 10: Scene Build and Export

> Last verified: 2026-04-21

## Overview

Converts geometry primitives into a Three.js scene, then exports the scene and geometry to all output formats. This stage is entirely outside the generation pipeline — it consumes the `{ version, primitives }` handover object and produces files on disk.

## Input Contract

```js
geometry: {
  version: 1,
  primitives: object[],    // from Stage 7
}
config: {
  debug: boolean,          // true → flat debug materials, false → texture atlas
  textureSet: string,      // e.g. 'base' — selects texture pool
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

## Export

Three output files are always written:

| Output | Function | File |
|---|---|---|
| GLB | `exportToGlb(scene, outputPath)` | `<baseName>.glb` |
| OBJ + MTL + PNG | `exportToObj(geometry, config, dir, baseName)` | `<baseName>.obj` / `.mtl` / `.png` |
| Collision OBJ | `exportCollisionObj(geometry, dir, baseName)` | `<baseName>_collision.obj` |

Plus two data files:

| Output | Contents | File |
|---|---|---|
| Geometry JSON | `{ version, primitives, collisionMatrix }` | `<baseName>_geometry.json` |
| Debug frames JSON | Recorder frame data (only when `--visualize`) | `debug_frames.json` |
| Matrix history JSON | Per-cell write history (only when `--debugMatrix`) | `<baseName>_matrix_history.json` |

## Key Files

- [src/generators/scene/build-scene.js](../../../../src/generators/scene/build-scene.js) — Three.js scene construction
- [src/generators/scene/build-primitive-mesh.js](../../../../src/generators/scene/build-primitive-mesh.js) — dispatches per primitive type to mesh builder
- [src/generators/scene/buildTexturePools.js](../../../../src/generators/scene/buildTexturePools.js) — loads and organises texture atlases
- [src/generators/scene/resolve-debug-material.js](../../../../src/generators/scene/resolve-debug-material.js) — flat debug colours by primitive name
- [src/generators/scene/resolve-textured-material.js](../../../../src/generators/scene/resolve-textured-material.js) — UV material from texture pool
- [src/export/glb-exporter.js](../../../../src/export/glb-exporter.js) — GLB export
- [src/export/obj-geometry/export-to-obj.js](../../../../src/export/obj-geometry/export-to-obj.js) — OBJ + MTL + texture atlas export
- [src/export/collision-exporter.js](../../../../src/export/collision-exporter.js) — collision mesh OBJ export

## Edge Cases & Constraints

- GLB and OBJ are always exported together — there is no flag to suppress either.
- The collision OBJ is derived from the same primitives as the visual OBJ but uses a simplified material; it is intended for physics/navigation mesh use.
- `--visualize` enables the debug recorder which captures per-stage snapshots; the output `debug_frames.json` is consumed by the preview server visualiser.
- `--debugMatrix` dumps the full per-cell write history; only cells with 2+ writes are included by default (see `src/index.js`).
