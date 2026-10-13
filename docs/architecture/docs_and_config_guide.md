# Docs & Config Guide

What each documentation file is for, and what each section of `src/config.js` controls. Read this to decide which doc to open, or where a tunable value lives.

**Last verified:** 2026-10-10 (known-issues list updated after cleanup)

---

## Part 1 — Documentation map

### Entry points

| File | Purpose | Trust level |
|---|---|---|
| `CLAUDE.md` (repo root) | Project rules, conventions, pipeline summary, agent list. Loaded automatically every session. | Current. Reference list updated 2026-10-10. |
| `README.md` | CLI flags, examples, texture packs, a pointer to tags v0.2.0 / v0.3.0 for the removed TTS export. | Current. |
| `docs/PROJECT_OVERVIEW.md` | Problem statement and design goals (flat surfaces, verticality, sightlines). | Stable. |

### `docs/architecture/` — cross-cutting concepts

| File | Purpose |
|---|---|
| `design_philosophy.md` | Stack-agnostic principles: seeded determinism, pure stage functions, flat/axis-aligned geometry. |
| `glossary.md` | Terms used in `src/generators` (primitive, slab, wall, cell, tier, etc.) and function names. |
| `collision_matrix.md` | The shared 1" cell grid every stage reads/writes, cell types, and write history. |
| `debug_tooling.md` | `--preview`, `--preview-map`, `--visualize`, `--debug-connectivity`, `--debug-matrix`, `--debug` flags and what they emit. |
| `profiles.md` | Swappable config profiles (`--profile withering`) and the generator options they use. |
| `docs_and_config_guide.md` | This file. |

### `docs/processes/` — per-stage flow docs (the most reliable source for "how does stage X work")

| File | Purpose |
|---|---|
| `FORMAT.md` | Template and rules for writing flow docs. |
| `pipeline-flows/1-grid.md` … `11-scene-and-export.md` | One doc per stage: input contract, algorithm, output contract, edge cases. Order: grid, buildings, floors, roofs, streets, connectivity, ladders, walls, cover, geometry, scene-and-export. |
| `pipeline-flows/archive/` | Superseded flow docs from the old 8-stage pipeline. Ignore unless doing history. |

### `docs/` top level — older specs

| File | Purpose | Trust level |
|---|---|---|
| `GENERATION_PIPELINE.md` | Stage order and links to the flow docs. | Current (rewritten 2026-10-10). |
| `IMPLEMENTATION_PHASES.md` | Original phased build plan. | Historical. |
| `FOLDER_STRUCTURE.md` | Actual folder layout. | Current (rewritten 2026-10-10). |
| `BUILDING_REFERENCE.md` | Live building size classes, placement chances, where to change them. | Current (rewritten 2026-10-10). |
| `AGENTS_AND_HOOKS.md` | Early plan for agents and hooks. | Historical; real agents are in `.claude/agents/`, hooks in `.claude/hooks/`. |
| `issues.md` | Known open bugs (currently: ground ladder inside diagonal building). | Current. |

### `docs/plans/`

- Active plans go directly in `docs/plans/`. Currently none.
- `docs/plans/archive/` holds completed plans, named `NAME_PLAN_YYYY_MM_DD.md`. Useful for the reasoning behind past design decisions (the retired vertex limits, connectivity, rivers, ladders, pillars).

### Other

- `docs/reports/CODE_AUDIT.md` — code audit from 2026-03-28; pre-refactor, mostly outdated.
- `docs/archive/OLD_FLOOR_WALL_RULES.md` — pre-quadrant floor/wall rules, kept for reference.

---

## Part 2 — `src/config.js`

All tuneable values live here (project rule: no magic numbers in logic). Each section is a named export. Units are inches unless stated; "cells" are 1" collision-matrix cells.

