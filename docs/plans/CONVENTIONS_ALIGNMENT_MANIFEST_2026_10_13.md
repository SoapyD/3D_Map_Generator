# Conventions Alignment — Grepped File Manifest

Companion to `CONVENTIONS_ALIGNMENT_PLAN_2026_10_13.md`. Generated 2026-10-13 from live greps and reads on `feature/primitive-merge` (uncommitted working tree). Line numbers drift; re-run the command under each heading before starting a phase. `src/generators/_old_system/` is excluded throughout and is not touched.

Shorthand: `EX` = `--glob '!src/generators/_old_system/**'`. Commands use ripgrep (`rg`), which works in PowerShell and bash.

## A. External consumers (blocks Phase 3)

Regenerate: `rg -n "generateObjToBuffers|generateTiersToBuffers|generateColliderToBuffer|generateToBuffer" D:\programming\Node\wyrdwars_manager --glob "!node_modules/**"`

```
D:\programming\Node\wyrdwars_manager\api\package.json:22                            "3d-map-generator": "github:SoapyD/3D_Map_Generator"
D:\programming\Node\wyrdwars_manager\pnpm-lock.yaml:438                            3d-map-generator@https://codeload.github.com/SoapyD/3D_Map_Generator/tar.gz/d366710…
D:\programming\Node\wyrdwars_manager\lib\src\core\maps\generateMapObjAssets.ts:2,11   generateObjToBuffers   (OBJ + atlas)
D:\programming\Node\wyrdwars_manager\lib\src\core\maps\generateMapTiers.ts:2,32      generateTiersToBuffers (per tier)
D:\programming\Node\wyrdwars_manager\lib\src\core\maps\generateMapCollider.ts:2,11   generateColliderToBuffer
D:\programming\Node\wyrdwars_manager\lib\src\core\maps\generateMapGlb.ts:2,11        generateToBuffer (GLB, kept)
D:\programming\Node\wyrdwars_manager\lib\src\controllers\maps\getMapObj.ts:17        mapsCore.generateMapObjAssets
D:\programming\Node\wyrdwars_manager\lib\src\controllers\maps\getMapTexture.ts:17    mapsCore.generateMapObjAssets (atlas)
D:\programming\Node\wyrdwars_manager\lib\src\controllers\maps\getMapTiersManifest.ts:18  mapsCore.generateMapTiers
D:\programming\Node\wyrdwars_manager\lib\src\controllers\maps\getMapTierObj.ts:21    mapsCore.generateMapTiers
D:\programming\Node\wyrdwars_manager\lib\src\controllers\maps\getMapTierCollider.ts:22  mapsCore.generateMapTiers
D:\programming\Node\wyrdwars_manager\lib\src\controllers\maps\getMapCollider.ts:17   mapsCore.generateMapCollider
D:\programming\Node\Game_Template\games\withering\client\src\scene\build-map-group.ts:23   new Mesh(new BoxGeometry(box.w, box.h, box.d), pair[0])  (no UVs, no texture)
D:\programming\Node\Game_Template\games\withering\client\src\scene\build-map-group.ts:27   mesh.userData.y0 = box.y0   (tier cut-away)
D:\programming\Node\Game_Template\games\withering\client\src\scene\colour-for.ts:4-5        colourFor(name): prefix match, grey fallback
D:\programming\Node\Game_Template\games\withering\client\src\scene\primitive-box.ts:8-10   slab/wall -> centred box, y0 = y
D:\programming\Node\Game_Template\games\withering\sim\src\map\load-map.ts:8              format check: withering-map/1 | /2
```

Not checked: whether the wyrdwars controllers are routed (route files not read).

## B. Wall pipeline (matrix writes, cell grid, merge)

Regenerate: `rg -n "mergeWallCells|subdivideWall|applyBlobDamage|applyWindowPlan|fillBoxUnless|setWriteContext|matrixTopY|matrixH" src/generators/walls src/generators/collision/matrix.js`

