# 3D Map Generator — Mordheim Tabletop Terrain

## Problem Statement

Workshop maps for Mordheim in Tabletop Simulator (TTS) have two critical issues:
1. **Geometry problems** — uneven surfaces cause models to tip over
2. **Poor map design** — no verticality, no connected elevated routes, overly long sightlines

## Solution

A procedural generator that creates seed-based 3D ruined city maps optimized for Mordheim gameplay, exportable to TTS.

## Core Design Principles

- **Function over form** — gameplay quality matters more than visual fidelity
- **Flat horizontal planes** — every surface a model stands on is perfectly flat (no tipping)
- **Thick cardboard aesthetic** — all geometry is extruded flat shapes (slabs + walls)
- **Verticality by design** — maps are built around 3-5 elevated tiers connected by walkways/ladders
- **Sightline control** — no unbroken shooting lanes across the entire map
- **Seed-based** — reproducible maps from a seed number
- **Mordheim scale** — 1 inch = 1 inch, standard 4'x4' (48"x48") or configurable play area

## Architecture

### Tier System

The map is a stack of horizontal planes:

```
Tier 4  ░░▓▓░░          (rooftops, small platforms)
Tier 3  ░░▓▓▓▓░░        (upper floors, balconies)
Tier 2  ░▓▓▓▓▓▓▓░       (second floors, walkways)
Tier 1  ▓▓▓▓▓▓▓▓▓▓      (ground floor ruins, rubble piles)
Tier 0  ████████████████  (base/street level — full coverage)
```

Each tier is a flat slab (constant thickness, e.g., 0.5") with cutout shapes representing:
- Building floor plates
- Balconies and overhangs
- Crumbling floor edges (irregular cutout boundaries)
- Walkways between buildings

### Vertical Elements

Thin wall slabs placed on tier edges and between tiers:
- Exterior walls with window/door cutouts
- Interior partial walls
- Ruined wall fragments (varying heights, jagged tops)

### Connectivity

Every elevated area must be reachable from ground level via:
- Ladders (thin geometry, textured)
- Walkways/bridges between buildings
- Ramps or rubble slopes (flat angled slabs)

### Sightline Control

After generation, raycasting checks identify long unbroken lines of sight.
Cover elements (wall fragments, rubble, barricades) are placed to break them up.
Target: no unobstructed sightline longer than ~24" (Mordheim max shooting range).

## Tech Stack

- **Runtime**: Node.js
- **3D Geometry**: Three.js
- **Export Format**: GLB (glTF binary) — TTS-compatible, supports embedded textures
- **Generation**: BSP / grid-based partitioning with seed-based RNG
- **CLI Interface**: `node generate.js --seed 42 --levels 4 --size 48x48`

## Output

A single `.glb` file per generation containing:
- All geometry (floors, walls, walkways, ladders)
- Embedded textures (stone floors, brick walls, wood planks)
- Correct scale for TTS import
