# Thin Floor Slabs Plan — 2026-10-11

Status: **Complete, archived 2026-10-16.** Implemented on `feature/thin-floor-slabs` and shipped in v0.3.0 (dev PR #39). Outcome: a tier now costs `tierHeight` (3") of pitch instead of 4", and floor slabs are 0.25" thick and sit flush with the tier surface; a 4-tier map is 12" tall instead of 16". Decisions as implemented: 2.75" headroom, thin ground slab, thin roofs. Tests live in `tests/`, not `test/`. File list and line-level hits: [`THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md`](THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md) (sections A–L, each with its regenerating grep). Section letters are referenced below as **[M-A]** etc.

## Problem

A new tier costs **4"** of height today: `levelHeight = tierHeight (3) + slabThickness (1)`. The floor reserves a whole 1" matrix cell, but walls and streets are only 0.25" thick. With 4 tiers the map is 16" tall for 12" of usable room.

## Proposal

Define each tier's floor as the **very top of the tier below**, and make that slab the same thickness as a wall (`WALL.wallThickness`, 0.25").

| | Now | Proposed |
|---|---|---|
| Tier pitch (`levelHeight`) | `tierHeight + slabThickness` = 4" | `tierHeight` = 3" |
| Walking surface of tier `i` | `i*4` | `i*3` |
| Floor slab geometry | 1" thick, `y = i*4 - 1` | 0.25" thick, `y = i*3 - 0.25` (flush top at `i*3`) |
| Matrix floor cell | `cy = i*4 - 1` | `cy = i*3 - 1` (same 1" cell, top row of the storey below; geometry only fills its top 0.25") |
| Wall run per tier | 3" (3 matrix rows) | `tierHeight - floorThickness` = 2.75" geometry, `tierHeight - 1` = 2 matrix rows |
| Map height, 4 tiers | 16" | 12" |

`tierHeight` changes meaning from "room height" to "floor-surface to floor-surface pitch"; clear headroom becomes `tierHeight - floorThickness`.

### Why this shape

- **Matrix stays on its 1" grid.** `cellSize` is a global 1" (`GLOBAL_GRID`); a 0.25" slab cannot be its own cell. The slab keeps the top matrix row of the storey below and renders thin inside it. Streets/pavements/rivers already work this way (`streetThickness: 0.25` inside the `-slabThickness` cell) — this is the same pattern applied to floors.
- **3" pitch matches the OBJ 3" segment subdivision / 4-segments-per-atlas-tile layout**, so tier faces land on segment boundaries instead of drifting (4" pitch does not).
- Rejected: fractional pitch (3.25"). Breaks cell indexing (`cy = floor(y/cellSize)`), ladder tier maths, and tier banding.

## Open decisions (need the user before Phase 2)

1. **Headroom 3" → 2.75"** (and 2 matrix rows of wall, down from 3). Accept, or keep 3" clear by setting default `tierHeight: 3.25`-style pitch? Recommended: accept 2.75" (`tierHeight` stays 3).
2. **Ground slab (tier 0, `cy = -1`)**: thin it too (recommended, consistent with streets) or leave 1".
3. **Roof slabs** use the same `yCollisionLevel`/`slabThickness` path as floors. Recommended: thin them too (single code path); roof top then sits 0.25" below the tier-top plane, i.e. flush with where the next floor would be.

## Phases

### Phase 0 — baseline
- Record vertex counts and `npm test` result for seeds 1, 7, 42, 100, 2024 (default + `--profile withering`) before touching code. Seed 100 already fails the 25k cap — note it as a pre-existing failure so it isn't blamed on this change.

### Phase 1 — one source of truth for level maths
Today `tierHeight + slabThickness` is re-derived inline in 8+ places **[M-B]**, violating the shared-helper rule. Add `src/core/levels.js` (named exports):
- `levelHeight(config)` → `config.tierHeight`
- `floorThickness(config)` → `WALL.wallThickness` (new config key `FLOOR_SLAB.thickness`, defaulting to it)
- `floorCellY(i, config)` → `i*levelHeight - 1` (matrix cell, was `i*L - slab`)
- `floorSurfaceY(i, config)` → `i*levelHeight`
- `floorGeomY(i, config)` → `floorSurfaceY - floorThickness`
- `floorIndexFromCy(cy, config)` → inverse used by ladders/cover/tier banding
- `wallMatrixRows(config)` = `tierHeight - 1`, `wallGeomHeight(config)` = `tierHeight - floorThickness`

Behaviour-preserving refactor first: with `floorThickness = 1` the helper reproduces today's numbers exactly, so Phase 1 ships with identical output (verify by diffing OBJ for the Phase 0 seeds). Replace each inline site in **[M-B]**, **[M-G]**.

### Phase 2 — flip the geometry
Files (see manifest sections in brackets):
- `src/config.js` **[M-A]** — add `FLOOR_SLAB.thickness`; document new `tierHeight` meaning; keep `slabThickness` only for matrix cell reservation/ground layers, or rename to `slabCellHeight` (decide with Phase 1 review).
- `src/generators/floors/process-building-floors.js` **[M-C]** — `yCollisionLevel` via `floorCellY`; also emit `surfaceY`/`geomY` so consumers stop re-deriving.
- `src/generators/floors/index.js`, `src/generators/roofs/index.js` **[M-E]** — matrix fill unchanged in shape (1 cell at `yCollisionLevel`).
- `src/generators/buildings/generateBuildings.js` **[M-B/E]** — shell height `maxTier*levelHeight - tierHeight` → recompute with new pitch (shell must stop below the top roof slab cell).
- `src/generators/geometry/build-floor-primitives.js`, `build-roof-primitives.js` **[M-D]** — render `y = geomY`, `h = floorThickness` for slab, ceiling and edges primitives. Slab `edges` primitive height must follow or side faces will be 1" tall.
- `src/generators/geometry/build-building-footprint-primitives.js` **[M-D]** — uses `slabThickness ?? 0.2`; align with ground-slab decision.
- `src/generators/walls/extract-wall-segments.js` **[M-F]** — `wallWorldY = floorSurfaceY`; matrix `fillBox` height `wallMatrixRows`; the "slab above?" probe `cy + levelHeight` must target the next floor *cell* (`cy + levelHeight`) — verify it still lands on the floor cell, not a wall row; wall record `h` becomes `wallGeomHeight`.
- `src/generators/walls/subdivide-wall.js` **[M-F]** — `rows = round(wall.h)` assumes integer height; 2.75 needs rows `[1, 1, 0.75]` (last row short). Check window/door/blob-damage code that indexes rows (`quadSize`, `applyDoorCuts`) for the 3-row assumption.
- `src/generators/ladders/generate-ladders.js` **[M-G]** — `floorIndex`, `slabY`, `tierH` (lines ~90–96, 155, 217–219, 248–272, 480–544): rewrite via helpers; rung top/bottom must meet new surface heights.
- `src/generators/cover/index.js` **[M-G]** — tier-from-cy at ~51; cover sitting on floors uses surface Y.
- `src/generators/connectivity/*` (`emit-anchors.js:75,143`, `generate-pillars.js:19–98`, `emit-river-crossing-anchors.js:43`) **[M-C/H]** — anchors key off `yCollisionLevel` (unchanged cell), but pillar bottom `scanY + slabThickness` and walkway top-flush assumptions need the thin-slab surface offset.
- `src/generators/streets/write-*.js`, `src/pipeline.js` **[M-E]** — ground-layer placeholders; only change if Open decision 2 thins tier 0.
- `src/generators/collision/matrix.js` **[M-H]** — `maxY = (maxTiers+1)*(tierHeight+slabThickness)` → use `levelHeight` (matrix gets smaller; safe).

### Phase 3 — exporters (OBJ/GLB parity)
- `src/export/assign-primitive-tier.js`, `src/export/export-tiers.js` **[M-I]** — tier banding `floor((baseY + slab)/levelHeight)`: re-derive with `floorIndexFromCy`; split-tier manifest fields `levelHeight`/`slabThickness` change meaning — bump manifest `version` and add `floorThickness`.
- `src/export/obj-geometry/build-obj-and-atlas.js:217` **[M-I]** — `prim.h || config.slabThickness` fallback → `floorThickness`.
- OBJ UV/atlas: 0.25" slab edges are thinner than a 3" segment; confirm edge UVs still map into one atlas tile and `shared`/`simpleBottom` flags are right. Update **both** OBJ and GLB paths (CLAUDE.md parity rule).
- Collision OBJ: slab-only allowlist must still emit the 0.25" slabs; walkable surface is `floorSurfaceY`, not cell top (they coincide, but verify no collider gap under the slab).
- `src/preview/debug-recorder.js` **[M-D]** (lines ~198–239, 324) — debug boxes use `slabThickness` and `levelHeight`; update so `--debug` matches.

### Phase 4 — tests and docs
- `test/floors.test.js`, `test/walls.test.js` **[M-J]** — fixtures use `tierHeight: 6, slabThickness: 0.5` (already inconsistent with defaults). Rebase on the helpers; add `test/levels.test.js` covering round-trips `floorIndexFromCy(floorCellY(i)) === i`, surfaces monotonic, wall geom top == next slab underside.
- New test: for default config, no tier's wall top overlaps its ceiling slab and no gap > 0 between them.
- Docs **[M-K]**: `docs/architecture/collision_matrix.md:127` (slabY formula), `docs/architecture/glossary.md` (tierHeight/slabThickness/tier definitions), `docs/processes/pipeline-flows/1-grid.md`, `2-buildings.md`, `3-floors.md`, `4-roofs.md`, `7-ladders.md`, `8-walls.md`, `11-scene-and-export.md` (banding paragraph, manifest schema), `docs/architecture/profiles.md` if profiles override `tierHeight`. Update `docs/issues.md` if anything is deferred.

## Verification gates

- `npm test` green (seed 100 vertex overflow remains a known, separately tracked failure unless it improves).
- Seeds 1, 7, 42, 100, 2024 × default and `--profile withering`: generate, confirm **vertex count < 25,000 per OBJ** (hook `check-vertex-count.mjs`) and report before/after counts. Expect a reduction (thinner slab sides, fewer wall-row quads).
- Reachability check passes on all seeds (ladder endpoints meet new surfaces); sightline limit unaffected (heights only shrink, but re-check the 24" rule on one seed).
- GLB vs OBJ visually/numerically agree on slab Y and thickness; open both for one seed, plus `--split-tiers` and `--debug`.
- Map total height for default 4 tiers = 12" (plus parapet), asserted in a test.

## Risks

- **Door/window rows**: 2 wall rows instead of 3 — doorways may become the full wall height. Mitigation: decide door height rule in Phase 2 (e.g. 2 rows = full-height door, or keep a 0.75" lintel row from geometry only).
- **Ladder ranges** are computed from tier/slab maths in several local copies; the likeliest source of off-by-one regressions. Phase 1 helper replaces all of them.
- **Saved seeds change shape**: map height shrinks from 16" to 12" for the same `--tiers`, so any previously printed/shared map differs. Note in the changelog.
- **Profile `withering`** and `src/tools/*` (already broken by the removed `BUILDING` section) may pin `tierHeight`/`slabThickness` **[M-A]**; check before merging.

## Branch / delivery

Feature branch off `dev` (`feature/thin-floor-slabs`), one PR per phase (1 is behaviour-preserving, ships alone), merged via `pr-shipper`. Never commit to master.
