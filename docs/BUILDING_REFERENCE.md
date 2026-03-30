# Building Types Reference

Quick reference for all building types, their generation chances, dimensions, and configuration keys.

---

## All Building Types

| Type | Size | Footprint | Shape Chance | Height | Internal Walls | Auto Ladder | Max Count | Config Key |
|---|---|---|---|---|---|---|---|---|
| **Small (full)** | Small | 4-7" × 4-7" | 40% of small | Random 2-4 tiers | No | No | Unlimited (grid-based) | `smallShapes.full` |
| **Small (corner ×4)** | Small | 4-7" × 4-7" (3/4) | 7.5% each | Random 2-4 tiers | No | No | Unlimited | `smallShapes.corner0-3` |
| **Small (diagonal ×2)** | Small | 2 half-buildings | 5% each | Random per half | No | No | Unlimited | `smallShapes.diagA/B` |
| **Small U (×4)** | Small | 5 tower-sized cells | 2% each | Random 2-4 tiers | No | No | Unlimited | `smallShapes.uSmallN/S/E/W` |
| **Tower** | Tower | 2-3" × 2-3" | 30% of cells | Fixed: max tier | No | Yes (ground to top) | 2 per map | `towerChance`, `maxTowers` |
| **Tower + pyramid** | Tower | 2-3" × 2-3" | 50% of towers | Fixed: max tier | No | Yes (ground to tier below roof) | 2 per map | `pyramidRoofChance` |
| **Medium (full)** | Medium | 7-12" × 7-12" | 40% of medium | Random 3-5 tiers | 20% per floor | No | 0-4 per map (layout) | `mediumShapes.full` |
| **Medium L-shape (×4)** | Medium | 2 segments (strip+ext) | 7.5% each | Random 3-5 tiers | No | No | 0-4 per map (layout) | `mediumShapes.lShape*` |
| **Medium narrow U (×4)** | Medium | 3 segments (col+stubs) | 5% each | Random 3-5 tiers | No | No | 0-4 per map (layout) | `mediumShapes.uNarrow*` |
| **Large (full)** | Large | 11-18" × 11-18" | 50% of large | Random 3-5 tiers | 100% per floor | No | 0-2 per map (layout) | `largeShapes.full` |
| **Large wide U (×4)** | Large | 3 segments (cols+bar) | 12.5% each | Random 3-5 tiers | No | No | 0-2 per map (layout) | `largeShapes.uShape*` |

### Max Count Notes

- **Small**: Generated per grid cell. Cell count depends on map size — a 48×48 map has ~36 cells. After tower chance and shape selection, typically 8-15 small buildings per map. 15-20% are then randomly culled.
- **Tower**: Max 2 per map (`BUILDING.maxTowers`). 30% chance per cell until cap reached.
- **Medium**: 0-4 per map, determined by layout selection (layouts 2-4 use medium). Hardcoded.
- **Large**: 0-2 per map, determined by layout selection (layouts 0-1 use large). Hardcoded.
- **Bridges**: No max — any tier 2+ walkway has a 40% chance to become a bridge.

---

## Layout Selection (Medium/Large)

The map generates 1-4 medium/large buildings from 5 equally weighted layouts (hardcoded, 20% each):

| Layout | Buildings |
|---|---|
| 0 | 1 large (centre) |
| 1 | 2 large (TL + BR) |
| 2 | 3 medium (TL + BR + TR) |
| 3 | 3 medium (TL + BL + TR) |
| 4 | 4 medium (TL×2 + BR + TR) |

---

## Shape Diagrams

### Small Shapes (2×2 quadrant grid)

```
full:       corner0:    corner1:    corner2:    corner3:
##          ##          ##          .#          #.
##          #.          .#          ##          ##

diagA:      diagB:
.#          #.
#.          .#
```

### Small U (2×3 grid, tower-sized cells)

```
uSmallN:    uSmallS:    uSmallE:    uSmallW:
##          ##          ###         #.#
#.          .#          #.#         ###
##          ##
```

### Medium Shapes

```
L-shapes (3×2 segments):
lShapeSW:   lShapeSE:   lShapeNW:   lShapeNE:
#.          .#          ##          ##
#.          .#          #.          .#
##          ##          #.          .#

Narrow U (2×3 segments):
uNarrowN:   uNarrowS:   uNarrowE:   uNarrowW:
##          ##          ###         #.#
#.          .#          #.#         ###
##          ##
```

### Large Shapes

```
Wide U (3×3 segments):
uShapeN:    uShapeS:    uShapeE:    uShapeW:
#.#         ###         ##.         .##
#.#         #.#         ###         ###
###         #.#         ##.         .##
```

---

## Roofs

| Type | Applies to | Texture | Underside |
|---|---|---|---|
| Flat roof | All buildings (top tier) | `roofs/` texture pool | Floor texture (visible from below) |
| Pyramid roof | Towers (50% chance) | `roofs/` texture pool | Flat floor texture quad at base |

---

## Connections

| Type | Trigger | Dimensions | Variants |
|---|---|---|---|
| Walkway | Between buildings, same tier | 2" wide × 0.3" thick | Wood texture, UV rotated for E-W |
| Bridge | Replaces tier 2+ walkway (40%) | 3" wide × 0.5" thick | Low walls (0.75") or battlements (1.5" spaced) |
| Tower ladder | Every tower | Ground to top floor | Exterior, wall deleted at exit tier |

---

## Hardcoded vs Config Values

| Setting | Location | Configurable? |
|---|---|---|
| Tower chance (30%) | `BUILDING.towerChance` | Yes |
| Pyramid roof chance (50%) | `BUILDING.pyramidRoofChance` | Yes |
| Tower footprint (2-3") | `BUILDING.tower` | Yes |
| Small/medium/large footprints | `BUILDING.footprints` | Yes |
| Small shape weights | `BUILDING.smallShapes` | Yes |
| Medium shape weights | `BUILDING.mediumShapes` | Yes |
| Large shape weights | `BUILDING.largeShapes` | Yes |
| Height ranges (short/medium/tall) | `BUILDING.heights` | Yes |
| Interior wall chance | `WALL.interiorWallChance` | Yes |
| Interior wall variants | `WALL.interiorWallVariants` | Yes |
| Bridge chance (40%) | `CONNECTIVITY.bridgeChance` | Yes |
| Bridge variants (low/battlement) | `CONNECTIVITY.bridgeVariants` | Yes |
| Bridge dimensions | `CONNECTIVITY.bridge*` | Yes |
| Layout count (5 options) | `buildings.js` line 305 | **Hardcoded** |
| Medium/large height range (3-5) | `buildings.js` line 374 | **Hardcoded** |
| Medium/large segment size (fp/2) | `buildings.js` makeBig | **Hardcoded** |
| Small U cell size (tower range) | `buildings.js` uSmall | **Hardcoded** (uses tower footprint) |
| Diagonal independent heights | `buildings.js` | **Hardcoded** (always independent) |