```
src/generators/walls/subdivide-wall.js:11        export function subdivideWall(wall)
src/generators/walls/subdivide-wall.js:15       cols = max(1, round(wallLength))            (1" columns)
src/generators/walls/subdivide-wall.js:16       rows = max(1, ceil(h - EPS))                 (1" rows, last may be short)
src/generators/walls/subdivide-wall.js:17       colWidth = wallLength / cols
src/generators/walls/subdivide-wall.js:20-24    rowOffsets / rowHeights (top row = h - offset, e.g. 0.75)
src/generators/walls/subdivide-wall.js:26-31    cells { col, row, alive: true }
src/generators/walls/apply-blob-damage.js:13    export function applyBlobDamage(grid, rng, type)
src/generators/walls/apply-blob-damage.js:25    cell(col, row) lookup
src/generators/walls/place-windows.js:31       export function applyWindowPlan(grid, wall, plan, building)
src/generators/walls/place-windows.js:42       window kills cells with row >= 1 (geometry only)
src/generators/walls/merge-wall-cells.js:11    export function mergeWallCells(grid, wall)   (Phase 1a done: calls coverGridWithRects)
src/generators/walls/merge-wall-cells.js:12-17 alive lookup, greedy cover (src/core/grid-rect-cover/coverGridWithRects.js)
src/generators/walls/merge-wall-cells.js:19-36 rect construction from spans (N/S along X, E/W along Z), keys: direction, floorY, x, y, z, w, h, d
src/generators/walls/index.js:64      export function generateWalls(data, config, rng, matrix)
src/generators/walls/index.js:68      buildWindowPlans(data.buildings, rng)
src/generators/walls/index.js:78-80   subdivideWall, applyBlobDamage (WALL.applyBlobDamage), applyWindowPlan (WALL.applyWindows)
src/generators/walls/index.js:84      matrixTopY = nextFloorCellY(wall.floorY, config)
src/generators/walls/index.js:86      for (const seg of mergeWallCells(grid, wall))
src/generators/walls/index.js:87      matrix.setWriteContext(STAGE.WALLS, walls.length)  <- write index changes with count
src/generators/walls/index.js:89-90   matrixH = min(seg.y + seg.h, matrixTopY) - seg.y; skip if <= 0
src/generators/walls/index.js:91-95   WALL.applyDoorCuts -> fillBoxUnless(..., CELL.DOOR) else fillBox
src/generators/walls/index.js:92      fillBoxUnless call
src/generators/walls/extract-wall-segments.js:95  comment: contiguous runs along sortAxis (1-D, not touched)
src/generators/collision/matrix.js:141  setWriteContext(stage, sourceIndex)
src/generators/collision/matrix.js:163  fillBox(x, y, z, w, h, d, value)
src/generators/collision/matrix.js:179  fillBoxUnless(x, y, z, w, h, d, value, skipValue)
```

## C. Floor, roof, cover and pavement rects

Regenerate: `rg -n "quadrantsToSections|ruinsToSections|buildCellBuildingMap|getEdgeGaps|cellsToRects|\.rects|roofSlabs|setCell|fillBox\(" src/generators --glob "!_old_system/**"`

```
src/generators/floors/process-building-floors.js:14   processBuildingFloors (damage escalation)
src/generators/floors/process-building-floors.js:47   present = quadrants not removed
src/generators/floors/process-building-floors.js:50   ruins-small -> ruinsToSections
src/generators/floors/process-building-floors.js:52   other ruins -> one full rect
src/generators/floors/process-building-floors.js:54   others -> quadrantsToSections(building, present)   <- 1c target
src/generators/floors/process-building-floors.js:58-68 floors.push({ rects, removedQuadrants, yCollisionLevel, geomY, ... })
src/generators/floors/quadrants-to-sections.js:9       export function quadrantsToSections(building, present)   (Phase 1c done: shared cover on the 2x2 mask; all present = 1 rect)
(ruins-small-to-sections.js deleted: ruins-small takes the one-rect ruins path in process-building-floors.js)
src/generators/floors/index.js:13      export function generateFloors(data, config, rng, matrix)
src/generators/floors/index.js:23-24   topmost level -> roofSlabs (not written here)
src/generators/floors/index.js:27-29   each rect -> matrix.fillBox(rect.x, level.yCollisionLevel, rect.z, rect.w, slabThickness, rect.d, CELL.FLOOR)
src/generators/floors/index.js:36      labelFloorCells(floorData, matrix)
src/generators/floor-texture-key.js:6-9 floorTextureKey(bi, buildings) -> getTexGroup(bi, buildings)  (texture groups, not per building)
src/generators/geometry-helpers/getEdgeGaps.js:5      export function getEdgeGaps(section, side, allSections)
src/generators/geometry/build-floor-primitives.js:14   for (const rect of floor.rects)
src/generators/geometry/build-floor-primitives.js:15   name floor_f{floorIndex}_{round x}_{round z}
src/generators/geometry/build-floor-primitives.js:19   slab (emitTop, emitBottom, shared)
src/generators/geometry/build-floor-primitives.js:27   getEdgeGaps(rect, side, floor.rects)   <- partition dependent
src/generators/geometry/build-floor-primitives.js:30   type 'edges'
src/generators/roofs/index.js:16-18   for (const slab of data.roofSlabs) for (const rect of slab.rects)
src/generators/roofs/index.js:28      rects: slab.rects   (roof rects = top floor rects)
src/generators/connectivity/emit-anchors.js:70-76   buildCellBuildingMap: covered cells from floor and roof rects
src/generators/streets/write-pavements.js:22     matrix.setCell(cx, pavementCy, cz, CELL.PAVEMENT)   (per cell, matrix)
src/generators/streets/write-pavements.js:29     return { cellCount, rects: cellsToRects(cells, ox, oz, cs) }
src/generators/streets/write-pavements.js:33-52  cellsToRects: coverGridWithRects over the cells' bounding box (Phase 1b done)
src/generators/geometry/build-pavement-primitives.js:9    textureKey: 'pavement:0' (fixed)
src/generators/geometry/build-pavement-primitives.js:10   emitTop true, emitBottom false, shared true
src/generators/cover/index.js:188     export function generateCover(data, config, rng, matrix)
src/generators/cover/index.js:191-192 reads data.buildings and data.streets only (not walls)
src/generators/cover/index.js:132     group.pieces.push (cover emits boxes, not rects)
```

