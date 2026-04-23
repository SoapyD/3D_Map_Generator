# Streets, Rivers & Pavements — Plan
_2026-04-23_

## Overview

Adds ground-level surface geometry to the map: rivers that wind through street
corridors via A\*, flat street surfaces, and pavement areas within foundation blocks
that aren't covered by buildings. All three surface types are written into the
collision matrix and become placement surfaces for Cover scatter.

River bridge connections are out of scope here — see
`RIVER_CONNECTIONS_PLAN_2026_04_23.md`.

---

## Pipeline position

TBD — deferred until river generation is working and we can see where it best
slots relative to Connectivity and Ladders. For now the stage runs standalone
after Roofs; exact numbering will be decided then.

---

## New CELL values (matrix.js)

```js
STREET:   110,   // flat ground surface in a street corridor (not river)
PAVEMENT: 111,   // flat ground surface inside a foundation, not under a building
RIVER:    112,   // water volume — occupies Y = -riverDepth to Y = -1
```

## New STAGE values (matrix.js)

```js
STREETS:   11,
PAVEMENTS: 12,
```

The constant `BELOW_GROUND = 12` already reserves enough below-ground cells for a
3-cell-deep river.

---

## Input from Stage 1

`generateGrid` already produces everything needed:

```js
data: {
  blocks:       [{ x, z, w, d }],       // foundation rects
  streetBounds: [{ x, z, w, d }],       // 1-BBD-wide gap rects between blocks
  activeArea:   { x, z, w, d },         // BBD-snapped usable area
}
```

`streetBounds` comes from `deriveStreetRects`, which sweeps all block edges to find
rectangular cells whose centre falls outside every block. Each rect is either:
- A **corridor** — one axis equals `streetWidth` (4 inches), the other spans block-to-block
- An **intersection square** — both axes equal `streetWidth`

---

## Phase 1 — Street node graph

The `streetBounds` rects from Stage 1 are already the natural graph nodes — no
separate intersection detection is needed.

Treat each street rect as a **node**. Two nodes are **adjacent** if their rects
share a full edge (one rect's boundary wall equals the other's — no gap, no overlap).

Node record:
```js
{
  id: number,
  rect: { x, z, w, d },    // from streetBounds
  center: { x, z },        // rect midpoint — used as A* position
  isEdgeNode: boolean,      // rect touches the activeArea boundary
  neighbours: number[],     // ids of adjacent nodes
}
```

A node is an **edge node** if any face of its rect lies flush with the `activeArea`
boundary:
```
rect.x === activeArea.x
rect.x + rect.w === activeArea.x + activeArea.w
rect.z === activeArea.z
rect.z + rect.d === activeArea.z + activeArea.d
```

Edge nodes are the candidates for river source and mouth.

---

## Phase 2 — River path (A\*)

### 2a. Select source and mouth

Pick 2 edge nodes using RNG. Prefer nodes on opposite sides of the map to produce
longer rivers — maximise straight-line distance between the two candidates when
sampling.

### 2b. A\* through the node graph

Standard A\* from source to mouth:
- **g cost** — cumulative distance (sum of rect-centre-to-rect-centre distances)
- **h cost** — straight-line distance from current node centre to mouth centre
- **Passable** — all nodes; adjacency is only via shared street edges so crossing a
  foundation is geometrically impossible

The result is an ordered list of node ids: the **river path**.

---

## Phase 3 — River geometry

### 3a. River volume

For each rect in the river path, write `CELL.RIVER` into the matrix at
`Y = -1` down to `Y = -riverDepth` (default `riverDepth = 3`, comfortably within
`BELOW_GROUND = 12`):

```
matrix.setWriteContext(STAGE.STREETS, rivers.length)
for Y = -riverDepth to Y = -1:
  matrix.fillBox(rect.x, Y, rect.z, rect.w, 1, rect.d, CELL.RIVER)
```

The surface at `Y = 0` above river rects is left as open air — no walkable surface
is written here.

### 3b. River banks

The banks are the outer edges of the adjacent foundation block rects — already
defined by the block geometry from Stage 1. No additional derivation needed.

---

## Phase 4 — Street surfaces

All street rects **not** on the river path get `CELL.STREET` written at
`Y = -slabThickness` (the same Y level as `FOUNDATION_PLACEHOLDER` from Stage 1),
replacing the existing `CELL.STREET_PLACEHOLDER`:

```
for each streetRect not in riverPathSet:
  matrix.setWriteContext(STAGE.STREETS, streets.length)
  matrix.fillBox(rect.x, -slabThickness, rect.z, rect.w, slabThickness, rect.d, CELL.STREET)
```

Streets and pavements use different textures. The geometry stage will need a new
primitive builder (or texture mapping entry) for `CELL.STREET` and `CELL.PAVEMENT`,
analogous to how `CELL.WALKWAY` is handled now.

---

## Phase 5 — Pavements

Pavements are ground-level areas inside foundation blocks not covered by a building
shell.

For each block rect, scan every `(cx, cz)` column at `cy = 0` (the shell level).
Cells that are not `CELL.SHELL` get `CELL.PAVEMENT` written at `Y = -slabThickness`:

```
for each block rect:
  for each (cx, cz) in block rect:
    if matrix.getCell(cx, 0, cz) !== CELL.SHELL:
      matrix.setCell(cx, -slabThickness, cz, CELL.PAVEMENT)
```

The check at `cy = 0` correctly identifies building footprints without needing
floor records — shells are stamped in Stage 2 and persist.

---

## Output contract

```js
{
  // all prior fields carried forward, plus:
  rivers: [
    {
      path: number[],           // ordered node ids
      rects: [{ x, z, w, d }], // corresponding street rects
    }
  ],
  streets: [{ x, z, w, d }],   // street rects that are NOT river
  pavements: [{ x, z, w, d }], // pavement rects (one per contiguous pavement cell group)
}
```

---

## New files

| File | Purpose |
|---|---|
| `src/generators/streets/build-node-graph.js` | Converts `streetBounds` into adjacency graph; marks edge nodes |
| `src/generators/streets/find-river-path.js` | A\* search; source/mouth selection |
| `src/generators/streets/write-river.js` | Writes `CELL.RIVER` into matrix |
| `src/generators/streets/write-streets.js` | Writes `CELL.STREET` for non-river rects |
| `src/generators/streets/write-pavements.js` | Scans block rects; writes `CELL.PAVEMENT` |
| `src/generators/streets/index.js` | Orchestrates all phases; exports `generateStreets(data, config, rng, matrix)` |

`src/generators/streets/derive-street-rects.js` already exists and is unchanged.

---

## Changes to existing files

| File | Change |
|---|---|
| `src/generators/collision/matrix.js` | Add `CELL.STREET`, `CELL.PAVEMENT`, `CELL.RIVER`; add `STAGE.STREETS`, `STAGE.PAVEMENTS` |
| `src/index.js` | Call `generateStreets` at the appropriate pipeline position (TBD) |

---

## Config

```js
export const STREETS = {
  riverDepth: 3,   // cells below Y=0 occupied by river volume
};
```

---

## Edge cases

- If fewer than 2 edge nodes exist, skip river generation entirely.
- If A\* finds no path between the chosen source and mouth, retry with a different
  pair up to a fixed limit (e.g. 5 attempts), then skip.
- River rects are excluded from street surface writing and from pavement writing
  (street rects never overlap block rects by construction).
- Pavement check at `cy = 0` correctly handles multi-storey buildings — the shell
  column extends upward from ground, so any building cell reads as `CELL.SHELL`.
