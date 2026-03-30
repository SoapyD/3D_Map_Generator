# Waterways Plan

**Date:** 2026-03-29
**Status:** Active
**Priority:** High

## Summary

Add canal waterways that cut through the city map in a cross pattern. Waterways sit below ground level, replace ground tiles where they intersect, and generate before all other buildings. They add tactical depth (movement penalties, chokepoints at bridges) and visual variety.

---

## 1. Layout

Waterways always flow **through** the map — entering on one edge and exiting on another. They run through the centre of the map. The seed selects from these layout variants:

### Layout Variants

```
1. North-South:      2. East-West:        3. Cross:
..........           ..........           ....#.....
....#.....           ..........           ....#.....
....#.....           ..........           ....#.....
....#.....           ..........           ....#.....
....#.....           ##########           #####.#####
....#.....           ..........           ....#.....
....#.....           ..........           ....#.....
....#.....           ..........           ....#.....
....#.....           ..........           ....#.....
..........           ..........           ....#.....

4. None (no waterways)
```

- **North-South:** Single canal from north edge to south edge, through map centre
- **East-West:** Single canal from east edge to west edge, through map centre
- **Cross:** Both N-S and E-W canals, crossing at the centre junction
- **None:** No waterways (controlled by enabled toggle or chance)

Every canal enters from one map edge and exits from the opposite edge — no dead-ends. The cross variant has a junction where both canals meet at the centre.

