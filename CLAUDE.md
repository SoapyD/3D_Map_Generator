# 3D Map Generator — Mordheim Terrain for Tabletop Simulator

## Project Summary

Procedural generator for ruined city maps optimized for Mordheim gameplay. Outputs GLB files for Tabletop Simulator import. All surfaces are perfectly flat (no model tipping), verticality is enforced by design, and sightlines are controlled.

See `docs/` for full documentation:
- `PROJECT_OVERVIEW.md` — problem statement, design principles, tech stack
- `GENERATION_PIPELINE.md` — detailed 8-stage generation pipeline
- `IMPLEMENTATION_PHASES.md` — phased build plan
- `FOLDER_STRUCTURE.md` — project layout

## Tech Stack

- Node.js (ESM modules)
- Three.js (geometry generation + GLB export)
- CLI-based: `node src/index.js --seed 42 --levels 4 --size 48x48`

## Code Conventions

- ESM imports (`import`/`export`, not `require`)
- Each generator stage is a pure function: takes data in, returns enriched data out
- All measurements are in **inches** (Mordheim tabletop scale)
- Seed-based RNG everywhere — no `Math.random()`, always use the seeded RNG from `src/core/rng.js`
- Axis convention: X = width, Y = up, Z = depth (Three.js default)
- Keep geometry axis-aligned — no rotated or angled surfaces except ladder/ramp angles

## Key Constraints

- **All horizontal surfaces must be perfectly flat** — this is the core requirement
- **Constant slab thickness** — floors and walls are uniform thickness
- **Everything must be reachable** — connectivity pass must verify flood-fill from ground
- **Sightlines must be controlled** — no unbroken line of sight > 24" by default
- **Geometry must be simple** — axis-aligned boxes and extruded shapes only, no curved surfaces

## Testing

- Run tests: `npm test`
- Each generator stage should have unit tests validating its output constraints
- Connectivity tests must verify full reachability
- Sightline tests must verify max distance constraint

## Generation Quick Test

```bash
node src/index.js --seed 42 --preview
```

Generates a map and opens the browser preview server.
