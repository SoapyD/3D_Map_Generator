# Stage 10: Geometry Build

> Last verified: 2026-04-24

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
}
```

## Output Contract

```js
{
  version: 1,
  primitives: object[],   // flat array of all primitive objects
}
// Written to disk as `<baseName>_geometry.json` with collisionMatrix embedded
```

## Key Files

- [src/generators/geometry/build-geometry.js](../../../../src/generators/geometry/build-geometry.js) — entry point
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
