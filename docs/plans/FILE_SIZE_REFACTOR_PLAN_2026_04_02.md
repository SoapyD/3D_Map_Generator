# File Size Refactor Plan

**Date:** 2026-03-31
**Goal:** Bring all src/ files under the enforced line limits with a 1-pipeline-stage-per-file structure.

## Enforced Limits

| Area | Path | Max effective lines |
|------|------|---------------------|
| Core utilities | `src/core/*.js` | 80 |
| Generator stages | `src/generators/*.js` | 200 |
| Exporters | `src/export/*.js` | 200 |
| Preview | `src/preview/*.js` | 80 |
| Tools | `src/tools/*.js` | 150 |
| Config | `src/config.js` | 300 |
| Root source | `src/*.js` | 120 |

Effective lines = non-blank, non-comment, non-import.

## Current Violations

| File | Effective lines | Limit | Over by |
|------|----------------|-------|---------|
| `generators/connectivity.js` | 895 | 200 | +695 |
| `generators/geometry-builder.js` | 444 | 200 | +244 |
| `generators/gap-detection.js` | 416 | 200 | +216 |
| `export/obj-geometry.js` | 356 | 200 | +156 |
| `tools/preview-building.js` | 331 | 150 | +181 |
| `export/obj-special.js` | 301 | 200 | +101 |
| `generators/buildings.js` | 297 | 200 | +97 |
| `generators/walls.js` | 251 | 200 | +51 |
| `export/obj-exporter.js` | 225 | 200 | +25 |

**Files already compliant:** 20 of 29 files pass.

## Refactoring Order

Work bottom-up — split leaf files first so upstream imports stay stable.

### Phase 1: Exporters (low risk, no pipeline dependencies)

**1a. `export/obj-geometry.js` (356 → 2 files)**

| New file | Functions | Est. lines |
|----------|-----------|------------|
| `obj-geometry-boxes.js` | `addSubBox` | ~180 |
| `obj-geometry-flat.js` | `addSharedFlat`, `addPerimeterEdges` | ~150 |

**1b. `export/obj-special.js` (301 → 2 files)**

| New file | Functions | Est. lines |
|----------|-----------|------------|
| `obj-special-walls.js` | `addSharedWall`, `wallEdgeCovered`, `addFloorEdgesFromGaps` | ~120 |
| `obj-special-ladders.js` | `addVerticalQuad`, `addLadderBox`, `emitLadder` | ~140 |

**1c. `export/obj-exporter.js` (225 → 2 files)**

| New file | Functions | Est. lines |
|----------|-----------|------------|
| `obj-exporter-main.js` | `exportToObj`, primitive dispatch loop | ~140 |
| `obj-exporter-atlas.js` | `loadTexPool`, `ensureTexture`, `getUV`, `resolveUV`, `getObjOutputPath` | ~100 |

### Phase 2: Generator leaf stages

**2a. `generators/buildings.js` (297 → 2 files)**

| New file | Functions | Est. lines |
|----------|-----------|------------|
| `buildings-main.js` | `generateBuildings` orchestrator, placement, overlap removal | ~160 |
| `buildings-shapes.js` | `pickShape`, all shape variant constructors (diagonal, L, U, narrow-U, small-U) | ~145 |

**2b. `generators/walls.js` (251 → 2 files)**

| New file | Functions | Est. lines |
|----------|-----------|------------|
| `walls-main.js` | `generateWalls` orchestrator, exterior + interior generation | ~130 |
| `walls-damage.js` | `applyWallDamage`, `mergeSegments`, `buildWall`, `pickInteriorVariant` | ~130 |

### Phase 3: Geometry builder

**3. `generators/geometry-builder.js` (444 → 2 files)**

| New file | Functions | Est. lines |
|----------|-----------|------------|
| `geometry-builder-main.js` | `buildGeometry` orchestrator — floors, walls, walkways, bridges, pillars, cover | ~200 |
| `geometry-builder-ladders.js` | `buildLadderPrimitive`, roofs (flat + pyramid), ladder platforms, junction platforms | ~160 |

