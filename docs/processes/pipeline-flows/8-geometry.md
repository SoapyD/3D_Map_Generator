# Stage 8: Geometry Build

> Last verified: 2026-04-21

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
    walkways: [],        // currently empty — walkway rasterisation pending
    bridges: [],
    pillars: [],
    ladderPlatforms: [],
    junctionPlatforms: [],
    ladders: [],
  },
  cover: [],
  interiorCover: [],
  streetScatter: [],
  deletedFootprints: [],
  // all prior fields
}
config: object
```

## Algorithm

`buildGeometry(data, config)` calls a series of primitive builders, each producing an array of primitive objects, and concatenates them all:

| Builder | Source data | Primitive type |
|---|---|---|
| `buildFloorPrimitives` | `floors[]`, `buildings[]` | Floor slabs |
| `buildBuildingFootprintPrimitives` | `buildings[]` (fallback if no floors) | Simple footprint boxes |
| `buildWallPrimitives` | `walls[]`, `buildings[]` | Wall boxes |
| `buildWalkwayPrimitives` | `connections.walkways` | Walkway decks |
| `buildBridgePrimitives` | `connections.bridges`, `walkways` | Bridge spans |
| `buildPillarPrimitives` | `connections.pillars`, `bridges`, `walkways` | Support pillars |
| `buildBoxSlabPrimitives` (cover) | `data.cover[]` | Scatter cover pieces |
| `buildBoxSlabPrimitives` (interiorCover) | `data.interiorCover[]` | Interior scatter |
| `buildBoxSlabPrimitives` (streetScatter) | `data.streetScatter[]` | Street objects |
| `buildCourtyardPrimitives` | `data.deletedFootprints[]` | Courtyard slabs |
| `buildRoofPrimitives` | `roofs[]`, `buildings[]` | Roof slabs |
| `buildAllLadderPrimitives` | `connections` (ladders, etc.) | Ladder assemblies |
| `buildLadderPlatformPrimitives` | `connections.ladderPlatforms` | Ladder landing platforms |
| `buildJunctionPlatformPrimitives` | `connections.junctionPlatforms` | Junction platforms |

Each primitive is a plain JS object:
```js
{
  name: string,          // primitive type name (e.g. 'wall', 'floor', 'roof')
  x, y, z,              // world origin
  w, h, d,              // dimensions
  textureKey: string,   // key into the texture atlas
  // additional fields vary by type
}
```

## Output Contract

```js
{
  version: 1,
  primitives: object[],   // flat array of all primitive objects
}
// Also written to disk as `<baseName>_geometry.json` with collisionMatrix embedded
```

## Key Files

- [src/generators/geometry/build-geometry.js](../../../../src/generators/geometry/build-geometry.js) — entry; calls all builders and concatenates
- [src/generators/geometry/build-floor-primitives.js](../../../../src/generators/geometry/build-floor-primitives.js)
- [src/generators/geometry/build-wall-primitives.js](../../../../src/generators/geometry/build-wall-primitives.js)
- [src/generators/geometry/build-roof-primitives.js](../../../../src/generators/geometry/build-roof-primitives.js)
- [src/generators/geometry/build-walkway-primitives.js](../../../../src/generators/geometry/build-walkway-primitives.js)
- [src/generators/geometry/build-bridge-primitives.js](../../../../src/generators/geometry/build-bridge-primitives.js)
- [src/generators/geometry/build-pillar-primitives.js](../../../../src/generators/geometry/build-pillar-primitives.js)
- [src/generators/geometry/build-all-ladder-primitives.js](../../../../src/generators/geometry/build-all-ladder-primitives.js)
- [src/generators/geometry/build-scatter-primitives.js](../../../../src/generators/geometry/build-scatter-primitives.js) — shared box-slab builder for cover/scatter
- [src/generators/geometry/build-courtyard-primitives.js](../../../../src/generators/geometry/build-courtyard-primitives.js)

## Edge Cases & Constraints

- If `floors[]` is empty, `buildBuildingFootprintPrimitives` is used as a fallback — this produces simple solid boxes rather than properly damaged slab geometry.
- `connections.walkways` is currently always an empty array (walkway rasterisation is pending in Stage 5 Step 7c). `buildWalkwayPrimitives` will become active once that is implemented.
- The `_geometry.json` handover file is written by `src/index.js` after this stage and includes the collision matrix for the viewer's grid toggle.
