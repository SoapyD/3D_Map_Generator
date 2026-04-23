# River Connections — Plan
_2026-04-23_

## Overview

Once rivers are generating correctly, bridge connections across river corridors need
to be enabled. This is a small change to the Connectivity stage — river cells must
be treated as passable by the anchor ray-cast, after which ground-level anchors on
foundation edges that border a river will naturally produce bridge candidates through
the existing filter and culling pipeline.

Depends on `STREETS_RIVERS_PLAN_2026_04_23.md` being implemented first.

---

## Pipeline position

Streets/Rivers must run **before** Connectivity so `CELL.RIVER` cells are already
in the matrix when anchor ray-casts fire. The exact stage numbering will be fixed
when Streets/Rivers is slotted into the pipeline.

---

## Change 1 — pair-anchors.js: extend passable set

The ray-cast currently treats only `CELL.EMPTY` (255) and `CELL.SHELL` (0) as
non-blocking. `CELL.RIVER` (112) must be added so rays can cross river cells:

```js
// current (pair-anchors.js ~line 128):
if ((v0 !== CELL.EMPTY && v0 !== CELL.SHELL) || (v1 !== CELL.EMPTY && v1 !== CELL.SHELL)) {
  break;
}

// updated:
const passable = v => v === CELL.EMPTY || v === CELL.SHELL || v === CELL.RIVER;
if (!passable(v0) || !passable(v1)) {
  break;
}
```

No other changes to Connectivity are required. Ground-level floor-edge anchors on
foundations that border a river corridor will pair with anchors on the opposite bank,
then flow through the existing stack cull → filter → bridge cull → stamp → rasterise
pipeline unchanged.

---

## Change 2 — 5-connectivity.md process doc

Update the Edge Cases section to note that `CELL.RIVER` is passable in the ray-cast
and that river-spanning connections are generated via the normal anchor pipeline.

---

## Files changed

| File | Change |
|---|---|
| `src/generators/connectivity/pair-anchors.js` | Add `CELL.RIVER` to passable-cell check |
| `docs/processes/pipeline-flows/5-connectivity.md` | Update edge cases — river passability |