- Canals are a fixed width (config, e.g. 4-5")
- The centre junction (cross variant) is a square where both channels overlap

### Variant Selection

The seed determines the layout. Config controls:
- `waterways.enabled: true/false` — master toggle
- `waterways.layoutChance: { none: 0.3, northSouth: 0.25, eastWest: 0.25, cross: 0.2 }` — weighted layout selection
- `waterways.width: 4` — channel width in inches
- `waterways.depth: 1` — depth below ground level in inches

---

## 2. Geometry

### Ground Level Changes

- The base floor (currently a flat slab at y=0) needs to be raised by `waterways.depth` (e.g. 1") to create room for the canal below
- Alternatively, the canal is recessed: ground stays at y=0, canal floor is at y=-depth
- **Recommended:** Recess the canal. Ground stays at y=0. Canal floor at y=-1. Board depth increases by `depth` to accommodate. This avoids moving everything else up.

### Canal Channel

- Canal floor: flat slab at y=-depth, width = `waterways.width`, textured with a water/dark texture
- Canal walls: vertical faces on both sides, height = `depth`, connecting ground level to canal floor
- Where the canal meets the map edge: open (water flows off-map)

### Ground Tile Replacement

- Ground tiles (base floor) that overlap the canal footprint are removed
- The base floor becomes multiple sections instead of a single 48×48 slab
- BSP grid partitioning must account for waterway channels — buildings cannot be placed in the canal

### Edge Walls (3 variants per arm)

| Variant | Description | Vertex Cost |
|---|---|---|
| **No edge** | Canal has no raised edge, ground meets canal at a step | Minimal — just the canal walls |
| **Low wall (0.75")** | Continuous 0.75" wall along both canal edges | 2 thin walls per arm side |
| **Battlement wall (1.5")** | 0.75" base + periodic 1.5" tall sections with gaps | Base walls + spaced pillars |

Edge variant is chosen per-map (same variant for all arms), controlled by config or seed.

---

## 3. Bridges

Each canal run (N-S or E-W) generates 1-2 bridges crossing it. Bridges are:

- Placed perpendicular to the canal, connecting the ground on both sides
- Width: 2-3" (same as walkways or slightly wider)
- Surface at ground level (y=0), spanning the canal
- Use the bridge walkway variants from BUILDING_ADDITIONS_PLAN (low walls or battlements)
- Placed at random positions along the canal (not at the very ends or centre junction)
- Must not overlap each other — minimum spacing between bridges

### Bridge Placement Rules

- 1-2 bridges per canal run (config: `waterways.bridgesPerCanal: [1, 2]`)
- For N-S canal: bridges run E-W. For E-W canal: bridges run N-S
- For cross layout: each canal run gets its own 1-2 bridges (so 2-4 total)
- Minimum 3" from map edge
- Minimum 3" from centre junction (cross layout)
- Minimum 4" between bridges on the same canal
- Bridges should be placed on each side of the centre junction where possible (not both on the same half)

---

## 4. Generation Order

Waterways must generate **before** all other content because they affect the ground floor and building placement:

```
Current pipeline:
1. Grid → 2. Buildings → 3. Floors → 4. Walls → 5. Connectivity → 6. Cover → 7. Export

New pipeline:
0. WATERWAYS → 1. Grid → 2. Buildings → 3. Floors → 4. Walls → 5. Connectivity → 6. Cover → 7. Export
```

Stage 0 (Waterways) outputs:
- `waterway.arms[]` — which arms are present (N, S, E, W)
- `waterway.channels[]` — canal floor rectangles { x, z, w, d, depth }
- `waterway.edgeWalls[]` — edge wall segments
- `waterway.bridges[]` — bridge slab positions
- `waterway.exclusionZones[]` — rectangles where buildings cannot be placed

Stage 1 (Grid) receives exclusion zones and avoids placing blocks in them.

Stage 2 (Buildings) checks against exclusion zones — no building overlaps a canal.

Stage 6 (Cover) — no ground-level cover or street scatter in canal zones. Courtyard footprints that overlap canals are clipped or removed.

---

## 5. Configuration

Add to `config.js`:

```js
export const WATERWAYS = {
  enabled: true,
  layoutChance: {             // weighted layout selection
    none: 0.3,
    northSouth: 0.25,
    eastWest: 0.25,
    cross: 0.2,
  },
  width: 4,                 // channel width in inches
  depth: 1,                 // depth below ground level
  edgeVariant: 'random',    // 'none', 'low', 'battlement', 'random'
  bridgesPerCanal: [1, 2],  // min, max bridges per canal run (N-S or E-W)
  bridgeWidth: 3,           // bridge crossing width
  bridgeMinEdgeDist: 3,     // min distance from map edge
  bridgeMinCentreDist: 3,   // min distance from centre junction
  bridgeMinSpacing: 4,      // min distance between bridges on same canal
  // Textures
  canalFloorTexture: 'water', // atlas tile category
  canalWallTexture: 'walls',  // atlas tile category for canal sides
};
```

Add to `DELETIONS`:
```js
  waterways: true,           // enable waterway generation
```

---

## 6. Vertex Budget Impact

| Element | Per-arm Cost | Notes |
|---|---|---|
| Canal floor (shared grid) | ~50-100 verts | Single flat surface, addSharedFlat |
| Canal side walls (2 per arm) | ~30-60 verts | Thin walls, addSharedWall |
| Edge walls (low/battlement) | ~20-80 verts | Depends on variant |
| Bridges (1-2 per arm) | ~30-50 each | Same as walkway bridges from BUILDING_ADDITIONS_PLAN |
| Ground floor sections (replacing single slab) | +~200 verts | Multiple sections instead of one slab |

Estimated total for full cross (4 arms): **~400-800 additional verts**. Well within the current headroom (13,943 / 25,000).

The base floor going from a single slab to multiple sections is the main cost increase — but each section uses addSharedFlat so the per-section overhead is small.

---

## 7. Implementation

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Add WATERWAYS config section | Pending | |
| 2 | Create `src/generators/waterways.js` (Stage 0) | Pending | Arm selection, channel calculation, exclusion zones |
| 3 | Canal floor geometry (recessed slab) | Pending | addSharedFlat at y=-depth |
| 4 | Canal side walls | Pending | Vertical faces connecting ground to canal floor |
| 5 | Edge variant: no edge | Pending | Just the step down |
| 6 | Edge variant: low wall (0.75") | Pending | Continuous thin walls along canal edges |
| 7 | Edge variant: battlement (1.5" with gaps) | Pending | Base wall + spaced tall sections |
| 8 | Bridge placement (1-2 per arm) | Pending | Random positions with spacing rules |
| 9 | Bridge geometry (reuse bridge walkway from BUILDING_ADDITIONS_PLAN) | Pending | Low wall / battlement variants |
| 10 | Ground floor splitting — replace single base slab with sections avoiding canals | Pending | Modify base floor generation |
| 11 | Grid exclusion zones — buildings can't overlap canals | Pending | Pass exclusion rects to grid.js |
| 12 | Cover exclusion — no ground cover or scatter in canal zones | Pending | Filter in cover.js |
| 13 | Courtyard clipping — courtyards that overlap canals are trimmed or removed | Pending | |
| 14 | Water texture category in texture packs | Pending | New folder: `assets/textures/*/water/` |
| 15 | OBJ exporter: canal geometry | Pending | addSharedFlat + addSharedWall |
| 16 | GLB scene builder: canal geometry | Pending | createFloorSlab + createWallSlab |
| 17 | Collision mesh: canal floor + bridges (walkable surfaces) | Pending | |
| 18 | Pipeline integration: waterways as Stage 0 before grid | Pending | Update index.js |
| 19 | Building preview tool: waterway toggle for context testing | Pending | Optional |

### Implementation Order

| Phase | Items | Notes |
|---|---|---|
| 1 | Config + Stage 0 generator (#1, #2) | Core waterway data generation |
| 2 | Ground floor splitting (#10) | Base floor becomes multiple sections |
| 3 | Canal geometry (#3, #4) | Recessed floor + side walls |
| 4 | Grid + building exclusion (#11) | Buildings avoid canals |
| 5 | Edge variants (#5, #6, #7) | Three wall styles |
| 6 | Bridges (#8, #9) | Crossing points |
| 7 | Cover + courtyard exclusion (#12, #13) | No ground content in canals |
| 8 | Exporters (#15, #16, #17) | OBJ + GLB + collision |
| 9 | Pipeline integration (#18) | Wire into index.js as Stage 0 |
