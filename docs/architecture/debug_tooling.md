# Debug Tooling — Architecture

**Last updated:** 2026-04-21

---

## Overview

The generator has several independent debug mechanisms. They are activated by CLI flags and operate at different layers — some write files, some start servers, some control what data the visualiser renders. None of them are connected to each other unless stated below.

---

## CLI flags

### `--preview`
- Sets `config.preview = true`
- After generation completes, starts the HTTP preview server (`src/preview/server.js`) on port 3010
- Server routes: `/` → `viewer.html`, `/model.glb`, `/geometry.json`
- `viewer.html` is a basic Three.js GLB viewer with a collision grid toggle (the grid data comes from `geometry.json` which embeds `matrix.toDebugJSON()`)

### `--visualize`
- Sets `config.visualize = true` **and** `config.preview = true`
- Activates the **debug recorder** (`src/preview/debug-recorder.js`): captures per-element rect arrays as each pipeline stage completes
- Writes `output/debug_frames.json` on completion
- Starts the preview server, but directs the browser to `visualizer.html` instead of `viewer.html`
- Also enables the **trigger cell scan** in `emit-anchors.js` — without this flag the scan is skipped and no trigger cell rects are emitted into the frame data (performance saving)

### `--debug-connectivity`
- Sets `config.debugConnectivity = true`
- At the end of `generateConnectivity`, dumps a raw JSON file (`debug_connectivity.json`) to the working directory containing:
  - All anchor records (id, direction, buildingId, cells, tier)
  - All candidate connection records (from/to ids, axis, length, debugRect)
- Independent of `--visualize` — works without starting a server

### `--debug` *(flag exists, currently unused)*
- Sets `config.debug = true`
- Parsed in `config.js` but not read anywhere in the active pipeline. May be a stub for future use.

---

## The visualiser (`visualizer.html`)

Served when `--visualize` is passed. Reads `debug_frames.json` and reconstructs the pipeline step-by-step.

### Data flow
```
node src/index.js --visualize
  → debug-recorder.js captures stage data
  → output/debug_frames.json written
  → server starts → browser opens visualizer.html
  → visualizer.html fetches /debug_frames.json
  → visualizer.html fetches /geometry.json  (for collision grid)
```

### Visualiser toggles

All toggles are **client-side only** — they filter or show/hide data already loaded into the browser. None of them trigger a re-run or re-fetch.

| Button | Key | State | What it controls |
|---|---|---|---|
| Grid [G] | G | `gridVisible` | Shows/hides the 3D collision matrix cell overlays (wireframe + solid fill per cell type) |
| All Layers [A] | A | `showAll` | Renders every stage at once at full opacity, ignoring the step-by-step progression |
| Prior Steps [P] | P | `showPrior` | Shows/hides dimmed geometry from stages before the current one |
| Debug Markers [D] | D | `showDebugMarkers` | Shows/hides debug-only rect types: `trigger`, `anchor`, `connection`, `door` |

### ⚠️ Debug Markers toggle is independent of all server-side flags

The Debug Markers button is **not** connected to `--debug`, `--visualize`, or `--debug-connectivity`. Debug rect data (`trigger`, `anchor`, `connection`, `door` types) is always included in `debug_frames.json` when `--visualize` is used — the button purely controls whether they are rendered client-side. Turning it off does not reduce the data captured or written to disk.

---

## Matrix write history

The collision matrix records a write history for every cell automatically — no flag required. See `docs/plans/COLLISION_MATRIX_HISTORY_PLAN_2026_04_21.md` for the full design. The `--debug-matrix` flag controls only whether the history is serialised to `output/{baseName}_matrix_history.json` at the end of a run; the history is always kept in memory regardless.

---

## Summary table

| Mechanism | Flag | Output | Visualiser impact |
|---|---|---|---|
| Preview server | `--preview` | (none — starts server) | Opens `viewer.html` |
| Debug recorder + visualiser | `--visualize` | `debug_frames.json` | Opens `visualizer.html`; enables trigger cell scan |
| Connectivity dump | `--debug-connectivity` | `debug_connectivity.json` | None |
| Debug flag | `--debug` | (none currently) | None |
| Matrix write history output | `--debug-matrix` *(planned)* | `*_matrix_history.json` | None (conflict highlighting planned separately) |
| Visualiser Debug Markers toggle | (client-side only) | None | Filters `trigger`/`anchor`/`connection`/`door` rects from render |
