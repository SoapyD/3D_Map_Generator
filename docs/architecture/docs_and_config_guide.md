# Docs & Config Guide

What each documentation file is for, and what each section of `src/config.js` controls. Read this to decide which doc to open, or where a tunable value lives.

**Last verified:** 2026-10-10 (known-issues list updated after cleanup)

---

## Part 1 — Documentation map

### Entry points

| File | Purpose | Trust level |
|---|---|---|
| `CLAUDE.md` (repo root) | Project rules, conventions, pipeline summary, agent list. Loaded automatically every session. | Current. Reference list updated 2026-10-10. |
| `README.md` | CLI flags, examples, TTS import steps, texture packs. | Current. |
| `docs/PROJECT_OVERVIEW.md` | Problem statement and design goals (flat surfaces, verticality, sightlines). | Stable. |

### `docs/architecture/` — cross-cutting concepts

| File | Purpose |
|---|---|
| `design_philosophy.md` | Stack-agnostic principles: seeded determinism, pure stage functions, flat/axis-aligned geometry. |
| `glossary.md` | Terms used in `src/generators` (primitive, slab, wall, cell, tier, etc.) and function names. |
| `collision_matrix.md` | The shared 1" cell grid every stage reads/writes, cell types, and write history. |
| `debug_tooling.md` | `--preview`, `--visualize`, `--debug-connectivity`, `--debug-matrix`, `--debug` flags and what they emit. |
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
- `docs/plans/archive/` holds completed plans, named `NAME_PLAN_YYYY_MM_DD.md`. Useful for the reasoning behind past design decisions (vertex limits, connectivity, rivers, ladders, pillars).

### Other

- `docs/reports/CODE_AUDIT.md` — code audit from 2026-03-28; pre-refactor, mostly outdated.
- `docs/archive/OLD_FLOOR_WALL_RULES.md` — pre-quadrant floor/wall rules, kept for reference.

---

## Part 2 — `src/config.js`

All tuneable values live here (project rule: no magic numbers in logic). Each section is a named export. Units are inches unless stated; "cells" are 1" collision-matrix cells.

| Export | What it controls |
|---|---|
| `GLOBAL_GRID` | Base grid: `bbd` (base building dimension, 4"), `cellSize` (matrix cell, 1"), `streetWidth` (4", tied to BBD for alignment — do not change independently). |
| `DEFAULTS` | Default CLI values: seed (random if unset), map size (48x48), tier count (4), tier height (3"), slab thickness (1"), `damageLevel` (0–1 ruin level), connection filter strategy and `filterN`, texture set, ladder style, and output flags (`preview`, `visualize`, `debug`, `obj`, `splitTiers`, `allRivers`, `outputDir`). |
| `WALL` | Wall thickness, toggles for segment cull / windows / blob damage / door cuts, damage column size (`quadSize`), per-row (base/mid/top) removal ratios for exterior and interior walls, interior wall chance by building size, blob damage size range. |
| `FLOOR` | Floor-plate damage: max consecutive intact floors and escalation chances for removing the 1st/2nd/3rd quadrant per tier. |
| `CONNECTIVITY` | Bridges and walkways: length thresholds for bridge/pillar eligibility, pillar spacing/width, bridge variant percentages (short vs long, must sum to 100), river-crossing spacing and max length, bridge slab/wall thickness and battlement spacing/height. |
| `STREETS` | River depth (cells below Y=0) and `riverWeights` — the none/one/two/all river-mode probabilities (must sum to 1). |
| `GRID` | BSP grid: minimum block size (8" = 2 × BBD). |
| `GEOMETRY` | Export geometry: GLB texture tile size, OBJ atlas tile/segment/padding pixel sizes, UV hash constants (per-object tiling offset, shared by GLB and OBJ), OBJ ladder pole/rung dimensions, courtyard slab, platform and walkway/river/street/pavement thicknesses, perimeter parapet height/thickness/inset. |
| `LADDER_DISPLAY` | Which ladder representations render (box vs mesh) and the mesh pole/rung radii and spacing. |
| `LADDERS` | Ladder placement rules: clearance from map edge, connections and other buildings, spacing between ladders, max per side, chance of trimming a full-height ladder. |
| `parseArgs(argv)` | CLI parser. Starts from `DEFAULTS`, handles the boolean flags (`--preview`, `--visualize`, `--debug`, `--debug-connectivity`, `--debug-matrix`, `--obj`, `--split-tiers`, `--all-rivers`, `--3d-ladders`, `--flat-ladders`), `--size WxD`, and any `--key value` whose camelCased name exists in `DEFAULTS`. Unknown flags are silently ignored. |

### Known config issues

- **`DEFAULTS.seed`** is derived from `Date.now()` when `--seed` is omitted (no `Math.random()` anywhere). It is evaluated at import time.
- **`flatLadders`** lives only in `DEFAULTS`; exporters fall back to `DEFAULTS.flatLadders`.
- **Building placement chances** (40% large, 50% medium, etc.) are still hard-coded in `src/generators/buildings/treemap-buildings.js`, not in `config.js`.
- **`src/tools/*`** (building/bridge preview scripts) still import the removed `BUILDING` config section and will not run.
- **Tests:** 12 of 16 test files fail because they import modules that no longer exist (e.g. `src/generators/grid.js`, `src/core/geometry.js`), and `tests/core/config.test.js` asserts on removed `BUILDING`/`COVER`/`DELETIONS` sections.
