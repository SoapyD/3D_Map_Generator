# Pipeline Migration Plan

**Date:** 2026-04-19
**Goal:** Port the remaining old-system pipeline stages (floors, walls, connectivity, cover) to consume the new foundation/treemap building output.

---

## What the old pipeline produced

1. Grid — uniform row/column city block subdivision
2. Buildings — small buildings on a uniform cell grid, large buildings slotted in on top with overlap culling
3. Floors — tier/roof generation per building
4. Walls — exterior and interior wall generation
5. Connectivity — walkways, bridges, ladders, pillars, gap detection
6. Cover — rooftop, interior, and ground scatter

---

## What the new pipeline produces (done)

1. **Foundations** (`src/generators/foundations/`) — BSP splits the map into variable-size foundation blocks separated by streets. Strategy is randomly selected per seed: `center-first` (places one block at map centre, BSP fills four surrounding regions) or `bsp-top-left` (plain BSP). Split positions use pluggable strategies: `balanced`, `organic`, `biased-center`.

2. **Collision matrix** (`src/generators/collision/`) — flat Uint8Array tracking occupied cells at BBD (4-inch) resolution across the full map volume.

3. **Treemap buildings** (`src/generators/buildings/`) — each foundation block gets its own BBD cell grid. Buildings are placed largest-first (largeA → largeB → medium → small). Cell pattern (where to try placing next) is randomly picked per foundation: `center-out` or `top-left`.

4. **Geometry + scene** (`src/generators/geometry/`, `src/generators/scene/`) — primitive builders and Three.js scene assembly, already migrated from the old system.

---

## What is left to do

The new buildings pipeline currently feeds into nothing. Everything below needs porting from `src/generators/_old_system/` to consume the new foundation/treemap output format.

### Stage 1 — Floors
**Source:** `_old_system/floors/`
- Port `generate-floors.js`, `process-building-floors.js`, `quadrants-to-sections.js`
- Buildings now come from treemap output — confirm the shape of each building object is compatible or add an adapter
- Output: tier sections, roof rects per building

### Stage 2 — Walls
**Source:** `_old_system/walls/`
- Port `generate-walls.js`, `generate-exterior-walls.js`, `generate-interior-walls.js`
- Wall placement depends on floor/tier data from Stage 1
- Output: wall segments per building per tier

### Stage 3 — Connectivity
**Source:** `_old_system/connectivity/`
- Port walkways, bridges, ladders (ground, yellow, interior, tower, orange, cyan), pillars
- Gap detection (`_old_system/gap-detection/`) must also be ported — ensures every area is reachable
- Depends on floors (tier sections) and walls (wall positions)
- Output: walkways, bridges, ladders, platforms, pillars

### Stage 4 — Cover
**Source:** `_old_system/cover/`
- Port `generate-cover.js` and its three sub-generators (rooftop, interior, ground/street)
- Depends on floors, walls, and connectivity output
- Output: cover pieces (scatter, props, battlements)

---

## Execution order

1. Audit the new building object shape vs what floors/walls expect — document any mismatches before touching code
2. Port Floors — verify tier/roof output matches geometry expectations
3. Port Walls — verify wall segments feed correctly into geometry primitives
4. Port Connectivity — port gap-detection alongside, they are tightly coupled
5. Port Cover
6. Delete `_old_system/` once all stages are verified end-to-end

---

## Notes

- All `_old_system/` files remain intact until their replacement is verified working
- The new system must produce identical or equivalent visual output before `_old_system/` is removed
- Each stage should be ported as a separate commit
