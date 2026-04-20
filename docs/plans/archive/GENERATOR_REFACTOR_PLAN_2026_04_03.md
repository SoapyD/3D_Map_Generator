# Generator Refactor Plan

**Date:** 2026-04-02
**Goal:** Break down 15 oversized generator files (limit: 80 lines) into smaller functions, group related files into subfolders, and rename vague subdirectory names.

## Overview

Three changes in order:
1. **Extract** — split large functions into helper files, keep orchestrators under 80 lines
2. **Regroup** — move related loose files into new subfolders
3. **Rename** — give existing subdirectories more descriptive names

All changes are pure refactoring — no behaviour changes.

---

## Phase 1: Function Extraction

For each file, extract logical chunks into new helper files. The main exported function becomes an orchestrator that imports and calls helpers.

### 1.1 connectivity/ files

**generate-walkways.js** (175 lines — worst offender)

| New file | Extracted function(s) | Source lines |
|----------|-----------------------|--------------|
| `generate-walkways-helpers.js` | `findNearestSection(edge, bi, floorData, buildings)` | 63-78 |
| | `buildWalkwayRect(edge, srcRect, tgtRect, y, width)` | 86-116 |
| | `validateWalkway(walkway, tier, data, config, existing)` → `{ valid, blocked }` | 120-192 |
| `cull-walkways.js` | `stripIntersectingWalkways(walkways)` | 203-217 |
| | `cullWalkwaysByTier(walkways, rng, tierHeight)` | 221-236 |

Orchestrator keeps: loop over buildings/tiers/quadrants/edges, calls helpers, returns `{ culledWalkways }`.

**filter-and-cull-ladders.js** (133 lines)

| New file | Extracted function(s) | Source lines |
|----------|-----------------------|--------------|
| `filter-and-cull-ladders-helpers.js` | `filterOrangeOverlaps(orangeLadders, culledWalkways, groundLadders)` | 21-39 |
| | `proximityCullByType(ladders, comparisons, proximity)` — generic same-tier proximity cull reused for yellow/red/orange/cyan | pattern at 58-68, 77-93, 102-113, 138-148 |
| | `cullAndFilterCyan(interiorLadders, finalOrange, rng)` | 130-164 |

Orchestrator keeps: shuffle/slice culls, stitch results together, flag bad orange, return.

**generate-connectivity.js** (118 lines)

| New file | Extracted function(s) | Source lines |
|----------|-----------------------|--------------|
| `upgrade-to-bridges.js` | `upgradeToBridges(finalWalkways, tierHeight, rng)` → `{ bridges, remainingWalkways }` — variant picking, textureId assignment, branch inheritance | 77-136 |
| `align-branch-bridges.js` | `alignBranchBridges(bridges)` — adjust branch start/end to parent edges | 139-176 |

Orchestrator keeps: generate walkways, generate all ladders, filter, gap-detect, branch, upgrade, platforms, pillars, return.

**generate-ground-ladders.js** (116 lines)

| New file | Extracted function(s) | Source lines |
|----------|-----------------------|--------------|
| `generate-ground-ladders-helpers.js` | `buildGroundLadderForEdge(lx, lz, lw, ld, data, config)` — wall check, highest tier, trim to floor, return ladder or null | 76-136 |

Orchestrator keeps: loop over buildings/quadrants/edges, compute position, call helper, filter walkway overlap.

**generate-yellow-ladders.js** (95 lines)

| New file | Extracted function(s) | Source lines |
|----------|-----------------------|--------------|
| `generate-yellow-ladders-helpers.js` | `buildYellowLadderAtEndpoint(w, endpoint, data, config)` — test rect, wall check, position, highest tier, trim, return ladder or null | 33-121 |

Orchestrator keeps: loop blocked walkways, loop endpoints, call helper, push results.

**generate-interior-ladders.js** (90 lines)

| New file | Extracted function(s) | Source lines |
|----------|-----------------------|--------------|
| `generate-interior-ladders-helpers.js` | `positionInteriorLadder(qr, side, width, depth)` → `{ x, z, w, d }` | 79-95 |

Orchestrator keeps: loop buildings/tiers/quadrants/neighbors, compute tier range, call helper, trim, push.

### 1.2 buildings/ files

**generateBuildings.js** (127 lines)

