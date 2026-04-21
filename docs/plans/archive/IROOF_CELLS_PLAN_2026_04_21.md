# Internal Roof Cell Labelling

**Created:** 2026-04-21
**Status:** Planned — not yet implemented
**Depends on:** Roofs stage (complete)

---

## Problem

The roof label pass currently produces only four cardinal labels (`ROOF_N/S/E/W`) using a simple priority chain — N wins over S over E over W. Two consequences:

1. **Corner/end/island cells are mislabelled** — a roof cell with two exposed faces gets only the highest-priority single-direction label, losing the second exposed face.
2. **No interior distinction** — a roof cell whose exposed face points into a shell gap (e.g. a removed roof quadrant) gets the same label as one exposed to open air. Downstream stages (ladders) cannot tell internal edges from external ones.

Floors solve both problems with the `IFLOOR_*` family. Roofs need parity.

---

## Goal

1. Upgrade the exterior roof labeller to detect corners (`ROOF_NE/NW/SE/SW`), ends (`ROOF_END_*`), and islands (`ROOF_ISLAND`) — matching floor labelling fidelity.
2. Add a full `IROOF_*` family that mirrors `IFLOOR_*`, distinguishing internal-facing roof edges from external ones.
3. Register all new cell IDs in the collision matrix.
4. Add `IROOF_*` to the connectivity anchor emission sets so roof-to-roof connections across internal gaps work correctly.

---

## No new arrays needed

`IFLOOR_*` labels do not have a separate data array — they are cell values in the matrix. `data.floors[]` stores level and rect data; the label pass classifies cells in-place. Roofs follow the same pattern: `data.roofs[]` is unchanged, and `IROOF_*` cells live in the matrix only.

---

## New cell values

### Exterior roof additions (45–48)

Values 45–48 are free between the existing `ROOF_W` (44) and `FOUNDATION_PLACEHOLDER` (50).

| Value | Constant | Meaning |
|---|---|---|
| `45` | `CELL.ROOF_NE` | Exterior corner, north + east exposed |
| `46` | `CELL.ROOF_NW` | Exterior corner, north + west exposed |
| `47` | `CELL.ROOF_SE` | Exterior corner, south + east exposed |
| `48` | `CELL.ROOF_SW` | Exterior corner, south + west exposed |

End and island cells for exterior roofs are deferred — they require cell values in a gap that doesn't exist cleanly before 50. If they are needed in future they can be allocated from the IROOF block or a new reserved range.

### Internal roof additions (91–104)

| Value | Constant | Meaning |
|---|---|---|
| `91` | `CELL.IROOF_N` | Interior-facing roof edge, north exposed (neighbour is SHELL) |
| `92` | `CELL.IROOF_S` | Interior-facing roof edge, south exposed |
| `93` | `CELL.IROOF_E` | Interior-facing roof edge, east exposed |
| `94` | `CELL.IROOF_W` | Interior-facing roof edge, west exposed |
| `95` | `CELL.IROOF_NE` | Interior corner, north + east exposed |
| `96` | `CELL.IROOF_NW` | Interior corner, north + west exposed |
| `97` | `CELL.IROOF_SE` | Interior corner, south + east exposed |
| `98` | `CELL.IROOF_SW` | Interior corner, south + west exposed |
| `100` | `CELL.IROOF_END_N` | Interior end cell, south + east + west exposed |
| `101` | `CELL.IROOF_END_S` | Interior end cell, north + east + west exposed |
| `102` | `CELL.IROOF_END_E` | Interior end cell, north + south + west exposed |
| `103` | `CELL.IROOF_END_W` | Interior end cell, north + south + east exposed |
| `104` | `CELL.IROOF_ISLAND` | Interior island, all four edges exposed |

Value 99 is left unused as a gap between corners and ends (matching the pattern used by the IFLOOR range: 60–74 skips 68–69 between corners and ends).

---

## Implementation steps

### Step 1 — Register new constants in `matrix.js`

