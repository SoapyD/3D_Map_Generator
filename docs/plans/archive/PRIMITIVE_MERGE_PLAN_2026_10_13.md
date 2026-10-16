# Primitive Merge Plan — 2026-10-13

Status: **Complete, archived 2026-10-16.** Phase A (merge pass, with the A0 exporter-only drop) is implemented on `feature/primitive-merge`, merged to `dev` as PR #41 and tested. Phase B (Track 2, OBJ without atlas) is **SUPERSEDED** and was not done: TTS is no longer a target and the OBJ export has since been deleted (conventions alignment plan, Phase 3b; old code in tags v0.2.0 / v0.3.0, so the OBJ file and line references below point at deleted code and are historical). The 25,000-vertex cap is retired. The merge pass itself is **disabled by default** (see the conventions plan, Phase 1 and 2 results). Outcome: with the merge pass on, default-profile vertex counts on seeds 1, 7, 42, 100 and 2024 fell from 23,878–26,490 to 20,196–22,604 (plan results table below). Target release was **v0.4.0** (`package.json:3` was 0.3.0). The preview work it was compared against is archived in [`LOADED_MAP_TEXTURE_PREVIEW_PLAN_2026_10_13.md`](LOADED_MAP_TEXTURE_PREVIEW_PLAN_2026_10_13.md). File and line refs: [`PRIMITIVE_MERGE_MANIFEST_2026_10_13.md`](PRIMITIVE_MERGE_MANIFEST_2026_10_13.md) (sections A–H, each with its regenerating grep). Section letters are referenced below as **[M-A]** etc.

## Context

TTS rejects OBJ models over **25,000 vertices** (CLAUDE.md). Default-profile vertex counts (`^v ` lines in `output/mordheim_map_N.obj`):

| Seed | Default | Over cap by | Status |
|---|---|---|---|
| 1 | 24,682 | — | under |
| 7 | **26,490** | 1,491 | fails |
| 42 | 23,878 | — | under |
| 100 | **25,522** | 523 | fails |
| 2024 | 24,596 | — | under |

Withering profile: not yet measured (Phase 0).

Per-type vertex cost, measured (seed 7 / seed 100):

| Type | Seed 7 | Seed 100 | Prims (seed 7) | Notes |
|---|---|---|---|---|
| wall | 14,116 | 13,960 | 590 / 587 | ~24 verts each; over half the budget |
| slab | 7,756 | 7,212 | | see subgroups |
| edges | 3,244 | 2,940 | | floors 1,292, roofs 736, cover 464, walkways 320, scatter 224 |
| ladder | 780 | 808 | | |
| ceiling | 594 | 602 | | |

Slab subgroups (seed 7): pavement 2,520 (258 prims, ~10 verts each), floor plates 1,394, roofs 594, bridges 744 (seed 100: 92), `skirt_bottom` 648 (one slab), other skirt/border ~370, street 306, river + banks 482, cover 232, walkways 212, pillars 144.

### Why the cost is what it is (verified from code, [M-B], [M-C])