## D. Primitive builders and the merge pass (Phase 1 decision)

Regenerate: `rg -n "mergePrimitives|mergeGroup|mergeTwoBoxes|buildMergedPrim|uvOrigin|epsilon" src/generators/geometry --glob "!_old_system/**"`

```
src/generators/geometry/build-geometry.js:31            import mergePrimitives
src/generators/geometry/build-geometry.js:47            const walls = data.walls
src/generators/geometry/build-geometry.js:54-58         floors (or footprint), then buildWallPrimitives(walls, buildings)
src/generators/geometry/build-geometry.js:78            buildAllLadderPrimitives(conn, walls)
src/generators/geometry/build-geometry.js:83, 92        buildLadderPrimitive(..., walls)
src/generators/geometry/build-geometry.js:98-99        merged = mergePrimitives(primitives, config.primitiveMerge ?? GEOMETRY.primitiveMerge); return
src/generators/geometry/build-wall-primitives.js:7     export function buildWallPrimitives(walls, buildings)
src/generators/geometry/build-wall-primitives.js:10-11 for each wall (index i)
src/generators/geometry/build-wall-primitives.js:13    texKey = wallTextureKey(bi, buildings)
src/generators/geometry/build-wall-primitives.js:16-21 { type 'wall', name `wall_${i}`, x, y, z, w, h, d, textureKey, axis }
src/generators/geometry/merge-primitives.js:15         export function mergePrimitives(primitives, options)
src/generators/geometry/merge/merge-group-type.js:6-13 group: wall | pavement | floor | null (names with _wall_/_batt_ excluded at :8)
src/generators/geometry/merge/merge-group-key.js:6-17   key: type, family, textureKey, q(y), q(h), flags; walls add line key (:13-15)
src/generators/geometry/merge/merge-group-prims.js:10   greedy pairwise fixpoint
src/generators/geometry/merge/merge-two-boxes.js:6      exact-rectangle union test
src/generators/geometry/merge/build-merged-prim.js:6-8  merged prim; uvOrigin carried (:7-8)
src/config.js:216-224                                   GEOMETRY.primitiveMerge { enabled: false (Phase 1 result), types, epsilon }
src/generators/geometry/index.js:12                     barrel export mergePrimitives
```

## E. (removed: not a real issue, per owner)

## F. GLB UVs (Phase 2 target)

Regenerate: `rg -n "uvOrigin|uvHash|glbTileSize|rotateUV|createSlab" src --glob "!_old_system/**"`

```
src/core/geometry-misc.js:17        import GEOMETRY
src/core/geometry-misc.js:19        TILE_SIZE = GEOMETRY.glbTileSize
src/core/geometry-misc.js:25        export function createSlab(..., { rotateUV, uvOffset })   (Phase 2 done: world-space UVs via boxFaceWorldUv)
src/core/geometry-misc.js:25-26     uv attribute read
src/core/geometry-misc.js:31-32     topU/topV swap when rotateUV
src/core/geometry-misc.js:33-40     per-face scales = face size / TILE_SIZE   <- local UV, not world
src/core/geometry-misc.js:44-45     uvHashU / uvHashV
src/core/geometry-misc.js:46-47     uvOrigin ?? { x, y, z }
src/core/geometry-misc.js:48-49     offU / offV per object                    <- Phase 2 removes
src/generators/scene/build-primitive-mesh.js:14-17     slab -> createSlab(..., { rotateUV, uvOrigin: uvOriginCenter(prim) })
src/generators/scene/build-primitive-mesh.js:25-28     wall -> createSlab(..., { uvOrigin: uvOriginCenter(prim) })
(src/generators/scene/uv-origin-center.js deleted in Phase 2; added texture-key-uv-offset.js and src/core/box-face-world-uv.js)
src/generators/scene/build-scene.js:22                 export function buildScene(geometry, config)
src/generators/scene/build-scene.js:44                 buildPrimitiveMesh(prim, getMaterial, ladderOpts) per primitive
src/preview/loaded-map/map-state.js:45-46              loaded-map preview uses buildScene -> buildGlbBuffer (same GLB path)
src/export/glb-exporter.js                              GLB writer (kept)
```

