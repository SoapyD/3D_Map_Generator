# Future Features & Roadmap

Prioritised feature list for the Mordheim 3D map generator. Features are grouped by category, then roughly ordered by bang-for-buck within each group.

Legend: **Complexity** S/M/L | **Impact** low/medium/high/critical

---

## 1. Generation Improvements

### 1a. L-Shaped and T-Shaped Building Footprints
Compose two overlapping rectangles to create non-rectangular ruins. The quadrant system already removes floor sections per tier, so the footprint itself being irregular would add significant visual variety without changing the wall/floor pipeline much.

- **Complexity:** M
- **Impact:** High
- **Dependencies:** None. Walls and floors already work with partial quadrants; the main work is footprint generation and ensuring connectivity still works.

### 1b. Bridges Between Buildings
Elevated stone bridges (wider and thicker than walkways) that span streets at tier 2+. Unlike wooden walkways, bridges would have low walls on each side and use stone textures.

- **Complexity:** M
- **Impact:** High -- creates dramatic sightline-blocking terrain and new tactical routes
- **Dependencies:** None, but benefits from 2c (edge handling) for the bridge walls.

### 1c. Archways and Doorways
Cut arch-shaped openings into ground-floor walls. Currently wall damage is rectangular quadrant removal; arch shapes would require subdividing wall geometry or using a shaped mesh.

- **Complexity:** M
- **Impact:** Medium -- improves visual authenticity and creates interesting ground-level movement options
- **Dependencies:** Would benefit from vertex-level wall geometry (see 4b).

### 1d. Elevation Changes / Sloped Terrain
Raise or lower portions of the base map to create hills, sunken areas, or stepped plazas. The base floor is currently a single flat plane at y=0.

- **Complexity:** L
- **Impact:** High -- fundamentally changes gameplay and sightlines
- **Dependencies:** Requires reworking ground floor generation, building placement (buildings need to sit on the terrain), and collision mesh export.

### 1e. Water Features
Canals, flooded basements, or a river cutting through the map. In Mordheim, water is dangerous terrain that slows movement. Could be implemented as recessed floor sections with a blue/transparent texture.

- **Complexity:** M
- **Impact:** Medium -- adds thematic variety and tactical depth (movement penalties)
- **Dependencies:** Elevation changes (1d) would make this more natural, but a flat canal at y=0 with special texture works independently.

### 1f. Different City Layout Presets
Currently the grid is pure BSP. Add layout modes: radial (streets radiating from a central plaza), linear (one main road with alleys), or district-based (dense slums vs. open market squares).

- **Complexity:** M
- **Impact:** High -- each layout plays very differently
- **Dependencies:** Requires refactoring `grid.js` to support pluggable layout strategies.

### 1g. Central Plaza / Open Spaces
Force one or more large open areas (market squares, cathedral grounds) by reserving blocks during BSP partitioning. These become key battleground areas with scattered cover.

- **Complexity:** S
- **Impact:** Medium -- creates natural focal points for engagements
- **Dependencies:** Minor change to `grid.js`. Cover placement (stage 6) already handles open ground.

### 1h. Ruined Towers
Tall, narrow buildings (2x2 to 3x3 footprint) that go to max tier. The current system can produce these if the footprint is small and `maxTier` is high, but a dedicated tower type with circular or octagonal footprint would be distinctive.

- **Complexity:** M
- **Impact:** Medium -- provides high vantage points, important for Mordheim shooting
- **Dependencies:** Non-rectangular geometry (see 1a for the simpler version, or new mesh primitives for circular).

### 1i. Building Interior Rooms
Subdivide large building interiors with interior walls, creating rooms and corridors. Currently large buildings are open floor plates.

- **Complexity:** L
- **Impact:** Medium -- adds tactical complexity for close-quarters fighting
- **Dependencies:** Requires interior wall generation, doorway placement, and connectivity updates to ensure rooms are accessible.

### 1j. Collapsed Floors / Rubble Piles
Instead of cleanly removing quadrants, some removed sections could leave angled debris or rubble geometry. Currently removal is binary (present or absent).

- **Complexity:** L
- **Impact:** Medium -- visual improvement and creates difficult terrain
- **Dependencies:** New geometry types beyond axis-aligned boxes.