| Export | What it controls |
|---|---|
| `GLOBAL_GRID` | Base grid: `bbd` (base building dimension, 4"), `cellSize` (matrix cell, 1"), `streetWidth` (4", tied to BBD for alignment — do not change independently). |
| `DEFAULTS` | Default CLI values: seed (random if unset), map size (48x48), tier count (4), tier height (3"), slab thickness (1"), `damageLevel` (0–1 ruin level), connection filter strategy and `filterN`, texture set, ladder style, and output flags (`preview`, `previewMap`, `visualize`, `debug`, `allRivers`, `outputDir`). |
| `PREVIEW` | Unified preview server (`--preview` with alias `--visualize`, and `--preview-map`): port (3010), mode names, tab list (tabs are Loaded map and Visualizer; `needs` run decides the greyed-out Visualizer; modes `run`/`preview-map`), initial tab per mode, localStorage key, 404 messages. |
| `LOADED_MAP` | Loaded map tab / `--preview-map` fixture handling: port (3010), allowed texture sets, accepted fixture formats, legacy pitch/slab for `/1` fixtures, upload size cap, fallback highlight colour. |
| `WALL` | Wall thickness, toggles for segment cull / windows / blob damage / door cuts, damage column size (`quadSize`), per-row (base/mid/top) removal ratios for exterior and interior walls, interior wall chance by building size, blob damage size range. |
| `FLOOR_SLAB` | Rendered floor/roof slab thickness (flush with the top of the 1" slab cell) and the tier banding lookahead used by `tierOf`. Vertical level maths built on it lives in `src/core/levels.js`. |
| `FLOOR` | Floor-plate damage: max consecutive intact floors and escalation chances for removing the 1st/2nd/3rd quadrant per tier. |
| `CONNECTIVITY` | Bridges and walkways: `maxLengthMapFraction` (longest connection as a fraction of the map's longer side; 0.5 = half), length thresholds for bridge/pillar eligibility, pillar spacing/width, bridge variant percentages (short vs long, must sum to 100), river-crossing spacing and max length, bridge slab/wall thickness and battlement spacing/height. |
| `STREETS` | River depth (cells below Y=0) and `riverWeights` — the none/one/two/all river-mode probabilities (must sum to 1). |
| `BUILDINGS` | Treemap building placement chances: large (40%), medium (50%, with attempts per block set by `mediumCellDivisor`), ruins horizontal/vertical choice, and spawn-pattern choice. Also `mode` (`fill`/`single`), `singleSizes` and `emptyBlocks` (see `profiles.md`). |
| `COVER` | Per-group chance (interior / roof / street) that a group receives cover; 1 = always. The cover piece sizes and counts themselves are still hard-coded in `generators/cover/index.js`. |
| `GRID` | BSP grid: minimum block size (8" = 2 × BBD) and `strategy` (`random`, `centerFirst`, `bspTopLeft`). |
| `GEOMETRY` | Export geometry: GLB texture tile size, `uvKeyOffset` (GLB texture offset per texture key; GLB UVs are world-space), ladder pole/rung dimensions, courtyard slab, platform and walkway/river/street/pavement thicknesses, perimeter parapet height/thickness/inset, `mergeMeshes` (`enabled`, `byTier`: GLB scene mesh merge, one mesh per material and tier, default on; off gives one mesh per primitive), and `primitiveMerge` (`enabled` switch, off by default after the greedy rect cover, `types` merge groups `wall`/`pavement`/`floor`, `epsilon` touch tolerance) for the geometry merge pass. |
| `LADDER_DISPLAY` | Which ladder representations render (box vs mesh) and the mesh pole/rung radii and spacing. |
| `LADDERS` | Ladder placement rules: clearance from map edge, connections and other buildings, spacing between ladders, max per side, chance of trimming a full-height ladder, ladder strip thickness, extra-path spacing, ruins-small ladder chance, and `pathQuota` (max ladder paths per building size). |
| `parseArgs(argv)` | CLI parser. Starts from `DEFAULTS`, handles the boolean flags (`--preview`, `--visualize`, `--debug`, `--debug-connectivity`, `--debug-matrix`, `--all-rivers`, `--3d-ladders`, `--flat-ladders`), `--profile NAME` (applies that profile's defaults first), `--size WxD`, `--textures NAME` (alias of `--texture-set`), and any `--key value` whose camelCased name exists in `DEFAULTS`. Unknown flags are silently ignored. |

### Known config issues

- **`DEFAULTS.seed`** is derived from `Date.now()` when `--seed` is omitted (no `Math.random()` anywhere). It is evaluated at import time.
- **`flatLadders`** lives only in `DEFAULTS`; exporters fall back to `DEFAULTS.flatLadders`.
- **`src/tools/*`** (building/bridge preview scripts) still import the removed `BUILDING` config section and will not run.
- **Tests:** the suite passes with no expected failures. The 25k vertex cap and the OBJ exporter tests were removed with the OBJ export; snapshot tests lock object counts and a collision-matrix hash for seeds 42 and 100.
