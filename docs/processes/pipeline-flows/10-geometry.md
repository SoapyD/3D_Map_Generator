# Stage 10: Geometry Build

> Last verified: 2026-10-13 (primitive merge pass added)

## Overview

Converts all pipeline data into a flat array of renderer-agnostic primitives. This is a pure data-transform stage — it reads from pipeline data and produces a serialisable description of every geometric object on the map. No Three.js types appear here. The output is the handover layer between generation and rendering.

## Input Contract

```js
data: {
  buildings: Building[],
  floors: FloorRecord[],
  roofs: RoofRecord[],
  walls: WallSegment[],
  connections: {
    walkways: [],
    bridges: [],
    pillars: [],
    ladderPlatforms: [],
    junctionPlatforms: [],
    ladders: [],
  },
  cover: [],             // shell + roof scatter pieces (from Stage 9)
  streetScatter: [],     // street corridor scatter pieces (from Stage 9)
  deletedFootprints: [],
  rivers: [],
  streets: [],
  pavements: [],
  // all prior fields
}
config: object
```

## Algorithm

`buildGeometry(data, config)` calls a series of primitive builders in order and concatenates their results:

| Builder | Source data | Primitive names |
|---|---|---|
| `buildFloorPrimitives` | `floors[]`, `buildings[]` | `floor_*` |
| `buildBuildingFootprintPrimitives` | `buildings[]` (fallback) | `footprint_*` |
| `buildWallPrimitives` | `walls[]`, `buildings[]` | `wall_*` |
| `buildWalkwayPrimitives` | `connections.walkways` | `walkway_*` |
| `buildBridgePrimitives` | `connections.bridges`, `walkways` | `bridge_*` |
| `buildPillarPrimitives` | `connections.pillars` | `pillar_*` |
| `buildBoxSlabPrimitives` (cover) | `data.cover[]` | `cover_*` |
| `buildBoxSlabPrimitives` (interiorCover) | `data.interiorCover[]` | `interior_cover_*` |
| `buildBoxSlabPrimitives` (streetScatter) | `data.streetScatter[]` | `street_scatter_*` |
| `buildCourtyardPrimitives` | `data.deletedFootprints[]` | `deleted_*` |
| `buildRiverPrimitives` | `data.rivers[]` | `river_*` |
| `buildRiverBankPrimitives` | `data.rivers[].banks` | `river_bank_*` |
| `buildStreetPrimitives` | `data.streets[]` | `street_*` |
| `buildPavementPrimitives` | `data.pavements[]` | `pavement_*` |
| `buildMapSkirtPrimitives` | `config` (mapWidth, mapDepth, riverDepth) | `skirt_N/S/E/W`, `skirt_bottom` |
| `buildRoofPrimitives` | `roofs[]`, `buildings[]` | `roof_*` |
| `buildAllLadderPrimitives` | `connections` | `ladder_*`, `ground_ladder_*` etc. |
| `buildLadderPlatformPrimitives` | `connections.ladderPlatforms` | `ladder_platform_*` |
| `buildJunctionPlatformPrimitives` | `connections.junctionPlatforms` | `junction_platform_*` |

### Map Skirt

`buildMapSkirtPrimitives(config)` emits a 5-panel base box around the map perimeter:

- 4 vertical side panels (N/S/E/W), 1 unit thick, flush outside the map boundary, from Y=0 down to Y=`-(riverDepth+1)`.
- 1 bottom cap slab sealing the underside.
- All panels use texture key `map_skirt`.

Each primitive is a plain JS object:
```js
{
  name: string,          // e.g. 'wall_5', 'skirt_N', 'river_bank_0'
  type: string,          // 'slab' | 'wall' | 'edges' | 'quad' | 'ceiling' | 'ladder'
  x, y, z,              // world origin
  w, h, d,              // dimensions
  textureKey: string,
  // additional fields vary by type (emitTop, emitBottom, thinAxis, axis, ...)
  // uvOrigin?: { x, y, z, w, h, d }  // only on merged primitives: first constituent's box (UV hash origin)
}
```

