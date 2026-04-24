# Streets, Rivers & Pavements — Plan
_2026-04-23_

**Status: ✅ Implemented 2026-04-23**

## Overview

Adds ground-level surface geometry to the map: rivers that wind through street
corridors via A\*, flat street surfaces, and pavement areas within foundation blocks
that aren't covered by buildings. All three surface types are written into the
collision matrix and become placement surfaces for Cover scatter.

River bridge connections are out of scope here — see
`RIVER_CONNECTIONS_PLAN_2026_04_23.md`.

---

## Pipeline position

**Stage 5** — runs after Roofs (Stage 4) and before Connectivity (Stage 6). This
ordering is required so `CELL.RIVER` cells are present in the matrix when
Connectivity's anchor ray-casts fire.

```
Stage 4: Roofs
      ↓
Stage 5: Streets / Rivers / Pavements
      ↓
Stage 6: Connectivity
      ↓
Stage 7: Ladders
      ↓
Stage 8: Walls
```

---

## New CELL values (matrix.js)

```js
STREET:     110,  // flat ground surface in a street corridor (not river)
PAVEMENT:   111,  // flat ground surface inside a foundation, not under a building
RIVER:      112,  // water — 1-cell-thick slab at Y = -riverDepth
RIVER_BANK: 113,  // bank marker at river-bed level on the non-river side of each edge
```

## New STAGE values (matrix.js)

```js
STREETS:   11,
PAVEMENTS: 12,
```

`BELOW_GROUND = 12` already reserves enough below-ground cells for a 3-cell-deep river.

---

## Input from Stage 1

`generateGrid` already produces everything needed:

```js
data: {
  blocks:       [{ x, z, w, d }],  // foundation rects
  streetBounds: [{ x, z, w, d }],  // 1-BBD-wide gap rects between blocks
  activeArea:   { x, z, w, d },    // BBD-snapped usable area
}
```

`streetBounds` comes from `deriveStreetRects`: each rect is either a corridor (one
axis = `streetWidth` = 4 inches) or an intersection square (both axes = `streetWidth`).
These rects are the natural graph nodes — no separate intersection detection needed.

---

## Phase 1 — Street node graph (`build-node-graph.js`)

Treat each street rect as a **node**. Two nodes are **adjacent** if their rects share
an overlapping edge (touching on X or Z axis with non-zero span overlap).

```js
{ id, rect, center: {x,z}, isEdgeNode, neighbours: number[] }
```

An **edge node** has any rect face flush with the `activeArea` boundary. Edge nodes
are the candidates for river source and mouth.

---

## Phase 2 — River path (`find-river-path.js`)

- Shuffle edge nodes with RNG; pick one as source.
- Mouth = farthest edge node from source (maximising straight-line distance).
- A\* through node graph: g = cumulative centre-to-centre distance, h = straight-line
  to mouth. All nodes passable (adjacency is only via shared street edges).
- Retries up to 5 times with a different source if A\* finds no path.
- Returns ordered list of node ids, or `null` if all retries fail.

---

## Phase 3a — River volume (`write-river.js`)

A **1-cell-thick slab** at `Y = -riverDepth` (default 3). Does not touch `Y = 0`.

```
matrix.fillBox(rect.x, -riverDepth, rect.z, rect.w, 1, rect.d, CELL.RIVER)
```

---

## Phase 3b — River banks (`derive-river-banks.js`)

Scans every `CELL.RIVER` cell in the matrix (after Phase 3a). For each of the 4
horizontal neighbours that is not `CELL.RIVER`, an edge is recorded. Contiguous
same-direction edge cells are merged into bank records via run-length encoding.

`CELL.RIVER_BANK` is written at river-bed level (`Y = -riverDepth`) on the **river
side** of each edge so banks appear in the matrix grid overlay.

Bank record: `{ x, z, length, axis: 'NS'|'WE', facing: 'N'|'S'|'E'|'W', bottomY, topY }`

This matrix-scan approach catches all river edges uniformly — including road
crossings where no foundation block is adjacent.

---

## Phase 4 — Street surfaces (`write-streets.js`)

Non-river street rects get `CELL.STREET` written at `Y = -slabThickness`,
replacing `CELL.STREET_PLACEHOLDER`:

```
matrix.fillBox(rect.x, -slabThickness, rect.z, rect.w, slabThickness, rect.d, CELL.STREET)
```

---

## Phase 5 — Pavements (`write-pavements.js`)

Scans each foundation block at `cy = 0`. Any cell that is not `CELL.SHELL` gets
`CELL.PAVEMENT` at `Y = -slabThickness`.

