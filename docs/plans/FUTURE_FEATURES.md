# Future Features & Roadmap

Prioritised feature list for the Mordheim 3D map generator. Features are grouped by category, then roughly ordered by bang-for-buck within each group.

Legend: **Complexity** S/M/L | **Impact** low/medium/high/critical

Items moved to dedicated plans or already implemented are marked accordingly.

---

## 1. Generation Improvements

### ~~1a. L-Shaped and T-Shaped Building Footprints~~ → BUILDING_ADDITIONS_PLAN
Moved to Building Additions Plan as "Small Building Footprint Shapes" (corner, L, U, diagonal).

### ~~1b. Bridges Between Buildings~~ → BUILDING_ADDITIONS_PLAN
Moved to Building Additions Plan as "Bridge Walkways" with low-wall and battlement variants.

### 1c. Archways and Doorways
Cut arch-shaped openings into ground-floor walls. Currently wall damage is rectangular quadrant removal; arch shapes would require subdividing wall geometry or using a shaped mesh.

- **Complexity:** M
- **Impact:** Medium
- **Dependencies:** Would benefit from vertex-level wall geometry.

### 1d. Elevation Changes / Sloped Terrain
Raise or lower portions of the base map to create hills, sunken areas, or stepped plazas.

- **Complexity:** L
- **Impact:** High
- **Dependencies:** Requires reworking ground floor generation, building placement, and collision mesh.

### ~~1e. Water Features~~ → WATERWAYS_PLAN
Moved to Waterways Plan — cross-pattern canals with edge wall variants, bridges, and ground floor splitting.

### 1f. Different City Layout Presets
Layout modes: radial, linear, district-based. Currently pure BSP.

- **Complexity:** M
- **Impact:** High
- **Dependencies:** Requires refactoring `grid.js` to support pluggable layout strategies.

### 1g. Central Plaza / Open Spaces
Force large open areas by reserving blocks during BSP partitioning.

- **Complexity:** S
- **Impact:** Medium
- **Dependencies:** Minor change to `grid.js`.

### ~~1h. Ruined Towers~~ → BUILDING_ADDITIONS_PLAN
Moved to Building Additions Plan with standard, narrow, and pyramid roof variants.

### ~~1i. Building Interior Rooms~~ → BUILDING_ADDITIONS_PLAN
Moved to Building Additions Plan as "Interior Walls" (centre wall and cross variants with quadrant damage).

### 1j. Collapsed Floors / Rubble Piles
Instead of cleanly removing quadrants, leave angled debris or rubble geometry.

- **Complexity:** L
- **Impact:** Medium
- **Dependencies:** New geometry types beyond axis-aligned boxes.

---

## 2. Visual Improvements

### 2a. Texture Variation Per Building
Mix 2-3 wall textures within a single building (e.g., brick lower, plaster upper).

- **Complexity:** S
- **Impact:** Medium

### 2b. Weathering / Damage Overlays
Darken edges, add moss/grime, overlay cracks via UV blending or vertex colouring.

- **Complexity:** M
- **Impact:** Medium

### 2c. Better Edge Handling on Broken Walls
Jagged/irregular edge profile instead of clean right angles at quadrant boundaries.

- **Complexity:** M
- **Impact:** High

### 2d. Ground Texture Zones
Different textures for streets, courtyards, building interiors instead of single base_map.

- **Complexity:** S
- **Impact:** Medium

### 2e. Roof Remnants
Partial roof geometry (angled slabs, timber frames) on some buildings.

- **Complexity:** M
- **Impact:** Medium

### 2f. Wooden Beam Details
Horizontal/vertical timber beams overlaid on wall surfaces (half-timbered style).

- **Complexity:** S
- **Impact:** Low-medium

### 2g. Street-Level Detail Objects
Barrels, crates, cart wreckage, well centerpieces as mesh templates instead of procedural boxes.

- **Complexity:** M
- **Impact:** Medium

### 2h. Lighting Hints for TTS
Embed suggested torch/light positions in export metadata.

- **Complexity:** S
- **Impact:** Low

---

## 3. Gameplay Improvements

### 3a. Deployment Zones
Mark map edges/corners as deployment zones with cover balance analysis.

- **Complexity:** S
- **Impact:** Critical

### 3b. Objective Markers
Place Wyrdstone shards / loot tokens at strategic positions.

- **Complexity:** S
- **Impact:** High
- **Dependencies:** 3a (deployment zones).

### 3c. Sightline Analysis
Raycast to identify and break long sightlines exceeding `maxSightline`. Currently defined in config but not enforced.

- **Complexity:** M
- **Impact:** High

### 3d. Balanced Cover Distribution
Analyse cover density across map quadrants and tiers for balance.

- **Complexity:** M
- **Impact:** High
- **Dependencies:** 3a (deployment zones).

### 3e. Movement Cost Annotations
Tag terrain with Mordheim movement costs as export metadata.

- **Complexity:** S
- **Impact:** Medium

