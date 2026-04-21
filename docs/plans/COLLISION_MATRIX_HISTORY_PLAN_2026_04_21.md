# Collision Matrix Write History

**Created:** 2026-04-21
**Last updated:** 2026-04-21
**Status:** Planned — not yet implemented

---

## Problem

The collision matrix stores a single `Uint8Array` of current cell values. When a cell gets overwritten by a later pipeline stage (e.g. a wall cell stamped over a door cell), there is no record of:

- What value the cell held before
- Which pipeline stage (or object within that stage) made each write
- The order in which writes occurred

This makes it hard to diagnose bugs where a stage silently overwrites another stage's work — the final cell value is all that survives.

---

## Goal

Add an always-on write-history layer to the collision matrix that records every non-empty write to every cell: what the previous value was, what the new value is, which pipeline stage made the change, and a direct index into that stage's source array so the exact object can be retrieved without any bounding-box lookups.

History is stored in a compact typed format — **5 bytes per write record** — making it negligible to keep alive for every generation run.

---

## Design

### Record format — 5 bytes per write

Each write appends 5 bytes to a per-cell `Uint8Array` buffer:

| Byte(s) | Field | Type | Notes |
|---|---|---|---|
| 0 | `prev` | `Uint8` | Cell value before this write |
| 1 | `next` | `Uint8` | Cell value after this write |
| 2 | `stage` | `Uint8` | Stage enum — see table below |
| 3–4 | `sourceIndex` | `Uint16LE` | Index into that stage's source array (see below) |

`sourceIndex` supports up to 65,535 objects per stage — sufficient for all current and foreseeable pipeline stages.

### Stage enum

| Value | Stage | Source array |
|---|---|---|
| `0` | Buildings | `data.buildings[]` |
| `1` | Floors | `data.floors[]` |
| `2` | Floors — label pass | `data.floors[]` (nearest building by index) |
| `3` | Roofs | `data.roofs[]` |
| `4` | Roofs — label pass | `data.roofs[]` (nearest building by index) |
| `5` | Connectivity | `data.connections.doors[]` |
| `6` | Walls — Pass 1 (floor labels) | `data.floors[]` (nearest building by index) |
| `7` | Walls — Pass 2 (segments) | `data.walls[]` |
| `8` | Walls — internal | `data.internalWalls[]` |
| `255` | Unknown / no source | — (`sourceIndex` ignored) |

Label passes (floor edge labelling, roof label pass, wall pass 1) don't iterate a natural per-object array — they scan the matrix and overwrite in place. For these, `sourceIndex` points to the nearest building index in the relevant array, which is sufficient to trace which building's geometry was being labelled.

### Storage — sparse Map of typed buffers

```js
// history: Map<cellIndex, Uint8Array>
// Each Uint8Array grows in 5-byte increments, one per write.
// Cells never written have no entry.
```

A sparse `Map<cellIndex, Uint8Array>` is used — cells that are never written have no entry, keeping memory cost proportional to actual writes rather than matrix volume.

**Memory estimate (default 48×48 map):**
- ~20,000 written cells × 1.2 average writes × 5 bytes = **~120 KB**
- Map entry overhead (V8): ~100 bytes per key × 20,000 entries = ~2 MB total with overhead
- Well within always-on budget for a Node.js generation process

### Matrix API

```js
// Existing methods — unchanged external signatures, history recorded internally:
matrix.setCell(cx, cy, cz, value)
matrix.fillBox(x, y, z, w, h, d, value)
matrix.fillBoxUnless(x, y, z, w, h, d, value, skipValue)

// Set once per source object before a write batch (not once per cell):
matrix.setWriteContext(stage, sourceIndex)

// Read methods:
matrix.getCellHistory(cx, cy, cz)
// → Array of decoded records: [{ prev, next, stage, stageName, sourceIndex }, ...]
// → undefined if cell was never written

matrix.dumpHistory()
// → Map<cellIndex, Uint8Array> — raw buffer map for serialisation
```

