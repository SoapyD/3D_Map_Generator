# Building Additions Plan

**Date:** 2026-03-29
**Completed:** 2026-03-30
**Status:** Archived
**Outcome:** Added towers (with pyramid roofs), building shapes (corners, diagonals, L-shapes, U-shapes in 3 sizes), interior walls, bridge walkways, roof system with separate textures, building preview tool, and texture grouping for composite buildings.

---

## Implemented Features

### Towers
- Tower building type (2-3" footprint, always max tier)
- Pyramid roof variant (50% chance, 4 triangle faces + flat ceiling)
- Tower ladders (ground to top, wall deletion at exit tier)
- Max 2 towers per map
- No quadrant floor damage (full floors at every tier)

### Building Shapes
- **Small**: full, corner (×4), diagonal (×2), small U (×4 tower-sized cells)
- **Medium**: full, L-shape (×4), narrow U (×4)
- **Large**: full, wide U (×4)
- All shapes configurable via weighted selection in config
- Composite shapes use `suppressEdges` to remove walls on shared internal edges
- `textureGroup` ensures all parts of a composite building share the same textures
- Diagonals generate as two independent buildings with separate random heights
- Tier 1 floors protected from damage on shaped buildings

### Interior Walls
- Centre wall and cross variants with 4 rotations each
- Quadrant damage applied to interior walls (creates natural doorway openings)
- Configurable chance per tier: 20% medium, 100% large
- Cross walls span half room width/depth (centred)

### Bridge Walkways
- Low variant: continuous 0.75" side walls
- Battlement variant: 0.75" base + spaced 1.5" tall sections
- 40% chance to replace tier 2+ walkways
- Stone texture (landmark_walls pool)

### Roof System
- Top tier floor sections separated into `roofs` array
- Flat roofs: roof texture on top, floor texture on underside
- Pyramid roofs: 4 outward-facing triangles + flat ceiling quad
- `roofs/` texture category added to texture packs
- Rooftop cover only generates on flat roofs

### Building Preview Tool
- `src/tools/preview-building.js`
- Supports: --type, --shape, --seed, --interior-walls, --texture-set, --debug, --glb, --obj, --format
- Generates single buildings in isolation with floors, walls, connectivity
- All composite shapes supported (diagonal, L, U variants)

### Other
- Anti-stacking: walkways on different tiers can't overlap in XZ if same axis
- Max walkway length increased to 24" (half map width)
- Tower count limited to 2 per map (`BUILDING.maxTowers`)