## G. Config keys

Regenerate: `rg -n "^export const|splitTiers|obj:|applyDoorCuts|applyBlobDamage|quadSize|glbTileSize|objAtlas|objSegment|uvHash|primitiveMerge|--obj|--split-tiers|--textures|--preview" src/config.js`

```
src/config.js:36         DEFAULTS.obj: false
src/config.js:37         DEFAULTS.splitTiers: false   (TTS elevator/reveal comment)
src/config.js:70, 73     PREVIEW tab loaded-map (needs null), initialTab run -> loaded-map
src/config.js:81         export const WALL
src/config.js:85-87      applyBlobDamage, applyDoorCuts, quadSize (quadSize has no reader in src, only _old_system)
src/config.js:103        export const FLOOR
src/config.js:114        export const FLOOR_SLAB
src/config.js:206        export const GEOMETRY
src/config.js:207        glbTileSize: 3
src/config.js:208-210   objAtlasTileSize, objSegmentPixelSize, objAtlasPadding  (Phase 3)
src/config.js:212-213   uvHashU, uvHashV                                        (Phase 2 per-key)
src/config.js:214-220   primitiveMerge block
src/config.js:288-292   --preview / --visualize
src/config.js:294-297   --textures
src/config.js:314-317   --obj (sets config.obj; never read)
src/config.js:319-322   --split-tiers
```

`quadSize` is read only in `_old_system/walls/apply-wall-damage.js:4` and `_old_system/walls/generate-interior-walls.js:30`. The current wall path does not use it.

## H. OBJ exporter (Phase 3 removal)

Regenerate: `rg -n "SEG_SIZE|export function|atlasPngBuffer|buildObjAtlas|emitPrimitivesToObj|wallEdgeCovered\(" src/export/obj-geometry/build-obj-and-atlas.js src/export/obj-geometry/add-shared-flat.js src/export/obj-geometry/add-shared-wall.js src/export/obj-geometry/add-sub-box.js`

