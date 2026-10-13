# Conventions Alignment Plan — 2026-10-13

**Status (2026-10-13): Phases 1 and 2 implemented, uncommitted on `feature/primitive-merge`. Phase 3 still BLOCKED (a live consumer exists, see Phase 3). Phase 4 text not started (on hold).** Results are in "Phase 1 and 2 results" below; the manifest sections B, C, D, F, N were updated for the new code. Companion: [`CONVENTIONS_ALIGNMENT_MANIFEST_2026_10_13.md`](CONVENTIONS_ALIGNMENT_MANIFEST_2026_10_13.md) (file:line refs and regenerating greps). This plan supersedes Track 2 (Phase B) of [`PRIMITIVE_MERGE_PLAN_2026_10_13.md`](PRIMITIVE_MERGE_PLAN_2026_10_13.md).

## Summary

The generator's consumer is now the Withering game (`D:\programming\Node\Game_Template`, read-only). It loads a frozen `withering-map/2` fixture and draws boxes with three.js. TTS is no longer the target. Keep the seeded generator, wall and floor cell damage, and the collision matrix. Retire the 25,000-vertex rule, the shared texture atlas, the 3" OBJ subdivision and the TTS-only export paths (after the Phase 3 gate). Align the code with standard conventions: one shared rect helper, no duplicated overlap code, world-space UVs, and docs that match the code.

## Corrections to the brief (verified 2026-10-13)

- **Floors are not a cell grid.** Floor damage is a 2×2 quadrant mask per building (`process-building-floors.js:47-55`, `quadrants-to-sections.js:1-38`). Walls are 1" cells (`subdivide-wall.js:15-16`). Pavements are a 1" grid, written per cell (`write-pavements.js:22`) and turned into rects by `cellsToRects` (`:33-58`). A helper that takes any boolean grid fits all three, but floors gain little (Phase 1c).
- **A live consumer of the TTS exports exists.** `wyrdwars_manager` imports every TTS entry point (Phase 3). The brief's "nothing else consumes them" does not hold.
- **The Withering client does not use textures or UVs.** It draws every primitive as a flat-coloured box (`games/withering/client/src/scene/build-map-group.ts:23`, `colour-for.ts:4-5`). Phase 2 therefore changes only the generator's own GLB and loaded-map preview.
- **Vertical wall stacking is superseded.** The merge plan's "next lever" is replaced by a 2-D cover at the source (Phase 1a).

## Findings that shape the phases

1. **Walls merge per row only.** `mergeWallCells` joins alive cells in the same row (`merge-wall-cells.js:11-14`, `:31-43`). An undamaged wall becomes one box per 1" row. Seed 7 has 590 wall primitives (earlier session, not re-measured here).
2. **A full floor plate is 2 rects.** With all four quadrants present, `quadrantsToSections` pairs (0,1) and (2,3) and returns 2 rects (`quadrants-to-sections.js:16-23`). `ruinsToSections` always returns two halves (`ruins-small-to-sections.js:1-11`).
3. **Duplicated logic.** `mergeWallCells` (`merge-wall-cells.js:7`) and `cellsToRects` (`write-pavements.js:33`) are the same row-run algorithm. `rectsOverlap` is defined twice (`src/core/rects-overlap.js:5`, `src/generators/utils/rects/index.js:9`). CLAUDE.md requires shared helpers for overlap checks.
4. **Floor edges and roofs depend on the partition.** `getEdgeGaps` looks at neighbouring rects (`build-floor-primitives.js:27`, `geometry-helpers/getEdgeGaps.js:5`). Roofs reuse the top level's rects (`roofs/index.js:18`, `:28`). Anchors use only the covered cell set (`emit-anchors.js:70-76`), so a pure re-partition leaves them unchanged.
5. **`--obj` is a no-op.** `config.js:314-317` sets `config.obj`, nothing reads it, and `src/index.js:94-95` always writes the OBJ and collision files.
6. **The Withering tier cut-away reads each mesh's `y0`** (`build-map-group.ts:27`, `primitive-box.ts:10`). A vertical merge across tiers would break it.
7. **A doc overstates the code.** `docs/processes/pipeline-flows/8-walls.md:7` says walls merge "into the fewest rectangles". They merge per row only today.
9. **Tests pin counts that these changes move.** `tests/generators/walls.test.js:117` (485 walls), and `tests/snapshot.test.js:78, 82, 103, 107`.

## Phase 1 and 2 results (2026-10-13)