### 3f. Vertical Access Balance
Equal ladder/walkway access from each deployment zone.

- **Complexity:** M
- **Impact:** High
- **Dependencies:** 3a (deployment zones).

### 3g. Hiding Spots Analysis
Identify and limit positions with full cover from all directions.

- **Complexity:** M
- **Impact:** Medium
- **Dependencies:** 3c (sightline analysis).

---

## 4. Technical Improvements

### 4a. Mesh Merging by Material
Merge meshes sharing the same material into single draw calls. `mergeMeshes` utility exists but is unused.

- **Complexity:** S
- **Impact:** High

### ~~4b. Vertex Optimisation / Deduplication~~ DONE
Implemented via shared vertex grids (`addSharedFlat`, `addSharedWall`), ladder edge removal, dedicated `addLadderBox`, bottom face culling, collision mesh simplification. Seed 42: 24,672 → 13,943 (43.5% reduction). See archived plan: `docs/plans/archive/VERTEX_OPTIMISATION_PLAN.md`

### 4c. LOD (Level of Detail)
Generate simplified versions for web preview.

- **Complexity:** M
- **Impact:** Low

### ~~4d. Better Collision Meshes~~ DONE
Collision mesh now uses single bounding boxes (8 verts) per surface instead of full Three.js BoxGeometry (24 verts). 4,032 → 1,504 verts.

### 4e. Streaming/Chunked Generation
Generate large maps (96x96+) in chunks to reduce memory.

- **Complexity:** L
- **Impact:** Low

### ~~4f. Interior Face Culling in OBJ Export~~ PARTIALLY DONE
`cullFaces` mechanism exists on `addSubBox`. Bottom face culling applied to base floor, courtyards, cover, scatter. Full interior face culling reverted — most "interior" faces are visible during play. Ladder edge faces removed. See archived plan.

---

## 5. Integration Features

### 5a. Web Preview with Three.js
Browser-based GLB preview. `--preview` flag stubbed in `index.js`.

- **Complexity:** M
- **Impact:** High

### 5b. TTS Save File Generation
Generate complete TTS .json save file with model placed and scaled.

- **Complexity:** M
- **Impact:** High

### 5c. Map Sharing / Seed Library
Store seeds with metadata for browsing and regeneration.

- **Complexity:** S-L
- **Impact:** Medium

### 5d. Batch Generation
Generate N maps from sequential/random seeds in one invocation.

- **Complexity:** S
- **Impact:** Medium

### 5e. Map Metadata Export
JSON file with building positions, floor areas, ladder counts, cover stats.

- **Complexity:** S
- **Impact:** Medium

### ~~5f. Package Integration with WyrdWars~~ → PACKAGE_INTEGRATION_PLAN
Full plan exists at `docs/plans/PACKAGE_INTEGRATION_PLAN.md`.

---

## 6. Quality of Life

### 6a. Config Presets
Named presets: `--preset skirmish`, `--preset campaign`, `--preset siege`.

- **Complexity:** S
- **Impact:** High

### 6b. Map Thumbnail Generation
Top-down 2D PNG with colour-coded tiers, ladders, walkways.

- **Complexity:** M
- **Impact:** High

### 6c. Dry Run / Stats Mode
Run generation without export. Print statistics.

- **Complexity:** S
- **Impact:** Medium

### 6d. Configurable Damage Presets
Wire up `damageLevel` parameter to control wall/floor removal ratios. Currently defined but inert.

- **Complexity:** S
- **Impact:** High

### 6e. Interactive Config Builder
Terminal UI walking users through configuration.

- **Complexity:** M
- **Impact:** Medium

### 6f. Export Format Selection
`--format glb`, `--format obj`, `--format both`.

- **Complexity:** S
- **Impact:** Low

### 6g. Custom Texture Pack Support
Validate custom packs at startup with error messages.

- **Complexity:** S
- **Impact:** Medium

---

## Priority Tiers

**Do first** (high impact, low-medium complexity):
1. 6d — Wire up damageLevel parameter (S, already exists but inert)
2. 3a — Deployment zones (S, critical for gameplay)
3. 6a — Config presets (S, quality of life)
4. 3b — Objective markers (S, high gameplay value)
5. 6b — Map thumbnail generation (M, fastest evaluation method)
6. 4a — Mesh merging by material (S, function already exists)

**Do second** (high impact, medium complexity):
7. BUILDING_ADDITIONS_PLAN — towers, bridges, shapes, interior walls
8. 3c — Sightline analysis (M, game balance)
9. 1f — City layout presets (M, replay variety)
10. 5a — Web preview (M, already stubbed)
11. 2c — Jagged broken wall edges (M, biggest visual improvement)
12. 5b — TTS save file generation (M, removes manual import)

**Do later** (larger scope or lower impact):
13. 1d — Elevation changes (L)
14. 3d — Balanced cover distribution (M)
15. 1e — Water features (M)
16. 1c — Archways (M)
17. 1j — Collapsed floors / rubble (L)
