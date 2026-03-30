# File Splitting Plan — Reducing Large Scripts for Maintainability

## Overview

Four source files exceed 500 lines, making them expensive to read into context and harder to maintain. This plan splits each into focused modules with clear boundaries. The goal is that no single file exceeds ~400 lines, and that an AI assistant (or human) only needs to read the module relevant to the task at hand.

---

## Files to Split

| File | Lines | Priority | Estimated Savings |
|------|-------|----------|-------------------|
| `connectivity.js` | 1997 | **P0** | ~1600 lines per read (only need 1 of 4 modules) |
| `obj-exporter.js` | 1072 | **P1** | ~700 lines per read (only need helpers OR main loop) |
| `geometry-builder.js` | 753 | **P2** | ~400 lines per read (only need the section being edited) |
| `buildings.js` | 521 | **P3** | ~200 lines per read (marginal, but clean split available) |

---

## P0 — `src/generators/connectivity.js` (1997 lines → 4 files)

The largest file by far. Contains four distinct responsibilities that never call each other except through the main orchestrator.

### Proposed Split

| New File | Source Functions | Est. Lines | Purpose |
|----------|----------------|------------|---------|
| `connectivity.js` | `generateConnectivity()` | ~150 | Orchestrator — calls the others, returns combined result |
| `gap-detection.js` | `detectGapsAndConnect()` + helpers | ~500 | Forced walkway placement, gap analysis |
| `branching.js` | `generateBranches()` + helpers | ~170 | Branch walkway/bridge generation |
| `pillars.js` | `generatePillars()` + helpers | ~90 | Pillar support generation |
| `connectivity-utils.js` | `isClose()`, `walkwaysIntersect()`, `getQuadrantRect()`, `findBuildingIndex()` | ~50 | Shared utility functions |

The bulk of the file (~1150 lines, lines 27-1145) is the main `generateConnectivity()` function which handles initial walkway/bridge placement. This is the orchestrator plus the primary placement logic. `detectGapsAndConnect` (lines 1149-1654, ~500 lines) is the next largest chunk — completely self-contained.

### Context Savings

A typical task touches one concern (e.g. "fix gap detection"). Currently: read 1997 lines. After: read ~500 lines. **~75% reduction.**

---

## P1 — `src/export/obj-exporter.js` (1072 lines → 3 files)

All geometry helper functions are defined inside `exportToObj()` as closures over shared state (`objLines`, `vertOff`, `uvOff`, `normOff`). Extracting them requires passing that state explicitly.

### Proposed Split

| New File | Source Functions | Est. Lines | Purpose |
|----------|----------------|------------|---------|
| `obj-exporter.js` | `exportToObj()` main loop, atlas setup, `resolveUV`, file write | ~200 | Orchestrator + atlas + primitive dispatch |
| `obj-geometry.js` | `addSubBox`, `addSharedFlat`, `addSharedWall`, `addPerimeterEdges`, `addFloorEdgesFromGaps` | ~550 | Box/slab/wall/edge geometry emission |
| `obj-special.js` | `addVerticalQuad`, `addLadderBox`, `emitLadder`, `wallEdgeCovered` | ~250 | Quad, ladder, and wall-coverage helpers |

### Shared State Pattern

The closures currently capture `objLines`, `vertOff`, `uvOff`, `normOff`. Extract to a state object:

```js
// obj-state.js or passed as parameter
const state = { objLines: [], vertOff: 1, uvOff: 1, normOff: 1 };

// Each helper receives state + uv:
export function addSubBox(state, name, x0, y0, z0, sizeX, sizeY, sizeZ, uv, ...) {
  state.objLines.push(`o ${name}`);
  // ... push vertices, increment state.vertOff, etc.
}
```

### Context Savings

Editing a geometry helper (e.g. fixing addSubBox edge faces): read ~550 instead of 1072. **~50% reduction.** Editing the main dispatch loop: read ~200 instead of 1072. **~80% reduction.**

---

## P2 — `src/generators/geometry-builder.js` (753 lines → 2-3 files)

Single export `buildGeometry()` with 12 section blocks. The helper functions at the top (building lookup, edge gaps, bridge gaps) are already cleanly separated.

### Proposed Split

| New File | Source Functions | Est. Lines | Purpose |
|----------|----------------|------------|---------|
| `geometry-builder.js` | `buildGeometry()` main function | ~500 | Primitive emission for all 12 sections |
| `geometry-helpers.js` | `findBuilding`, `findBuildingForWall`, `getTexGroup`, `wallTextureKey`, `floorTextureKey`, `getEdgeGaps`, `findBranchGaps`, `splitWallSegments` | ~200 | Lookup and gap-detection helpers |

### Alternative: Section-Based Split

If `buildGeometry()` grows further, split by section groups:

| New File | Sections | Est. Lines |
|----------|----------|------------|
| `geometry-builder.js` | Orchestrator + floors + walls | ~250 |
| `geometry-connections.js` | Walkways, bridges, pillars | ~250 |
| `geometry-objects.js` | Cover, scatter, roofs, ladders, platforms | ~250 |

### Context Savings

Typical task (e.g. "fix bridge gap detection"): read ~200 helpers file instead of 753. **~70% reduction.** Section-based split: ~250 per read. **~65% reduction.**

---

## P3 — `src/generators/buildings.js` (521 lines → 2 files)

Clean split between the main generator and the big-building layout placer.

### Proposed Split

| New File | Source Functions | Est. Lines | Purpose |
|----------|----------------|------------|---------|
| `buildings.js` | `generateBuildings()`, `pickShape()` | ~340 | Main building generation + shape selection |
| `building-layouts.js` | `placeBigLayout()` | ~180 | Large building layout placement |

### Context Savings

Marginal — most tasks touch the main generator. But `placeBigLayout` is self-contained and rarely edited. **~35% reduction** when only editing layouts.

---

## Implementation Order

| Phase | Task | Risk | Notes |
|-------|------|------|-------|
| **1** | Split `obj-exporter.js` helpers into `obj-geometry.js` + `obj-special.js` | Low | Most impactful for current work; closures → state object is mechanical |
| **2** | Split `connectivity.js` into 4 files | Low | Functions are already isolated; just move + wire imports |
| **3** | Extract `geometry-helpers.js` from `geometry-builder.js` | Low | Top-of-file helpers have no closure dependencies |
| **4** | Split `buildings.js` | Low | Only if touching that file for other work |

### Validation

After each phase:
- Run `node src/index.js --seed 42` and diff OBJ/GLB output against pre-split baseline
- Output should be byte-identical (no logic changes, only file moves)

---

## Rules

- No logic changes during splits — move code only
- Every extracted function gets the same name and signature (plus state param for OBJ helpers)
- Imports stay explicit (no barrel files / re-exports)
- Target: no file exceeds 550 lines after all phases
