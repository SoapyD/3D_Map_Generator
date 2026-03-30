# 3D Map Generator — Mordheim Terrain for Tabletop Simulator

## Project Summary

Procedural generator for ruined city maps optimized for Mordheim gameplay. Outputs GLB (preview), OBJ + PNG atlas (TTS), and collision OBJ. All surfaces are perfectly flat, verticality is enforced, sightlines are controlled.

## Tech Stack

- Node.js (ESM modules)
- Three.js (geometry generation + GLB export)
- pngjs (texture atlas generation)
- Custom seed-based RNG (mulberry32)
- CLI: `node src/index.js --seed 42 --tiers 4 --size 48x48 --debug`

## Architecture

### Generation Pipeline (7 stages)
1. **Grid** — BSP partitioning into city blocks
2. **Buildings** — Small/medium/large placement with overlap culling
3. **Floors** — Quadrant-based floor plates with progressive damage per tier
4. **Walls** — Edge-detected walls with quadrant damage (upper/lower rows)
5. **Connectivity** — Walkways, ladders (yellow/red/orange/cyan), platforms, gap detection (forced connections), branching T-junctions, bridges
6. **Cover** — Rooftop, courtyard, interior, street scatter
7. **Export** — GLB scene, OBJ (subdivided + atlas), collision mesh

### Export Details
- OBJ uses 3" segment subdivision with 256px atlas tiles (4 segments per tile = 64px each)
- GLB textures tile at 3" repeat (source textures are 32x32px)
- Per-object UV offset breaks visible tiling repetition
- TTS vertex limit: **25,000 per OBJ model**

## Code Conventions

- ESM imports (`import`/`export`, not `require`)
- **Named exports only** — no default exports
- Each generator stage is a pure function: takes data in, returns enriched data out
- All measurements in **inches** (Mordheim tabletop scale)
- Seed-based RNG everywhere — no `Math.random()`, always use seeded RNG from `src/core/rng.js`
- Axis convention: X = width, Y = up, Z = depth
- All geometry is axis-aligned boxes — no curves in OBJ export

## Critical Rules

### Branch Protection
- Never commit directly to master/main — use feature branches + PRs
- No force pushes to master/main

### Config
- All tuneable values live in `src/config.js`
- No magic numbers in logic — extract to config
- Deletion toggles in `DELETIONS` section for debugging
- `--debug` flag uses flat colours instead of textures

### Code Quality
- Overlap/collision checks should use shared helpers, not inline duplication
- Keep OBJ exporter and GLB scene builder in sync — same geometry, different formats
- When modifying geometry or UVs, update both exporters

### Testing
- Test with multiple seeds before committing generation changes
- Always verify vertex count stays under 25k TTS limit
- Check both GLB and OBJ output when modifying geometry or UV logic
- Run: `npm test`

## Key Constraints

- **All horizontal surfaces must be perfectly flat** — core requirement
- **Constant slab thickness** — floors and walls are uniform thickness
- **Everything must be reachable** — connectivity pass verifies access from ground
- **Sightlines must be controlled** — no unbroken line of sight > 24"
- **Geometry must be simple** — axis-aligned boxes only

## Agent Usage

- **Always check `.claude/agents/` for an applicable agent before starting a task.** If one exists, use it. If none fits, do the work directly.
- **If the user repeats a process that doesn't have an agent, suggest creating one.** Ask the user if they'd like an agent built for it — don't just create one silently.
- **Use the agent-builder agent** to create new agents, ensuring they follow project conventions and don't duplicate existing ones.
- Available agents: `code-auditor`, `release-validator`, `status-tracker`, `task-runner`, `test-builder`, `agent-builder`

## Reference Documents

- `docs/GENERATION_PIPELINE.md` — detailed pipeline docs
- `docs/PROJECT_OVERVIEW.md` — problem statement, design principles
- `docs/BUILDING_REFERENCE.md` — all building types, shapes, config keys, and diagrams
- `docs/plans/VERTEX_LIMIT_PLAN.md` — vertex budget strategy
- `docs/plans/PACKAGE_INTEGRATION_PLAN.md` — wyrdwars integration plan
- `docs/plans/BUILDING_ADDITIONS_PLAN.md` — towers, bridges, shapes, interior walls, preview tool
- `docs/plans/WATERWAYS_PLAN.md` — canal waterways with edge variants and bridges
- `docs/plans/WALKWAY_IMPROVEMENTS_PLAN.md` — walkway/bridge improvements (gap detection, branching)
- `docs/plans/FUTURE_FEATURES.md` — feature roadmap
- `docs/plans/archive/VERTEX_OPTIMISATION_PLAN.md` — completed vertex optimisation
- `docs/plans/archive/BUILDING_ADDITIONS_PLAN.md` — completed building additions
