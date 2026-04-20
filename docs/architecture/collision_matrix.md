# Collision Matrix — Architecture

**Last updated:** 2026-04-19

---

## Overview

The collision matrix is a flat `Uint8Array` covering the full map volume at 1-inch resolution in all three axes (X, Y, Z). It is created once at pipeline start and written to incrementally by each generation stage. Every occupied cell carries a typed value so downstream stages can distinguish exactly what kind of geometry occupies it.

---

## Resolution

| Axis | Resolution | Notes |
|---|---|---|
| X, Z | 1 inch per cell | Matches `GLOBAL_GRID.cellSize` |
| Y | 1 inch per cell | Vertical resolution — finer than the XZ BBD grid |

---

## Cell type values

| Value | Constant | Written by | Meaning |
|---|---|---|---|
| `255` | `CELL.EMPTY` | (init) | Unoccupied — array default is 0, so the array is explicitly `fill(255)` on creation |
| `0` | `CELL.SHELL` | Buildings stage | Building shell / structural volume |
| `1` | `CELL.FLOOR` | Floors stage | Interior floor cell (no exposed edge) |
| `2` | `CELL.WALL` | Walls stage | Wall geometry — generic / interior walls where a single facing direction is not meaningful |
| `10` | `CELL.FLOOR_N`  | Walls stage — Pass 1 | Floor cell with exposed **north** edge only |
| `11` | `CELL.FLOOR_S`  | Walls stage — Pass 1 | Floor cell with exposed **south** edge only |
| `12` | `CELL.FLOOR_E`  | Walls stage — Pass 1 | Floor cell with exposed **east** edge only |
| `13` | `CELL.FLOOR_W`  | Walls stage — Pass 1 | Floor cell with exposed **west** edge only |
| `14` | `CELL.FLOOR_NE` | Walls stage — Pass 1 | Corner cell with exposed **north and east** edges — generates walls on both sides |
| `15` | `CELL.FLOOR_NW` | Walls stage — Pass 1 | Corner cell with exposed **north and west** edges |
| `16` | `CELL.FLOOR_SE` | Walls stage — Pass 1 | Corner cell with exposed **south and east** edges |
| `17` | `CELL.FLOOR_SW` | Walls stage — Pass 1 | Corner cell with exposed **south and west** edges |
| `20` | `CELL.WALL_N` | Walls stage — Pass 2 | Wall geometry facing **north** |
| `21` | `CELL.WALL_S` | Walls stage — Pass 2 | Wall geometry facing **south** |
| `22` | `CELL.WALL_E` | Walls stage — Pass 2 | Wall geometry facing **east** |
| `23` | `CELL.WALL_W` | Walls stage — Pass 2 | Wall geometry facing **west** |
| `30` | `CELL.FLOOR_END_N` | Walls stage — Pass 1 | End cell: north is connected, **south+east+west** edges exposed |
| `31` | `CELL.FLOOR_END_S` | Walls stage — Pass 1 | End cell: south is connected, **north+east+west** edges exposed |
| `32` | `CELL.FLOOR_END_E` | Walls stage — Pass 1 | End cell: east is connected, **north+south+west** edges exposed |
| `33` | `CELL.FLOOR_END_W` | Walls stage — Pass 1 | End cell: west is connected, **north+south+east** edges exposed |
| `34` | `CELL.FLOOR_ISLAND` | Walls stage — Pass 1 | Island cell: all four cardinal edges exposed, no floor neighbours |
| `40` | `CELL.ROOF` | Roofs stage | Roof slab — full building footprint, no damage |
| `41` | `CELL.ROOF_N` | Roofs stage — label pass | Roof cell with exposed **north** edge |
| `42` | `CELL.ROOF_S` | Roofs stage — label pass | Roof cell with exposed **south** edge |
| `43` | `CELL.ROOF_E` | Roofs stage — label pass | Roof cell with exposed **east** edge |
| `44` | `CELL.ROOF_W` | Roofs stage — label pass | Roof cell with exposed **west** edge |
| `50` | `CELL.FOUNDATION_PLACEHOLDER` | Foundations stage | Foundation block ground-slab placeholder — replaced by real geometry in a later stage |
| `51` | `CELL.STREET_PLACEHOLDER` | Foundations stage | Street ground-slab placeholder — may become river/waterway |
| `60` | `CELL.IFLOOR_N`  | Floors stage — label pass | Interior-facing floor edge, north exposed (neighbour is SHELL) |
| `61` | `CELL.IFLOOR_S`  | Floors stage — label pass | Interior-facing floor edge, south exposed |
| `62` | `CELL.IFLOOR_E`  | Floors stage — label pass | Interior-facing floor edge, east exposed |
| `63` | `CELL.IFLOOR_W`  | Floors stage — label pass | Interior-facing floor edge, west exposed |
| `64` | `CELL.IFLOOR_NE` | Floors stage — label pass | Interior corner, north+east exposed |
| `65` | `CELL.IFLOOR_NW` | Floors stage — label pass | Interior corner, north+west exposed |
| `66` | `CELL.IFLOOR_SE` | Floors stage — label pass | Interior corner, south+east exposed |
| `67` | `CELL.IFLOOR_SW` | Floors stage — label pass | Interior corner, south+west exposed |
| `70` | `CELL.IFLOOR_END_N` | Floors stage — label pass | Interior end cell, south+east+west exposed |
| `71` | `CELL.IFLOOR_END_S` | Floors stage — label pass | Interior end cell, north+east+west exposed |
| `72` | `CELL.IFLOOR_END_E` | Floors stage — label pass | Interior end cell, north+south+west exposed |
| `73` | `CELL.IFLOOR_END_W` | Floors stage — label pass | Interior end cell, north+south+east exposed |
| `74` | `CELL.IFLOOR_ISLAND` | Floors stage — label pass | Interior island, all four edges exposed |
| `80` | `CELL.INTERNAL_WALL_N` | Walls stage — Phase 1 correction | Internal wall face, north-facing — logged at wall position, no geometry |
| `81` | `CELL.INTERNAL_WALL_S` | Walls stage — Phase 1 correction | Internal wall face, south-facing |
| `82` | `CELL.INTERNAL_WALL_E` | Walls stage — Phase 1 correction | Internal wall face, east-facing |
| `83` | `CELL.INTERNAL_WALL_W` | Walls stage — Phase 1 correction | Internal wall face, west-facing |

