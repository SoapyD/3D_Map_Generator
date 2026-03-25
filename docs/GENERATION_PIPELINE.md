# Generation Pipeline

## Overview

The generator runs as a sequential pipeline. Each stage takes the output of the previous stage and enriches it.

```
Seed → Grid → Buildings → Floors → Walls → Connectivity → Sightlines → Textures → Export
```

## Stage 1: Grid Partitioning

**Input**: Map dimensions, seed
**Output**: 2D grid of city blocks separated by streets

- Divide the play area into a grid
- Use BSP (Binary Space Partitioning) to create irregular block sizes
- Carve streets between blocks (configurable width, e.g., 3-4")
- Streets form the ground-level movement network
- Some blocks are open plazas / market squares (no buildings)

## Stage 2: Building Footprints

**Input**: City blocks from Stage 1
**Output**: Building footprints within each block

- Each block gets 1-3 building footprints
- Buildings are axis-aligned rectangles (possibly L-shaped or T-shaped via combining rectangles)
- Leave gaps between buildings for alleyways
- Tag buildings with a height (number of tiers they reach)
- Taller buildings toward the center, shorter toward edges (optional)

## Stage 3: Floor Plate Generation (Horizontal Planes)

**Input**: Building footprints + height assignments
**Output**: 3D slab geometry for each tier

For each tier (0 to max):
- **Tier 0 (base)**: Full map coverage — streets + building interiors at ground level
- **Tier 1+**: Only the footprints of buildings tall enough to reach this tier
- Apply **damage/ruin cutouts**:
  - Remove random rectangular chunks from floor edges
  - Create irregular boundaries using stepped cuts (axis-aligned zigzag)
  - Higher tiers have more damage (less floor remaining)
  - Ensure enough floor remains to place models (min ~2"x2" walkable area per section)
- Extrude each floor shape to constant thickness (e.g., 0.5")
- Tier vertical spacing: 6" between each tier (configurable)

## Stage 4: Wall Generation (Vertical Planes)

**Input**: Floor plates from Stage 3
**Output**: Wall slab geometry

For each building on each tier:
- Place walls along the outer edges of the floor plate
- Walls are thin slabs (e.g., 0.25" thick) extruded upward to next tier height
- Apply damage:
  - Remove sections to create doorways (ground floor, ~1.5" wide x 2" tall)
  - Cut window openings (upper floors, ~1" x 1")
  - Break wall tops into jagged profiles (stepped cuts)
  - Remove entire wall sections randomly (more damage on higher tiers)
- Interior walls: occasionally subdivide large floor areas

## Stage 5: Connectivity

**Input**: All geometry from Stages 3-4
**Output**: Walkways, ladders, and bridges added

### Algorithm:
1. Build a graph: each floor section is a node
2. Two nodes are connected if they share an edge at the same tier
3. For each isolated upper-tier node, find the nearest lower-tier node
4. Place a ladder or stairway between them
5. For nearby buildings at the same tier, consider placing walkway bridges
6. Validate: flood-fill from ground level — every node must be reachable
7. If unreachable nodes exist, add additional ladders/walkways

### Geometry:
- **Ladders**: Thin rectangular slab (0.5" wide) at ~80° angle, textured as ladder
- **Walkways**: Flat slab (2" wide) bridging gaps, with optional low wall/railing
- **Rubble ramps**: Angled slab from ground to tier 1 (for natural-looking access)

## Stage 6: Sightline Analysis

**Input**: Complete geometry
**Output**: Additional cover elements placed

### Algorithm:
1. Sample points across all tiers at regular intervals (e.g., every 2")
2. For each pair of points with line of sight, measure distance
3. Flag any sightline > 24" (configurable, Mordheim shooting range)
4. Place cover elements to break flagged sightlines:
   - Freestanding wall fragments
   - Rubble piles (flat-topped for model placement)
   - Barricades
   - Market stall remnants
5. Re-check until no sightlines exceed threshold
6. Avoid over-cluttering — track cover density per area

## Stage 7: Texturing

**Input**: All geometry
**Output**: UV-mapped geometry with material assignments

- Assign materials by element type:
  - Floor slabs → stone/tile texture
  - Walls → brick/stone texture
  - Walkways → wood plank texture
  - Ladders → wood/metal texture
  - Rubble/cover → rubble texture
- Simple box UV projection (axis-aligned geometry makes this trivial)
- Textures are embedded in the GLB output

## Stage 8: Export

**Input**: Textured geometry
**Output**: `.glb` file

- Merge all geometry into a single scene
- Apply Three.js GLTFExporter
- Optionally split into separate objects (TTS can handle multi-object GLB)
- Write metadata (seed, settings) into GLB extras field
- Output file named: `mordheim_map_{seed}.glb`

## Configuration Options

| Parameter | Default | Description |
|-----------|---------|-------------|
| `seed` | random | RNG seed for reproducibility |
| `mapWidth` | 48 | Map width in inches |
| `mapDepth` | 48 | Map depth in inches |
| `tiers` | 4 | Number of elevated tiers (+ base) |
| `tierHeight` | 6 | Vertical spacing between tiers (inches) |
| `slabThickness` | 0.5 | Thickness of floor slabs (inches) |
| `wallThickness` | 0.25 | Thickness of wall slabs (inches) |
| `streetWidth` | 3.5 | Minimum street width (inches) |
| `damageLevel` | 0.5 | 0-1, how ruined the buildings are |
| `maxSightline` | 24 | Max allowed unbroken sightline (inches) |
| `textureSet` | "gothic" | Which texture pack to use |
