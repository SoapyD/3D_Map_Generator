# Connection Rasterisation Plan — Step 7c

**Created:** 2026-04-21
**Depends on:** Connectivity Plan V2 (Phases 1–3 complete, Step 7b-i complete)

---

## Overview

Converts surviving connections into stamped collision cells and segmented geometry descriptors. Handles the case where an NS connection and a WE connection cross the same cells on the same tier — at those cells both connections emit only a floor slab rather than a full sided/battlemented profile.

---

## 1. New collision matrix values

Two new constants added to `src/generators/collision/matrix.js` and documented in `docs/architecture/collision_matrix.md`:

| Value | Constant | Written by | Meaning |
|---|---|---|---|
| `105` | `CELL.WALKWAY` | Connectivity — Step 7c | Walkway or bridge span cell |
| `106` | `CELL.WALKWAY_CROSSING` | Connectivity — Step 7c | Cell where two connections cross — only floor slab emitted |

New `STAGE` enum entry: `STAGE.WALKWAYS` (value `9`) — used as `setWriteContext` stage when writing 105/106.

---

## 2. Connection type assignment

Before any cell work, assign a type to each surviving connection. Type is seeded via `rng`:

- **Tier 1 (ground):** always `walkway`
- **Tier 2+:** roll `rng.chance(bridgeChance)` — if true, weighted-random pick from bridge variants; else `walkway`

```js
// bridge variants (from old system, moved to live config)
bridgeVariants: {
  low:        { weight: 0.5 },   // slab + low continuous side walls
  battlement: { weight: 0.5 },   // slab + low walls + spaced tall sections
}
```

Each connection gets a new field `connectionType: 'walkway' | 'bridge_low' | 'bridge_battlement'`.

---

## 3. Cell enumeration

For each connection, compute the full set of cells it occupies. A connection is always 2 cells wide perpendicular to its travel axis.

**NS connection** (travels along Z):
```
for cz from min(from.cells[0].cz, to.cells[0].cz)
         to max(from.cells[0].cz, to.cells[0].cz) inclusive:
  cells: (from.cells[0].cx, cy, cz)  and  (from.cells[1].cx, cy, cz)
```

**WE connection** (travels along X):
```
for cx from min(from.cells[0].cx, to.cells[0].cx)
         to max(from.cells[0].cx, to.cells[0].cx) inclusive:
  cells: (cx, cy, from.cells[0].cz)  and  (cx, cy, from.cells[1].cz)
```

Store as `connection.spanCells: [{ cx, cy, cz }]`.

---

## 4. Crossing detection (pre-enumeration pass)

After enumerating all connections, build a reverse map before writing anything to the matrix:

```js
const cellOwners = new Map();  // "cx,cy,cz" → [connectionId, ...]

for (const conn of survivors) {
  for (const cell of conn.spanCells) {
    const key = `${cell.cx},${cell.cy},${cell.cz}`;
    if (!cellOwners.has(key)) cellOwners.set(key, []);
    cellOwners.get(key).push(conn.id);
  }
}
```

Any key with 2+ owners is a crossing cell. Collect:

```js
const crossings = new Map();  // cellKey → { cx, cy, cz, connectionIds: [id, id] }

for (const [key, owners] of cellOwners) {
  if (owners.length >= 2) {
    crossings.set(key, { ...parsedCell, connectionIds: owners });
    // mark each owner connection
    for (const id of owners) connectionsById.get(id).hasCrossing = true;
  }
}
```

> **Note on matrix history:** The plan spec called for checking the matrix history when writing each cell to detect crossings. Pre-enumeration is used instead — it is equivalent and avoids the awkward write-then-re-read-history pattern. The matrix history still captures which connection index wrote each cell (via `setWriteContext`), so the crossing record can always be reconstructed from history if needed.

---

## 5. Segment splitting

For connections with `hasCrossing = true`, split `spanCells` into contiguous runs along the travel axis coordinate. A "slice" (all width cells at one travel-axis step) is a crossing slice if any of its cells appears in `crossings`.

```
slices: [
  { travelCoord: number, cells: [...], isCrossing: bool }
]
```

Group contiguous same-type slices into segments:

```js
connection.segments = [
  {
    sliceStart, sliceEnd,   // travel-axis range (inclusive)
    cells: [...],           // all cells in this segment
    isCrossing: bool,       // true → floor slab only, no side walls
    worldRect: { x, z, w, d }  // derived from cell coordinates
  }
]
```

Connections with `hasCrossing = false` get a single segment covering the full span (`isCrossing: false`).

---

## 6. Drawing — two passes

**Pass A — Non-crossing connections** (`hasCrossing === false`):

```js
matrix.setWriteContext(STAGE.WALKWAYS, walkwayIndex);
for (const cell of conn.spanCells) {
  matrix.setCell(cell.cx, cell.cy, cell.cz, CELL.WALKWAY);
}
// push to data.connections.walkways[]
```

**Pass B — Crossing connections** (`hasCrossing === true`):