| New file | Extracted function(s) | Source lines |
|----------|-----------------------|--------------|
| `placeSmallBuildings.js` | `placeSmallBuildings(cols, rows, cellW, cellD, config, rng, tiers)` → buildings array | 49-93 |
| `placeBigBuildings.js` | `placeBigBuildings(buildings, specs, config, rng, tiers)` → `{ placedBig, displacedByBig }` | 100-151 |
| `cullBuildings.js` | `cullBuildings(surviving, placedBig, displacedByBig, rng)` → `{ finalBuildings, deletedBuildings }` | 154-188 |

Orchestrator keeps: compute grid, call three helpers in sequence, return.

**generateBigBuilding.js** (115 lines)

| New file | Extracted function(s) | Source lines |
|----------|-----------------------|--------------|
| `buildBigShapes.js` | `buildBigLShape(shape, x, z, segW, segD, maxTier, sizeKey)` | 31-55 |
| | `buildBigNarrowU(shape, x, z, segW, segD, maxTier, sizeKey)` | 56-85 |
| | `buildBigUShape(shape, x, z, segW, segD, maxTier, sizeKey)` | 86-119 |

Orchestrator keeps: common setup, dispatch to shape helper, apply groupMarker, return.

### 1.3 Loose generator files

**cover.js** (106 lines)

| New file | Extracted function(s) | Source lines |
|----------|-----------------------|--------------|
| `generate-rooftop-cover.js` | `generateRooftopCover(data, config, rng)` → cover[] | 28-48 |
| `generate-interior-cover.js` | `generateInteriorCover(data, config, rng)` → interiorCover[] | 52-88 |
| `generate-ground-cover.js` | `generateGroundAndStreetCover(data, config, rng, cover, allLadders, footprints)` → `{ groundCover, streetScatter }` | 101-141 |

Orchestrator keeps: build courtyard footprints, call helpers, filter wall collisions, return.

**walls-main.js** (110 lines)

| New file | Extracted function(s) | Source lines |
|----------|-----------------------|--------------|
| `generate-exterior-walls.js` | `generateExteriorWalls(data, config, rng)` → walls[] | 37-115 |
| `generate-interior-walls.js` | `generateInteriorWalls(data, config, rng)` → walls[] | 118-168 |

Orchestrator keeps: call both, concat, return.

**floors.js** (86 lines)

| New file | Extracted function(s) | Source lines |
|----------|-----------------------|--------------|
| `process-building-floors.js` | `processBuildingFloors(building, buildingIndex, data, config, rng)` → `{ bq, tierSections[], roofs[] }` | 39-127 |

Orchestrator keeps: create base tier, loop buildings, merge results, return.

**branching.js** (126 lines)

| New file | Extracted function(s) | Source lines |
|----------|-----------------------|--------------|
| `find-branch-candidates.js` | `findBranchCandidates(forcedWalkways, data, config)` → candidates[] | 27-133 |
| `filter-branch-candidates.js` | `filterBranchCandidates(candidates, data, allWalkways, tierHeight)` → filtered[] | 137-162 |

Orchestrator keeps: call find, call filter, sort, slice, return.

**pillars.js** (91 lines)

| New file | Extracted function(s) | Source lines |
|----------|-----------------------|--------------|
| `collect-pillar-surfaces.js` | `collectPillarSurfaces(data, tierHeight, slabThickness)` → surfaces[] | 24-39 |

Orchestrator keeps: collect surfaces, loop connections, place pillars, return.

### 1.4 geometry-building/ files

**build-geometry.js** (125 lines)

| New file | Extracted function(s) | Source lines |
|----------|-----------------------|--------------|
| `build-floor-primitives.js` | `buildFloorPrimitives(floorData, buildings, config)` → primitives[] | 42-91 |
| `build-wall-primitives.js` | `buildWallPrimitives(walls, buildings)` → primitives[] | 95-109 |
| `build-walkway-primitives.js` | `buildWalkwayPrimitives(walkways)` → primitives[] | 113-134 |
| `build-pillar-primitives.js` | `buildPillarPrimitives(pillars, bridges, walkways)` → primitives[] | 147-167 |

Orchestrator keeps: call all builders, concat, return `{ version, primitives }`.

### 1.5 Scene builder

**scene-builder.js** (119 lines)