- **Every shared flat is cut into 3" segments and emits both a top and a bottom vertex grid, regardless of `emitTop`/`emitBottom`.** Cost = `2 × (segsX+1) × (segsZ+1)` with `segs = ceil(size/3)`. `add-shared-flat.js:28-45` pushes both grids unconditionally; the `emitTop`/`emitBottom` flags only guard the faces (`:60`, `:76`).
- **`skirt_bottom` = 648 = 2 × 18 × 18** (50" map+skirt → 17 segments per axis). It is `emitBottom: false` (`build-map-skirt-primitives.js:74`), so half its vertices are never referenced.
- **Walls** are one `wall` prim per wall piece. Each wall costs `4 × (segsL+1)` for front/back grids (height 3" = 1 segment) plus up to 16 for top, bottom and two end caps (`build-obj-and-atlas.js:145-179`). Up to 24 verts per wall, matching the measured ~24. End caps are culled only when a neighbour fully covers them (`wall-edge-covered.js:11-44`).
- **Pavements** all use the single texture key `pavement:0` (`build-pavement-primitives.js:9`), so merging them cannot change their look.
- **Walls** carry a per-building texture key (`build-wall-primitives.js:13`), so they may only merge within one building.
- **GLB does not subdivide.** `createSlab` draws each primitive as one box with a 3" texture repeat (`src/core/geometry-misc.js:18`, `:20`). Merging primitives reduces GLB mesh count too, but does not change GLB vertex cost much.

### Constraints the merge must respect (verified)

- **Tier banding reads the name.** `floor_f(\d+)_` is authoritative (`src/export/assign-primitive-tier.js:60`); other tiers use Y (`:70-78`). Merges must never cross a tier and must keep the `floor_fN_` prefix.
- **Collision reads name prefixes** (`src/export/collision-buffer.js:11-15`, filter at `:28`) and excludes names containing `_wall_` or `_batt_` (`:30`). Merged primitives must keep these prefixes and must not gain `_wall_` in a collidable name.
- **UV hash uses the primitive origin** (`add-shared-flat.js:23-24`, `add-shared-wall.js:27-28`, `geometry-misc.js:45-46`). A merged primitive has a new origin, so its texture offset changes unless the original origin is carried through.
- **Tests pin counts and names.** `tests/snapshot.test.js:80` and `:105` pin primitive counts (1284, 1355). `tests/export/export-tiers.test.js:45` and `:49` pin names.

## Track 1 — Primitive merge (Phase A)

Goal: reduce the primitive list **before** the exporters, so OBJ, GLB, collision and the loaded-map preview all see the same merged primitives (CLAUDE.md "same geometry, different formats").

### Phase A0 — exporter-only quick win (optional, can ship first)

Stop emitting grids that no face references: skip the top grid when `emitTop` is false and the bottom grid when `emitBottom` is false and `simpleBottom` is false. The `simpleBottom` path still needs its four corner vertices. No primitive changes, so the rendered faces are identical.

- Verified: exactly **324** saved on `skirt_bottom` (seed 7, 48×48).
- Inferred: pavements and other `emitBottom: false` flats (street, river, roof top, scatter, courtyard, river bank) roughly halve their cost. The total is not measured.
- Could clear seed 7's 1,491 deficit by itself. Measure before deciding how much Phase A is needed.

### Phase A1 — merge pass (the core change)

- New pure module `src/generators/geometry/merge-primitives.js` [M-D] (named export `mergePrimitives(primitives, config)`), called at the end of `buildGeometry` before `return` (`build-geometry.js:95`). Pipeline result (`src/pipeline.js:121-122`) then feeds GLB, OBJ, collision and preview alike.
- Helpers in small files, one export per file (match the `scripts/checks` single-export rule; the rule text was not read).
- Merge rules (all must hold):
  - Same `type`, `textureKey`, `y`, `h`, flags (`shared`, `emitTop`, `emitBottom`, `simpleBottom`, `rotateUV`, `axis`).
  - Same tier (same `y`, and the name family `floor_fN_` is unchanged).
  - Same building for walls (`textureKey` already encodes it).
  - Rectangles merge only when the union is exactly a rectangle (no overlap, no gap).
  - Walls merge only when collinear, end-to-end, same `d`, same `h`.
  - Never merge `ladder`, `ceiling`, `edges`, `bridge_wall_`, `bridge_batt_` or `_wall_` names (see Open decision 2).
- Carry the **original origin** on the merged primitive (for example `uvOrigin: {x, z, y}`) so the UV hash is unchanged. The exporters read `uvOrigin` when present.
- Keep names with the same prefix. Use a deterministic counter, no RNG (CLAUDE.md seeded-RNG rule).
- Config: new keys under the `GEOMETRY` block (`src/config.js:171-178`), for example `primitiveMerge: { enabled, types }`, so the feature can be switched off for A/B tests.

### Phase A2 — wall end-cap coverage on merged walls

`wallEdgeCovered(prim, side, wallPrims)` (`wall-edge-covered.js:11`) is called with the full wall list at `build-obj-and-atlas.js:170-178`. After merging, the end caps of a merged run must be checked against the merged list. The merge must not create an uncovered internal seam, and must not hide a real end cap.

### Phase A3 — tests

- Update `tests/snapshot.test.js` counts (lines 80, 105) and any name-pinned tests in `tests/export/export-tiers.test.js`.
- New `tests/generators/merge-primitives.test.js`: sum of areas per texture per tier is unchanged; no overlapping rectangles; collidable volume (`collision-buffer.js`) is unchanged; `tierOf` returns the same value for every primitive before and after.

### Phase A4 — measure and ship

Record before/after per seed and profile (see Verification). Ship as one PR on a feature branch off `dev`.

## Implementation status and results (2026-10-13, branch `feature/primitive-merge`, uncommitted)

Phase 0, A0, A1-A3 and the A4 measurements are done. Phase B is not started (owner decision 5). `package.json` is not bumped. Owner decisions applied: A0 first; scope = walls, pavements, floor plates; target <= 23,000; `uvOrigin` carried; Phase A only.

### Measured vertex counts (`^v ` lines of `output/mordheim_map_N.obj`)

| Profile | Seed | Baseline | After A0 | After A0 + merge |
|---|---|---|---|---|
| default | 1 | 24,682 | 21,780 | 20,748 |
| default | 7 | 26,490 | 23,610 | **22,604** |
| default | 42 | 23,878 | 21,070 | 20,196 |
| default | 100 | 25,522 | 22,578 | 21,638 |
| default | 2024 | 24,596 | 21,776 | 20,834 |
| withering | 1 | 7,522 | 6,199 | 5,778 |
| withering | 7 | 8,586 | 7,309 | 6,889 |
| withering | 42 | 10,154 | 8,721 | 8,281 |
| withering | 100 | 7,002 | 5,757 | 5,343 |
| withering | 2024 | 8,850 | 7,585 | 7,157 |

Extra default seeds after A0 + merge: 2: 22,906; 3: 21,872; 5: 18,996; 11: 17,952; 99: 19,714; 123: 18,016; 500: 19,376; 777: 21,504. All <= 23,000.

Gates: `npm test` 276/276 pass (baseline 244 + 1 expected fail; the seed-100 `it.fails` is now a normal test); `npm run check:all` 37 findings (baseline 37; file-sizes 16, identical list); `npm run check:file-sizes` identical to baseline.

### What the measurements showed (plan corrections)

- **A0 alone** removes 2,880 (seed 7) to 2,944 (seed 100) vertices per default map, about 3x the "324 on skirt_bottom" that the plan verified. Seeds 7 and 100 were already under 25,000 after A0. Face data is byte-identical (ordered position + UV per face), GLB byte-identical, collision OBJ byte-identical.
- **Walls: the plan's wall merge saves almost nothing on default maps.** A wall primitive is a single 1" (or 0.75") tall row; rows stack at different `y`, so the "same `y`, `h`" rule only allows horizontal merges, and seed 7 has 0 horizontally adjacent same-row pairs (31 adjacent pairs differ in `y`/`h`). The 14,116 wall vertices (seed 7) are unchanged by the merge. The savings come from pavements (258 -> 70 prims, 2,520 -> 550 verts, including A0) and floor plates. The "590 prims, over half the budget" is the wall cost the plan hoped to cut; it needs a different rule (below).
- **Withering** has merged walls (seed 7: 590 -> 176), so the wall rule does work there.
- **Next lever (not implemented, outside owner decisions): vertical stacking of wall rows** (same x/z/w/d/axis/textureKey, consecutive `y`, same `tierOf`). A throwaway prototype on the current geometry took seed 7 from 22,604 to 16,256 and seed 100 from 21,638 to 15,658 (273 / 260 merges). Caveat: each 1" row currently stretches one 3" texture segment over 1" of height (`segsH = 1`), so a merged 2.75" wall would show the texture differently. Needs a visual decision before implementing.
- Remaining biggest cost, seed 7 after merge: wall 14,116, floor_f0 1,158, roof_ceil 1,033, floor_f1 818, cover 580, pavement 550, walkway 532, floor_f2 414.
- The plan said merged names should use "a deterministic counter"; none is needed: the merged primitive keeps the earlier constituent's name (unique, same prefix).
- `tests/export/export-tiers.test.js` uses hand-written fixtures and does not call `buildGeometry`, so it needed no change. `tests/snapshot.test.js` (seed 42: 1284 -> 1079 prims, 23,878 -> 20,196 verts; seed 100: 1355 -> 1127, 25,522 -> 21,638) and `tests/export/obj-exporter.test.js` (seed 42 vertex lock) were updated.
- `uvOrigin` keeps the texture offset of a merged primitive's first segment only; later 3" segments continue from it, so merged spans are not tile-for-tile identical to their constituents.

### Verification done

OBJ total triangle area (all 10 seed/profile runs) and collision box volume identical before/after merge; collision boxes 554 -> 321 (seed 1). Wall end-cap rectangles that are not covered are the same set before/after (seeds 1, 7, 100). Same seed twice gives identical OBJ, GLB and collision md5. With `enabled: false`, GLB and `_geometry.json` are byte-identical to the baseline and the OBJ face set is identical to the baseline. `--split-tiers` still works (seed 7: 4 tier OBJs). GLB mesh nodes seed 7: 1,208 -> 981.

Not visually verified: textures, seams and tier bands of merged output in TTS or the preview (see the preview comparison in the PR notes).

## Track 2 — OBJ without atlas or subdivision (Phase B, SUPERSEDED)

**SUPERSEDED (2026-10-13).** Tabletop Simulator is no longer a target and the OBJ export is deprecated, so this proposal is dropped. See [`CONVENTIONS_ALIGNMENT_PLAN_2026_10_13.md`](../CONVENTIONS_ALIGNMENT_PLAN_2026_10_13.md) (Phase 3). Kept below for history only.

Proposal: write one `.mtl` material per texture key, use UVs that repeat every 3" like the GLB path, and remove the atlas and subdivision. This would remove `SEG_SIZE` from `add-shared-flat.js:3`, `add-shared-wall.js:3` and `add-sub-box.js:6`, the atlas build in `build-obj-and-atlas.js:52-104`, and the atlas PNG write at `:100-101`.

- **Why it matters:** with subdivision in place, a merged face is still cut into 3" segments, so merging saves less in the OBJ than in the GLB. Removing subdivision is what lets merging pay off in the OBJ.
- **Why it is risky:**
  - Unverified: TTS may not repeat UVs beyond 0–1, or may not accept multiple materials per custom model. Our belief is that a TTS custom model takes a single diffuse image. That is why the atlas exists, but no doc records it (grep of `docs/` finds only the mechanism at `11-scene-and-export.md:75`).
  - The THIN_FLOOR_SLABS plan relies on the 3" segment grid (`THIN_FLOOR_SLABS_PLAN_2026_10_11.md:27`). It would need revisiting.
  - The loaded-map preview already uses GLB-style 3" repeat UVs (`LOADED_MAP_TEXTURE_PREVIEW_PLAN_2026_10_13.md:36`). It can act as the visual reference for Phase B.
- **Gate:** build a small hand-made OBJ (two quads, UVs 0–4 for a 1-tile texture, two materials) and load it in TTS. Check: repeat works, multi-material works, vertex count is as expected. Do not commit Phase B until this passes.
- **If TTS needs one image:** either split OBJs per texture (more files, more load) or stay on the atlas and rely on Phase A alone.

## Open decisions (need the owner)

1. **Ship A0 first?** It is exporter-only and may clear seed 7 alone. Recommended: yes, and measure before A1.
2. **Merge scope.** Walls (about 14k, the biggest lever), pavements and floor plates are the first candidates. Edge prims (`edges`, 3,244) and ladders are excluded in the first cut; merging slabs does not reduce edge cost. Confirm.
3. **Target margin.** Hard limit `< 25,000`, or a target such as `≤ 23,000` for seed-to-seed headroom? Recommended: `≤ 23,000` for every seed and profile tested.
4. **UV hash for merged primitives.** Keep the first constituent's origin (textures identical, recommended) or accept new texture offsets?
5. ~~**Phase B go / no-go**, after the TTS test above.~~ Superseded: Phase B is dropped (OBJ deprecated).
6. **Release scope.** Ship v0.4.0 with Phase A only, and Phase B later as a breaking format change? Recommended: yes.

## Phases and gates

- **Phase 0 — baseline.** Before touching code, record vertex counts for seeds 1, 7, 42, 100, 2024 × default and `--profile withering`, `npm test`, and `npm run check:all` (owner reports 37 findings; not re-measured in this plan). Note that seed 100 already fails the cap.
- **Phase A0 — optional exporter-only drop** (separate PR, identical rendering).
- **Phase A1–A3 — merge pass, coverage, tests** (one PR, behind `primitiveMerge.enabled`).
- **Phase A4 — measure, flip default on** if all gates pass.
- **Phase B — SUPERSEDED** (dropped; see the conventions alignment plan, Phase 3).

## Verification

- **Vertex counts:** `npm run generate -- --seed N [--profile withering]`, then count `^v ` lines in `output/mordheim_map_N.obj`. PowerShell: `(Select-String -Path output\mordheim_map_N.obj -Pattern '^v ').Count`. The hook `.claude/hooks/check-vertex-count.mjs` does the same check.
- **Tests:** `npm test` (`package.json:14`, `vitest run`).
- **Static checks:** `npm run check:all` (`package.json:18`); the 37-finding baseline must not rise.
- **GLB / OBJ parity:** primitive count per name family in the GLB scene equals the count of `o ` groups in the OBJ; world-space bounds equal; collision OBJ volume equal before and after merge.
- **Visual:** use the loaded-map preview to compare merged and unmerged for seeds 7 and 100. Check seams at merged walls, texture alignment (UV hash), and tier bands.
- **Seeds:** at least 1, 7, 42, 100, 2024 plus a few more before flipping the default.

## Risks

- **Wall end caps:** a merge can expose or hide an end cap if coverage is not recomputed (Phase A2).
- **Texture change:** dropping `uvOrigin` changes every merged piece's texture offset (Open decision 4).
- **Tier misassignment:** a merge that crosses tiers or drops the `floor_fN_` prefix moves geometry to the wrong tier file.
- **Savings ceiling:** edges and ladders do not merge in the first cut, so Phase A may not be enough on its own for seed 100 without A0.
- **Snapshot churn:** counts in `tests/snapshot.test.js` change on every merge; update them deliberately.
- **Phase B unknowns:** superseded; Phase B is dropped.

## Verified vs inferred

**Verified** (read or grepped this session):
- Vertex formulas for `addSharedFlat` and walls; `skirt_bottom` = 648 = 2 × 18 × 18, with `emitBottom: false`.
- Both grids emitted regardless of `emitTop`/`emitBottom`.
- Pavement texture key is fixed as `pavement:0`.
- Walls carry per-building texture keys.
- Tier banding reads `floor_fN_` names; collision reads name prefixes and `_wall_`/`_batt_` exclusions.
- UV hash depends on primitive origin.
- Snapshot and export-tiers tests pin counts and names.
- `docs/` does not record why the atlas and subdivision exist.

**Inferred or unmeasured:**
- A0 savings beyond `skirt_bottom` (about half of other unused grids).
- Any merge savings (wall, pavement, floor counts after merge).
- Whether a TTS custom model accepts one diffuse image only.
- The owner's `check:all` count of 37 (taken from the request, not re-run).
- Vertex counts for seeds 1, 42, 2024 are from the request, not re-run.
