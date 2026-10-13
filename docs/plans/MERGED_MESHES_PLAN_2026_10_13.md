# Merged Meshes Plan - 2026-10-13

Status: **implemented, uncommitted on `feature/merged-meshes` (branched from `feature/primitive-merge` at d8754d0)**. Owner-approved. Browser checks are still open (see the end).

## Goal

The GLB scene had one `THREE.Mesh` per primitive (678 glTF meshes on seed 7). It now has one mesh per (material, tier) group, which cuts glTF meshes and draw calls by about 8x with the same geometry. The primitives list, geometry JSON and collision matrix are untouched: the merge only exists in the scene build.

## Design

- Config: `GEOMETRY.mergeMeshes = { enabled: true, byTier: true }` (`src/config.js`); `config.mergeMeshes` overrides it per call. `enabled: false` reproduces the previous per-primitive meshes exactly.
- `buildScene` (`src/generators/scene/build-scene.js`) still builds per-primitive meshes, then `mergeSceneMeshes` (`merge-scene-meshes.js`) groups them by material object and `tierOf(prim, config)` (`src/export/assign-primitive-tier.js`), in first-encounter order (deterministic). Each mesh is baked to world space with the same transform the exporter used (`mesh-world-geometry.js`) and concatenated by an in-repo typed-array helper (`merge-group-geometry.js`). three's `BufferGeometryUtils` is not needed, and the helper keeps the Float32 positions bit-identical. Quads (no UVs) get zero UVs, which is what the unmerged mesh sampled anyway; non-indexed ceilings and quads get a sequential index. Ladders and the debug path go through the same route, so nothing is left as separate meshes.
- Textures: world-space UVs are baked per vertex (`box-face-world-uv.js`), so a merged mesh samples the same texels as the separate meshes. Materials and images are already deduplicated per material by `glb-exporter.js`; merging does not change the material, texture or image counts.
- Per-primitive information: each merged mesh gets `userData = { tier, primitives: [{ name, textureKey, indexStart, indexCount }] }`; `glb-exporter.js` writes it as the mesh's glTF `extras` (`GLTFLoader` restores it as `userData`; verified with the real loader on a debug GLB).
- Tier cut-away: a global clip plane in the viewer, applied per fragment, so merged meshes work unchanged. The tier split also lets a viewer hide one tier by mesh.
- Preview fallback highlight (`src/preview/loaded-map/loaded-map.html`): for each merged mesh, an overlay mesh shares the vertex buffers, indexes only the fallback primitives' triangle ranges (matched by name via `userData.primitives`) and uses the flat highlight material with a polygon offset. Chosen over vertex colours (these cannot replace a texture) and over splitting meshes (would rebuild geometry on every toggle). Unmerged GLBs keep the old per-mesh material swap. `map-state.js` now passes `tiers`, `tierHeight` and `slabThickness` from the fixture so the loaded model also splits per tier.
- Known minor difference: transparent (alpha) materials were sorted per primitive by the renderer; in a merged mesh the triangles draw in index order. Only low-alpha texture categories are affected.

## Verification

- Disabled: `enabled = false` gives GLB md5, collision-matrix SHA-256 and primitives hash identical to the baseline commit for seeds 1, 7, 42, 100, 2024 x default and `--profile withering` (10 of 10).
- Enabled: matrix SHA-256 and primitives hash identical for the same 10 cases. Per material: triangle count and axis-aligned bounds match exactly, total area matches (relative difference below 5e-15), and the sorted set of triangle vertex positions + UVs hashes identically between the unmerged and merged GLBs (10 of 10).
- `npm test`: 285 passed, including `tests/export/merged-meshes.test.js`. `npm run check:all`: 31 findings (unchanged).

## Results

Medians of 3 `generateToBuffer` runs (whole generation, not only the scene build). Draw-call proxy = glTF mesh primitives.

| Case | Merged | GLB bytes | Meshes | Nodes | Mesh primitives | Materials | Textures | Triangles | Time ms |
|---|---|---|---|---|---|---|---|---|---|
| seed 7 | no | 1,303,368 | 678 | 678 | 678 | 32 | 32 | 12,142 | 60 |
| seed 7 | yes | 934,508 | 82 | 82 | 82 | 32 | 32 | 12,142 | 53 |
| seed 100 | no | 1,266,328 | 646 | 646 | 646 | 32 | 32 | 11,960 | 46 |
| seed 100 | yes | 919,576 | 86 | 86 | 86 | 32 | 32 | 11,960 | 45 |
| seed 3 withering | no | 439,456 | 242 | 242 | 242 | 26 | 26 | 3,838 | 21 |
| seed 3 withering | yes | 326,128 | 51 | 51 | 51 | 26 | 26 | 3,838 | 19 |

The GLB gets smaller (about 28%), not bigger: per-mesh accessors, buffer views and min/max disappear, and the per-primitive names move into one `extras` list per merged mesh. Images were already embedded once per material, so no exporter fix was needed.

## Not visually verified

No browser was available. The fallback highlight overlay with merged meshes, the tier cut-away on merged meshes and the textured appearance (UV continuity, alpha sorting) are verified only by geometry/UV equivalence and by running the overlay function against a GLTFLoader-loaded GLB. To look: `node src/index.js --seed 7 --preview --textures loaded`, open http://localhost:3010, use "Highlight fallbacks" and the Ground / Tier buttons.