### Primitive merge pass

After all builders have run, `buildGeometry` calls `mergePrimitives(primitives, config.primitiveMerge ?? GEOMETRY.primitiveMerge)` (`src/generators/geometry/merge-primitives.js`; helpers in `src/generators/geometry/merge/`). It joins adjacent boxes into one primitive so the OBJ spends fewer vertices; the merged list is what GLB, OBJ, collision, tier export and the loaded-map preview all consume. Switch it off with `GEOMETRY.primitiveMerge.enabled = false` (unmerged baseline for A/B comparison).

- **Groups** (`GEOMETRY.primitiveMerge.types`): `wall` (`wall_N`), `pavement` (`pavement_N`), `floor` (`floor_fN_x_z` slabs). Edges, ladders, ceilings, roofs, bridges (`bridge_*`, including `_wall_`/`_batt_` pieces) and everything else are never merged.
- **Candidates must share** type, `textureKey`, `y`, `h`, the flags (`shared`, `emitTop`, `emitBottom`, `simpleBottom`, `rotateUV`, `axis`) and the name family (`floor_fN` so the tier named by the prefix never changes). Walls also share their line (axis plus the fixed cross-coordinate and thickness), so only collinear walls can join.
- **Geometry rule**: two boxes merge only when their union is exactly a rectangle (equal extent on one axis, touching end-to-end on the other). Overlaps and gaps never merge. The pass is a deterministic greedy pairwise fixpoint in primitive order (no RNG).
- **Result**: the merged primitive keeps the earlier constituent's name and position in the list (so name prefixes, `tierOf` and the collision allowlist behave as before) and gains `uvOrigin: { x, y, z, w, h, d }` = the first constituent's box, so the exporters hash the same origin for the per-object UV offset (see stage 11). The input list is not mutated.
- **Wall note**: wall primitives are 1" (or 0.75") tall rows. Rows are never merged vertically (different `y`), so on default-profile maps almost no walls merge; the savings come from pavements and floor plates.

## Output Contract

```js
{
  version: 1,
  primitives: object[],   // flat array of all primitive objects (after the merge pass)
}
// Written to disk as `<baseName>_geometry.json` with collisionMatrix embedded
```

## Key Files

- [src/generators/geometry/build-geometry.js](../../../../src/generators/geometry/build-geometry.js) — entry point
- [src/generators/geometry/merge-primitives.js](../../../../src/generators/geometry/merge-primitives.js) — merge pass (helpers in `merge/`)
- [src/generators/geometry/build-map-skirt-primitives.js](../../../../src/generators/geometry/build-map-skirt-primitives.js) — base box panels
- [src/generators/geometry/build-river-primitives.js](../../../../src/generators/geometry/build-river-primitives.js)
- [src/generators/geometry/build-river-bank-primitives.js](../../../../src/generators/geometry/build-river-bank-primitives.js)
- [src/generators/geometry/build-street-primitives.js](../../../../src/generators/geometry/build-street-primitives.js)
- [src/generators/geometry/build-pavement-primitives.js](../../../../src/generators/geometry/build-pavement-primitives.js)
- [src/generators/geometry/build-scatter-primitives.js](../../../../src/generators/geometry/build-scatter-primitives.js) — shared box-slab builder for cover/scatter

## Edge Cases & Constraints

- If `floors[]` is empty, `buildBuildingFootprintPrimitives` is used as a fallback.
- The map skirt height = `riverDepth + 1` so its bottom cap sits 1 unit below the river floor. `riverDepth` is read from `config.riverDepth ?? STREETS.riverDepth`.
- The `_geometry.json` handover file is written by `src/index.js` after this stage and includes the collision matrix for the viewer's grid toggle.
