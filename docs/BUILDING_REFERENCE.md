# Building Types Reference

> Last verified: 2026-10-10 against `src/generators/buildings/` and `src/config.js`

Quick reference for the building size classes the live pipeline places. For the full algorithm see [processes/pipeline-flows/2-buildings.md](processes/pipeline-flows/2-buildings.md).

The earlier building system (corner/diagonal/L/U/narrow-U shapes, towers with pyramid roofs, `BUILDING`/`smallShapes` config keys) was removed and lives only in `src/generators/_old_system/`. This doc no longer describes it.

---

## Size classes

Defined in `src/generators/buildings/building-sizes.js`. Footprints are on the 4" Base Building Dimension (BBD) grid with a 1" skirt each side, so a 1-BBD cell gives a 2" footprint, 2 BBD gives 6", and so on.

| Size key | BBD (W×D) | Footprint (W×D) | Notes |
|---|---|---|---|
| `ruins-small` | 1×1 | 2" × 2" | Smallest piece; different floor decomposition in Stage 3; 40% chance of no ladders |
| `ruins-medium-h` | 3×1 | 10" × 2" | Long thin ruin, horizontal. Chosen 50/50 with `-v` |
| `ruins-medium-v` | 1×3 | 2" × 10" | Long thin ruin, vertical |
| `small` | 2×2 | 6" × 6" | |
| `medium` | 3×3 | 10" × 10" | Interior walls: 75% chance (`WALL.interiorWallChance.medium`) |
| `largeA` | 5×3 | 18" × 10" | Interior walls: always (`WALL.interiorWallChance.largeA`) |
| `largeB` | 3×5 | 10" × 18" | Interior walls: always (`WALL.interiorWallChance.largeB`) |

## Placement per block

From `treemap-buildings.js`, for each city block:

1. 40% chance to attempt a `largeA`, independently 40% for a `largeB`.
2. `floor(bbdW × bbdD / 4)` attempts at a `medium`, each with a 50% chance.
3. Fill what remains with `small`, then `ruins-medium` (h or v), then `ruins-small`, so the block is covered without overlap.

Each placed building gets a random `maxTier` between 1 and `--tiers`. Its shell is written to the collision matrix as `CELL.SHELL`.

## Ladders per building

From Stage 7 (path selection quota):

| Size | Max ladder paths |
|---|---|
| `ruins-small`, `small` | 1 |
| `medium`, `ruins-medium-*` | 2 |
| `largeA`, `largeB` | 3 |

## Where to change things

| What | Where |
|---|---|
| Footprint sizes | `BUILDING_SIZES` in `src/generators/buildings/building-sizes.js` |
| Block placement chances | `treemap-buildings.js` (hard-coded; not yet in `config.js`) |
| Interior wall chance | `WALL.interiorWallChance` in `src/config.js` |
| Ladder clearances and quotas | `LADDERS` in `src/config.js` |
| Floor damage per tier | `FLOOR` and `--damage-level` |
| Wall damage | `WALL` row-removal ratios |