`setWriteContext` is called once per source object (e.g. once per wall segment before its `fillBox`), not once per cell — keeping call overhead minimal. No change to existing call sites is needed until Step 2 wires up context.

---

## Implementation steps

### Step 1 — Matrix internals

In `src/generators/collision/matrix.js`:

1. Allocate `const history = new Map()` and `let writeCtxStage = 255, writeCtxSource = 0` unconditionally on matrix creation — no flag needed
2. Add internal `recordWrite(cellIndex, prev, next)` — appends 5 bytes to `history.get(cellIndex)`, creating the buffer if absent; skips when `prev === next` (no-op writes)
3. Call `recordWrite` inside `setCell`, `fillBox`, `fillBoxUnless` before each assignment
4. Expose `setWriteContext(stage, sourceIndex)`, `getCellHistory(cx, cy, cz)`, `dumpHistory()`

### Step 2 — Propagate context through callers

Each pipeline stage calls `matrix.setWriteContext(stageEnum, index)` once before writing each source object's cells:

```js
// Example — walls stage (Pass 2):
for (let i = 0; i < walls.length; i++) {
  matrix.setWriteContext(7, i);  // stage 7 = Walls Pass 2, index into data.walls[]
  const seg = walls[i];
  matrix.fillBoxUnless(seg.x, seg.y, seg.z, seg.w, seg.h, seg.d, WALL_CELL[seg.direction], CELL.DOOR);
}
```

### Step 3 — JSON output

Write the history to JSON when `--debug-matrix` is passed. After all pipeline stages complete:

```
{outputDir}/{baseName}_matrix_history.json
```

Format:

```json
{
  "cells": [
    {
      "cx": 12, "cy": 0, "cz": 7,
      "writes": [
        { "prev": 255, "next": 0,  "stage": 0, "stageName": "buildings",    "sourceIndex": 3 },
        { "prev": 0,   "next": 90, "stage": 5, "stageName": "connectivity", "sourceIndex": 1 },
        { "prev": 90,  "next": 20, "stage": 7, "stageName": "walls",        "sourceIndex": 47 }
      ]
    }
  ]
}
```

Only cells with more than one write are included by default. A `--debug-matrix-all` flag includes all written cells.

### Step 4 — Visualiser: solid cell fills ✅ Implemented

Grid cells are currently rendered as wireframe `LineSegments`. While functional, wireframes alone are hard to read at a glance, especially at high cell density.

Add a semi-transparent solid mesh fill to each cell cube alongside the existing wireframe:

- For each cell type, build a triangle-face buffer (6 faces × 2 triangles × 3 vertices = 36 vertices per cell) using the same per-type loop that already builds wireframe edge positions
- Create a `THREE.Mesh` per type with `MeshBasicMaterial({ transparent: true, opacity: 0.15, depthWrite: false, side: THREE.DoubleSide })`
- Show/hide the fill meshes in sync with the existing wireframe `typeLines` toggle

`depthWrite: false` prevents z-fighting between adjacent filled cells. The low opacity (0.15) keeps the fills readable without obscuring the geometry behind them.

### Step 5 — Visualiser: conflict highlighting (optional, later)

Once Step 3 (JSON output) is implemented, load the history file in the visualiser and highlight cells with write conflicts (overwritten more than once) in a distinct colour — e.g. red wireframe — to make contested cells immediately visible without manually reading the JSON.

---

## What this is NOT

- Not a replay system — history is a log only, not executable
- Not a lock mechanism — writes still happen freely; history is observational only
- **Not debug-flag gated** — history is always recorded; the JSON output file is only written when `--debug-matrix` is passed

---

## Implementation status

| Step | Description | Status |
|---|---|---|
| Step 1 | Matrix history internals | ⏳ Pending |
| Step 2 | Propagate context through callers | ⏳ Pending |
| Step 3 | JSON output | ⏳ Pending |
| Step 4 | Visualiser: solid cell fills | ✅ Implemented |
| Step 5 | Visualiser: conflict highlighting | ⏳ Pending |
