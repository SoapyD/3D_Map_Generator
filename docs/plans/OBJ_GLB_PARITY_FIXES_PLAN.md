# OBJ/GLB Parity Fixes — Shared Geometry Layer with Handover File

## Overview

The GLB scene builder and OBJ exporter both independently traverse the same map data and duplicate significant logic (placement, gap detection, variant handling). Features added to one don't automatically appear in the other — leading to missing pillars, missing bridge wall gaps, and missing roof collision in OBJ.

The fix: extract all "what to render" logic into a shared geometry builder that writes a **handover file** (`_geometry.json`). Each renderer reads that file and only concerns itself with emitting geometry in its own format. The geometry is computed once, consumed multiple times, and inspectable as a debug artifact.

---

## Architecture

### Current Flow
```
                                 ┌─► buildScene() ──► Three.js scene ──► .glb
                                 │                         │
coverData (map generation) ──────┤                         └──► collision-exporter ──► _collision.obj
                                 │
                                 └─► obj-exporter (re-traverses coverData) ──► .obj + .png
```

Both `buildScene()` and `exportToObj()` independently iterate coverData, compute geometry decisions (gap detection, battlement placement, building lookups, etc.), and emit meshes. Logic diverges → bugs.

### Proposed Flow
```
coverData ──► buildGeometry() ──► _geometry.json (handover file)
                                        │
                     ┌──────────────────┼──────────────────┐
                     ▼                  ▼                  ▼
              scene-builder.js   obj-exporter.js    collision-exporter.js
              (reads handover,   (reads handover,   (reads handover,
               emits Three.js)    emits OBJ verts)   emits bounding boxes)
                     ▼                  ▼                  ▼
                   .glb               .obj + .png       _collision.obj
```

### Pipeline Integration (index.js)

The handover step slots in between generation and export:

```js
// Current (line 67):
const scene = buildScene(coverData, config);

// Proposed:
const geometryPath = path.join(config.outputDir, `${baseName}_geometry.json`);
const primitives = buildGeometry(coverData, config);
await writeFile(geometryPath, JSON.stringify(primitives));   // handover file

const scene = buildScene(primitives, config);                // reads primitives, not coverData
const objPath = await exportToObj(primitives, config, dir, baseName);  // same primitives
const collisionPath = await exportCollisionObj(primitives, dir, baseName); // same primitives
```

The same change applies to `tools/preview-building.js` which shares the same call pattern.

---

## Handover File Format (`_geometry.json`)

The handover is a JSON object with a flat array of typed **render primitives** — fully resolved geometry with no map-data lookups remaining. Each primitive has everything a renderer needs to emit it.

```json
{
  "version": 1,
  "primitives": [
    { "type": "slab", "name": "floor_t0_3_5", "x": 3, "y": 0, "z": 5, "w": 12, "h": 0.3, "d": 10,
      "textureKey": "floor:base:0", "emitTop": true, "emitBottom": true, "simpleBottom": true, "rotateUV": false },

    { "type": "edges", "name": "floor_t0_3_5", "x": 3, "y": 0, "z": 5, "w": 12, "h": 0.3, "d": 10,
      "textureKey": "floor:base:0", "edgeGaps": { "north": [...], "south": [...], "east": [...], "west": [...] } },

    { "type": "slab", "name": "bridge_wall_0_L_seg0", "x": 10, "y": 5.5, "z": 8, "w": 4.2, "h": 0.75, "d": 0.25,
      "textureKey": "wall:landmark:0", "emitTop": false, "emitBottom": false },

    { "type": "slab", "name": "pillar_3", "x": 15, "y": 2, "z": 12, "w": 0.5, "h": 3.5, "d": 0.5,
      "textureKey": "walkway:2", "emitTop": false, "emitBottom": false },

    { "type": "quad", "name": "roof_pyramid_0_face_N", "verts": [[x,y,z], [x,y,z], [x,y,z]],
      "normal": [0, 0.6, -0.8], "textureKey": "roof:1" },

    { "type": "ceiling", "name": "roof_ceil_0", "x": 5, "y": 12, "z": 8, "w": 6, "d": 6,
      "textureKey": "floor:building:2" },

    { "type": "ladder", "name": "ladder_0",
      "poles": [{ "x": 5.1, "z": 8.0, "y0": 3.0, "y1": 6.0, "w": 0.24, "d": 0.24 }, ...],
      "rungs": [{ "x": 5.1, "y": 3.75, "z": 8.0, "w": 1.2, "h": 0.18, "d": 0.18 }, ...],
      "isThinX": true, "wallOffsetDir": 1, "textureKey": "ladder:0" }
  ]
}
```

