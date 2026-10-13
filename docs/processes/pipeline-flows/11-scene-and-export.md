# Stage 11: Scene Build and Export

> Last verified: 2026-10-13 against src/index.js. GLB + geometry JSON are always written. The OBJ + atlas, collision OBJ and per-tier split exports were removed in this version (conventions plan, Phase 3b); the old behaviour is in git tags `v0.2.0` and `v0.3.0`.

## Overview

Converts geometry primitives into a Three.js scene, then exports the scene (GLB) and the geometry JSON. The consumer is the Withering game (GLB + primitives + collision matrix); Tabletop Simulator is no longer a target. This stage is entirely outside the generation pipeline — it consumes the `{ version, primitives }` handover object and produces files on disk.

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
   - `debug=false` → `resolveTexturedMaterial(prim.textureKey, pools)` — world-space UVs: every face's UV = world position / `GEOMETRY.glbTileSize` along the face's axes (`src/core/box-face-world-uv.js`), plus one texture offset per texture key (`GEOMETRY.uvKeyOffset`, `src/generators/scene/texture-key-uv-offset.js`). Adjacent boxes of one texture share UVs along a common edge, so there is no visible seam between neighbouring boxes.

Texture categories loaded by `buildTexturePools`:
`walls`, `landmark_walls`, `floors`, `objects`, `ladders`, `walkways`, `courtyards`, `base_map`, `roofs`, `rivers`, `river_banks`, `streets`, `pavements`, `map_skirt`.

## Export

The GLB is always written:

| Output | Function | File |
|---|---|---|
| GLB | `exportToGlb(scene, outputPath)` | `<baseName>.glb` |

The in-memory library has one export, `generateToBuffer` (returns the GLB). The former `generateObjToBuffers`, `generateColliderToBuffer` and `generateTiersToBuffers` were removed with the OBJ paths. There is no vertex cap.

Data files:

| Output | Contents | File |
|---|---|---|
| Geometry JSON (always written) | `{ version, primitives, collisionMatrix }` | `<baseName>_geometry.json` |
| Debug frames JSON | Recorder frame data (written when `--preview` or `--visualize` is on) | `debug_frames.json` |
| Matrix history JSON | Per-cell write history (only when `--debugMatrix`) | `<baseName>_matrix_history.json` |

### Ladder mode

Controlled by `config.flatLadders` (CLI flags `--flat-ladders` / `--3d-ladders`, default `true`):

- `true` - flat 2D quads offset slightly from the adjacent wall face.
- `false` - full 3D geometry: two pole boxes + individual rung boxes per rung.

### Merged primitives

The geometry stage may merge adjacent boxes (see stage 10, "Primitive merge pass"; disabled by default, `GEOMETRY.primitiveMerge.enabled = false`). A merged primitive still carries `uvOrigin` (the first constituent's box), but no exporter reads it: the GLB uses world-space UVs.

### Tier assignment helper

`tierOf(prim, config)` (`src/export/assign-primitive-tier.js`) maps a primitive to one vertical tier. The per-tier export that used it was removed; it is kept as a tested helper (used by the merge-pass tests).

## Key Files

- [src/generators/scene/build-scene.js](../../../../src/generators/scene/build-scene.js)
- [src/generators/scene/buildTexturePools.js](../../../../src/generators/scene/buildTexturePools.js)
- [src/generators/scene/resolve-textured-material.js](../../../../src/generators/scene/resolve-textured-material.js)
- [src/export/glb-exporter.js](../../../../src/export/glb-exporter.js)
- [src/export/get-output-base-name.js](../../../../src/export/get-output-base-name.js) - output directory and base file name
- [src/export/assign-primitive-tier.js](../../../../src/export/assign-primitive-tier.js) - `tierOf` / `tierCount` / `primBaseY` / `primTopY`
- [src/generators/generate-textures.js](../../../../src/generators/generate-textures.js) — generates placeholder PNGs for `base` and `loaded` packs

## Edge Cases & Constraints

- The GLB and geometry JSON are always written. There are no other export formats.
- `--preview` (alias `--visualize`) enables the debug recorder which captures per-stage snapshots consumed by the preview visualiser.
- The `map_skirt` texture must exist in both `assets/textures/base/map_skirt/` and `assets/textures/loaded/map_skirt/`. Run `node src/generators/generate-textures.js` to regenerate if missing.