```js
for (const seg of conn.segments) {
  const cellValue = seg.isCrossing ? CELL.WALKWAY_CROSSING : CELL.WALKWAY;
  matrix.setWriteContext(STAGE.WALKWAYS, walkwayIndex);
  for (const cell of seg.cells) {
    matrix.setCell(cell.cx, cell.cy, cell.cz, cellValue);
  }
}
// push to data.connections.walkways[] with segments array attached
```

The matrix history naturally records which connection index wrote each cell. The `CELL.WALKWAY_CROSSING` value is the cue for the geometry builder to suppress side geometry.

---

## 7. Output shape

```js
data.connections.walkways = [
  {
    id: string,
    connectionType: 'walkway' | 'bridge_low' | 'bridge_battlement',
    axis: 'NS' | 'WE',
    fromBuildingId, toBuildingId,
    tier: cy,
    hasCrossing: bool,
    segments: [
      {
        isCrossing: bool,
        worldRect: { x, y, z, w, d },  // y = world Y of the slab top face
      }
    ],
  }
]
```

Crossing records stored separately for debug/inspection:

```js
data.connections.crossings = [
  { cx, cy, cz, connectionIds: [id, id] }
]
```

---

## 8. Geometry notes

`buildWalkwayPrimitives` and `buildBridgePrimitives` will consume `segments[]` rather than a single rect. The rule per segment:

| `connectionType` | `isCrossing: false` | `isCrossing: true` |
|---|---|---|
| `walkway` | slab + edges | slab only (no edges) |
| `bridge_low` | slab + side walls | slab only |
| `bridge_battlement` | slab + side walls + battlements | slab only |

The "just the floor rect" at crossing points is the `type: 'slab'` primitive already emitted by the bridge builder — the side walls (`emitWallSegments`) and battlements (`emitBattlements`) calls are simply skipped for crossing segments.

---

## 9. Config additions (to live `src/config.js`)

```js
export const CONNECTIVITY = {
  bridgeChance: 0.4,
  bridgeVariants: {
    low:        { weight: 0.5 },
    battlement: { weight: 0.5 },
  },
};
```

---

## 10. Files to create/modify

| File | Change |
|---|---|
| `src/generators/collision/matrix.js` | Add `CELL.WALKWAY = 105`, `CELL.WALKWAY_CROSSING = 106`, `STAGE.WALKWAYS = 9` |
| `docs/architecture/collision_matrix.md` | Document new values and stage enum entry |
| `src/generators/connectivity/rasterise-connections.js` | **New** — type assignment, cell enumeration, crossing detection, two-pass matrix writes |
| `src/generators/connectivity/index.js` | Call `rasteriseConnections` after `stampDoors`, attach `walkways` and `crossings` to output |
| `src/generators/geometry/build-walkway-primitives.js` | Consume `segments[]`, suppress side geometry on `isCrossing` segments |
| `src/generators/geometry/build-bridge-primitives.js` | Segment-aware, skip walls/battlements on crossing segments |
| `src/config.js` | Add `CONNECTIVITY` block |

---

## Implementation status

| Step | Status |
|---|---|
| New CELL constants + STAGE enum | ✅ Complete |
| Config additions | ✅ Complete |
| `rasterise-connections.js` — type assignment | ✅ Complete |
| `rasterise-connections.js` — cell enumeration | ✅ Complete |
| `rasterise-connections.js` — crossing detection | ✅ Complete |
| `rasterise-connections.js` — two-pass matrix writes | ✅ Complete |
| `connectivity/index.js` wiring | ✅ Complete |
| `build-walkway-primitives.js` segment support | ✅ Complete |
| `build-bridge-primitives.js` segment support | ✅ Complete |

---

## Post-plan changes (2026-04-21)

**Bug fix — crossing detection:** `cellOwners` was storing `conn.id` (always `undefined` — connections have no id field) instead of connection object references. The `connById` lookup therefore always returned the last connection in the survivors array, so `hasCrossing` was never correctly set on crossing pairs. Fixed by storing connection objects directly and marking `conn.hasCrossing = true` without a map lookup.

**Edges suppressed for crossing bridge segments:** The plan specified "slab only" for `isCrossing` segments but `build-bridge-primitives.js` was still emitting `type: 'edges'` unconditionally. Fixed to guard edges behind `if (!seg.isCrossing)`, matching the walkway builder.

**Shared texture index and type for crossing groups:** After crossing detection, a union-find pass groups all crossing connections. All connections in the same group receive the same `texIndex` (the root's array index) and the same `connectionType` (the root's type). Geometry builders use `texIndex` instead of their loop counter so crossing connections resolve to the same texture pool entry and are visually consistent.

**Connection type system redesigned:** The original two-layer system (`bridgeChance` gate + variant percentages) was replaced with a single direct-percentage roll per length band. `bridgeChance` and `bridgeLongChance` removed from config. `bridgeVariants` and `bridgeVariantsLong` now include a `walkway` entry so the roll is a single pass with final probabilities summing to 100%.
