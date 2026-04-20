# Project Folder Structure

```
3d_map_generator/
├── docs/                        # Project documentation
│   ├── PROJECT_OVERVIEW.md
│   ├── GENERATION_PIPELINE.md   # Design spec for all 8 stages
│   ├── IMPLEMENTATION_PHASES.md
│   ├── FOLDER_STRUCTURE.md
│   ├── architecture/
│   │   └── design_philosophy.md # Stack-agnostic principles behind the project
│   └── processes/
│       ├── FORMAT.md            # How to write pipeline flow docs
│       └── pipeline-flows/      # One flow doc per pipeline stage
│           ├── 1-grid.md
│           ├── 2-buildings.md
│           ├── 3-floors.md
│           ├── 4-walls.md
│           ├── 5-connectivity.md
│           ├── 6-sightlines.md
│           ├── 7-textures.md
│           └── 8-export.md
│
├── src/
│   ├── index.js                 # CLI entry point
│   ├── config.js                # Default config + CLI arg parsing
│   │
│   ├── core/
│   │   ├── rng.js               # Seed-based RNG (mulberry32 or similar)
│   │   └── geometry.js          # Shared geometry helpers (extrude, merge, etc.)
│   │
│   ├── generators/
│   │   ├── grid.js              # Stage 1: BSP city block partitioning
│   │   ├── buildings.js         # Stage 2: Building footprint placement
│   │   ├── floors.js            # Stage 3: Floor plate generation + damage
│   │   ├── walls.js             # Stage 4: Wall generation + damage
│   │   ├── connectivity.js      # Stage 5: Ladders, walkways, bridges
│   │   ├── sightlines.js        # Stage 6: Sightline analysis + cover
│   │   └── textures.js          # Stage 7: UV mapping + material assignment
│   │
│   ├── export/
│   │   └── glb-exporter.js      # Stage 8: Three.js scene → GLB file
│   │
│   └── preview/
│       ├── server.js            # Simple HTTP server for browser preview
│       └── viewer.html          # Three.js browser viewer
│
├── assets/
│   └── textures/                # Texture images (stone, brick, wood, etc.)
│       ├── stone_floor.png
│       ├── brick_wall.png
│       ├── wood_plank.png
│       └── rubble.png
│
├── output/                      # Generated map files land here
│
├── test/                        # Tests per generator stage
│   ├── grid.test.js
│   ├── buildings.test.js
│   ├── floors.test.js
│   ├── walls.test.js
│   ├── connectivity.test.js
│   └── sightlines.test.js
│
├── CLAUDE.md                    # Claude Code project instructions
├── package.json
└── .gitignore
```

## Key Decisions

- **ESM modules** (`"type": "module"` in package.json) — modern Node.js
- **No framework** — plain Node.js + Three.js, no build step needed
- **Generators are independent stages** — each takes data in, returns enriched data out
- **Preview server** is optional dev convenience, not required for generation
- **Output folder** is gitignored — generated files aren't committed
