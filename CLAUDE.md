# 3D Map Generator — Mordheim Ruined-City Terrain

## Project Summary

Procedural generator for ruined city maps optimized for Mordheim gameplay. The consumer is the **Withering game**, which uses the GLB, the geometry primitives (boxes) and the collision matrix. **Tabletop Simulator (TTS) is no longer a target.** The OBJ + PNG atlas, the per-tier split (`--split-tiers`) and the collision OBJ exports were **removed in this version**; they live in git tags `v0.2.0` and `v0.3.0`. All surfaces are perfectly flat, verticality is enforced, sightlines are controlled.

## Tech Stack

- Node.js (ESM modules)
- Three.js (geometry generation + GLB export)
- pngjs (GLB texture pools)
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
7. **Export** — GLB scene + geometry JSON (with the collision matrix).

### Export Details
- GLB textures tile at 3" repeat (source textures are 32x32px); GLB UVs are world-space, with one offset per texture key to break visible repetition
- GLB + geometry JSON are always written; the Withering game reads the primitives and the collision matrix
- OBJ + atlas, per-tier split and collision OBJ exports were removed (tags `v0.2.0`, `v0.3.0`)
- There is **no vertex cap**: the old 25,000-vertex TTS limit is gone with the OBJ export

## Code Conventions

- ESM imports (`import`/`export`, not `require`)
- **Named exports only** — no default exports
- Each generator stage is a pure function: takes data in, returns enriched data out
- All measurements in **inches** (Mordheim tabletop scale)
- Seed-based RNG everywhere — no `Math.random()`, always use seeded RNG from `src/core/rng.js`
- Axis convention: X = width, Y = up, Z = depth
- All geometry is axis-aligned boxes — no curves

## Critical Rules

### Branch Protection
- Never commit directly to master/main — use feature branches + PRs
- No force pushes to master/main

### Config
- All tuneable values live in `src/config.js`
- No magic numbers in logic — extract to config
- `--debug` flag uses flat colours instead of textures

### Code Quality
- Overlap/collision checks should use shared helpers, not inline duplication
- Keep the GLB scene builder and the collision matrix in sync — matrix parity for the same seed unless a change is deliberate

### Testing
- Test with multiple seeds before committing generation changes
- Generation must stay deterministic per seed (same GLB and geometry JSON) and the collision matrix must stay identical unless a change is deliberate
- Check the GLB output when modifying geometry or UV logic
- Run: `npm test` and `npm run check:all` (baseline 37 findings, must not rise) and `npm run check:file-sizes` (no new entries)

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
- Available agents: `code-auditor`, `release-validator`, `status-tracker`, `task-runner`, `test-builder`, `agent-builder`, `pr-shipper`

## Reference Documents

- `docs/architecture/docs_and_config_guide.md` — what each doc and each `src/config.js` section is for (start here)
- `docs/GENERATION_PIPELINE.md` — stage order and links to the per-stage flow docs
- `docs/processes/pipeline-flows/` — one flow doc per stage (1-grid … 11-scene-and-export)
- `docs/PROJECT_OVERVIEW.md` — problem statement, design principles
- `docs/BUILDING_REFERENCE.md` — building size classes and placement
- `docs/issues.md` — known open issues
- `docs/plans/CONVENTIONS_ALIGNMENT_PLAN_2026_10_13.md` and `docs/plans/CONVENTIONS_ALIGNMENT_MANIFEST_2026_10_13.md` — conventions alignment (shared rect cover, world-space GLB UVs, TTS/OBJ removal, Phase 3b done)
- `docs/plans/PRIMITIVE_MERGE_PLAN_2026_10_13.md` — primitive merge (Track 2 superseded by the conventions plan)
- `docs/plans/` — active plans; completed plans are in `docs/plans/archive/` (e.g. `VERTEX_LIMIT_PLAN_2026_03_30.md`, `VERTEX_OPTIMISATION_PLAN_2026_03_29.md`, `WATERWAYS_PLAN_2026_03_30.md`, `WALKWAY_IMPROVEMENTS_PLAN_2026_03_30.md`, `BUILDING_ADDITIONS_PLAN_2026_03_30.md`, `PACKAGE_INTEGRATION_PLAN_2026_03_28.md`, `FUTURE_FEATURES_2026_03_30.md`)