### Phase 4: Connectivity (largest, most complex)

**4a. `generators/gap-detection.js` (416 → 3 files)**

| New file | Functions | Est. lines |
|----------|-----------|------------|
| `gap-detection-main.js` | `detectGapsAndConnect` orchestrator, grid init, pair tracking, deduplication | ~140 |
| `gap-detection-helpers.js` | `bldGroup`, `makePairKey`, `findBldForPoint`, `markWalkwayOnGrid`, `crossesWalkway`, `passesThrough`, `isStackedOnForced`, `findFloorEdge`, `findCrossAxisRange`, `clearBlockingWalls`, `tryForceConnection` | ~190 |
| `gap-detection-scanning.js` | Row scan loop, column scan loop, tier iteration | ~120 |

**4b. `generators/connectivity.js` (895 → 3 files)**

This is the biggest split. The file currently runs as one giant `generateConnectivity()` function with nested helpers.

| New file | Functions | Est. lines |
|----------|-----------|------------|
| `connectivity-main.js` | `generateConnectivity` orchestrator — calls sub-stages, aggregates results | ~150 |
| `connectivity-walkways.js` | Quadrant edge walking, best-section finding, walkway generation, intersection/stacking checks | ~200 |
| `connectivity-ladders.js` | Tower/yellow ladders, ground/red ladders, orange ladders, interior/cyan ladders, ladder platform generation | ~200 |

**Note:** The nested function structure means extracting will require passing shared state (buildings, floors, walls, config, rng) as parameters to the new modules. Use a context object to keep signatures clean.

### Phase 5: Tools

**5. `tools/preview-building.js` (331 → 2 files)**

| New file | Functions | Est. lines |
|----------|-----------|------------|
| `preview-building-main.js` | `main` CLI orchestrator — generation, export dispatch | ~150 |
| `preview-building-setup.js` | `parsePreviewArgs`, `createBuilding`, shape variant construction | ~125 |

## Approach for Each Split

1. Create new files with the extracted functions
2. Update imports in the original file to re-export from new locations (temporary)
3. Update all callers to import from new files directly
4. Delete the re-exports from the original / remove original
5. Run `npm test` after each split to catch breakage
6. One PR per phase

## Files Already Compliant (no action needed)

| File | Effective lines | Limit |
|------|----------------|-------|
| `core/rng.js` | 41 | 80 |
| `core/spatial.js` | 38 | 80 |
| `core/geometry.js` | 136 | 80 |
| `generators/grid.js` | 67 | 200 |
| `generators/floors.js` | 134 | 200 |
| `generators/building-layouts.js` | 138 | 200 |
| `generators/branching.js` | 126 | 200 |
| `generators/pillars.js` | 91 | 200 |
| `generators/cover.js` | 145 | 200 |
| `generators/connectivity-utils.js` | 44 | 200 |
| `generators/geometry-helpers.js` | 154 | 200 |
| `generators/scene-builder.js` | 186 | 200 |
| `generators/generate-textures.js` | 65 | 200 |
| `generators/textures.js` | 44 | 200 |
| `export/glb-exporter.js` | 197 | 200 |
| `export/collision-exporter.js` | 63 | 200 |
| `preview/server.js` | 29 | 80 |
| `tools/preview-bridge.js` | 51 | 150 |
| `config.js` | 230 | 300 |
| `index.js` | 58 | 120 |

**Warning zone (within 10% of limit):**
- `core/geometry.js` — 136/80 — **over limit, needs split in a future pass**
- `generators/scene-builder.js` — 186/200 — monitor
- `export/glb-exporter.js` — 197/200 — monitor

## Note on `core/geometry.js`

At 136 effective lines against an 80-line limit, this file is also over. It should be split in a follow-up:

| New file | Contents | Est. lines |
|----------|----------|------------|
| `core/geometry-rects.js` | Rectangle intersection, overlap, containment helpers | ~50 |
| `core/geometry-edges.js` | Edge detection, wall-facing, quadrant edge helpers | ~50 |
| `core/geometry-misc.js` | Distance, clamping, coordinate helpers | ~40 |