Add to the `CELL` export in `src/generators/collision/matrix.js`:

```js
// Exterior roof corners
ROOF_NE: 45, ROOF_NW: 46, ROOF_SE: 47, ROOF_SW: 48,
// Interior-facing roof edge labels
IROOF_N: 91, IROOF_S: 92, IROOF_E: 93, IROOF_W: 94,
IROOF_NE: 95, IROOF_NW: 96, IROOF_SE: 97, IROOF_SW: 98,
IROOF_END_N: 100, IROOF_END_S: 101, IROOF_END_E: 102, IROOF_END_W: 103,
IROOF_ISLAND: 104,
```

Also update the useful range check helpers:

```js
const isExteriorRoof = v => v === CELL.ROOF || (v >= 41 && v <= 48);
const isInteriorRoof = v => (v >= 91 && v <= 98) || (v >= 100 && v <= 104);
const isAnyRoof      = v => isExteriorRoof(v) || isInteriorRoof(v);
```

### Step 2 — Upgrade `label-roof-cells.js`

Replace the current priority chain with full corner/end/island detection, matching the logic in `label-floor-cells.js`. The callback receives all four neighbour values (`nN, nS, nE, nW`) via `labelCells` — the signature already supports this, it's just not used today.

```js
function allInternal(...neighbours) {
  return neighbours.every(n => n === CELL.SHELL);
}

// Inside the resolve callback:
if (expCount === 4) {
  return allInternal(nN, nS, nE, nW) ? CELL.IROOF_ISLAND : null; // exterior island deferred
}
if (expCount === 3) {
  if (!expN) return allInternal(nS, nE, nW) ? CELL.IROOF_END_N : null; // exterior ends deferred
  if (!expS) return allInternal(nN, nE, nW) ? CELL.IROOF_END_S : null;
  if (!expE) return allInternal(nN, nS, nW) ? CELL.IROOF_END_E : null;
  return allInternal(nN, nS, nE) ? CELL.IROOF_END_W : null;
}
if (expN && expE) return allInternal(nN, nE) ? CELL.IROOF_NE : CELL.ROOF_NE;
if (expN && expW) return allInternal(nN, nW) ? CELL.IROOF_NW : CELL.ROOF_NW;
if (expS && expE) return allInternal(nS, nE) ? CELL.IROOF_SE : CELL.ROOF_SE;
if (expS && expW) return allInternal(nS, nW) ? CELL.IROOF_SW : CELL.ROOF_SW;
if (expN) return nN === CELL.SHELL ? CELL.IROOF_N : CELL.ROOF_N;
if (expS) return nS === CELL.SHELL ? CELL.IROOF_S : CELL.ROOF_S;
if (expE) return nE === CELL.SHELL ? CELL.IROOF_E : CELL.ROOF_E;
if (expW) return nW === CELL.SHELL ? CELL.IROOF_W : CELL.ROOF_W;
```

Also update `isRoofCell` in `label-roof-cells.js` to include the new labels so the pass re-recognises already-labelled cells on subsequent iterations (same reason `isFloorCell` includes IFLOOR ranges):

```js
function isRoofCell(v) {
  return v === CELL.ROOF
    || (v >= 41 && v <= 48)    // ROOF_N … ROOF_SW
    || (v >= 91 && v <= 98)    // IROOF_N … IROOF_SW
    || (v >= 100 && v <= 104); // IROOF_END … IROOF_ISLAND
}
```

### Step 3 — Add `IROOF_*` to connectivity anchor sets in `emit-anchors.js`

The `FACING_N/S/E/W` sets in `src/generators/connectivity/emit-anchors.js` include all `IFLOOR_*` variants so connectivity can fire anchors from internal floor edges. Add `IROOF_*` in the same positions:

```js
const FACING_N = new Set([
  // ... existing entries ...
  CELL.IROOF_N, CELL.IROOF_NE, CELL.IROOF_NW,
  CELL.IROOF_END_S, CELL.IROOF_END_E, CELL.IROOF_END_W, CELL.IROOF_ISLAND,
]);
// ... repeat for FACING_S, FACING_E, FACING_W following the same pattern as IFLOOR_*
```