| New file | Extracted function(s) | Source lines |
|----------|-----------------------|--------------|
| `build-primitive-mesh.js` | `buildPrimitiveMesh(prim, getMaterial, ladderOpts)` → mesh[] — the full switch statement | 47-154 |

Orchestrator keeps: setup, create getMaterial, loop primitives, add to scene, return.

---

## Phase 2: Regroup Into Subfolders

Move related loose files into new subfolders. Each new subfolder gets an `index.js` that re-exports the main public function.

### 2.1 cover/

Move from `generators/` into `generators/cover/`:

| File | Notes |
|------|-------|
| `cover.js` → `cover/generate-cover.js` | Main orchestrator |
| `generate-rooftop-cover.js` | New from Phase 1 |
| `generate-interior-cover.js` | New from Phase 1 |
| `generate-ground-cover.js` | New from Phase 1 |
| `cover-overlap.js` | Existing helper |
| `cover-hits-wall.js` | Existing helper |
| `make-cover-piece.js` | Existing helper |

Create `cover/index.js` exporting `generateCover`.

**Import updates:**
- `src/index.js`: `'./generators/cover.js'` → `'./generators/cover/index.js'`
- Internal: cover.js helper imports change from `'./cover-overlap.js'` to `'./cover-overlap.js'` (no change since they move together)
- `make-cover-piece.js` imports from `'./pick/pickCoverType.js'` → `'../selectors/pickCoverType.js'` (after Phase 3 rename)

### 2.2 walls/

Move from `generators/` into `generators/walls/`:

| File | Notes |
|------|-------|
| `walls-main.js` → `walls/generate-walls.js` | Main orchestrator |
| `generate-exterior-walls.js` | New from Phase 1 |
| `generate-interior-walls.js` | New from Phase 1 |
| `apply-wall-damage.js` | Existing helper |
| `merge-segments.js` | Existing helper |
| `split-wall-segments.js` | Existing helper |

Create `walls/index.js` exporting `generateWalls`.

