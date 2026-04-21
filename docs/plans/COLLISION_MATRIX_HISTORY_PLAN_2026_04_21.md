# Collision Matrix Write History

**Created:** 2026-04-21
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

Add an optional write-history layer to the collision matrix that records every write to every cell: what the previous value was, what the new value is, and what object caused the change. The history is off by default (zero cost in production) and enabled via a config flag for debugging sessions.

---

## Design

### History record

Each write appends one record to a per-cell log:

```js
{
  prev:   Number,   // cell value before this write
  next:   Number,   // cell value after this write
  stage:  String,   // pipeline stage name, e.g. 'walls', 'connectivity'
  source: String,   // identifying string for the object that caused the write,
                    // e.g. 'wall:N:b03', 'door:A0012', 'floor:b03:tier1'
}
```

Per-cell logs are stored in a sparse `Map<cellIndex, record[]>` — cells that are never written have no entry, keeping memory cost proportional to actual writes rather than matrix volume.

### Matrix API additions

Two new methods on the matrix object, only active when `config.debugMatrix` is true:

```js
// Existing methods gain an optional context parameter:
matrix.setCell(cx, cy, cz, value, context)
matrix.fillBox(x, y, z, w, h, d, value, context)
matrix.fillBoxUnless(x, y, z, w, h, d, value, skipValue, context)

// New read methods:
matrix.getCellHistory(cx, cy, cz)  // → record[] | undefined
matrix.dumpHistory()               // → Map<cellIndex, record[]> — full history
```

`context` is an object `{ stage, source }`. When `config.debugMatrix` is false, the context parameter is accepted but ignored — no branching in callers, no cost.

### Enabling

Add `debugMatrix: true` to the config (CLI flag `--debug-matrix`). When set, the matrix constructor allocates the history map and all write methods record to it.

---

## Implementation steps

### Step 1 — Matrix internals

In `src/generators/collision/matrix.js`:

1. Accept `debugMatrix` flag in `createCollisionMatrix(activeArea, maxTiers, tierHeight, slabThickness, debugMatrix)`
2. Allocate `const history = debugMatrix ? new Map() : null`
3. Add internal `recordWrite(cellIndex, prev, next, context)` helper — no-ops when `history` is null
4. Wrap each write in `setCell`, `fillBox`, `fillBoxUnless` with a `recordWrite` call before the assignment
5. Expose `getCellHistory(cx, cy, cz)` and `dumpHistory()`

### Step 2 — Propagate context through callers

Each pipeline stage that writes to the matrix gains a `{ stage, source }` context on its write calls. Suggested source strings per stage:

| Stage | Example source string |
|---|---|
| Buildings | `'shell:b03'` |
| Floors | `'floor:b03:tier1'` |
| Roofs | `'roof:b03'` |
| Walls | `'wall:N:b03'` |
| Connectivity | `'door:A0012'` |

This is additive — callers that don't pass context still work, they just produce records with `stage: undefined, source: undefined`.

### Step 3 — Output

When `config.debugMatrix` is true, after all pipeline stages complete, write the history to a JSON file alongside the existing debug outputs:

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
        { "prev": 255, "next": 0,  "stage": "buildings", "source": "shell:b03" },
        { "prev": 0,   "next": 90, "stage": "connectivity", "source": "door:A0012" },
        { "prev": 90,  "next": 20, "stage": "walls", "source": "wall:N:b03" }
      ]
    }
  ]
}
```

Only cells with more than one write are included by default (single-write cells are unambiguous). A `--debug-matrix-all` flag includes all written cells.

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
- Not always-on — zero cost when `debugMatrix` is false
- Not a lock mechanism — writes still happen freely; history is observational only

---

## Open questions

1. **Granularity of source strings** — per-building is probably sufficient; per-wall-segment would be very verbose. Decide during Step 2.
2. **Visualiser conflict highlighting** — worth doing immediately alongside Step 3, or defer until we have a concrete debugging need?
3. **History file size** — large maps with many stages could produce large JSON. Consider a compact binary format or a filtered view (conflicts only) as default output.

---

## Implementation status

| Step | Description | Status |
|---|---|---|
| Step 1 | Matrix history internals | ⏳ Pending |
| Step 2 | Propagate context through callers | ⏳ Pending |
| Step 3 | JSON output | ⏳ Pending |
| Step 4 | Visualiser: solid cell fills | ✅ Implemented |
| Step 5 | Visualiser: conflict highlighting | ⏳ Pending |