```
src/export/obj-geometry/build-obj-and-atlas.js:10      import { PNG } from 'pngjs'  (OBJ-only)
src/export/obj-geometry/build-obj-and-atlas.js:13      floorThickness import
src/export/obj-geometry/build-obj-and-atlas.js:39      export function buildObjAndAtlas(geometry, config)
src/export/obj-geometry/build-obj-and-atlas.js:52      export function buildObjAtlas(geometry, config)
src/export/obj-geometry/build-obj-and-atlas.js:53-80   texture pools and fallbacks
src/export/obj-geometry/build-obj-and-atlas.js:95-97   ensureTexture for every primitive
src/export/obj-geometry/build-obj-and-atlas.js:100-101 buildAtlasImage + PNG.sync.write
src/export/obj-geometry/build-obj-and-atlas.js:112     export function emitPrimitivesToObj(primitives, config, atlasCtx, wallPrimsForCoverage)
src/export/obj-geometry/build-obj-and-atlas.js:117     header '# Mordheim Map Generator - subdivided'
src/export/obj-geometry/build-obj-and-atlas.js:128-139 case 'slab': addSimpleBox (solid) / addSharedFlat (shared) / addSubBox
src/export/obj-geometry/build-obj-and-atlas.js:141-181 case 'wall': addSharedWall + four edge helpers, cap culling
src/export/obj-geometry/build-obj-and-atlas.js:170-177 wallEdgeCovered for start/end caps
src/export/obj-geometry/build-obj-and-atlas.js:183     case 'edges'
src/export/obj-geometry/build-obj-and-atlas.js:217-220 case 'ceiling' -> addSharedFlat(..., emitTop false)
src/export/obj-geometry/build-obj-and-atlas.js:222-225 case 'ladder' -> emitLadder
src/export/obj-geometry/add-shared-flat.js:3-4         SEG_SIZE = 3; SEGS_PER_TILE
src/export/obj-geometry/add-shared-flat.js:9           export function addSharedFlat(... uvOrigin)
src/export/obj-geometry/add-shared-flat.js:10-11       segsX / segsZ = ceil(size / SEG_SIZE)
src/export/obj-geometry/add-shared-flat.js:24-26       uvOrigin hash
src/export/obj-geometry/add-shared-flat.js:37-45       top grid, only if emitTop (A0 done)
src/export/obj-geometry/add-shared-flat.js:47-61       bottom grid, simpleBottom 4 corners (A0 done)
src/export/obj-geometry/add-shared-flat.js:76          if (emitTop) faces
src/export/obj-geometry/add-shared-flat.js:92          if (emitBottom) faces
src/export/obj-geometry/add-shared-wall.js:3           SEG_SIZE = 3
src/export/obj-geometry/add-shared-wall.js:9           export function addSharedWall(... uvOrigin)
src/export/obj-geometry/add-shared-wall.js:14-15       segsL / segsH
src/export/obj-geometry/add-shared-wall.js:28-29       uvOrigin hash
src/export/obj-geometry/add-shared-wall.js:34-35       gridW / gridH
src/export/obj-geometry/add-sub-box.js:6               SEG_SIZE = 3
src/export/obj-geometry/add-sub-box.js:12              export function addSubBox(...)
src/export/obj-geometry/add-sub-box.js:42-43, 62-63    segsL / segsH
src/export/obj-geometry/wall-edge-covered.js:11        export function wallEdgeCovered(wallPrim, side, allWallPrims)
src/export/obj-geometry/wall-edge-covered.js:25        y tolerance 0.5
src/export/obj-geometry/export-to-obj.js:14-18        exportToObj -> writes .obj and .png
src/export/obj-geometry/get-obj-output-path.js:1      getObjOutputPath (also used for names in src/index.js:50, 80; keep and rename)
src/export/obj-geometry/ensure-texture.js:7           atlas registration
src/export/obj-geometry/resolve-uv.js:7               resolveUV
src/export/obj-geometry/get-uv.js:10                  getUV (atlas tile)
src/export/obj-geometry/load-tex-pool.js:2            import { PNG } from 'pngjs'  (OBJ-only)
src/export/obj-geometry/build-atlas-image.js:1        import { PNG } from 'pngjs'  (OBJ-only)
src/export/obj-geometry/emit-ladder.js:15, 27         emitLadder; prim.wallOffsetDir
```

The `obj-geometry/` folder holds 24 files in total. Several are used only by the OBJ path (`add-edge*.js`, `add-wall-pair.js`, `emit-floor-slab.js`, `add-vertical-quad.js`, `add-ladder-box.js`, `add-floor-edges-from-gaps.js`, `add-perimeter-edges.js`, `add-simple-box.js`, `add-texture.js`, `create-atlas-state.js`, `build-atlas-image.js`, `load-tex-pool.js`, `get-uv.js`, `resolve-uv.js`, `ensure-texture.js`).

## I. Collision OBJ and per-tier export (Phase 3 removal)

Regenerate: `rg -n "COLLIDABLE_PREFIXES|buildCollisionObj|appendBoundsCage|appendCornerColliders|cornerPostPrimitives|groupPrimitivesByTier|buildTierBuffers|exportTiers" src --glob "!_old_system/**"`

```
src/export/collision-buffer.js:2-8        header: simplified TTS collider
src/export/collision-buffer.js:11-15      COLLIDABLE_PREFIXES
src/export/collision-buffer.js:21         export function buildCollisionObj(geometry)
src/export/collision-buffer.js:28         prefix filter
src/export/collision-buffer.js:30         skip names containing '_wall_' or '_batt_'
src/export/collision-exporter.js:9        import buildCollisionObj
src/export/collision-exporter.js:14-15    exportCollisionObj -> buildCollisionObj
src/export/export-tiers.js:13             import buildObjAtlas, emitPrimitivesToObj
src/export/export-tiers.js:14             import buildCollisionObj
src/export/export-tiers.js:16             import tierOf, tierCount, primBaseY, primTopY
src/export/export-tiers.js:32             appendBoundsCage (identical XZ bounds for TTS alignment)
src/export/export-tiers.js:58             appendCornerColliders
src/export/export-tiers.js:99             cornerPostPrimitives (border_corner_t{t}_{i})
src/export/export-tiers.js:121            export function groupPrimitivesByTier(geometry, config)
src/export/export-tiers.js:140            export function buildTierBuffers(geometry, config, baseName)
src/export/export-tiers.js:141            buildObjAtlas (one shared atlas)
src/export/export-tiers.js:194-195        emitPrimitivesToObj + buildCollisionObj per tier
src/export/export-tiers.js:232            export async function exportTiers(...)
src/export/export-tiers.js:241            per-tier .obj write
src/export/assign-primitive-tier.js:31    primBaseY
src/export/assign-primitive-tier.js:54    export function tierOf(prim, config)   (kept while merge test uses it)
src/export/assign-primitive-tier.js:59-60 floor_f{N}_ name is authoritative
src/export/assign-primitive-tier.js:72    wall row comment
src/generate-collider-buffer.js:11, 18, 22   import, generateColliderToBuffer, buildCollisionObj
src/generate-tiers-buffers.js:12, 20, 24     import, generateTiersToBuffers, buildTierBuffers
src/generate-obj-buffers.js:11, 18, 22       import, generateObjToBuffers, buildObjAndAtlas
```

