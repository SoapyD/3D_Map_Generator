# Archived Floor & Wall Generation Rules

These rules were replaced by the quadrant system. Kept for reference.

## Old Floor Generation (Edge Damage + Centre Hollowing)

Floors were generated as full building footprints, then damaged:

### Edge Damage
- Rectangular chunks subtracted from floor edges
- Number of cuts scaled with damage level and floor area
- Cuts applied from the 4 sides randomly
- Larger sections were preferentially targeted

### Centre Hollowing (added later)
- Tier ratio determined floor style:
  - Low tiers (0-0.3): mostly intact, small edge chips
  - Mid tiers (0.3-0.6): 40-70% chance of centre hollowed out
  - High tiers (0.6-1.0): 70-90% chance of centre gone
- Hollowing left a 2.5" lip/rim around edges connecting wall corners
- Rim pieces could also get edge-chipped
- At high damage, 0-2 rim pieces could be removed entirely

### Constants
- MIN_WALKABLE = 2 inches
- LIP_WIDTH = 2.5 inches

---

## Old Wall Generation

Multiple iterations existed. Key approaches:

### Version 1: Building-Edge Driven
- Walls placed along all 4 edges of each floor section
- Damage applied: doors, windows, blown-out sections, broken tops
- Strip-based rasterization (0.5" strips) with openings subtracted
- Adjacent strips merged for cleaner geometry

### Version 2: Ruin Shape System
- Each building picked a "ruin shape" — 1-2 sides with walls
- Shapes: corners (NW, NE, SW, SE), single walls, parallel walls
- Weighted toward corners (most natural ruin shape)
- Only selected sides got walls; others were fully open

### Version 3: Floor-Driven Structural
- Walls generated to support floors above
- Every upper floor section required at least 2 walls underneath
- Priority: ruin-shape edges > edges with floor above > any edges
- 40% minimum wall-floor overlap validation pass

### Wall Damage Constants (all versions)
- DOOR_WIDTH = 1.8", DOOR_HEIGHT = 2.5"
- WINDOW_WIDTH = 1.2", WINDOW_HEIGHT = 1.5", WINDOW_SILL = 1.2"
- MAX_OPENING_RATIO = 0.5 (no opening > 50% of wall length)

### Wall Damage Rules
- Ground floor: 1-2 archways per wall (1.8" wide)
- All floors: windows every ~4", 50% placement chance
- Blown-out sections: capped at 50% of wall length
- Broken tops: 40% chance, wall cut to 55-85% height
- Top-tier walls could be skipped entirely (30% chance × damage)

---

## Why These Were Replaced

The edge damage and centre hollowing systems produced unpredictable floor
shapes that made it hard to guarantee walls properly supported floors above.
The ruin shape and structural wall systems grew increasingly complex trying
to handle edge cases.

The quadrant system replaced both with a simple, predictable model:
- 4 quadrants per floor, progressively removed bottom-up
- Walls placed on outer edges of quadrants present on the floor above
- No ambiguity about what supports what