Move `build/buildWall.js` into `walls/buildWall.js` (it's exclusively a wall helper).

**Import updates:**
- `src/index.js`: `'./generators/walls-main.js'` → `'./generators/walls/index.js'`
- `src/tools/preview-building-export.js`: same pattern
- `apply-wall-damage.js`: `'./merge-segments.js'` stays (moves together)
- `walls-main.js`: `'./build/buildWall.js'` → `'./buildWall.js'`
- `walls-main.js`: `'./pick/pickInteriorVariant.js'` → `'../selectors/pickInteriorVariant.js'` (after Phase 3 rename)
- `geometry-building/emit-wall-segments.js`: `'../split-wall-segments.js'` → `'../walls/split-wall-segments.js'`

### 2.3 floors/

Move from `generators/` into `generators/floors/`:

| File | Notes |
|------|-------|
| `floors.js` → `floors/generate-floors.js` | Main orchestrator |
| `process-building-floors.js` | New from Phase 1 |
| `quadrants-to-sections.js` | Existing helper |

Create `floors/index.js` exporting `generateFloors`.

**Import updates:**
- `src/index.js`: `'./generators/floors.js'` → `'./generators/floors/index.js'`
- `src/tools/preview-building-export.js`: same pattern
- `floors.js`: `'./quadrants-to-sections.js'` stays (moves together)
- `floors.js`: `'./pick/pickAdjacentToRemoved.js'` → `'../selectors/pickAdjacentToRemoved.js'` (after Phase 3 rename)

### 2.4 scene/

Move from `generators/` into `generators/scene/`:

| File | Notes |
|------|-------|
| `scene-builder.js` → `scene/build-scene.js` | Main orchestrator |
| `build-primitive-mesh.js` | New from Phase 1 |
| `resolve-debug-material.js` | Existing helper |
| `resolve-textured-material.js` | Existing helper |

Move `build/buildTexturePools.js` into `scene/buildTexturePools.js` (it's exclusively a scene helper).

Create `scene/index.js` exporting `buildScene`.

**Import updates:**
- `src/index.js`: `'./generators/scene-builder.js'` → `'./generators/scene/index.js'`
- `src/tools/preview-building-export.js`: same pattern
- `scene-builder.js`: `'./build/buildTexturePools.js'` → `'./buildTexturePools.js'`
- `resolve-textured-material.js`: `'./pick/pickFromPool.js'` → `'../selectors/pickFromPool.js'` (after Phase 3 rename)

### 2.5 Move into connectivity/

Move from `generators/` into `generators/connectivity/`:

| File | Notes |
|------|-------|
| `branching.js` → `connectivity/branching.js` | Already imported by generate-connectivity via `'../branching.js'` |
| `find-branch-candidates.js` | New from Phase 1 |
| `filter-branch-candidates.js` | New from Phase 1 |
| `pillars.js` → `connectivity/pillars.js` | Already imported by generate-connectivity via `'../pillars.js'` |
| `collect-pillar-surfaces.js` | New from Phase 1 |

**Import updates:**
- `generate-connectivity.js`: `'../branching.js'` → `'./branching.js'`
- `generate-connectivity.js`: `'../pillars.js'` → `'./pillars.js'`
- `branching.js`: `'./connectivity/find-building-index.js'` → `'./find-building-index.js'`

---

## Phase 3: Rename Existing Subdirectories

| Current name | New name | Rationale |
|-------------|----------|-----------|
| `build/` | *(deleted — split)* | `buildWall.js` → `walls/`, `buildTexturePools.js` → `scene/` (done in Phase 2) |
| `find/` | `building-lookup/` | Contains `findBuilding`, `findBuildingForWall`, `findBranchGaps` |
| `get/` | `geometry-helpers/` | Contains `getEdgeGaps`, `getMaterial`, `getTexGroup` |
| `pick/` | `selectors/` | Contains `pickAdjacentToRemoved`, `pickCoverType`, `pickFromPool`, `pickInteriorVariant` |
| `geometry-building/` | `geometry/` | Shorter, clearer |
| `gap-detection/` | *(keep as-is)* | Already descriptive |
| `buildings/` | *(keep as-is)* | Already descriptive |
| `connectivity/` | *(keep as-is)* | Already descriptive |

### Import updates for renames

**`find/` → `building-lookup/`** (3 importers):
- `geometry-building/build-geometry.js`: `'../find/index.js'` → `'../building-lookup/index.js'`
- `geometry-building/build-roof-primitives.js`: same pattern
- `geometry-building/emit-wall-segments.js`: `'../find/index.js'` → `'../building-lookup/index.js'`

**`get/` → `geometry-helpers/`** (4 importers):
- `geometry-building/build-geometry.js`: `'../get/index.js'` → `'../geometry-helpers/index.js'`
- `geometry-building/build-roof-primitives.js`: `'../get/index.js'` → `'../geometry-helpers/index.js'`
- `floor-texture-key.js`: `'./get/getTexGroup.js'` → `'./geometry-helpers/getTexGroup.js'`
- `wall-texture-key.js`: `'./get/getTexGroup.js'` → `'./geometry-helpers/getTexGroup.js'`

**`pick/` → `selectors/`** (5 importers):
- `cover.js` (in `cover/`): `'./pick/pickCoverType.js'` → `'../selectors/pickCoverType.js'`
- `make-cover-piece.js` (in `cover/`): `'./pick/pickCoverType.js'` → `'../selectors/pickCoverType.js'`
- `floors.js` (in `floors/`): `'./pick/pickAdjacentToRemoved.js'` → `'../selectors/pickAdjacentToRemoved.js'`
- `walls-main.js` (in `walls/`): `'./pick/pickInteriorVariant.js'` → `'../selectors/pickInteriorVariant.js'`
- `resolve-textured-material.js` (in `scene/`): `'./pick/pickFromPool.js'` → `'../selectors/pickFromPool.js'`

**`geometry-building/` → `geometry/`** (2 importers):
- `src/index.js`: `'./generators/geometry-building/index.js'` → `'./generators/geometry/index.js'`
- `src/tools/preview-building-export.js`: same pattern (if it imports from geometry-building)

**`build/` → deleted** (split in Phase 2):
- All imports already updated when files moved to `walls/` and `scene/`
- Delete empty `build/` directory and its `index.js`

---

## Final Directory Structure

```
src/generators/
  building-lookup/          (renamed from find/)
    findBranchGaps.js
    findBuilding.js
    findBuildingForWall.js
    index.js
  buildings/                (unchanged name)
    buildBigShapes.js       (new)
    buildDiagonalShape.js
    buildLShape.js
    buildNarrowUShape.js
    buildSmallUShape.js
    buildUShape.js
    cullBuildings.js        (new)
    generateBigBuilding.js
    generateBuildings.js
    getLayoutSpecs.js
    index.js
    overlapsAny.js
    pickShape.js
    placeBigBuildings.js    (new)
    placeSmallBuildings.js  (new)
  connectivity/             (unchanged name)
    align-branch-bridges.js (new)
    branching.js            (moved from generators/)
    collect-pillar-surfaces.js (new)
    cull-walkways.js        (new)
    filter-and-cull-ladders-helpers.js (new)
    filter-and-cull-ladders.js
    filter-branch-candidates.js (new)
    find-branch-candidates.js (new)
    find-building-index.js
    generate-connectivity.js
    generate-ground-ladders-helpers.js (new)
    generate-ground-ladders.js
    generate-interior-ladders-helpers.js (new)
    generate-interior-ladders.js
    generate-ladder-platforms.js
    generate-orange-ladders.js
    generate-tower-ladders.js
    generate-walkways-helpers.js (new)
    generate-walkways.js
    generate-yellow-ladders-helpers.js (new)
    generate-yellow-ladders.js
    get-quadrant-rect.js
    index.js
    is-close.js
    pillars.js              (moved from generators/)
    post-filter-ladders.js
    proximity-cull-walkways.js
    upgrade-to-bridges.js   (new)
    walkways-intersect.js
  cover/                    (new subfolder)
    cover-hits-wall.js      (moved)
    cover-overlap.js        (moved)
    generate-cover.js       (renamed from cover.js)
    generate-ground-cover.js (new)
    generate-interior-cover.js (new)
    generate-rooftop-cover.js (new)
    index.js                (new)
    make-cover-piece.js     (moved)
  floors/                   (new subfolder)
    generate-floors.js      (renamed from floors.js)
    index.js                (new)
    process-building-floors.js (new)
    quadrants-to-sections.js (moved)
  gap-detection/            (unchanged)
    ...
  geometry/                 (renamed from geometry-building/)
    build-all-ladder-primitives.js
    build-bridge-primitives.js
    build-courtyard-primitives.js
    build-floor-primitives.js (new)
    build-geometry.js
    build-junction-platform-primitives.js
    build-ladder-platform-primitives.js
    build-ladder-primitive.js
    build-pillar-primitives.js (new)
    build-roof-primitives.js
    build-scatter-primitives.js
    build-wall-primitives.js (new)
    build-walkway-primitives.js (new)
    emit-battlements.js
    emit-wall-segments.js
    index.js
  geometry-helpers/         (renamed from get/)
    getEdgeGaps.js
    getMaterial.js
    getTexGroup.js
    index.js
  scene/                    (new subfolder)
    build-primitive-mesh.js (new)
    build-scene.js          (renamed from scene-builder.js)
    buildTexturePools.js    (moved from build/)
    index.js                (new)
    resolve-debug-material.js (moved)
    resolve-textured-material.js (moved)
  selectors/                (renamed from pick/)
    index.js
    pickAdjacentToRemoved.js
    pickCoverType.js
    pickFromPool.js
    pickInteriorVariant.js
  walls/                    (new subfolder)
    apply-wall-damage.js    (moved)
    buildWall.js            (moved from build/)
    generate-exterior-walls.js (new)
    generate-interior-walls.js (new)
    generate-walls.js       (renamed from walls-main.js)
    index.js                (new)
    merge-segments.js       (moved)
    split-wall-segments.js  (moved)
  bsp-split.js              (stays — grid helper)
  extract-streets.js        (stays — grid helper)
  floor-texture-key.js      (stays — shared texture util)
  generate-textures.js      (stays — texture generation)
  grid.js                   (stays — stage 1)
  wall-texture-key.js       (stays — shared texture util)
```

Loose files remaining in `generators/`: 6 (grid stage + shared texture utilities).

---

## Execution Order

1. Phase 1 — extract helpers (no moves, no import path changes outside each file)
2. Phase 2 — create subfolders, move files, update imports
3. Phase 3 — rename directories, update imports
4. Run `node src/index.js --seed 42` to verify no breakage
5. Run file-size check to confirm all files under 80 lines

Each phase can be done as a separate commit.
