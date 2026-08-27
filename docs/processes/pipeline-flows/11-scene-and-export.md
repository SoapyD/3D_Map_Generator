# Stage 11: Scene Build and Export

> Last verified: 2026-08-27

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

### Per-tier split export (`--split-tiers`, opt-in, additive)

`--split-tiers` (or the in-memory `generateTiersToBuffers(seed, opts)`) additionally emits one OBJ + one collider OBJ **per vertical tier**, plus a manifest. This lets Tabletop Simulator load the map as N stacked, independently movable tier objects (the "elevator" / reveal feature) instead of one monolithic model that the camera collides against. Combined GLB/OBJ/collider are still written unconditionally — the split is purely additive.

All tiers share **one** diffuse atlas PNG: the atlas is built once from the full geometry (`buildObjAtlas`) and reused for every tier's OBJ (`emitPrimitivesToObj`), so UVs match a single `<baseName>.png`.

**Alignment via corner posts.** The geometry is world-baked, but TTS does **not** self-align separately-imported tiers — it centres each `Custom_Model` on its **collider** bounding box, and each tier's raw geometry has a different centre (upper floors don't cover the whole footprint, so they'd land off-centre). So each tier gets **4 corner posts** (`cornerPostPrimitives`): one at each corner of the global map footprint, `1×1` in XZ and spanning **that tier's own height**, emitted into **both** the visual OBJ and the collider (name prefix `border_corner_` → collidable). This gives every tier an identical **XZ footprint** bounding box (→ TTS places them identically → they line up horizontally) with a **real per-tier height** (so the selection box isn't a whole-map block and units rest on the real floor). Vertical stacking is applied by the loader from each tier's manifest `center`. The posts sit at the map corners (skirt/border, off the play area), textured `map_border`, so they render as small posts (floating at the corners on the upper floors). Earlier iterations used an invisible degenerate-triangle "bounds cage" instead, but that cooked into a flickering invisible collider in Unity — real corner boxes are stable.

Tier assignment — `tierOf(prim, config)` (`src/export/assign-primitive-tier.js`), total + disjoint (every primitive → exactly one tier in `[0, config.tiers]`; tier count is `config.tiers + 1`):

1. **Floors** — authoritative tier from the `floor_f{n}_` name.
2. **Ground terrain** (`street_`, `river_`, `skirt_`, `border_`, `deleted_`, `pavement_`, `building_footprint_`) → tier 0.
3. **Cross-tier connectors** (any name containing `ladder`, plus `pillar_`, `bridge_`, `walkway_`, `junction_platform_`) → their **lower/base** tier by floor-banding `baseY` (v1: a raised upper tier detaches cosmetically at the top).
4. **Everything else** (walls, roofs, rooftop cover) → **floor-banded** to the floor at or below `baseY` (`floor((baseY + slabThickness) / levelHeight)`, `levelHeight = tierHeight + slabThickness`). A tier owns its floor slab and all the wall rows above it up to — but not including — the next floor, so every 1"-tall wall row (`y = i*levelHeight + 0..tierHeight-1`) stays on tier `i`.

Outputs (for each **non-empty** tier `t`; empty tiers are skipped but retained in the manifest with `empty: true`):

| Output | File |
|---|---|
| Tier OBJ | `<baseName>_tier{t}.obj` |
| Tier collider OBJ | `<baseName>_tier{t}_collision.obj` (omitted if the tier has no collidable surfaces) |
| Shared atlas PNG | `<baseName>.png` (one, shared by all tiers) |
| Manifest | `<baseName>_tiers.json` — `{ version, seed, tierCount, levelHeight, tierHeight, slabThickness, units, tiers: [{ tier, obj, collision, primitiveCount, xMin, xMax, yMin, yMax, zMin, zMax, center: [cx,cy,cz], empty }] }` |

Each tier entry carries its **XZ footprint bounds** (identical across tiers — the corner posts reach the map corners) and its **per-tier Y** range, giving a `center` whose XZ is the map centre and whose Y is the tier's own. A loader repositions each tier to its `center`: the XZ offset is the same for every tier (the corner posts already align them horizontally), and the Y offset stacks the tiers vertically.

`levelHeight` in the manifest is the vertical distance between stacked tier floors — the elevator lift delta a TTS script applies.

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
- [src/export/assign-primitive-tier.js](../../../../src/export/assign-primitive-tier.js) — `tierOf` / `tierCount` / `primBaseY` / `primTopY` (per-tier split)
- [src/export/export-tiers.js](../../../../src/export/export-tiers.js) — `groupPrimitivesByTier` / `buildTierBuffers` / `cornerPostPrimitives` (footprint corner posts) / `exportTiers`
- [src/export/obj-geometry/build-obj-and-atlas.js](../../../../src/export/obj-geometry/build-obj-and-atlas.js) — `buildObjAtlas` (shared atlas) + `emitPrimitivesToObj` (per-tier OBJ)
- [src/generate-tiers-buffers.js](../../../../src/generate-tiers-buffers.js) — in-memory `generateTiersToBuffers` (consumed by the wyrdwars maps API)
- [src/generators/generate-textures.js](../../../../src/generators/generate-textures.js) — generates placeholder PNGs for `base` and `loaded` packs

## Edge Cases & Constraints

- GLB and OBJ are always exported together — there is no flag to suppress either.
- `--split-tiers` is additive and opt-in: it never replaces the combined outputs, and its per-tier OBJs reuse the single combined atlas PNG.
- `--visualize` enables the debug recorder which captures per-stage snapshots consumed by the preview visualiser.
- The `map_skirt` texture must exist in both `assets/textures/base/map_skirt/` and `assets/textures/loaded/map_skirt/`. Run `node src/generators/generate-textures.js` to regenerate if missing.