### Primitive Types

| Type | Purpose | Key Fields |
|------|---------|-----------|
| `slab` | Box geometry (floors, walls, walkways, bridges, cover, pillars, battlements) | `x,y,z,w,h,d`, `emitTop`, `emitBottom`, `simpleBottom`, `rotateUV` |
| `edges` | Perimeter/floor edge faces (OBJ only, GLB skips) | Same bbox + `edgeGaps` per side |
| `quad` | Triangular/quad face (pyramid roof slopes) | `verts[]`, `normal` |
| `ceiling` | Downward-facing flat (roof underside) | `x,y,z,w,d` |
| `ladder` | Ladder placement data (poles + rungs) | `poles[]`, `rungs[]`, `isThinX`, `wallOffsetDir` |

### Texture Keys

Semantic strings resolved by each renderer independently:

| Key Format | Example | GLB resolves to | OBJ resolves to |
|-----------|---------|-----------------|-----------------|
| `floor:base:{i}` | `floor:base:0` | `pools.floors[0]` | `getUV(baseIdx)` |
| `floor:building:{i}` | `floor:building:2` | `pools.floors[2]` | `getUV(floorIdx[2])` |
| `wall:standard:{i}` | `wall:standard:1` | `pools.walls[1]` | `getUV(wallIdx[1])` |
| `wall:landmark:{i}` | `wall:landmark:0` | `pools.landmark_walls[0]` | `getUV(buildingWallIdx[0])` |
| `walkway:{i}` | `walkway:3` | `pools.walkways[3]` | `getUV(walkwayIdx)` |
| `roof:{i}` | `roof:0` | `pools.roofs[0]` | `getUV(roofIdx)` |
| `object:{i}` | `object:5` | `pools.objects[5]` | `getUV(objectIdx)` |
| `courtyard` | `courtyard` | `pools.courtyards[0]` | `getUV(courtyardIdx)` |
| `ladder:{i}` | `ladder:0` | `pools.ladders[0]` | `getUV(ladderIdx)` |

The geometry builder doesn't know about materials, UV atlases, or Three.js — it only assigns semantic keys. Each renderer has a small `resolveTexture(textureKey)` function.

---

## Shared Geometry Builder — Section Breakdown

New file: `src/generators/geometry-builder.js`

Single export: `buildGeometry(data, config) → { version, primitives[] }`

All map-data logic moves here. Each section is a function that pushes primitives onto the array.

### 1. Floors
**Moves here:** Tier iteration, building detection (`findBuildingIndex`), texture group lookup, Y placement, `emitTop`/`emitBottom`/`simpleBottom` decisions.
**Emits:** `slab` per section + `edges` per section (with pre-computed `edgeGaps` from adjacency analysis).
**Note:** The `edgeGaps` are computed here by porting `getEdgeCoverage()` logic — it's a geometry decision (where are exposed edges?), not a rendering detail.

### 2. Walls
**Moves here:** Wall iteration, building detection, axis → w/d conversion, texture selection (landmark vs standard based on building size).
**Emits:** `slab` per wall.
**Stays in OBJ:** `wallEdgeCovered` for edge suppression (rendering optimisation — which faces to skip).

### 3. Walkways
**Moves here:** Iteration, branch/blocked detection, texture inheritance via `textureId`, `rotateUV` decision.
**Emits:** `slab` + `edges` per walkway.

### 4. Bridges (the big win)
**Moves here:**
- Bridge slab placement
- **Branch gap detection** — collect perpendicular branches, calculate gap intervals with margin, merge overlaps, split walls into segments. Currently GLB-only; now shared.
- **Wall segment emission** — each non-gap wall portion becomes its own `slab` primitive
- **Battlement placement** — iterate over surviving wall segments only, emit each battlement as a `slab`
- All dimension constants from config

**Emits:**
- `slab` for bridge deck + `edges` for perimeter
- `slab` per wall **segment** (post-gap-splitting), named `bridge_wall_{i}_{side}_seg{j}`
- `slab` per battlement, named `bridge_batt_{i}_{side}_{pos}`

