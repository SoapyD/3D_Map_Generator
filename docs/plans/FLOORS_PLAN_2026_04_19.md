# Floors Sub-Plan

**Created:** 2026-04-19  
**Last updated:** 2026-04-20  
**Status:** ✅ Complete  
**Parent plan:** PIPELINE_MIGRATION_PLAN_2026_04_19.md

---

## Collision grid vertical resolution

- Y resolution = **1 inch per cell**
- **Room height** = 3" | **Slab thickness** = 1" | **Per-level total** = 4"
- Ground room occupies Y 0–2; first floor slab at Y 3; first floor room Y 4–6; second slab at Y 7; etc.
- Formula: `slabY(i) = i * 4 + 3`

---

## What was deferred

- **Tier 0 / base slab** — the full-map ground floor is still deferred.
  - Foundation areas: solid slab per foundation block footprint (same damage-cutout process as building floors).
  - Street areas: can be converted to rivers/waterways instead of solid floor.

---

## Implementation summary

### Step 1 — Building shape audit ✅

Treemap buildings expose `x, z, w, d, maxTier` directly. No adapter needed.  
`maxTier` drives floor count: `slabY(i) = i * (tierHeight + slabThickness) + tierHeight`.

### Step 2 — Typed collision cell values ✅

Implemented directly in `src/generators/collision/matrix.js` (not a separate constants file as originally planned).

Full type table in `docs/architecture/collision_matrix.md`. Key types:

| Value | Constant | Meaning |
|---|---|---|
| `255` | `CELL.EMPTY` | Unoccupied — array initialised with `fill(255)` |
| `0` | `CELL.SHELL` | Building shell volume |
| `1` | `CELL.FLOOR` | Interior floor slab |
| `10–17` | `CELL.FLOOR_N/S/E/W`, `FLOOR_NE/NW/SE/SW` | Directional floor edge labels |
| `30–34` | `CELL.FLOOR_END_N/S/E/W`, `FLOOR_ISLAND` | End (3 exposed edges) and island (4 exposed) cells |
| `40–44` | `CELL.ROOF`, `ROOF_N/S/E/W` | Roof slab and directional labels |
| `20–23` | `CELL.WALL_N/S/E/W` | Wall geometry |

### Step 3 — Floor generation ✅

**Files:** `src/generators/floors/index.js`, `process-building-floors.js`, `quadrants-to-sections.js`

- `processBuildingFloors` runs the full escalating-damage pass for **all** tiers (0 to `maxTier-1`) in a single RNG sequence, preserving determinism.
- `generateFloors` splits the result: interior slabs (`floorIndex < maxTier-1`) are written as `CELL.FLOOR`; the topmost slab is stored in `data.roofSlabs` and passed to the Roofs stage unwritten.
- Floor labelling (`label-floor-cells.js`) runs at the end of `generateFloors` — floor edge cells are overwritten with `FLOOR_N/S/E/W` and corner/end/island variants.

**Divergence from original plan:** damage cutouts use quadrant removal (NW/NE/SW/SE quadrants, not edge-inset rects). This is the old system's approach, ported directly.

**Output shape per floor record:**
```js
{
  buildingId, buildingIndex, floorIndex,
  yCollisionLevel,    // i * (tierHeight + slabThickness) + tierHeight
  rects,              // axis-aligned rects after quadrant removal
  removedQuadrants,   // array of removed quadrant indices [0..3]
  materialKey,        // 'stone_floor'
}
```

### Step 4 — Visualiser ✅

- Per-type `THREE.LineSegments` in the collision grid overlay
- Group checkboxes: Shell / Floors / Roofs / Walls
- Visualiser stage 4 captures floor plates per building
- "All Layers" toggle [A] renders everything at full opacity, hiding building shells

---

## Roofs stage (added — not in original plan)

The topmost slab of each building is a separate pipeline stage between Floors and Walls.

**Files:** `src/generators/roofs/index.js`, `label-roof-cells.js`

- Consumes `data.roofSlabs` — already has the correct quadrant-damage shape from `processBuildingFloors`
- Writes each rect as `CELL.ROOF`, then labels edge cells `ROOF_N/S/E/W`
- Drops `roofSlabs` from the pipeline data; downstream sees only `data.roofs`
- No walls are placed above roof slabs (walls only read `data.floors`)

**Shared utility:** `src/generators/utils/label-cells.js` — generic cardinal-neighbour scan used by both `labelFloorCells` and `labelRoofCells`.

---

## Files produced

| File | Purpose |
|---|---|
| `src/generators/collision/matrix.js` | Typed cell constants + matrix helpers |
| `src/generators/floors/index.js` | Stage entry point — splits interior floors from roof slab |
| `src/generators/floors/process-building-floors.js` | Escalating quadrant-damage pass, all tiers |
| `src/generators/floors/quadrants-to-sections.js` | Merges present quadrant pairs into rects |
| `src/generators/floors/label-floor-cells.js` | Labels exposed FLOOR edges with directional types |
| `src/generators/roofs/index.js` | Writes roofSlabs as CELL.ROOF, runs roof labelling |
| `src/generators/roofs/label-roof-cells.js` | Labels exposed ROOF edges ROOF_N/S/E/W |
| `src/generators/utils/label-cells.js` | Shared cardinal-neighbour labelling utility |
| `docs/architecture/collision_matrix.md` | Full cell type reference |