Owner decisions applied: greedy cover accepted; one texture offset per texture key (config); windows and doors unchanged; full floor plate and ruins-small become one rect (matrix hash identical); primitive merge pass kept only if it still removes at least 2%.

**Code.** New `src/core/grid-rect-cover/` (`coverGridWithRects(cols, rows, alive)` returns index spans `{col,row,cols,rows}`; callers map to inches, which keeps each caller's exact arithmetic and the 0.75" top wall row). Used by `mergeWallCells`, `cellsToRects` (pavements) and `quadrantsToSections` (floors). `ruins-small-to-sections.js` is deleted (ruins-small takes the one-rect ruins path). GLB: `createSlab` writes world-space UVs (`src/core/box-face-world-uv.js`) with one offset per texture key (`GEOMETRY.uvKeyOffset`, `src/generators/scene/texture-key-uv-offset.js`); `uv-origin-center.js` is deleted. `GEOMETRY.primitiveMerge.enabled` is now false.

**Phase 1 gates** (baseline = HEAD 83decf8 run from a clean export; seeds 1, 7, 42, 100, 2024, each default and `withering`, 10 runs):
- G1.1 collision-matrix cells SHA-256: identical in all 10.
- G1.2 RNG call trace (method plus argument shape, hashed): identical in all 10.
- G1.3 buildings, connectivity, ladders, cover and streets, with the wall, pavement, floor and roof rect lists excluded (they change by design): identical in all 10. Floors and roofs differ only in their rect lists (1c).
- G1.4 summed wall volume per texture key, pavement area and floor area: equal to within 3e-4 (rounding in the check script).
- G1.6 tests: new `tests/core/grid-rect-cover.test.js`; counts updated in `walls.test.js`, `snapshot.test.js`, `obj-exporter.test.js`, `merge-primitives.test.js`.
- G1.7 `npm test` 293/293; `npm run check:all` 37 findings (baseline 37); `npm run check:file-sizes` no new entries.

| Seed (profile) | Primitives before -> after | Walls | Pavements | Floors | Roofs |
|---|---|---|---|---|---|
| 1 default | 1170 -> 798 | 537 -> 275 | 80 -> 69 | 159 -> 120 | 165 -> 105 |
| 7 default | 1205 -> 852 | 590 -> 317 | 70 -> 62 | 165 -> 126 | 138 -> 105 |
| 42 default | 1079 -> 802 | 485 -> 276 | 69 -> 57 | 120 -> 94 | 114 -> 84 |
| 100 default | 1127 -> 810 | 587 -> 327 | 66 -> 60 | 132 -> 108 | 111 -> 84 |
| 2024 default | 1127 -> 836 | 519 -> 286 | 64 -> 60 | 135 -> 108 | 129 -> 102 |
| 1 withering | 356 -> 269 | 134 -> 73 | 40 -> 40 | 49 -> 38 | 54 -> 39 |
| 7 withering | 393 -> 283 | 176 -> 98 | 36 -> 36 | 54 -> 40 | 51 -> 33 |
| 42 withering | 479 -> 359 | 191 -> 99 | 36 -> 36 | 68 -> 52 | 48 -> 36 |
| 100 withering | 325 -> 226 | 130 -> 62 | 36 -> 36 | 49 -> 36 | 48 -> 30 |
| 2024 withering | 408 -> 304 | 183 -> 106 | 36 -> 36 | 59 -> 44 | 48 -> 36 |

"Before" had the merge pass on (unmerged baseline default: 1403 / 1432 / 1284 / 1355 / 1352). OBJ vertices (informational): seed 7 22,604 -> 15,666; seed 42 20,196 -> 14,926; seed 100 21,638 -> 15,228. GLB nodes: seed 7 981 -> 678, seed 100 930 -> 646; world bounds unchanged ([-1,-5,-1] to [49,11,49]).

**Merge pass decision.** With the pass enabled vs disabled on the new code, primitive counts are equal on all 10 runs (0.00% removed; threshold 2%), so `GEOMETRY.primitiveMerge.enabled = false`. The code and its tests remain (the tests enable it explicitly). `build-merged-prim.js` keeps `uvOrigin` because the OBJ exporter still reads it.

**Phase 2 gates.** G2.1 world bounds unchanged and `createSlab` positions and sizes untouched, only the UV attribute differs. G2.2 `tests/core/world-uv.test.js`: shared edges of adjacent wall boxes and floor slabs have equal UVs; a half box matches the whole box. G2.4 `npm test` passes. Determinism: seeds 7 and 100 generated twice give identical GLB and OBJ md5. Preview: `--seed 7 --preview --textures loaded` served `/tabs.json`, `/loaded-model.glb` (1.8 MB) and `/texture-report.json` (`ok: true`).

**Not visually verified.** G1.8 and G2.3: wall appearance now that stacked walls have unsquashed textures, seam continuity, tiling regularity, floor-plate edge strips on merged plates. To look: `node src/index.js --seed 7 --preview --textures loaded`, then `--seed 100`.

**Deviations and plan corrections.**
- The helper takes and returns cell indices, not inches; callers keep their own exact arithmetic.
- Partial floor plates also change partition (for example quadrants {0,2,3} become a left half plus quadrant 3), not only the full plate and ruins-small; covered union and matrix are identical.
- Phase 2 could not remove `uvOrigin` from `build-merged-prim.js` while the OBJ exporter reads it, so only the GLB use was removed. The `uvOrigin` assertions in `merge-primitives.test.js` stay valid.
- `GEOMETRY.uvHashU/V` stay (OBJ only); the new GLB key is `GEOMETRY.uvKeyOffset`.
- Finding 3's second `rectsOverlap` (0.01 tolerance) is untouched: its semantics differ from `src/core/rects-overlap.js`, so unifying it is a behaviour change outside Phase 1.

## Phase 1 — Shared greedy rectangle cover (gate: matrix parity)

Goal: one pure helper turns any boolean grid (walls, pavements, the floor quadrant mask) into non-overlapping axis-aligned rects. It replaces the row-only merge and the duplicate `cellsToRects`.

**Design**
- Location: `src/core/grid-rect-cover/`. One export per file (`scripts/checks/check-single-export.js:103`). Entry point `coverGridWithRects(grid)`.
- Input: `alive(c, r)`, column x-offsets and widths, and row y-offsets and heights, all in inches. The 0.75" top wall row must keep its real height (`subdivide-wall.js:20-24`).
- Output: `{ u0, v0, du, dv }` in inches. Callers map these to x/y/z, as `mergeWallCells` does today.
- Algorithm: row-major scan. From each unassigned alive cell, extend right, then extend down while the whole next segment is alive and unassigned. Deterministic. No RNG.
- The result is **greedy, not minimal**. A minimum rectangle partition is polynomial for hole-free shapes and NP-hard with holes. Window and blob-damage gaps are holes, so report the measured counts and do not claim minimality.
- Keep the output shape of `mergeWallCells` (`direction, floorY, x, y, z, w, h, d`).

**Applications**
- **1a. Walls.** Replace the body of `mergeWallCells` (`merge-wall-cells.js:7-50`). The caller is `walls/index.js:86`. Matrix writes stay per segment with the same clipping (`walls/index.js:89-95`). `walls.length` (`:87`) is the debug write index and changes.
- **1b. Pavements.** Replace `cellsToRects` (`write-pavements.js:29`, `:33-58`). Matrix writes are per cell (`:22`) and are unaffected.
- **1c. Floors.** Run the cover on the present-quadrant mask in `quadrantsToSections` (`quadrants-to-sections.js:1`). This changes only the full plate and ruins-small (2 rects to 1). It needs approval (Open decision 4). `ruinsToSections` stays as is unless approved.
- **1d. Not touched.** `extract-wall-segments.js:95` (1-D runs of edge cells).

**Primitive merge pass (Track 1 of the merge plan), after 1a–1c**
- Re-measure merges per group. Keep the pass only if it still removes at least 2% of primitives. Otherwise delete `src/generators/geometry/merge-primitives.js` and `merge/`, keeping the `uvOrigin` plumbing until Phase 2.
- The floor merge key uses texture-group keys (`floor-texture-key.js:8-9`, `geometry-helpers/getTexGroup.js`), so joins can cross buildings.

**Gates**
- **G1.1 Matrix parity (must be identical).** SHA-256 of `Uint8Array.from(matrix.toDebugJSON().cells)` before and after, for seeds 1, 7, 42, 100 and 2024, each with the default and `withering` profiles. Capture the baseline hashes before any code changes and keep them outside the repo. Debug-matrix history (`src/index.js:49-74`) will differ; that is allowed.
- **G1.2 RNG trace identical.** Wrap `rng` to hash every call (method and arguments) and compare before and after. This proves the call order is unchanged.
- **G1.3 Other stage outputs identical.** Ladders, connections, cover and anchors deep-equal before and after. Cover does not read the wall list (`cover/index.js:191-195`). Floor and roof changes are expected only under 1c.
- **G1.4 Area parity.** Summed footprint area per name family (walls, pavements, floors) is equal before and after.
- **G1.5 Windows and doors.** Window cells (`place-windows.js:42`) and door skips (`walls/index.js:91-95`) unchanged. Covered by G1.1.
- **G1.6 Tests.** New `tests/core/grid-rect-cover.test.js`: partition (no overlap, union equals alive cells), determinism, holes, and a 2.75" row. Update the counts listed in Findings 9.
- **G1.7** `npm test`, `npm run check:all` (37-finding baseline, not re-run in this plan), and `npm run check:file-sizes`.
- **G1.8 Visual.** Loaded-map preview (`node src/index.js --seed 7 --preview --textures loaded`), walls and floors, before and after.

**Risks**
- Greedy is not minimal. Report the actual reduction.
- Floor edges and roof rects change. Merged plates lose internal seam edges, which is intended, but it is still a visible change.
- Snapshot and inline counts change on every run. Update them deliberately.

## Phase 2 — World-space UVs in the GLB (gate: seams and visual check)

Goal: each face's UV = world position / `glbTileSize`, so adjacent boxes line up and merged boxes need no origin.

**Changes**
- `createSlab` (`src/core/geometry-misc.js:21-60`): replace the local BoxGeometry UV scaling (`:33-40`) and the per-object offset (`:44-49`) with UVs computed from world coordinates (box centre plus local vertex). Keep the per-face axis map and the `rotateUV` swap (`:31-32`).
- Remove `uvOrigin`: `geometry-misc.js:14, 21, 46-49`; `build-primitive-mesh.js:16, 27`; delete `src/generators/scene/uv-origin-center.js`; and `merge/build-merged-prim.js:7-8` if the merge pass survives.
- **Variation (Open decision 2).** Recommended: one offset per texture key, not per primitive. All faces of one building or texture group then share an offset and seams stay aligned. `GEOMETRY.uvHashU/V` (`config.js:212-213`) move to a per-key hash. `glbTileSize` (`:207`) stays.
- The OBJ side is untouched in this phase (`add-shared-flat.js:24-26`, `add-shared-wall.js:28-29`). It is removed in Phase 3.

**Tests:** `tests/core/geometry.test.js:10-45` (UV scale and rotate) and `:168-173` (no-UV branch). Add a seam test: shared edge UVs equal across two adjacent boxes. Update or delete `tests/generators/merge-primitives.test.js:95-107, 176-181` (uvOrigin assertions).

**Gates**
- **G2.1** GLB primitive count and world bounds unchanged. Only the UV attribute differs.
- **G2.2** Seams continuous along merged walls and floor plates.
- **G2.3** Loaded-map preview visual check, seeds 7 and 100, walls and floors.
- **G2.4** `npm test`.
- The Withering fixture is unchanged (colour-only consumer).

**Risks:** a single global offset gives visibly regular tiling. The per-key hash is the compromise.

## Phase 3 — Retire TTS-only paths (NOT STARTED; BLOCKED)

**Gate result: the owner's condition is not met.** `D:\programming\Node\wyrdwars_manager` depends on the generator as a git dependency (`api/package.json:22`, pinned to codeload commit `d366710…` in `pnpm-lock.yaml:438`). It imports:
- `generateObjToBuffers` (`lib/src/core/maps/generateMapObjAssets.ts:2, 11`), exposed by `getMapObj.ts:17` and `getMapTexture.ts:17`.
- `generateTiersToBuffers` (`generateMapTiers.ts:2, 32`), exposed by `getMapTiersManifest.ts:18`, `getMapTierObj.ts:21` and `getMapTierCollider.ts:22`.
- `generateColliderToBuffer` (`generateMapCollider.ts:2, 11`), exposed by `getMapCollider.ts:17`.

Phase 3 can start only after the owner chooses (a) migrating wyrdwars to the GLB and collision-matrix path, or (b) keeping a pinned old generator version for it. Whether these controllers are routed was not checked.

**Removal footprint**

| Removal | Touches (verified 2026-10-13) |
|---|---|
| OBJ + atlas export (24 files in `src/export/obj-geometry/`) | `src/index.js:15-16, 94, 100`; `src/tools/preview-building-export.js:12, 92`; `src/generate-obj-buffers.js`; `src/lib.js:22`; `tests/export/obj-exporter.test.js` (whole file); `tests/snapshot.test.js:3, 31-35, 87-89, 112-114`; OBJ-only `pngjs` imports `build-atlas-image.js:1`, `build-obj-and-atlas.js:10`, `load-tex-pool.js:2` |
| 3" subdivision | `add-shared-flat.js:3-4`, `add-shared-wall.js:3`, `add-sub-box.js:6` (removed with OBJ). Docs: CLAUDE.md:27; THIN_FLOOR_SLABS_PLAN:27 (the 3" tier pitch rationale only; gameplay pitch stays) |
| Atlas config | `src/config.js:208-210` (`objAtlasTileSize`, `objSegmentPixelSize`, `objAtlasPadding`); `:212-213` only if an OBJ-side hash is kept |
| Per-tier split | `src/export/export-tiers.js` (whole file: bounds cage `:32`, corner colliders `:58`, corner posts `:99`, `buildTierBuffers` `:140`); `src/generate-tiers-buffers.js`; `src/lib.js:25`; `src/index.js:104-109`; `src/config.js:37, 319-322`; `tests/export/export-tiers.test.js` |
| Collision OBJ | `src/export/collision-buffer.js`, `src/export/collision-exporter.js`, `src/generate-collider-buffer.js`; `src/lib.js:23`; `src/index.js:17, 95, 101`; `tests/export/collision-exporter.test.js`; `tests/generators/merge-primitives.test.js:8, 58` (volume test rewritten on primitives) |
| Vertex hook | `.claude/hooks/check-vertex-count.mjs` (whole file); `.claude/settings.json:32`; `tests/export/obj-exporter.test.js:6, 33-34`; `tests/snapshot.test.js:52-56` |
| Library API | `package.json:7-9` (`exports` → `src/lib.js`); `src/lib.js:22-25` (`generateObjToBuffers`, `generateColliderToBuffer`, `generateTiersToBuffers`) |
| CLI flags | `--obj` (`config.js:314-317`, `DEFAULTS.obj` at `:36`); `--split-tiers` (`:319-322`, `DEFAULTS.splitTiers` at `:37`) |
| npm scripts | None reference OBJ or TTS (`package.json:11-21`). No change |
| Dependencies | `pngjs` **stays** (GLB texture pools: `buildTexturePools.js:7`, `generate-textures.js:7`) |
| Shared code | `tierOf` (`assign-primitive-tier.js:54`) stays while `tests/generators/merge-primitives.test.js:7` uses it |
| Agents | `vertex-optimiser.md` (whole agent is TTS-only); `_session-brief.md:29, 74`; `pr-shipper.md:32, 34`; `release-validator.md:32, 72`; `status-tracker.md:55, 64`; `test-builder.md:94` |

