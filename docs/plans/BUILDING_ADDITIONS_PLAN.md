# Building Additions Plan

**Date:** 2026-03-29
**Status:** Active
**Priority:** High

## Summary

Add new building types, shapes, and features to increase map variety. Includes ruined towers with pyramid roofs, bridge walkways with cover walls, non-rectangular small building footprints, interior walls for large/medium buildings, and a building preview tool.

---

## 1. Ruined Towers

Tall, narrow buildings (2×2 to 3×3 footprint) that always go to max tier. Distinct from regular buildings by their height-to-footprint ratio.

### Variants

| Variant | Footprint | Height | Roof |
|---|---|---|---|
| Standard tower | 3×3 | maxTier (4) | Open top (ruined) |
| Narrow tower | 2×2 | maxTier (4) | Open top (ruined) |
| Pyramid tower | 2×2 or 3×3 | maxTier (4) | Pyramid roof (4 angled triangles meeting at centre) |

### Pyramid Roof

- 4 triangular faces from the top floor corners meeting at a central apex
- Apex height: 1-2" above the top floor
- Uses a roof/stone texture from the atlas
- Only on the smaller footprint variants (2×2 and 3×3)
- OBJ: 4 triangles = 5 verts (4 corners + 1 apex) — minimal vertex cost
- GLB: same geometry via Three.js

### Implementation

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Add `tower` building size to config (footprint, height ranges) | Pending | Alongside small/medium/large |
| 2 | Tower placement in `buildings.js` — 1-2 per map, placed in grid cells | Pending | Use smallest available cells |
| 3 | Tower floors — always all 4 quadrants present, no deletion | Pending | Full floor at every tier |
| 4 | Tower walls — full perimeter at every tier, standard quadrant damage | Pending | |
| 5 | Pyramid roof generation for qualifying towers | Pending | Config chance, e.g. 50% |
| 6 | Pyramid roof in OBJ exporter — 4 triangular faces | Pending | New emission function |
| 7 | Pyramid roof in GLB scene builder — ConeGeometry or manual triangles | Pending | |
| 8 | Pyramid roof in collision mesh — single peak collision | Pending | |
| 9 | Ladder connectivity to tower tops | Pending | At least one ladder per tower |
| 10 | Tower texture assignment (landmark textures) | Pending | Use landmark_walls pool |

---

## 2. Bridge Walkways

Elevated bridges between buildings at tier 2+, wider and thicker than standard walkways, with raised side walls that provide cover.

### Variants

| Variant | Side Wall Height | Description |
|---|---|---|
| Low bridge | 0.75" continuous | Low walls along both sides, provides light cover |
| Battlements | 0.75" base + 1.5" tall spaced sections | Alternating low/high sections (crenellation pattern), provides heavier cover with firing gaps |

### Geometry

