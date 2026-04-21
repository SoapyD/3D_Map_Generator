# Collision Matrix — Architecture

**Last updated:** 2026-04-21

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
| `45` | `CELL.ROOF_NE` | Roofs stage — label pass | Roof corner cell with exposed **north and east** edges |
| `46` | `CELL.ROOF_NW` | Roofs stage — label pass | Roof corner cell with exposed **north and west** edges |
| `47` | `CELL.ROOF_SE` | Roofs stage — label pass | Roof corner cell with exposed **south and east** edges |
| `48` | `CELL.ROOF_SW` | Roofs stage — label pass | Roof corner cell with exposed **south and west** edges |
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
| `90` | `CELL.DOOR` | Connectivity stage — Step 7b-i | Doorway opening — stamped into the building shell (2 cells wide × 3 cells tall) at each surviving anchor's trigger-cell position, before wall generation runs. Wall generator reads these to carve openings. |
| `91` | `CELL.IROOF_N` | Roofs stage — label pass | Interior-facing roof edge, north exposed (neighbour is SHELL) |
| `92` | `CELL.IROOF_S` | Roofs stage — label pass | Interior-facing roof edge, south exposed |
| `93` | `CELL.IROOF_E` | Roofs stage — label pass | Interior-facing roof edge, east exposed |
| `94` | `CELL.IROOF_W` | Roofs stage — label pass | Interior-facing roof edge, west exposed |
| `95` | `CELL.IROOF_NE` | Roofs stage — label pass | Interior roof corner, north+east exposed |
| `96` | `CELL.IROOF_NW` | Roofs stage — label pass | Interior roof corner, north+west exposed |
| `97` | `CELL.IROOF_SE` | Roofs stage — label pass | Interior roof corner, south+east exposed |
| `98` | `CELL.IROOF_SW` | Roofs stage — label pass | Interior roof corner, south+west exposed |
| `100` | `CELL.IROOF_END_N` | Roofs stage — label pass | Interior roof end cell, south+east+west exposed |
| `101` | `CELL.IROOF_END_S` | Roofs stage — label pass | Interior roof end cell, north+east+west exposed |
| `102` | `CELL.IROOF_END_E` | Roofs stage — label pass | Interior roof end cell, north+south+west exposed |
| `103` | `CELL.IROOF_END_W` | Roofs stage — label pass | Interior roof end cell, north+south+east exposed |
| `104` | `CELL.IROOF_ISLAND` | Roofs stage — label pass | Interior roof island, all four edges exposed |

---

## Useful range checks

```js
const isExteriorFloor = v => v === CELL.FLOOR || (v >= 10 && v <= 17) || (v >= 30 && v <= 34);
const isInteriorFloor = v => (v >= 60 && v <= 67) || (v >= 70 && v <= 74);
const isAnyFloor      = v => isExteriorFloor(v) || isInteriorFloor(v);
const isExteriorWall  = v => v === CELL.WALL || (v >= 20 && v <= 23);
const isInternalWall  = v => v >= 80 && v <= 83;
const isExteriorRoof  = v => v === CELL.ROOF || (v >= 41 && v <= 48);
const isInteriorRoof  = v => (v >= 91 && v <= 98) || (v >= 100 && v <= 104);
const isAnyRoof       = v => isExteriorRoof(v) || isInteriorRoof(v);
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
3. **Roofs** — `fillBox` top slab (index maxTier−1) with `CELL.ROOF`; label pass marks exposed edges as `CELL.ROOF_N/S/E/W/NE/NW/SE/SW` (exterior) or `CELL.IROOF_*` (interior, edge faces SHELL)
4. **Connectivity** — stamps `CELL.DOOR` (value 90) into the shell volume at each surviving anchor's trigger-cell position (2 wide × 3 tall), marking where the wall generator must carve doorway openings
5. **Walls Pass 1** — overwrite each exposed-edge FLOOR cell with `CELL.FLOOR_N/S/E/W` (and END/ISLAND variants)
6. **Walls Pass 2** — `fillBox` each wall segment with `CELL.WALL_N/S/E/W`, skipping cells already marked `CELL.DOOR` (never above roof level)

Later stages (cover, ladders) will add further types as the pipeline is extended.

---

## Write history — source arrays

Each pipeline stage stores its output objects in arrays on the shared data object. The write history (see `docs/plans/COLLISION_MATRIX_HISTORY_PLAN_2026_04_21.md`) records a direct index into these arrays alongside each cell write, so any cell's history can be resolved to the exact source object without bounding-box lookups.

| Stage enum | Stage | Source array | Object shape (key fields) |
|---|---|---|---|
| `0` | Buildings | `data.buildings[]` | `{ x, z, w, d, maxTier, size, blockIndex }` |
| `1` | Floors | `data.floors[]` | `{ buildingId, buildingIndex, floorIndex, yCollisionLevel, rects[], removedQuadrants }` |
| `2` | Floors — label pass | `data.floors[]` | Same as above — nearest building, no per-cell object |
| `3` | Roofs | `data.roofs[]` | `{ buildingId, buildingIndex, yCollisionLevel, rects[], removedQuadrants }` |
| `4` | Roofs — label pass | `data.roofs[]` | Same as above — nearest building, no per-cell object. Covers ROOF_N/S/E/W, ROOF_NE/NW/SE/SW, and all IROOF_* labels |
| `5` | Connectivity | `data.connections.doors[]` | `{ anchorId, direction, x, y, z, w, h, d }` |
| `6` | Walls — Pass 1 (floor labels) | `data.floors[]` | Nearest building — label pass has no per-cell object |
| `7` | Walls — Pass 2 (segments) | `data.walls[]` | `{ x, y, z, w, h, d, direction, floorY }` |
| `8` | Walls — internal | `data.internalWalls[]` | Same shape as `walls[]` |
| `255` | Unknown / no source | — | `sourceIndex` field ignored |

### Byte layout per history record

```
[ prev:Uint8 | next:Uint8 | stage:Uint8 | sourceIndex:Uint16LE ]
```

5 bytes total. Records are appended sequentially into a per-cell `Uint8Array` stored in a sparse `Map<cellIndex, Uint8Array>`. Only cells that receive at least one write have an entry.

---

## File

`src/generators/collision/matrix.js`