Written cells are collected and converted to **row-run rects** (contiguous cx runs
per cz row) so the geometry builder receives correct pavement outlines that exclude
building footprints, not full block rects.

---

## Output contract

```js
{
  streetNodes: Node[],       // full node graph (debug / future use)
  rivers: [
    {
      path: number[],           // ordered node ids
      rects: [{ x, z, w, d }], // street rects on river path
      banks: [{ x, z, length, axis, facing, bottomY, topY }],
    }
  ],
  streets:   [{ x, z, w, d }], // non-river street rects
  pavements: [{ x, z, w, d }], // row-run rects excluding building shells
}
```

---

## Files

### New

| File | Purpose |
|---|---|
| `src/generators/streets/build-node-graph.js` | Street rect adjacency graph; edge node detection |
| `src/generators/streets/find-river-path.js` | Source/mouth selection + A\* |
| `src/generators/streets/write-river.js` | Writes `CELL.RIVER` (1-cell slab at -riverDepth) |
| `src/generators/streets/derive-river-banks.js` | Matrix scan → bank records + `CELL.RIVER_BANK` writes |
| `src/generators/streets/write-streets.js` | Writes `CELL.STREET` for non-river rects |
| `src/generators/streets/write-pavements.js` | Writes `CELL.PAVEMENT`; returns row-run rects |
| `src/generators/streets/index.js` | Orchestrates all phases; exports `generateStreets` |
| `src/generators/geometry/build-river-primitives.js` | River bed slab (top face at Y=-riverDepth+thickness) |
| `src/generators/geometry/build-river-bank-primitives.js` | Bank slabs on river side of boundary edge |
| `src/generators/geometry/build-street-primitives.js` | Street surface slabs (top face at Y=0) |
| `src/generators/geometry/build-pavement-primitives.js` | Pavement row-run slabs (top face at Y=0) |

`src/generators/streets/derive-street-rects.js` already existed and is unchanged.

### Modified

| File | Change |
|---|---|
| `src/generators/collision/matrix.js` | `CELL.STREET/PAVEMENT/RIVER/RIVER_BANK`; `STAGE.STREETS/PAVEMENTS` |
| `src/generators/geometry/build-geometry.js` | Calls all four new primitive builders |
| `src/generators/scene/buildTexturePools.js` | Added `rivers`, `river_banks`, `streets`, `pavements` categories |
| `src/generators/scene/resolve-textured-material.js` | Texture key handlers for all four types |
| `src/export/obj-geometry/export-to-obj.js` | Loads four new texture pools |
| `src/export/obj-geometry/ensure-texture.js` | Atlas registration for all four new keys |
| `src/generators/connectivity/generate-pillars.js` | Scan extended to `-BELOW_GROUND`; `CELL.RIVER` treated as landing surface |
| `src/index.js` | `generateStreets` called at Stage 5, before Connectivity |
| `src/preview/visualizer.html` | `CELL_TYPES` + `CELL_GROUPS` + checkboxes for Walkways and Rivers |
| `src/preview/debug-recorder.js` | Stage 2 (Streets), Stage 10 (Rivers), Stage 11 (Pavements) |

---

## Config

```js
export const STREETS = {
  riverDepth: 3,  // cells below Y=0 for river volume; must be <= BELOW_GROUND
};

// In GEOMETRY:
riverThickness:    0.25,
riverBankThickness: 0.25,
streetThickness:   0.25,
pavementThickness: 0.25,
```

---

## Texture assets

Stand-in 32×32 PNG placeholders created in both `assets/textures/base/` and
`assets/textures/loaded/`:

| Directory | File |
|---|---|
| `rivers/` | `blue_stone.png` |
| `river_banks/` | `stone_wall.png` |
| `streets/` | `dark_cobble.png` |
| `pavements/` | `grey_stone.png` |

---

## Key implementation notes

- **River is 1 cell thick**, not depth-filling. Slab at `Y = -riverDepth`; trench
  above it (`Y = -1` to `Y = -riverDepth+1`) is empty air.
- **Banks sit on the river side** of the boundary edge, not the pavement side.
  N-facing: `z = bank.z`; S-facing: `z = bank.z - thickness`; etc.
- **Street and pavement tops are at Y = 0** — `y = -thickness`, so their top
  face is flush with the bank tops and ground surface.
- **Pavement rects are row-run derived** from actual written cells, not full block
  rects — building shells are correctly excluded.
- **Pillar scan extended** to `-BELOW_GROUND` so bridge pillars over rivers reach
  the river bed instead of stopping at Y = 0.
- **Edge cases**: fewer than 2 edge nodes → no river; A\* failure → retry up to 5
  times then skip.