## J. CLI, library and tools

Regenerate: `rg -n "exportToObj|exportCollisionObj|exportTiers|getObjOutputPath|splitTiers|generate.*ToBuffers|buildScene|exportToGlb" src --glob "!_old_system/**"`

```
src/index.js:9         import parseArgs, PREVIEW
src/index.js:15-17     imports exportToObj, getObjOutputPath, exportCollisionObj
src/index.js:44        runPipeline(config, rng, { recorder, log: true })
src/index.js:49-74     --debug-matrix history (write index per cell)
src/index.js:80        getObjOutputPath(config)
src/index.js:83-85     _geometry.json handover (with collisionMatrix)
src/index.js:88        buildScene(geometry, config)
src/index.js:90-92     comment "Always export both GLB and OBJ with texture atlas"; exportToGlb
src/index.js:94-95     exportToObj; exportCollisionObj (unconditional)
src/index.js:97-102    console summary (GLB, OBJ, Texture, Collision, Geometry)
src/index.js:104-109   --split-tiers -> exportTiers
src/index.js:111-115   --preview -> startPreview
src/lib.js:13-18       imports (generateToBuffer deps)
src/lib.js:20-25       TTS comments and re-exports
src/lib.js:22          export { generateObjToBuffers }
src/lib.js:23          export { generateColliderToBuffer }
src/lib.js:25          export { generateTiersToBuffers }
src/lib.js:34-42       export async function generateToBuffer(seed, opts)  (kept)
src/pipeline.js:9      header mentions "the TTS OBJ"
src/tools/preview-building-export.js:12    import exportToObj
src/tools/preview-building-export.js:92    exportToObj(...)
package.json:3         "version": "0.3.0"
package.json:4         "description": "... for Mordheim / Tabletop Simulator"
package.json:7-9       "exports": { ".": "./src/lib.js" }
package.json:11-21     scripts (no OBJ or TTS scripts)
package.json:32        "pngjs"  (kept: GLB textures)
src/generators/scene/buildTexturePools.js:7   import PNG (kept)
src/generators/generate-textures.js:7         import PNG (kept)
```

## K. Hook, settings and agents

Regenerate: `rg -n "25,000|25000|23,000|25k|TTS|vertex" .claude --glob "!node_modules/**"`

```
.claude/hooks/check-vertex-count.mjs:2-5    header: 23,000 warn, 25,000 error, PostToolUse
.claude/hooks/check-vertex-count.mjs:17     only after src/index.js runs
.claude/hooks/check-vertex-count.mjs:23     OBJ files, excluding collision
.claude/hooks/check-vertex-count.mjs:27     vertex count = ^v lines
.claude/hooks/check-vertex-count.mjs:29     ERROR > 25000
.claude/hooks/check-vertex-count.mjs:31     WARNING > 23000
.claude/settings.json:32                    "command": "node .claude/hooks/check-vertex-count.mjs"
.claude/agents/_session-brief.md:29         TTS vertex limit (25,000 per OBJ model)
.claude/agents/_session-brief.md:74         always flag 25k limit
.claude/agents/pr-shipper.md:32             "expected baseline: one it.fails for seed 100" (stale)
.claude/agents/pr-shipper.md:34             confirm vertex counts under 25,000
.claude/agents/release-validator.md:32      fail if OBJ exceeds 25,000
.claude/agents/release-validator.md:72      vertex count hard limit (>23,000)
.claude/agents/status-tracker.md:55         OBJ "Subdivided + atlas"
.claude/agents/status-tracker.md:64         "42 | 24,672 | Warning (close to 25k)" (stale)
.claude/agents/test-builder.md:94           UV within atlas tile bounds
.claude/agents/vertex-optimiser.md:3, 10    description and scope are TTS vertex limits
.claude/agents/vertex-optimiser.md:28       flag OBJ over 23k/25k
.claude/agents/vertex-optimiser.md:74-78    3" subdivision and no-UV collider guidance
.claude/agents/vertex-optimiser.md:115, 127 "TTS headroom", "% of 25k limit"
```

