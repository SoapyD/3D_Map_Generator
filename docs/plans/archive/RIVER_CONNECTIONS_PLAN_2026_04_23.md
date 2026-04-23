# River Connections — Plan
_2026-04-23_

**Status: ✅ Implemented 2026-04-23**

## Overview

Generates ground-level walkway connections across river corridors. Uses bank records
(from the Streets/Rivers stage) as edge sources instead of floor-edge labels. Anchors
emit at `cy = -slabThickness` (matching tier-0 floor anchors) so crossings sit flush
with ground. Candidates flow through the main connectivity pipeline with river-specific
culling rules applied in `filterCandidates`.

---

## Pipeline position

Runs inside `generateConnectivity`, immediately after the main `emitAnchors` call.
River-crossing anchors go through their own `pairAnchors` call with a 5-cell cap,
then merge into the main candidate list before the stacking cull.

---

## Anchor emission (`emit-river-crossing-anchors.js`)

- Source: `data.rivers[].banks` — each bank record has `{ x, z, length, axis, facing, bottomY, topY }`
- Anchor direction = `OPPOSITE[bank.facing]` (fires toward the river)
- `cy = Math.floor(-config.slabThickness / cs)` — matches tier-0 floor anchor Y so walkways are flush
- Grid alignment: `cx % anchorPeriod === 0` (WE-axis banks) / `cz % anchorPeriod === 0` (NS-axis banks) — uses the **same global grid** as `emitAnchors`, not a relative offset
- `buildingId = 'river_crossing'` — flags candidates for special filter handling
- `CELL.STREET_PLACEHOLDER` cleared from river rects in `write-river.js` so anchor cells are CELL.EMPTY at `cy = -1`

---

## Pairing

```js
pairAnchors(riverAnchors, matrix, { maxConnectionLength: 5 })
```

River corridors are 4 cells wide; the 5-cell cap prevents pairing across multiple corridors.

---

## Filter pass (`filterCandidates`)

River crossing candidates (`fromBuildingId === 'river_crossing'`) are separated from
regular candidates and processed by `cullRiverCrossings`:

1. **Group by section** — keyed by `czAnchor` (NS-axis) or `cxAnchor` (WE-axis), which uniquely identifies the corridor rect (stretch between two river nodes)
2. **Shuffle** within each group for random selection
3. **Keep 1** per section
4. **Long stretch rule**: if any remaining candidate is >10 cells from the first, pick one of them as a guaranteed 2nd
5. **Short stretch fallback**: 10% chance of a 2nd from remaining candidates

Regular candidates go through the normal per-building quota filter unchanged.

---

## Files

| File | Change |
|---|---|
| `src/generators/connectivity/emit-river-crossing-anchors.js` | **new** — emits ground-level anchors from bank edges |
| `src/generators/connectivity/index.js` | Calls `emitRiverCrossingAnchors`, merges candidates before stack cull |
| `src/generators/connectivity/filter-candidates.js` | `cullRiverCrossings` — per-section culling with long-stretch guarantee |
| `src/generators/streets/write-river.js` | Clears `CELL.STREET_PLACEHOLDER` at `cy = -slabThickness` for river rects |
| `src/config.js` | Added `riverCrossingMaxLength: 5`, `riverCrossingSpacing: 3` to `CONNECTIVITY` |