---

## 2. Visual Improvements

### 2a. Texture Variation Per Building
Currently textures are assigned per-building from pools, but every wall of a building uses the same texture. Allow mixing 2-3 wall textures within a single building (e.g., brick lower floors, plaster upper floors).

- **Complexity:** S
- **Impact:** Medium
- **Dependencies:** None. Scene builder already picks textures per-mesh.

### 2b. Weathering / Damage Overlays
Darken edges of broken walls, add moss/grime near ground level, or overlay crack textures on surfaces. Could be done by modifying UV mapping to blend a second texture or by vertex colouring.

- **Complexity:** M
- **Impact:** Medium
- **Dependencies:** Would benefit from vertex colour support in the exporter (4b).

### 2c. Better Edge Handling on Broken Walls
Currently broken wall edges are clean right angles (quadrant boundaries). Adding a jagged/irregular edge profile would make ruins look more natural.

- **Complexity:** M
- **Impact:** High -- the clean edges are the most visually obvious shortcoming
- **Dependencies:** Requires moving beyond pure BoxGeometry for wall segments.

### 2d. Ground Texture Zones
Instead of a single base_map texture for the entire ground, assign different textures to streets (cobblestone), courtyards (dirt/gravel), and building interiors (flagstone).

- **Complexity:** S
- **Impact:** Medium
- **Dependencies:** The OBJ exporter already handles atlas regions per-object. Needs ground sections to be tagged by type.

### 2e. Roof Remnants
Add partial roof geometry (angled slabs, timber frames) on some buildings. Currently all buildings are open-topped ruins.

- **Complexity:** M
- **Impact:** Medium -- adds visual variety and blocks vertical sightlines into buildings
- **Dependencies:** New angled geometry; currently everything is axis-aligned.

### 2f. Wooden Beam Details
Add horizontal/vertical timber beams on walls (half-timbered style). Could be thin box meshes overlaid on wall surfaces with a wood texture.

- **Complexity:** S
- **Impact:** Low-medium
- **Dependencies:** None. Just additional meshes in the scene builder.

### 2g. Street-Level Detail Objects
Expand cover objects beyond simple boxes: barrels, crates, cart wreckage, well/fountain centerpieces. Each would be a small mesh template rather than a procedural box.

- **Complexity:** M
- **Impact:** Medium
- **Dependencies:** Requires loading external mesh templates (GLTF/OBJ models).

### 2h. Lighting Hints for TTS
Embed suggested light positions in the export metadata (e.g., torch sconces on walls). TTS supports point lights on imported objects.

- **Complexity:** S
- **Impact:** Low -- TTS lighting is limited, but torchlight adds atmosphere
- **Dependencies:** None.

---

## 3. Gameplay Improvements

### 3a. Deployment Zones
Mark two (or more) map edges/corners as deployment zones. Ensure deployment zones have adequate cover and are roughly balanced in terms of access to elevated positions. Output zone boundaries as metadata or visual markers.

- **Complexity:** S
- **Impact:** Critical -- every Mordheim game needs deployment zones; currently players eyeball it
- **Dependencies:** None. Pure metadata/marker generation added after stage 6.

### 3b. Objective Markers
Place 3-5 objective markers (Wyrdstone shards, loot tokens) at strategic positions -- some at ground level, some elevated. Ensure they are accessible from multiple directions and not trivially defensible.

- **Complexity:** S
- **Impact:** High -- most Mordheim scenarios use objective markers
- **Dependencies:** Benefits from 3a (deployment zones) to ensure objectives are placed between deployment areas.