## L. Tests that pin counts, UVs, vertices or TTS behaviour

Regenerate: `rg -n "toBe\(|toMatchInlineSnapshot|25000|25k|uvOrigin|uv'|getAttribute\('uv'\)|primitives: |\.length\)\.toBe" tests --glob "*.js"`

```
tests/snapshot.test.js:3              import buildObjAndAtlas
tests/snapshot.test.js:31-35          objVertexCount(seed)
tests/snapshot.test.js:52-56          25k TTS limit test (normal test, not it.fails)
tests/snapshot.test.js:78             "primitives": 1079   (seed 42, locked)
tests/snapshot.test.js:82             "walls": 485         (seed 42, locked)
tests/snapshot.test.js:87-89          seed 42 OBJ vertex lock: 20196
tests/snapshot.test.js:103            "primitives": 1127   (seed 100, locked)
tests/snapshot.test.js:107            "walls": 587         (seed 100, locked)
tests/snapshot.test.js:112-114        seed 100 OBJ vertex lock: 21638
tests/generators/walls.test.js:117-118  walls.length toBe 485; internalWalls toBe 9
tests/generators/floors.test.js:64-72   floor rects positive size and inside footprint (keep)
tests/generators/merge-primitives.test.js:5-8   imports mergePrimitives, mergeTwoBoxes, tierOf, buildCollisionObj
tests/generators/merge-primitives.test.js:58     collision volume test (rewrite on primitives in Phase 3)
tests/generators/merge-primitives.test.js:95-107 uvOrigin assertions (Phase 2)
tests/generators/merge-primitives.test.js:176-181 uvOrigin containment check (Phase 2)
tests/core/geometry.test.js:10-45     createSlab UV scale and rotate tests (Phase 2)
tests/core/geometry.test.js:168-173   no-UV branch
tests/export/obj-exporter.test.js:3, 6, 17-19   OBJ + atlas build, TTS limit constant
tests/export/obj-exporter.test.js:33-34         "stays under the 25k TTS vertex limit"
tests/export/obj-exporter.test.js:83            "seed 42 vertex count is locked"
tests/export/export-tiers.test.js:2             import groupPrimitivesByTier
tests/export/export-tiers.test.js:44-46         expected names tier 0
tests/export/export-tiers.test.js:49            expected names tier 2
tests/export/collision-exporter.test.js:2-3     imports exportCollisionObj, buildCollisionObj
tests/export/assign-primitive-tier.test.js:2    imports tierOf, tierCount, primBaseY, primTopY
tests/profiles/withering.test.js:75-76         slim vs full primitive counts (moves with Phase 1)
tests/helpers/run-stages.js:12, 75              runStages returns geometry and matrix (harness for G1 hashes)
```

## M. Docs that describe TTS, the OBJ or the vertex limit

Regenerate: `rg -n "TTS|Tabletop|25,000|25000|25k|atlas|subdivi|OBJ" CLAUDE.md README.md docs --glob "!docs/plans/archive/**" --glob "!docs/processes/pipeline-flows/archive/**" --glob "!docs/reports/**"`