The pairing, filtering, and stamping logic in Phase 2 and Phase 3 requires no changes — it operates on anchor direction and cell position, not cell type.

### Step 4 — Add to visualiser grid panel

Register the new cell types in `visualizer.html` (`CELL_TYPES` array and `CELL_GROUPS`). Suggested colours to match the existing IROOF aesthetic:

```js
{ value: 45,  label: 'Roof NE',      color: 0xaaffdd, id: 'grid-roof-ne' },
{ value: 46,  label: 'Roof NW',      color: 0xddaaff, id: 'grid-roof-nw' },
{ value: 47,  label: 'Roof SE',      color: 0xffddaa, id: 'grid-roof-se' },
{ value: 48,  label: 'Roof SW',      color: 0xffaadd, id: 'grid-roof-sw' },
{ value: 91,  label: 'IRoof N',      color: 0x775533, id: 'grid-iroof-n' },
{ value: 92,  label: 'IRoof S',      color: 0x775533, id: 'grid-iroof-s' },
{ value: 93,  label: 'IRoof E',      color: 0x775533, id: 'grid-iroof-e' },
{ value: 94,  label: 'IRoof W',      color: 0x775533, id: 'grid-iroof-w' },
{ value: 95,  label: 'IRoof NE',     color: 0x886644, id: 'grid-iroof-ne' },
{ value: 96,  label: 'IRoof NW',     color: 0x886644, id: 'grid-iroof-nw' },
{ value: 97,  label: 'IRoof SE',     color: 0x886644, id: 'grid-iroof-se' },
{ value: 98,  label: 'IRoof SW',     color: 0x886644, id: 'grid-iroof-sw' },
{ value: 100, label: 'IRoof End N',  color: 0x997755, id: 'grid-iroof-end-n' },
{ value: 101, label: 'IRoof End S',  color: 0x997755, id: 'grid-iroof-end-s' },
{ value: 102, label: 'IRoof End E',  color: 0x997755, id: 'grid-iroof-end-e' },
{ value: 103, label: 'IRoof End W',  color: 0x997755, id: 'grid-iroof-end-w' },
{ value: 104, label: 'IRoof Island', color: 0xaa8866, id: 'grid-iroof-island' },
```

---

## Connectivity compatibility

The anchor emission system (`emit-anchors.js`) works by checking whether a cell's label appears in a `FACING_*` set — it does not inspect the label family beyond that. Adding `IROOF_*` to the four facing sets (Step 3) is the only change required. Confirmed working areas:

| Component | Change needed | Reason |
|---|---|---|
| `emit-anchors.js` FACING sets | ✅ Add IROOF_* | Direct label lookup |
| `pair-anchors.js` | None | Operates on anchor cells (empty space), not label type |
| `filter-candidates.js` | None | Operates on candidate connections, not label type |
| `connectivity/index.js` stampDoors | None | Operates on anchor direction + cells |
| `extract-wall-segments.js` | None | Roof cells are not in wall label sets |

---

## Updates required in other documents

- `docs/architecture/collision_matrix.md` — add new cell values to the type table and range checks; add IROOF entries to the write history source table (stage enum 4, `data.roofs[]`)
- `docs/plans/COLLISION_MATRIX_HISTORY_PLAN_2026_04_21.md` — stage enum 4 ("Roofs — label pass") already covers this; no new enum entry needed

---

## Implementation status

| Step | Description | Status |
|---|---|---|
| Step 1 | Register new constants in `matrix.js` | ✅ Implemented |
| Step 2 | Upgrade `label-roof-cells.js` | ✅ Implemented |
| Step 3 | Add `IROOF_*` to connectivity facing sets | ✅ Implemented |
| Step 4 | Visualiser grid panel entries | ✅ Implemented |
