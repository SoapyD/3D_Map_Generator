# Stage 5: Streets, Rivers & Pavements

> Last verified: 2026-04-23

## Overview

Generates all ground-level surface geometry: rivers winding through street corridors via A\*, flat street surfaces, and pavement areas within foundation blocks not covered by buildings. All three types are written to the collision matrix and become placement surfaces for Cover scatter. Must run before Connectivity so river cells are in the matrix when anchor ray-casts fire.

## Input Contract

```js
data: {
  blocks:       [{ x, z, w, d }],  // foundation rects — from Stage 1
  streetBounds: [{ x, z, w, d }],  // 1-BBD gap rects between blocks — from Stage 1
  activeArea:   { x, z, w, d },    // BBD-snapped usable area — from Stage 1
  buildings:    Building[],        // needed for pavement shell exclusion
}
config: {
  slabThickness: number,
  riverDepth: number,   // from STREETS config (default 3)
  allRivers: boolean,   // CLI flag — forces all-rivers mode
}
rng: RNG
matrix: CollisionMatrix
```

## Algorithm

### River mode selection

A weighted RNG roll picks the generation mode before any A\* runs:

| Mode | Weight | Description |
|---|---|---|
| `none` | 80% | No rivers |
| `one` | 10% | One A\* river path |
| `two` | 7.5% | Two A\* river paths (unique source-mouth pairs) |
| `all` | 2.5% | Every street corridor becomes a river |

`--all-rivers` CLI flag overrides the roll and forces `all` mode.

### Phase 1 — Street node graph (`build-node-graph.js`)

`streetBounds` rects are already the natural graph nodes — no intersection detection needed. Two nodes are **adjacent** if their rects share an overlapping edge. Nodes whose rect face lies on the `activeArea` boundary are marked **edge nodes** (river source/mouth candidates).

### Phase 2 — River paths (`find-river-path.js`)

`findRiverPaths(nodes, count, rng)`:
1. Shuffle edge nodes with RNG.
2. Iterate as candidate sources; for each, find the farthest edge node not already paired (`usedPairs` set of `"minId|maxId"` strings).
3. Run A\* (g = centre-to-centre distance, h = straight-line to mouth). Record path if found.
4. Stop when `count` paths found or no more valid pairs.

In `all` mode: skip A\* entirely; use all `streetBounds` as a single river entry with `path: []`.

### Phase 3a — River volume (`write-river.js`)

**All** river volumes are written before any bank derivation. For each rect in each river path:
- Write `CELL.RIVER` (1-cell slab) at `Y = -riverDepth`
- Clear `CELL.STREET_PLACEHOLDER` at `Y = -slabThickness` → `CELL.EMPTY` so Connectivity anchor ray-casts are not blocked

### Phase 3b — River banks (`derive-river-banks.js`)

Scans every `CELL.RIVER` cell; for each of its 4 horizontal neighbours that is not `CELL.RIVER`, records an edge. Contiguous same-direction edges are run-length merged. Writes `CELL.RIVER_BANK` at river-bed level on the non-river side. Deduplicates across rivers sharing an intersection node.

Bank record: `{ x, z, length, axis: 'NS'|'WE', facing: 'N'|'S'|'E'|'W', bottomY, topY }`

### Phase 4 — Street surfaces (`write-streets.js`)

Non-river street rects → `CELL.STREET` at `Y = -slabThickness`, replacing `CELL.STREET_PLACEHOLDER`.

### Phase 5 — Pavements (`write-pavements.js`)

For each foundation block, scan every `(cx, cz)` at `cy = 0`. Cells that are not `CELL.SHELL` get `CELL.PAVEMENT` at `Y = -slabThickness`. Written cells are collected and converted to **row-run rects** (contiguous cx runs per cz row) so geometry correctly excludes building footprints.

## Output Contract

```js
{
  // all prior fields carried forward, plus:
  streetNodes: Node[],
  rivers: [
    {
      path: number[],           // ordered node ids ([] in all-rivers mode)
      rects: [{ x, z, w, d }],
      banks: [{ x, z, length, axis, facing, bottomY, topY }],
    }
  ],
  streets:   [{ x, z, w, d }], // non-river street rects
  pavements: [{ x, z, w, d }], // row-run rects excluding shells
}
```

## Key Files

- [src/generators/streets/index.js](../../../../src/generators/streets/index.js) — entry; mode selection, two-pass write/bank loop, phases 4–5
- [src/generators/streets/build-node-graph.js](../../../../src/generators/streets/build-node-graph.js) — adjacency graph + edge node detection
- [src/generators/streets/find-river-path.js](../../../../src/generators/streets/find-river-path.js) — `findRiverPaths`; A\* with unique-pair tracking
- [src/generators/streets/write-river.js](../../../../src/generators/streets/write-river.js) — writes `CELL.RIVER`; clears street placeholder
- [src/generators/streets/derive-river-banks.js](../../../../src/generators/streets/derive-river-banks.js) — matrix scan → bank records + `CELL.RIVER_BANK`
- [src/generators/streets/write-streets.js](../../../../src/generators/streets/write-streets.js) — writes `CELL.STREET`
- [src/generators/streets/write-pavements.js](../../../../src/generators/streets/write-pavements.js) — writes `CELL.PAVEMENT`; returns row-run rects
- [src/generators/streets/derive-street-rects.js](../../../../src/generators/streets/derive-street-rects.js) — existing helper; unchanged

## Edge Cases & Constraints

- Must run **before** Connectivity (Stage 6) — `CELL.RIVER` must be in the matrix before anchor ray-casts fire. River corridors at `cy = -slabThickness` are `CELL.EMPTY` (placeholder cleared), so crossings work without changes to `pair-anchors.js`.
- All river volumes are written before any bank derivation runs — banks for River 1 cannot span positions River 2 will later occupy.
- Bank derivation uses `!= CELL.RIVER` cell checks, so intersection nodes where two rivers share a rect are handled correctly; duplicate bank records are deduplicated by `(x, z, length, axis, facing)` key.
- Pavement row-run rects correctly exclude building shells; geometry emits flat slabs with top face at `Y = 0`.
- `--all-rivers` overrides the RNG roll regardless of seed.
