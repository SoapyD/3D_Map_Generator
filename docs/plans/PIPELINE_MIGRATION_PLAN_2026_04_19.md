# Pipeline Migration Plan

**Created:** 2026-04-19  
**Last updated:** 2026-04-20

---

## What the old pipeline produced

1. Grid — uniform row/column city block subdivision
2. Buildings — small buildings on a uniform cell grid, large buildings slotted in on top with overlap culling
3. Floors — tier/roof generation per building
4. Walls — exterior and interior wall generation
5. Connectivity — walkways, bridges, ladders, pillars, gap detection
6. Cover — rooftop, interior, and ground scatter

---

## What the new pipeline produces

### ✅ Done

1. **Foundations** (`src/generators/foundations/`) — BSP splits the map into variable-size foundation blocks separated by streets.

2. **Collision matrix** (`src/generators/collision/matrix.js`) — flat `Uint8Array` at 1-inch XYZ resolution. Typed cell values: `EMPTY=255`, `SHELL=0`, `FLOOR=1`, directional floor labels `10–17`, `30–34`, wall types `20–23`, roof types `40–44`. See `docs/architecture/collision_matrix.md`.

3. **Treemap buildings** (`src/generators/buildings/`) — per-foundation BBD cell grid, buildings placed largest-first.

4. **Floors** (`src/generators/floors/`) — quadrant-damage escalation per building, all tiers in one RNG pass. Interior slabs written as `CELL.FLOOR` and labelled `FLOOR_N/S/E/W` (and corner, end, island variants). Top slab passed to Roofs stage as `data.roofSlabs`. See `FLOORS_PLAN_2026_04_19.md`.

5. **Roofs** (`src/generators/roofs/`) — consumes `data.roofSlabs` from the Floors stage; uses the same quadrant-damage shape as the topmost interior floor. Written as `CELL.ROOF` and labelled `ROOF_N/S/E/W`. No walls are placed above roof slabs.

6. **Walls Phase 1** (`src/generators/walls/`) — two-pass exterior wall generation from labelled floor cells. Includes corner truncation, end cells (3 exposed edges), and island cells (4 exposed edges). See `WALLS_PLAN_2026_04_19.md`.

7. **Shared utilities** (`src/generators/utils/label-cells.js`) — generic cardinal-neighbour labelling used by both floors and roofs.

8. **Geometry + scene** (`src/generators/geometry/`, `src/generators/scene/`) — already migrated.

9. **Preview visualiser** (`src/preview/visualiser.html`) — per-type collision grid overlay, animated stage playback, "All Layers" toggle (hides building shells), compass labels.

### ⬜ Not started

- Walls Phase 2 (damage + interior walls)
- Connectivity
- Cover

---

## What is left to do

### Stage 1 — Walls Phase 2
**Detail:** `WALLS_PLAN_2026_04_19.md` — Phase 2 section

- `apply-wall-damage.js` — quadrant subdivision + removal per exterior wall segment
- `merge-segments.js` — merge contiguous post-damage segments
- `generate-interior-walls.js` — interior dividing walls for medium/large buildings

### Stage 2 — Connectivity
**Source:** `_old_system/connectivity/` + `_old_system/gap-detection/`

- Port walkways, bridges, ladders (ground, yellow, interior, tower, orange, cyan), pillars
- Port gap detection alongside — ensures every area is reachable
- Depends on floors + walls

### Stage 3 — Cover
**Source:** `_old_system/cover/`

- Port rooftop, interior, and ground/street scatter
- Depends on floors, walls, and connectivity

---

## Execution order (remaining)

1. Walls Phase 2 — damage + interior walls
2. Connectivity — port gap-detection and connectivity together (tightly coupled)
3. Cover
4. Delete `_old_system/` once all stages verified end-to-end

---

## Notes

- All `_old_system/` files remain intact until their replacement is verified working
- The Roofs stage was not in the original plan — it was added as a distinct pipeline step between Floors and Walls
- Each stage should be ported as a separate commit
