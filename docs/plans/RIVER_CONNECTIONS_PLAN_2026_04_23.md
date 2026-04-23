# River Connections — Plan
_2026-04-23_

## Overview

Generate ground-level walkway connections across river corridors. Instead of relying
on building floor-edge labels (as the main Connectivity stage does), this pass scans
**pavement rect edges that face the river** and emits anchors directly. The resulting
candidates are capped at 5 cells and fed into the existing filter → rasterise pipeline.

Depends on the streets/rivers stage having run (rivers and pavement rects present in `data`).

---

## Pipeline position

Runs inside `generateConnectivity`, immediately after the main `emitAnchors` pass.
River-crossing anchors are a distinct anchor list that goes through its own `pairAnchors`
call with a tighter length cap, then merges with the main candidates before filtering.

---

## How the existing anchor system works (reference)

`emitAnchors` scans the matrix at each known floor/roof Y level. For each Y:

- **N-S pass**: outer Z, inner X. At every `cx % period === 0`, it checks a 2-cell
  pair `(cx, cz)` and `(cx+1, cz)`. If both carry a N-facing label AND both cells
  one step north are empty → emit a 2-cell N-facing anchor at `(cx, cy, cz-1)` and
  `(cx+1, cy, cz-1)`. Same check for S-facing.

- **W-E pass**: outer X, inner Z. At every `cz % period === 0`, checks `(cx, cz)` and
  `(cx, cz+1)`. E-facing: anchor at `(cx+1, cy, cz)` and `(cx+1, cy, cz+1)`. Same
  for W-facing.

The anchor cell is the step-out position (one cell past the floor edge into open air).
`pairAnchors` then ray-casts outward from each anchor and registers a candidate when
it hits an opposite-facing anchor.

---

## River-crossing anchor emission

### Source of edges

Instead of floor-edge labels, use the **bank records** from `data.rivers[].banks`.
Each bank record already describes a pavement/river boundary edge:
```js
{ x, z, length, axis: 'NS'|'WE', facing: 'N'|'S'|'E'|'W', bottomY, topY }
```
The bank's `facing` is the direction away from the river. The anchor must face
the **opposite** direction (toward the river).

| Bank facing | Anchor direction | Anchor cells step toward |
|---|---|---|
| N | S | river (south) |
| S | N | river (north) |
| E | W | river (west) |
| W | E | river (east) |

### Anchor Y level

River-crossing connections are ground-level (cy = 0). At cy = 0 the river corridor
is `CELL.EMPTY` (river cells are at cy = -riverDepth), so the ray-cast already
passes freely — **no changes to `pair-anchors.js` are needed for this case**.

### Walking the edge

For a **WE-axis bank** (runs along X, N or S facing):
- The boundary is a horizontal line in X at world_z = `bank.z`.
- Anchor cells are at `cz = round((bank.z - oz) / cs)`, cy = 0.
- Walk cx from `round((bank.x - ox) / cs)` in steps of `period` (default 2 for river
  crossings — narrower than the building period of 4 because river corridors are only
  4 cells wide).
- At each step, check the 2-cell pair `(cx, 0, cz)` and `(cx+1, 0, cz)`.
- Both cells must be `CELL.EMPTY` at cy = 0. If yes, emit a 2-wide anchor.

For a **NS-axis bank** (runs along Z, E or W facing):
- Boundary is a vertical line in Z at world_x = `bank.x`.
- Anchor cells at `cx = round((bank.x - ox) / cs)`, cy = 0.
- Walk cz from `round((bank.z - oz) / cs)` in steps of `period`.
- Check `(cx, 0, cz)` and `(cx, 0, cz+1)`. Both must be `CELL.EMPTY`.

### buildingId

River-crossing anchors have no associated building. Set `buildingId = 'river_crossing'`
so the filter stage can handle them as a distinct group (rather than null, which would
merge all of them into one bucket).

---

## Pairing pass

Call `pairAnchors` on the river-crossing anchor list with:

```js
const riverCandidates = pairAnchors(riverAnchors, matrix, {
  maxConnectionLength: 5,   // cap — river corridors are 4 cells wide
});
```

No changes to `pairAnchors` required. The 5-cell cap prevents anchors accidentally
pairing across multiple river corridors.

---

## Merging with main candidates

After the main `pairAnchors` call and before the stacking cull, append `riverCandidates`
to `candidates`. They then flow through the existing pipeline unchanged:

```
stack cull → filterCandidates → cullBridges → stampDoors → rasteriseConnections
```

River-crossing connections will be grouped under `fromBuildingId = 'river_crossing'`
in the filter pass. They should receive a high `filterN` (or skip the per-building
quota) to avoid being culled — there will be very few of them. This can be handled
by adding a special-case in `filterCandidates`: if `fromBuildingId === 'river_crossing'`,
accept all candidates (they're already capped at 5 cells so there won't be many).

---

## New file

| File | Purpose |
|---|---|
| `src/generators/connectivity/emit-river-crossing-anchors.js` | Emits ground-level anchors from pavement/river boundary edges |

---

## Modified files

| File | Change |
|---|---|
| `src/generators/connectivity/index.js` | Import and call `emitRiverCrossingAnchors`; merge river candidates before stack cull |
| `src/generators/connectivity/filter-candidates.js` | Pass-through for `buildingId === 'river_crossing'` |
| `src/config.js` | Add `riverCrossingPeriod: 2` and `riverCrossingMaxLength: 5` to `CONNECTIVITY` |

---

## Edge cases

- A bank edge shorter than 2 cells produces no anchors.
- If no opposing anchor is found within 5 cells, the candidate is not registered
  (normal `pairAnchors` behaviour).
- River intersection nodes (where two river corridors cross) will have bank edges
  on all four sides; anchors can fire in all directions from intersection corners.