```
CLAUDE.md:1           title "... Terrain for Tabletop Simulator"
CLAUDE.md:5           "Outputs GLB (preview), OBJ + PNG atlas (TTS), and collision OBJ"
CLAUDE.md:11          pngjs (texture atlas generation)
CLAUDE.md:24          7. Export — GLB scene, OBJ (subdivided + atlas), collision mesh
CLAUDE.md:27          OBJ uses 3" segment subdivision with 256px atlas tiles
CLAUDE.md:28          GLB textures tile at 3" repeat (keep)
CLAUDE.md:30          TTS vertex limit: 25,000 per OBJ model
CLAUDE.md:40          "no curves in OBJ export"
CLAUDE.md:55          keep OBJ exporter and GLB scene builder in sync
CLAUDE.md:58          ### Testing
CLAUDE.md:60          Always verify vertex count stays under 25k TTS limit
CLAUDE.md:61          Check both GLB and OBJ output
README.md:3           "for Mordheim / Tabletop Simulator"
README.md:14-15       output/*.obj for TTS import; output/*.png texture atlas
README.md:76          loaded map: 3-inch repeat, as in the GLB (keep)
README.md:107-110     "Importing into Tabletop Simulator" section
README.md:124         7. Export — GLB + OBJ with texture atlas
README.md:150         transparent_base not in TTS
README.md:179         TTS does not support PNG transparency
docs/PROJECT_OVERVIEW.md:1, 5, 11       TTS problem statement and purpose
docs/PROJECT_OVERVIEW.md:67             Export Format: GLB ... TTS-compatible
docs/PROJECT_OVERVIEW.md:76             Correct scale for TTS import
docs/GENERATION_PIPELINE.md:31          stage 11: GLB; OBJ + atlas; collision OBJ; per-tier split
docs/FOLDER_STRUCTURE.md:35             export/ "GLB, OBJ + atlas, collision and per-tier exporters"
docs/AGENTS_AND_HOOKS.md:41             file size reasonable for TTS import (< 50MB)
docs/architecture/design_philosophy.md:63   TTS limits on polygon count and file size
docs/architecture/docs_and_config_guide.md:16     README "TTS import steps"
docs/architecture/docs_and_config_guide.md:29     vertex-limit plans in archive note
docs/architecture/docs_and_config_guide.md:68     DEFAULTS list includes obj, splitTiers
docs/architecture/docs_and_config_guide.md:79     GEOMETRY: OBJ atlas sizes, UV hash (shared GLB and OBJ)
docs/architecture/docs_and_config_guide.md:89     tests: seed 100 exceeds the 25k limit (stale)
docs/issues.md:3                        seeds 7 and 100 exceed the 25k cap (stale after A0 + merge)
docs/issues.md:4                        playtest TTS physics on the 0.25" floor colliders
docs/IMPLEMENTATION_PHASES.md:82, 86-99 Phase 6 TTS integration (historical)
docs/processes/pipeline-flows/8-walls.md:7       "merged back into the fewest rectangles" (inaccurate today)
docs/processes/pipeline-flows/8-walls.md:54      subdivideWall rows 1, 1, 0.75 (keep)
docs/processes/pipeline-flows/8-walls.md:93      link to subdivide-wall.js
docs/processes/pipeline-flows/10-geometry.md:85  mergePrimitives description
docs/processes/pipeline-flows/11-scene-and-export.md:3    "Last verified: 2026-10-13 ... OBJ grid fix added"
docs/processes/pipeline-flows/11-scene-and-export.md:33   GLB UV-mapped from atlas (Phase 2 rewrites)
docs/processes/pipeline-flows/11-scene-and-export.md:44-46 output table: GLB, OBJ + atlas PNG, collision OBJ
docs/processes/pipeline-flows/11-scene-and-export.md:56-63 OBJ ladder mode; Collision OBJ
docs/processes/pipeline-flows/11-scene-and-export.md:73-75 --split-tiers; one shared atlas for all tiers
docs/processes/pipeline-flows/11-scene-and-export.md:90-97 tier manifest table and levelHeight meaning
docs/processes/pipeline-flows/11-scene-and-export.md:103  "Unused vertex grids (OBJ)" (A0)
docs/processes/pipeline-flows/11-scene-and-export.md:131   build-obj-and-atlas.js link
docs/processes/pipeline-flows/11-scene-and-export.md:137-138 GLB and OBJ always exported together; --split-tiers additive
```

## N. Duplicated helpers and stale citations (found this session)

Regenerate: `rg -n "function rectsOverlap|function cellsToRects|function mergeWallCells" src --glob "!_old_system/**"`

```
src/core/rects-overlap.js:5                           export function rectsOverlap(a, b)
src/generators/utils/rects/index.js:9                 export function rectsOverlap(a, b)   <- duplicate
src/generators/streets/write-pavements.js:33          cellsToRects   (now uses the shared cover)
src/generators/walls/merge-wall-cells.js:11           mergeWallCells (now uses the shared cover)
```

Stale citations in the earlier documents (re-derived here; do not reuse their numbers):
- `PRIMITIVE_MERGE_PLAN_2026_10_13.md:45` and `PRIMITIVE_MERGE_MANIFEST` section H: snapshot pins are now `tests/snapshot.test.js:78` and `:103` (the plan's `:80` and `:105` are stale).
- `PRIMITIVE_MERGE_PLAN_2026_10_13.md:33` and `PRIMITIVE_MERGE_MANIFEST` section C: `add-shared-flat.js:28-45` is now `:37-45` (A0 landed).
- `PRIMITIVE_MERGE_MANIFEST` section B: config lines 172–238 are now `config.js:207–243`.
- `pr-shipper.md:32` expects `it.fails` for seed 100; the test is now a normal test (`tests/snapshot.test.js:54-55`).
- `status-tracker.md:64` and `docs_and_config_guide.md:89` cite seed 100 and seed 42 counts from before A0 and the merge.