### 3c. Sightline Analysis
After generation, raycast across the map to identify long sightlines. If any sightline exceeds `maxSightline` (currently 24"), add cover or adjust building placement to break it. Currently `maxSightline` is defined in config but not enforced.

- **Complexity:** M
- **Impact:** High -- unbroken sightlines make ranged combat dominant and ruin game balance
- **Dependencies:** None. Post-generation analysis pass.

### 3d. Balanced Cover Distribution
Analyse cover density across map quadrants and across tiers. Ensure no quadrant is significantly more exposed than others. Currently cover placement is random within constraints.

- **Complexity:** M
- **Impact:** High -- prevents one player having a major terrain advantage
- **Dependencies:** Benefits from 3a (deployment zones) to define what "balanced" means relative to starting positions.

### 3e. Movement Cost Annotations
Tag terrain features with Mordheim movement costs (climbing = double movement, jumping gaps, dangerous terrain for water/rubble). Export as metadata alongside the geometry.

- **Complexity:** S
- **Impact:** Medium -- helps players who are new to the terrain rules
- **Dependencies:** None.

### 3f. Vertical Access Balance
Ensure both sides of the map have roughly equal access to elevated positions. Count ladders and walkways reachable from each deployment zone.

- **Complexity:** M
- **Impact:** High
- **Dependencies:** 3a (deployment zones).

### 3g. Hiding Spots Analysis
Identify positions where a model has full cover from all directions (enclosed rooms, behind walls with no sightline). Flag or limit these to prevent camping.

- **Complexity:** M
- **Impact:** Medium
- **Dependencies:** 3c (sightline analysis).

---

## 4. Technical Improvements

### 4a. Mesh Merging by Material
Currently every wall segment, floor section, and cover piece is a separate mesh. Merge all meshes that share the same material into a single draw call. The `mergeMeshes` utility in `geometry.js` exists but is unused.

- **Complexity:** S
- **Impact:** High -- dramatically reduces draw calls and file size in GLB; improves TTS performance
- **Dependencies:** None. The function already exists.

### 4b. Vertex Optimisation / Deduplication
The OBJ exporter creates 8 vertices per subdivided segment, many of which are shared with adjacent segments. Deduplicating shared vertices would reduce file size significantly.

- **Complexity:** M
- **Impact:** Medium -- OBJ files are already large; this could halve vertex count
- **Dependencies:** None.

### 4c. LOD (Level of Detail)
Generate a simplified collision-only version alongside the full detail version. The collision exporter already does a basic version of this; extend it to produce 2-3 LOD levels.

- **Complexity:** M
- **Impact:** Low -- TTS doesn't use LOD, but useful for web preview
- **Dependencies:** Web preview (5a) to make use of LODs.

### 4d. Better Collision Meshes
The collision exporter includes all floor and walkway geometry. For TTS, a simplified version with just the top faces (no bottom faces, no sides of thin slabs) would be more efficient and reduce physics overhead.

- **Complexity:** S
- **Impact:** Medium -- TTS performance with complex collision meshes can be poor
- **Dependencies:** None.

### 4e. Streaming/Chunked Generation
For very large maps (96x96+), generate in chunks to reduce peak memory usage. Currently the entire map is held in memory.

- **Complexity:** L
- **Impact:** Low -- 48x48 maps work fine; only matters for unusually large tables
- **Dependencies:** None.

### 4f. Interior Face Culling in OBJ Export
The OBJ exporter already has edge coverage helpers but only uses them for floors. Extend to walls and cover objects -- don't emit faces that are pressed against another surface and will never be seen.

- **Complexity:** M
- **Impact:** Medium -- reduces polygon count and texture atlas waste
- **Dependencies:** None.

---

## 5. Integration Features

### 5a. Web Preview with Three.js
A browser-based preview that loads the GLB and lets users orbit/zoom. The `--preview` flag and `src/preview/server.js` path are referenced in `index.js` but not yet implemented.

- **Complexity:** M
- **Impact:** High -- lets users evaluate maps without importing to TTS
- **Dependencies:** None.

### 5b. TTS Save File Generation
Instead of exporting OBJ/GLB and manually importing, generate a complete TTS save file (.json) with the model already placed, scaled, and positioned on a table. Include deployment zone markers as TTS tokens.

- **Complexity:** M
- **Impact:** High -- eliminates the manual import step entirely
- **Dependencies:** Benefits from 3a (deployment zones) and 3b (objective markers) to include game elements.

### 5c. Map Sharing / Seed Library
A simple JSON file or web service that stores seeds with metadata (size, tier count, notable features, player ratings). Users can browse and regenerate maps from seeds.

- **Complexity:** S (local JSON) / L (web service)
- **Impact:** Medium
- **Dependencies:** None for local; web service is a separate project.

### 5d. Batch Generation
Generate N maps from sequential or random seeds in one invocation. Useful for tournament organisers who need multiple balanced maps.

- **Complexity:** S
- **Impact:** Medium
- **Dependencies:** None. Just a loop around `main()`.

### 5e. Map Metadata Export
Output a JSON file alongside the geometry containing: building positions, floor areas per tier, ladder/walkway counts, cover density stats, seed, config. Useful for analysis and for TTS scripting.

- **Complexity:** S
- **Impact:** Medium
- **Dependencies:** None.

---

## 6. Quality of Life

### 6a. Config Presets
Named presets for common setups: `--preset skirmish` (24x24, 2 tiers, low damage), `--preset campaign` (48x48, 4 tiers, medium), `--preset siege` (48x48, 4 tiers, high damage, one large fortified building).

- **Complexity:** S
- **Impact:** High -- most users will want a quick start rather than tuning 10+ parameters
- **Dependencies:** None.

### 6b. Map Thumbnail Generation
Render a top-down 2D image of the generated map (PNG). Colour-code floors by tier, mark ladders and walkways. Useful for quick visual comparison of seeds.

- **Complexity:** M
- **Impact:** High -- the fastest way to evaluate a map without loading it in 3D
- **Dependencies:** None. Can use node-canvas or raw pixel buffer (pngjs is already a dependency).

### 6c. Dry Run / Stats Mode
Run generation without exporting geometry. Print statistics: building count by size, floor area per tier, ladder/walkway counts, cover density, longest sightline. Fast way to evaluate seeds.

- **Complexity:** S
- **Impact:** Medium
- **Dependencies:** None.

### 6d. Configurable Damage Presets
The `damageLevel` parameter (0-1) currently has no direct effect on wall/floor removal. Wire it up to control `WALL.upperRemovalRatio`, `WALL.lowerRemovalRatio`, `FLOOR.tier1/2/3EscalateChance`, and `BUILDING.deleteRatio` proportionally.

- **Complexity:** S
- **Impact:** High -- the parameter exists but does nothing; wiring it up gives users real control
- **Dependencies:** None.

### 6e. Interactive Config Builder
A simple terminal UI (using inquirer or similar) that walks users through map configuration with sensible descriptions and ranges for each parameter.

- **Complexity:** M
- **Impact:** Medium
- **Dependencies:** None.

### 6f. Export Format Selection
Allow choosing which formats to export via CLI flags: `--format glb`, `--format obj`, `--format both`. Currently both are always generated.

- **Complexity:** S
- **Impact:** Low -- saves time when only one format is needed
- **Dependencies:** None.

### 6g. Custom Texture Pack Support
Document the texture pack format and validate custom packs at startup. Currently packs must follow the exact folder structure with no error messages if files are missing.

- **Complexity:** S
- **Impact:** Medium -- enables community texture packs
- **Dependencies:** None.

---

## Priority Tiers

**Do first** (high impact, low-medium complexity):
1. 6d - Wire up damageLevel parameter (S, it already exists but is inert)
2. 3a - Deployment zones (S, critical for gameplay)
3. 4a - Mesh merging by material (S, function already written)
4. 6a - Config presets (S, quality of life)
5. 3b - Objective markers (S, high gameplay value)
6. 6b - Map thumbnail generation (M, fastest evaluation method)

**Do second** (high impact, medium complexity):
7. 1b - Bridges between buildings (M, dramatic terrain feature)
8. 3c - Sightline analysis (M, game balance)
9. 1f - City layout presets (M, replay variety)
10. 5a - Web preview (M, already stubbed out)
11. 2c - Jagged broken wall edges (M, biggest visual improvement)
12. 5b - TTS save file generation (M, removes manual import step)

**Do later** (high impact but large scope, or medium impact):
13. 1a - L/T-shaped buildings (M)
14. 1d - Elevation changes (L)
15. 3d - Balanced cover distribution (M)
16. 1e - Water features (M)
17. 1c - Archways (M)
18. 1i - Interior rooms (L)

**Nice to have:**
19. Everything else -- worth doing but lower priority relative to the above.