### 5. Pillars
**Moves here:** Iteration over `data.connections.pillars`, texture inheritance lookup.
**Emits:** `slab` per pillar.
**Note:** Currently GLB-only. Moving here fixes missing OBJ export automatically.

### 6. Roofs
**Moves here:** Type detection (flat vs pyramid), tier/building lookup, apex calculation, normal computation.
**Emits:**
- Flat: `slab` (roof texture, top-only) + `ceiling` (floor texture, bottom-only) + `edges`
- Pyramid: 3-4 × `quad` (sloped triangular faces) + `ceiling` (flat underside)

### 7. Cover / Interior Cover / Street Scatter / Deleted Footprints
**Moves here:** Iteration, position, dimensions, texture assignment.
**Emits:** `slab` + `edges` per item.

### 8. Ladders
**Moves here:** Orientation detection, center/spread calculation, rung count + positions, wall offset detection (for flat mode).
**Emits:** `ladder` primitives with pre-computed pole and rung positions.
**Note:** Most divergent section (GLB cylinders vs OBJ flat quads/boxes). The shared layer emits placement data; each renderer chooses its own mesh style.

### 9. Ladder Platforms / Junction Platforms
**Moves here:** Position, dimensions, parent texture lookup.
**Emits:** `slab` + `edges` per platform.

---

## Renderer Changes

### scene-builder.js (GLB)

Becomes a thin primitive consumer:

```js
export function buildScene(primitives, config) {
  const scene = new THREE.Scene();
  const pools = buildTexturePools(config);

  for (const p of primitives.primitives) {
    switch (p.type) {
      case 'slab': {
        const mat = resolveMaterial(p.textureKey, pools);
        const mesh = createSlab(p.x + p.w/2, p.y + p.h/2, p.z + p.d/2, p.w, p.h, p.d, mat);
        mesh.name = p.name;
        scene.add(mesh);
        break;
      }
      case 'quad': {
        // Manual BufferGeometry for pyramid faces
        break;
      }
      case 'ceiling': {
        // Downward-facing slab
        break;
      }
      case 'ladder': {
        // Create cylinder poles + rungs from placement data
        break;
      }
      case 'edges':
        // GLB skips — BoxGeometry includes all faces
        break;
    }
  }
  return scene;
}
```

All building detection, gap calculation, variant logic, iteration — gone. Just emit meshes.

### obj-exporter.js (OBJ)

Same pattern:

```js
export async function exportToObj(primitives, config, outputDir, baseName) {
  // ... atlas setup, helper functions (addSubBox, addSharedFlat, etc.) stay ...

  for (const p of primitives.primitives) {
    const uv = resolveUV(p.textureKey, getUV, indices);
    switch (p.type) {
      case 'slab':
        if (p.shared) {
          addSharedFlat(p.name, p.x, p.y, p.z, p.w, p.h, p.d, uv, p.emitTop, p.emitBottom, p.simpleBottom, p.rotateUV);
        } else {
          addSubBox(p.name, p.x, p.y, p.z, p.w, p.h, p.d, uv, p.emitTop);
        }
        break;
      case 'edges':
        addEdges(p.name, p.x, p.y, p.z, p.w, p.h, p.d, uv, p.edgeGaps);
        break;
      case 'quad':
        addTriangle(p.name, p.verts, p.normal, uv);
        break;
      case 'ceiling':
        addSharedFlat(p.name, p.x, p.y, p.z, p.w, 0, p.d, uv, false, true);
        break;
      case 'ladder':
        addLadderMesh(p.name, p, uv);
        break;
    }
  }
  // ... write file ...
}
```

### collision-exporter.js

Simplifies significantly — no longer needs to traverse a Three.js scene:

```js
export async function exportCollisionObj(primitives, outputDir, baseName) {
  const COLLIDABLE = ['floor_', 'cover_', 'interior_cover_', 'ladder_platform_',
    'junction_platform_', 'deleted_', 'walkway_', 'bridge_', 'pillar_',
    'street_scatter_', 'roof_flat_', 'roof_pyramid_'];

  for (const p of primitives.primitives) {
    if (p.type !== 'slab') continue;
    if (!COLLIDABLE.some(prefix => p.name.startsWith(prefix))) continue;
    emitBoundingBox(p.name, p.x, p.y, p.z, p.w, p.h, p.d);
  }
}
```