---

## Useful range checks

```js
const isExteriorFloor = v => v === CELL.FLOOR || (v >= 10 && v <= 17) || (v >= 30 && v <= 34);
const isInteriorFloor = v => (v >= 60 && v <= 67) || (v >= 70 && v <= 74);
const isAnyFloor      = v => isExteriorFloor(v) || isInteriorFloor(v);
const isExteriorWall  = v => v === CELL.WALL || (v >= 20 && v <= 23);
const isInternalWall  = v => v >= 80 && v <= 83;
const isOccupied      = v => v !== CELL.EMPTY;
```

---

## Vertical layout (per floor level)

Room height = 3", slab thickness = 1", so each floor level occupies 4" of Y space.  
The matrix reserves 12 cells below Y=0 for future below-ground geometry (rivers, sewers, tunnels).

| Y cell range | Contents |
|---|---|
| `< 0` | Below-ground reserve (12 cells; FOUNDATION_PLACEHOLDER / STREET_PLACEHOLDER at Y=-1) |
| `-1` | Ground floor slab (FLOOR / FLOOR_N/S/E/W cells) |
| `0 – 2` | Ground-level room (SHELL cells inside building footprint; walls from Y=0) |
| `3` | First upper floor slab |
| `4 – 6` | First-floor room |
| `7` | Second upper floor slab |
| `8 – 10` | Second-floor room |
| … | Pattern repeats: slab at `i * 4 - 1` for floor index `i ≥ 0` |

Formula: `slabY(floorIndex) = floorIndex * (tierHeight + slabThickness) - slabThickness`  
With defaults: `slabY(i) = i * 4 - 1`

---

## Write order (pipeline stages)

1. **Buildings** — `fillBox` entire building volume with `CELL.SHELL`
2. **Floors** — `fillBox` each interior floor slab (index 0 to maxTier−2) with `CELL.FLOOR`
3. **Roofs** — `fillBox` top slab (index maxTier−1) with `CELL.ROOF`; label pass marks exposed edges as `CELL.ROOF_N/S/E/W`
4. **Walls Pass 1** — overwrite each exposed-edge FLOOR cell with `CELL.FLOOR_N/S/E/W` (and END/ISLAND variants)
5. **Walls Pass 2** — `fillBox` each wall segment with `CELL.WALL_N/S/E/W` (never above roof level)

Later stages (connectivity, cover) will add further types as the pipeline is extended.

---

## File

`src/generators/collision/matrix.js`