**Proposal: deprecate first, then delete**
- **3a (minor, e.g. v0.4.0).** Make `--obj` real: OBJ and collision are written only with `--obj`. This changes the default output. Mark `--split-tiers` and the three library exports `@deprecated` with a one-time warning. Keep the code.
- **3b (next minor or major, owner's choice).** Delete the code. The old behaviour is in tags `v0.3.0` and `v0.2.0`. The owner states the tags exist; this was not checked (no git access in this session).
- Order matters: wyrdwars must be migrated or pinned before 3b.

**Gates:** wyrdwars migrated or pinned; the test removals listed above; `npm test`; `npm run check:all`; no dangling imports (ripgrep for every removed module name).

## Phase 4 — Docs, CLAUDE.md and agents (text only)

- **4a. Now (no code).**
  - CLAUDE.md: the target statement (`:1`, `:5`), the Export Details block (`:24`, `:27`, `:30`), "no curves in OBJ export" (`:40`), the Testing rule (`:58-61`, the 25k line at `:60`).
  - `docs/PROJECT_OVERVIEW.md:1, 5, 11, 67, 76`; `docs/GENERATION_PIPELINE.md:31`.
  - `docs/processes/pipeline-flows/8-walls.md:7`: correct the "fewest rectangles" wording until Phase 1 lands.
  - Agents with the 25k rule (Phase 3 list above). The hook, if still present.
  - `docs/issues.md:3-4`: close the cap issue after Phase 1 (seed 7 and seed 100 cap entries).
  - `PRIMITIVE_MERGE_PLAN_2026_10_13.md` Track 2 (`:127-137`), open decision 5 (`:145`) and `:154`, `:172`: mark superseded by Phase 3.
- **4b. With Phase 3.**
  - `docs/processes/pipeline-flows/11-scene-and-export.md` (`:3, 33, 44-46, 56-63, 73-75, 77, 90-103, 131, 137-138`).
  - `docs/architecture/docs_and_config_guide.md:16, 29, 68, 79, 89`.
  - `README.md:3, 14-15, 107-124, 150, 179` (TTS import and transparency notes).
  - `docs/FOLDER_STRUCTURE.md:35`; `docs/AGENTS_AND_HOOKS.md:41`; `docs/architecture/design_philosophy.md:63`; `docs/IMPLEMENTATION_PHASES.md:82, 86-99` (historical banner, not a rewrite).
  - `10-geometry.md:85` (the merge-pass description, updated for whatever survives Phase 1).
  - Source comments: `src/config.js:37, 207-213`, `src/pipeline.js:9`, `src/lib.js:20-25`, `src/index.js:90`, `src/export/collision-buffer.js:2-8`, `src/export/export-tiers.js` header.
  - `package.json:4` (description: "for Mordheim / Tabletop Simulator").
- Agents: `project-manager.md` has no TTS references and needs no change.

## Verification

- **Matrix hash parity** (G1.1): cells SHA-256, seeds 1, 7, 42, 100, 2024, default and `withering`. Run it again after any change to walls, floors or pavements.
- **Seed determinism:** each seed run twice gives the same geometry JSON hash and the same RNG trace hash (G1.2).
- **`npm test`:** baseline 276/276 per the merge plan (not re-run here). Expect count-only changes in Phase 1.
- **`npm run check:all`:** 37 findings (owner's figure, not re-run here). The count must not rise. **`npm run check:file-sizes`:** no new violations.
- **GLB before and after:** `node src/index.js --seed 7 --preview --textures loaded` (the loaded-map tab is the initial tab, `config.js:70`, `:73`). Compare GLB mesh and primitive counts (`src/index.js:88`) and, for Phase 2, UV seams.
- **Counts per seed** (1, 7, 42, 100, 2024; default and `withering`): primitives, walls, floors, pavements, GLB mesh nodes. The OBJ vertex count is still reported while the OBJ exists, but the 25k cap is no longer a gate.
- **Baseline to capture first:** the merge plan's table (A0 + merge, not re-measured here): default seed 7 22,604 vertices, seed 100 21,638, seed 42 20,196; withering seed 7 6,889.

## Verified vs inferred

**Verified this session** (grep or read): every file:line in this plan and the manifest; the consumer list (`wyrdwars_manager`, `Game_Template`); the wall, floor and pavement algorithms; `--obj` never read; the vertex hook thresholds (23,000 warn, 25,000 error, `check-vertex-count.mjs:29, 31`); the pinned consumer commit.

**Inferred or not measured:** the greedy cover's count reduction; the full-plate floor saving; that the merge pass becomes redundant; that world-space tiling looks acceptable; the 590 seed-7 wall count (earlier session); `npm test` = 276; `check:all` = 37; the tags `v0.2.0` and `v0.3.0` exist; whether the wyrdwars controllers are routed. No `npm`, `git` or test commands were run for this document; the only tools used were read and search.

## Open decisions (need the owner)

1. **Phase 3 consumers.** Decided 2026-10-13: `wyrdwars_manager` stays on generator v0.2.0 (1" floors) and its docs now say so; the dependency pin itself is not yet enforced (specifier is unpinned, lockfile at `d366710`). Phase 3 is then unblocked for this repo once the owner confirms nothing else consumes the OBJ/tier/collider exports.
2. **Texture variation.** Keep random variation? Recommended: one offset per texture key, not per primitive (Phase 2).
3. **Windows and doors.** Do they need distinct handling? Today windows only remove geometry cells (`place-windows.js:42`), and doors only skip matrix writes (`walls/index.js:91-95`). No separate treatment is proposed.
4. **Floor full plate and ruins-small.** One rect each (fewer boxes, no seam edge) or keep the split?
5. **Primitive merge pass.** Keep or delete after measuring (2% threshold in Phase 1)?
6. **Greedy vs exact cover.** Is greedy acceptable? Exact is only tractable for hole-free shapes.
7. **Release shape.** Minor (v0.4.0) for deprecation and default-off OBJ, then a minor or major for deletion (Phase 3)?
8. **`--obj` default.** Off by default (breaking default output) or on?
