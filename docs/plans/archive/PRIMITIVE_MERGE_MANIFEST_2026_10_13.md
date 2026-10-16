# Primitive Merge — Grepped File Manifest

Status: **Archived 2026-10-16** with `PRIMITIVE_MERGE_PLAN_2026_10_13.md` (plan complete; Phase A in PR #41). Line numbers below are as of generation and are not kept current.

Companion to `PRIMITIVE_MERGE_PLAN_2026_10_13.md`. Generated 2026-10-13 on branch `dev` from live reads and greps. Line numbers will drift (refs below updated 2026-10-13 after Phase A0-A3 landed on `feature/primitive-merge`); re-run the command under each heading before starting a phase. `_old_system/` is excluded throughout and is not touched.

Shorthand: `EX` = `--exclude-dir=_old_system`; scope is `src tests scripts`.

## A. Pipeline entry, handover and exporters

Regenerate: `grep -rnE 'buildGeometry|_geometry\.json|buildScene\(|exportToGlb\(|exportToObj\(|exportCollisionObj\(' src --include=*.js`

```
src/generators/geometry/build-geometry.js:41   export function buildGeometry(data, config)
src/generators/geometry/build-geometry.js:98-99 mergePrimitives(...) then return { version: 1, primitives: merged }   <- merge pass (added)
src/pipeline.js:121                            const geometry = buildGeometry(coverData, config);
src/pipeline.js:122                            return { geometry, matrix };
src/index.js:76                                const geometryWithMatrix = { ...geometry, collisionMatrix: ... };
src/index.js:77-78                             _geometry.json write
src/index.js:81                                const scene = buildScene(geometry, config);
src/index.js:85                                await exportToGlb(scene, outputPath);
src/index.js:87                                const objPath = await exportToObj(geometry, config, dir, baseName);
src/index.js:88                                const collisionPath = await exportCollisionObj(geometry, dir, baseName);
src/generators/scene/build-scene.js:22        export function buildScene(geometry, config)
src/generators/scene/build-scene.js:43-44     for (const prim of geometry.primitives) buildPrimitiveMesh(...)
src/export/collision-exporter.js:9            import { buildCollisionObj } from './collision-buffer.js';
src/export/collision-exporter.js:18-23        empty check, path, writeFile
```

## B. Config values that the merge and UV hash read

Regenerate: `grep -nE 'GEOMETRY|glbTileSize|objAtlasTileSize|objSegmentPixelSize|uvHashU|uvHashV|wallThickness|streetThickness|pavementThickness' src/config.js`

```
src/config.js:47        wallThickness: 0.25,
src/config.js:206       export const GEOMETRY = {
src/config.js:216-220   primitiveMerge: { enabled, types, epsilon }   <- added
src/config.js:172       glbTileSize: 3,
src/config.js:173       objAtlasTileSize: 256,
src/config.js:174       objSegmentPixelSize: 128,
src/config.js:177       uvHashU: [0.7123, 0.3917],
src/config.js:178       uvHashV: [0.5431, 0.9281, 0.1637],
src/config.js:195       streetThickness:   0.25,
src/config.js:238       pavementThickness: 0.25,
```

## C. OBJ flat / wall / sub-box emitters (subdivision and UV hash)

Regenerate: `grep -rnE 'SEG_SIZE|uvHashU|uvHashV|function add' src/export/obj-geometry --include=*.js`

```
src/export/obj-geometry/add-shared-flat.js:3       const SEG_SIZE = 3;
src/export/obj-geometry/add-shared-flat.js:9       export function addSharedFlat(state, name, x0, y0, z0, sizeX, sizeY, sizeZ, uv, emitBottom, rotateUV, simpleBottom, emitTop)
src/export/obj-geometry/add-shared-flat.js:10-11   segsX / segsZ = ceil(size / SEG_SIZE)
src/export/obj-geometry/add-shared-flat.js:21-24   UV hash from x0, z0, y0 (origin dependency)
src/export/obj-geometry/add-shared-flat.js:24      uvOrigin hash override (added)
src/export/obj-geometry/add-shared-flat.js:37-45   TOP grid, now only if emitTop (A0)
src/export/obj-geometry/add-shared-flat.js:47-62   BOTTOM grid only if emitBottom; simpleBottom writes 4 corners only (A0, done)
src/export/obj-geometry/add-shared-flat.js:60      if (emitTop) { faces }
src/export/obj-geometry/add-shared-flat.js:76-77   if (emitBottom) { if (simpleBottom) ... }
src/export/obj-geometry/add-shared-wall.js:3       const SEG_SIZE = 3;
src/export/obj-geometry/add-shared-wall.js:9       export function addSharedWall(state, name, x0, y0, z0, sizeX, sizeY, sizeZ, uv)
src/export/obj-geometry/add-shared-wall.js:14-15   segsL / segsH = ceil(... / SEG_SIZE)
src/export/obj-geometry/add-shared-wall.js:28      UV hash from uvOrigin ?? (x0, y0, z0)
src/export/obj-geometry/add-shared-wall.js:36-47   front and back grids (both always emitted)
src/export/obj-geometry/add-sub-box.js:6           const SEG_SIZE = 3;
src/export/obj-geometry/add-sub-box.js:12          export function addSubBox(state, name, x0, y0, z0, sizeX, sizeY, sizeZ, uv, showEdges, rotateUV, thinAxis)
src/export/obj-geometry/add-sub-box.js:24-25       UV hash
src/export/obj-geometry/add-sub-box.js:42-43, 62-63  segsL / segsH
```

## D. OBJ dispatch (per primitive type) and atlas build

Regenerate: `grep -nE "case '|addShared|addSubBox|addSimpleBox|wallEdgeCovered\(|buildObjAtlas|atlasPngBuffer|export function" src/export/obj-geometry/build-obj-and-atlas.js`

```
src/export/obj-geometry/build-obj-and-atlas.js:39      export function buildObjAndAtlas(geometry, config)
src/export/obj-geometry/build-obj-and-atlas.js:52      export function buildObjAtlas(geometry, config)   <- atlas: remove in Phase B
src/export/obj-geometry/build-obj-and-atlas.js:100-101 buildAtlasImage + PNG.sync.write   <- Phase B target
src/export/obj-geometry/build-obj-and-atlas.js:112     export function emitPrimitivesToObj(primitives, config, atlasCtx, wallPrimsForCoverage)
src/export/obj-geometry/build-obj-and-atlas.js:125     const uv = resolveUV(atlasState, prim.textureKey, ...)
src/export/obj-geometry/build-obj-and-atlas.js:128     case 'slab':
src/export/obj-geometry/build-obj-and-atlas.js:133-134 prim.shared -> addSharedFlat(...)
src/export/obj-geometry/build-obj-and-atlas.js:136     non-shared -> addSubBox(...)
src/export/obj-geometry/build-obj-and-atlas.js:141     case 'wall':
src/export/obj-geometry/build-obj-and-atlas.js:142     addSharedWall(...)
src/export/obj-geometry/build-obj-and-atlas.js:145-160 addWallEdge (4 verts, 2 normals, 4 faces per edge)
src/export/obj-geometry/build-obj-and-atlas.js:166-167 top and bottom edge faces (always)
src/export/obj-geometry/build-obj-and-atlas.js:169-179 start/end cap faces, gated by wallEdgeCovered
src/export/obj-geometry/build-obj-and-atlas.js:170,172,175,177  wallEdgeCovered(prim, 'start'|'end', wallPrims) calls
src/export/obj-geometry/build-obj-and-atlas.js:183     case 'edges':
src/export/obj-geometry/build-obj-and-atlas.js:217-220 case 'ceiling' -> addSharedFlat(..., emitTop false)
src/export/obj-geometry/build-obj-and-atlas.js:222     case 'ladder' -> emitLadder(...)
```

## E. Wall end-cap coverage (must be recomputed after merge)

Regenerate: `grep -n 'export function\|margin\|Math.abs' src/export/obj-geometry/wall-edge-covered.js`

```
src/export/obj-geometry/wall-edge-covered.js:11   export function wallEdgeCovered(wallPrim, side, allWallPrims)
src/export/obj-geometry/wall-edge-covered.js:25   y tolerance 0.5 (walls on another level are ignored)
src/export/obj-geometry/wall-edge-covered.js:30-31, 37-38  full-extent coverage tests
```

## F. Primitive builders (merge candidates and their flags)

Regenerate: `grep -rnE "type: '|shared:|emitBottom|emitTop" src/generators/geometry --include=*.js`

```
src/generators/geometry/build-wall-primitives.js:7     buildWallPrimitives(walls, buildings)
src/generators/geometry/build-wall-primitives.js:13    texKey = wallTextureKey(bi, buildings)   <- per-building
src/generators/geometry/build-wall-primitives.js:16-21 type 'wall', name `wall_${i}`, axis
src/generators/geometry/build-floor-primitives.js:6    buildFloorPrimitives(floors, buildings, config)
src/generators/geometry/build-floor-primitives.js:10   y = floor.geomY
src/generators/geometry/build-floor-primitives.js:15   name `floor_f${floorIndex}_${x}_${z}`  <- tier prefix
src/generators/geometry/build-floor-primitives.js:18-22 slab (emitTop, emitBottom true, shared)
src/generators/geometry/build-floor-primitives.js:30   type 'edges'
src/generators/geometry/build-pavement-primitives.js:3 buildPavementPrimitives(pavements, config)
src/generators/geometry/build-pavement-primitives.js:9 textureKey: 'pavement:0'   <- fixed key
src/generators/geometry/build-pavement-primitives.js:10-11 emitBottom false, shared true
src/generators/geometry/build-map-skirt-primitives.js:19-25 panel() shared slab with emitBottom false
src/generators/geometry/build-map-skirt-primitives.js:34-44 solid border panels (solid: true, shared: false)
src/generators/geometry/build-map-skirt-primitives.js:50-53 skirt_N / skirt_S / skirt_W / skirt_E
src/generators/geometry/build-map-skirt-primitives.js:70-75 skirt_bottom, w = mapWidth + 2*skirtT (:72), emitBottom false (:74)
src/generators/geometry/build-roof-primitives.js:32-36 roof slab (emitBottom false, shared)
src/generators/geometry/build-roof-primitives.js:39-42 roof_ceil (type 'ceiling', emitTop false)
src/generators/geometry/build-roof-primitives.js:45   type 'edges'
src/generators/geometry/build-bridge-primitives.js:30-35 bridge_${i} deck (emitBottom true, shared)
src/generators/geometry/build-bridge-primitives.js:39   bridge edges
src/generators/geometry/build-bridge-primitives.js:64-69 bridge_${i}_wall${side} (shared false, thinAxis)
src/generators/geometry/build-bridge-primitives.js:99-104 bridge_${i}_batt${ci}_${side} (shared false)
src/generators/geometry/build-river-primitives.js:12-16 river_${ri}_${i} (emitBottom false, shared)
src/generators/geometry/build-river-bank-primitives.js:29-34 river_bank_${idx} (emitBottom false, shared)
src/generators/geometry/build-street-primitives.js:7-11 street_${i} (emitBottom false, shared)
src/generators/geometry/build-walkway-primitives.js:14-19 walkway_${i} (emitBottom true, shared)
src/generators/geometry/build-walkway-primitives.js:23   walkway edges
src/generators/geometry/build-scatter-primitives.js:11-15 ${prefix}_${i} (emitBottom false, shared)
src/generators/geometry/build-courtyard-primitives.js:8-12 deleted_${i} (emitBottom false, shared)
src/generators/geometry/build-pillar-primitives.js:11-15 pillar_${i} (shared false, no top, no bottom)
src/generators/geometry/build-ladder-primitive.js:79   type 'ladder' (not a box; do not merge)
src/generators/geometry/build-ladder-platform-primitives.js:19-23 ladder_platform_${i} (emitBottom true)
src/generators/geometry/build-junction-platform-primitives.js:19-23 junction_platform_${i} (emitBottom true)
src/generators/geometry/build-building-footprint-primitives.js:7-12 building_footprint_${i} (emitBottom false)
src/generators/geometry/build-geometry.js:52,54    floor or footprint branch
src/generators/geometry/build-geometry.js:56-78   builder call order (walls at :56, pavements :71, skirt :72, roofs :73)
```

## G. Name-based consumers (merge must preserve these)

Regenerate: `grep -rnE "startsWith|includes\('_|floor_f|COLLIDABLE|tierOf" src/export src/generators/scene --include=*.js`

```
src/export/assign-primitive-tier.js:31       export function primBaseY(prim)
src/export/assign-primitive-tier.js:38       export function primTopY(prim)
src/export/assign-primitive-tier.js:54       export function tierOf(prim, config)
src/export/assign-primitive-tier.js:60       /^floor_f(\d+)_/ — authoritative tier from name
src/export/assign-primitive-tier.js:64       GROUND_PREFIXES check
src/export/assign-primitive-tier.js:67       ladder / CONNECTOR_PREFIXES check
src/export/assign-primitive-tier.js:73-75    Y banding comment (walls rows up to next floor)
src/export/collision-buffer.js:11-15         COLLIDABLE_PREFIXES
src/export/collision-buffer.js:21            export function buildCollisionObj(geometry)
src/export/collision-buffer.js:28            prefix filter
src/export/collision-buffer.js:30            skip names containing '_wall_' or '_batt_'
```

## H. Tests and tools that pin counts, names or the hook

Regenerate: `grep -rnE "primitives\.length|primitives: |toBe\(|'floor_f|wall_" tests --include=*.js` and `ls .claude/hooks scripts/checks`

```
tests/snapshot.test.js:27      primitives: r.geometry.primitives.length
tests/snapshot.test.js:46      primitives: again.geometry.primitives.length
tests/snapshot.test.js:63      countPrims(geometry, 'wall_') > 0
tests/snapshot.test.js:80      "primitives": 1284   <- changes with merge
tests/snapshot.test.js:105     "primitives": 1355   <- changes with merge
tests/export/export-tiers.test.js:9-14   fixture primitives (wall_0, wall_1)
tests/export/export-tiers.test.js:45     expected names tier 0 (floor_f0_0_0 …)
tests/export/export-tiers.test.js:49     expected names tier 2 (floor_f2_0_0, ladder_1, wall_1)
tests/export/collision-exporter.test.js:18-30  fixtures (bridge_wall_0, wall_0 excluded)
tests/export/collision-exporter.test.js:44     names that must be excluded
tests/helpers/run-stages.js:85-87              countPrims by name prefix
tests/profiles/withering.test.js:75-76         slim vs full primitive counts
tests/generators/connectivity.test.js:151,165  ladder primitive counts
.claude/hooks/check-vertex-count.mjs           vertex-count hook (25k check)
scripts/checks/check-single-export.js          single-export rule (rule text not read)
```

## I. Package scripts and version

Regenerate: `grep -nE '"(version|generate|test|check:all)"' package.json`

```
package.json:3    "version": "0.3.0"   <- bump for v0.4.0
package.json:11   "generate": "node src/index.js"
package.json:14   "test": "vitest run"
package.json:18   "check:all": "node scripts/checks/run-all.js"
```

## J. Docs that describe the export path (update when Phase B lands)

Regenerate: `grep -rnE "atlas|subdivi|SEG|3\"" docs --include=*.md --exclude-dir=archive`

```
docs/processes/pipeline-flows/11-scene-and-export.md:33   GLB UV-mapped from atlas (textures path)
docs/processes/pipeline-flows/11-scene-and-export.md:45   OBJ + texture atlas PNG output row
docs/processes/pipeline-flows/11-scene-and-export.md:75   one shared diffuse atlas PNG (only record of atlas use)
docs/processes/pipeline-flows/11-scene-and-export.md:92   manifest: shared atlas PNG
docs/architecture/docs_and_config_guide.md:77             GEOMETRY section description (atlas tile/segment sizes)
docs/plans/THIN_FLOOR_SLABS_PLAN_2026_10_11.md:27         3" pitch matches OBJ 3" segment subdivision (Phase B dependency)
docs/plans/archive/LOADED_MAP_TEXTURE_PREVIEW_PLAN_2026_10_13.md:36   P1 uses 3" repeat per face (GLB-style); reference for Phase B
docs/plans/archive/LOADED_MAP_TEXTURE_PREVIEW_PLAN_2026_10_13.md:68   OBJ-side equivalent: build-obj-and-atlas.js:52, ensure-texture.js:7
```

## K. Phase A files added (2026-10-13)

Regenerate: `git status --short` on `feature/primitive-merge`, or `ls src/generators/geometry/merge`

```
src/generators/geometry/merge-primitives.js            mergePrimitives(primitives, options)   (called from build-geometry.js:98)
src/generators/geometry/merge/merge-group-type.js      wall | pavement | floor | null
src/generators/geometry/merge/merge-group-key.js       shared-key a pair must match
src/generators/geometry/merge/merge-two-boxes.js       exact-rectangle union test
src/generators/geometry/merge/merge-group-prims.js     greedy pairwise fixpoint
src/generators/geometry/merge/build-merged-prim.js     merged prim + uvOrigin
src/generators/scene/uv-origin-center.js               GLB: uvOrigin box -> centre
src/generators/scene/build-primitive-mesh.js           passes uvOrigin to createSlab (slab + wall cases)
src/core/geometry-misc.js:20,46-49                     createSlab uvOrigin option
src/export/obj-geometry/build-obj-and-atlas.js:134,142 passes prim.uvOrigin
tests/generators/merge-primitives.test.js              A3 tests
tests/snapshot.test.js, tests/export/obj-exporter.test.js   counts updated (export-tiers.test.js needed no change: synthetic fixtures)
```