- Bridge slab: same as walkway but wider (3" instead of 2") and thicker (0.5" instead of 0.3")
- Side walls: thin boxes (0.25" thick) running along both long edges
- Battlement sections: additional 0.75" tall boxes on top of the 0.75" base wall, spaced every ~1.5"
- Stone texture instead of wood (different atlas tile from walkways)

### Implementation

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Add `bridge` connection type to connectivity config | Pending | Chance to replace walkway at tier 2+ |
| 2 | Bridge slab generation (wider, thicker) | Pending | Reuse addSharedFlat |
| 3 | Low bridge variant — continuous 0.75" side walls | Pending | 2 thin wall boxes per bridge |
| 4 | Battlement variant — spaced 1.5" tall sections | Pending | Multiple small boxes on top of base walls |
| 5 | Bridge texture assignment (stone textures) | Pending | New texture category or reuse landmark_walls |
| 6 | Bridge in OBJ exporter | Pending | Slab + wall geometry |
| 7 | Bridge in GLB scene builder | Pending | |
| 8 | Bridge in collision mesh | Pending | Slab + walls for unit movement |
| 9 | Walkway UV rotation applies to bridges too | Pending | Texture planks run along bridge length |

---

## 3. Small Building Footprint Shapes

Currently all small buildings are rectangles. Add non-rectangular shapes composed of quadrant-sized blocks.

### Shapes (all shown as quadrant grids, # = present)

**Corner (2 quadrants):**
```
#.
##
```
Rotations: 4 (NW, NE, SE, SW corners)

**L-Shape (3 quadrants):**
```
#.
##
```
Wait — that's the same as corner. L-shape is:
```
#.
#.
##
```
But our buildings use a 2×2 quadrant grid, so with 2×2 quadrants available:

**Corner (2 quadrants, 2×2 grid):**
```
#.
##
```
Rotations × mirrors = 4 variations

**L-Shape (3 quadrants, 2×2 grid):**
```
#.
##
```
Actually in a 2×2 grid, 3 quadrants = L-shape (missing one corner).
Rotations × mirrors = 4 variations (which corner is missing)

**U-Shape (3 quadrants, but different arrangement):**
```
#.#
###
```
This needs a 3×2 or wider grid. In a 2×2 grid:
```
#.
##
```
U-shape doesn't fit a 2×2 quadrant grid. Needs a wider building footprint.

### Revised approach

Small buildings currently use a 2×2 quadrant grid. The shapes map to which quadrants are present at tier 1:

| Shape | Quadrants Present | Count | Variations |
|---|---|---|---|
| Full rectangle | 0,1,2,3 | 4 | 1 (current default) |
| Corner | e.g. 0,1,2 (missing 3) | 3 | 4 (which corner missing) |
| Diagonal | e.g. 0,3 or 1,2 | 2 | 2 (which diagonal) |

For U-shape and wider L-shapes, the building would need a 3×2 quadrant grid (wider footprint). This requires:
- Building footprint = 3 quadrants wide × 2 deep
- A 6-quadrant grid system for wider buildings

### Implementation

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Define shape templates as quadrant presence arrays | Pending | `[[0,1,2], [0,1,3], [0,2,3], [1,2,3]]` for corner shapes |
| 2 | Add shape selection to building placement (config chance) | Pending | e.g. 30% shaped, 70% full rectangle |
| 3 | Shape determines which quadrants exist at tier 1 | Pending | Higher tiers can remove more via existing damage |
| 4 | Walls generate only on exposed edges of present quadrants | Pending | Existing wall edge detection should handle this |
| 5 | Floor generation respects shape | Pending | Only present quadrants get floors |
| 6 | Connectivity still works (ladders placed on present quadrants) | Pending | |
| 7 | For U-shape: extend to 3×2 grid for wider buildings | Pending | Larger footprint, 6 quadrant positions |
| 8 | All rotations and mirrors generated from base template | Pending | Rotate template array, don't duplicate code |

### Shape Variations (2×2 grid)

Corner (missing one quadrant):
```
Variation 0:  Variation 1:  Variation 2:  Variation 3:
##            ##            #.            .#
#.            .#            ##            ##
```

L-Shape = Corner (in a 2×2 grid, 3 quadrants always form an L)

Diagonal:
```
Variation 0:  Variation 1:
#.            .#
.#            #.
```

### Shape Variations (3×2 grid for U-shape)

```
Base:     Rotation 90:  Rotation 180:  Rotation 270:
#.#       ##            ###            ##
###       .#            #.#            #.
          ##                           ##
```

---

## 4. Interior Walls

Large and medium buildings can have interior walls on mid-floors (not ground, not top — same tiers as interior cover).

### Variants

| Variant | Layout | Description |
|---|---|---|
| Centre wall | Wall from one perimeter wall midpoint toward room centre | Divides room roughly in half |
| Cross | Two perpendicular walls crossing at room centre | Divides room into 4 roughly equal areas |

### Rules

- Follow same quadrant damage rules as exterior walls (upper/lower row removal)
- Interior walls are thinner (same 0.25" thickness)
- Must not block the only path through a room — at least one gap per interior wall
- Generate on mid-floors only (tier 1 to maxTier-1)
- Config chance per eligible floor (e.g. 20% for medium, 40% for large)
- Interior walls use the same texture as the building's exterior walls

### Centre Wall Variations (all rotations)

```
North:    South:    East:     West:
..#..     ..#..     .....     .....
..#..     ..#..     .###.     .###.
.....     .....     .....     .....

(wall extends from north edge to centre, etc.)
```

### Cross Variation

```
..#..
..#..
.###.
..#..
..#..
```

With quadrant damage, sections of interior walls get removed just like exterior walls, creating doorway-like openings naturally.

### Implementation

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Add interior wall config (chance per tier for medium/large) | Pending | |
| 2 | Interior wall generation in `walls.js` or new `interior-walls.js` | Pending | After exterior walls |
| 3 | Wall variant selection (centre vs cross, rotation) | Pending | Random per eligible floor |
| 4 | Apply quadrant damage to interior walls | Pending | Reuse existing `applyWallDamage` |
| 5 | Interior walls in OBJ exporter | Pending | Use addSharedWall |
| 6 | Interior walls in GLB scene builder | Pending | Use createWallSlab |
| 7 | Interior walls in collision mesh | Pending | Exclude (same as exterior walls) |
| 8 | Connectivity: interior ladders don't clip through interior walls | Pending | Check during placement |
| 9 | Interior cover doesn't overlap interior walls | Pending | Add to overlap checks |

---

## 5. Building Preview Tool

A CLI tool to extract and view a single building with randomised options, for testing and development.

### Usage

```bash
node src/tools/preview-building.js --type tower --seed 42
node src/tools/preview-building.js --type small --shape corner --seed 100
node src/tools/preview-building.js --type large --interior-walls --seed 7
```

### Features

- Generates a single building in isolation (no city grid, no neighbours)
- Applies random seed for damage, tier selection, wall quadrant removal
- Outputs GLB + OBJ for the single building
- Shows vertex count for the building
- Supports all building types: small, medium, large, tower
- Supports shape selection for small buildings
- Supports interior wall toggle for medium/large

### Implementation

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Create `src/tools/preview-building.js` CLI script | Pending | |
| 2 | Standalone building generation (floors, walls, damage, ladders) | Pending | Reuse existing generators with single-building data |
| 3 | Single-building OBJ + GLB export | Pending | Reuse existing exporters |
| 4 | Vertex count output | Pending | |
| 5 | CLI args: --type, --shape, --seed, --interior-walls, --tiers | Pending | |

---

## Implementation Order

| Phase | Items | Dependencies |
|---|---|---|
| 1 | Building preview tool (#5) | None — useful for testing everything else |
| 2 | Small building shapes (#3) | Preview tool for testing |
| 3 | Ruined towers (#1) | Preview tool for testing |
| 4 | Interior walls (#4) | Preview tool for testing |
| 5 | Bridge walkways (#2) | Towers and shapes done first (bridges connect buildings) |