No Three.js dependency. Reads bounding boxes directly from primitive data. Roof collision comes for free by adding `roof_flat_` and `roof_pyramid_` to the prefix list.

---

## Config Change: `objSegmentPixelSize`

Separate from the refactor — can be done first.

**In `config.js`:**
```js
// Replace:  objSegmentsPerTile: 2
// With:
objSegmentPixelSize: 128,  // pixels per 3" segment (higher = more detail per segment)
                           // 256 = full tile per segment, 128 = 2 segments/tile, 64 = 4 segments/tile
```

**In `obj-exporter.js`:**
```js
const SEG_PIXELS = GEOMETRY.objSegmentPixelSize;       // 128
const SEGS_PER_TILE = TILE_SIZE / SEG_PIXELS;          // 256 / 128 = 2
```

---

## Implementation Order

| Phase | Task | Complexity | Notes |
|-------|------|-----------|-------|
| **1** | Config change (`objSegmentPixelSize`) | Low | Standalone, no deps |
| **2** | Create `geometry-builder.js` scaffold + simple sections (cover, scatter, footprints, platforms) | Low | Prove the pattern works |
| **3** | Add walkway + bridge sections (including gap detection + battlements) | Medium-High | The biggest win — fixes parity bugs |
| **4** | Add pillar section | Low | Fixes missing OBJ pillars |
| **5** | Add roof section (flat + pyramid) | Medium | Fixes missing collision |
| **6** | Add floor + wall sections | Medium | Largest volume of primitives |
| **7** | Add ladder placement data | Medium | Most divergent renderer logic |
| **8** | Refactor `scene-builder.js` to consume handover | Medium-High | Remove all map traversal |
| **9** | Refactor `obj-exporter.js` to consume handover | Medium-High | Remove all map traversal |
| **10** | Refactor `collision-exporter.js` to consume handover directly | Low | Remove Three.js dependency |
| **11** | Update `index.js` + `preview-building.js` pipeline | Low | Wire up new flow |

**Strategy:** Phases 2-7 build out the geometry builder incrementally. Each section can be tested by comparing its output against what the current renderers compute. Phases 8-10 are the switchover — each renderer gets refactored to consume primitives instead of raw map data.

---

## Handover File Benefits

| Benefit | Detail |
|---------|--------|
| **Parity guarantee** | Both renderers work from identical resolved geometry — impossible to diverge |
| **No redundant computation** | Gap detection, building lookups, battlement placement run once |
| **Debug artifact** | Inspect `_geometry.json` to see exactly what geometry was decided, without loading a 3D viewer |
| **Simpler renderers** | Each renderer becomes a thin loop over primitives — just "how to emit", no "what to emit" |
| **New exporters trivial** | Adding a new format (e.g. FBX, USD) just means writing a new primitive consumer |
| **Collision simplification** | Collision exporter no longer needs a Three.js scene — reads bounding boxes from primitives directly |

---

## What Stays Renderer-Specific

| Concern | Why it stays |
|---------|-------------|
| OBJ subdivision (`addSubBox`, `addSharedFlat`) | Atlas tiling / 3" segment UV mapping is OBJ-only |
| OBJ shared vertex grids | Memory optimisation for OBJ format |
| OBJ `wallEdgeCovered` edge suppression | Render optimisation — which box faces to actually emit |
| GLB `createSlab()` / Three.js materials | Three.js API |
| GLB cylinder ladders vs OBJ flat/box ladders | Mesh style choice per format |
| UV hash application | Same formula, applied differently (atlas coords vs 0-1 space) — formula itself could be a shared util |
| Texture atlas building + PNG export | OBJ-only concern |
| Material pool setup | GLB-only concern |

---

## Test Plan

- **Regression:** For each section migrated, generate seed 42 and diff output against pre-refactor. OBJ/GLB should be byte-identical (except for newly added features).
- **Handover inspection:** Open `_geometry.json` for seed 42, verify bridge_0 wall primitives are split into segments with gaps where branches connect.
- **Pillar count:** Compare `pillar_` primitive count in handover against GLB mesh count — should match.
- **Roof collision:** Verify `roof_flat_` and `roof_pyramid_` primitives appear in collision output.
- **Multi-seed batch:** Run 10+ seeds, compare OBJ object counts against GLB object counts — should match exactly.
- **Config test:** `objSegmentPixelSize: 128` produces identical output to old `objSegmentsPerTile: 2`.
