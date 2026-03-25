# Implementation Phases

## Phase 1: Foundation & Floor Generation

**Goal**: Generate flat floor slabs with cutouts and export a viewable 3D file.

### Tasks:
1. Project scaffolding (package.json, folder structure, ESM setup)
2. Seed-based RNG utility
3. BSP grid partitioner — divide map into city blocks + streets
4. Building footprint generator — place rectangular buildings in blocks
5. Floor plate generator — create tier 0-N slab shapes with damage cutouts
6. Three.js geometry builder — extrude 2D shapes into 3D slabs
7. GLB exporter — write geometry to file
8. CLI entry point with basic args (seed, size, tiers)
9. Preview server — simple HTTP server to view output in browser via Three.js

### Deliverable:
`node generate.js --seed 42` outputs a GLB of stacked floor slabs with ruined cutout shapes. Viewable in any GLB viewer or the preview server.

---

## Phase 2: Walls

**Goal**: Add vertical wall elements to buildings.

### Tasks:
1. Wall placement logic — trace floor plate edges, place walls
2. Wall damage — doorways, windows, broken tops
3. Interior wall subdivision
4. Integrate into pipeline after floor generation

### Deliverable:
GLB now includes walls with openings. Starting to look like ruined buildings.

---

## Phase 3: Connectivity

**Goal**: Ensure all elevated areas are reachable.

### Tasks:
1. Build floor section graph (nodes + adjacency)
2. Flood-fill reachability from ground level
3. Ladder placement algorithm
4. Walkway/bridge generator
5. Validation pass — confirm full connectivity

### Deliverable:
Every elevated platform is reachable via ladders or walkways. Graph connectivity verified.

---

## Phase 4: Sightline Analysis & Cover

**Goal**: Break up excessively long lines of sight.

### Tasks:
1. Sightline sampling — cast rays between sample points
2. Flag long sightlines (> configurable threshold)
3. Cover element generator (wall fragments, barricades, rubble)
4. Placement algorithm — break flagged sightlines without over-cluttering
5. Iterative pass — place, re-check, repeat

### Deliverable:
No unbroken sightline exceeds the configured maximum.

---

## Phase 5: Texturing & Polish

**Goal**: Apply textures and visual polish.

### Tasks:
1. Create/source a basic texture set (stone, brick, wood, rubble)
2. UV mapping for axis-aligned geometry
3. Material assignment by element type
4. Texture embedding in GLB
5. Optional: edge highlighting / painted-edge effect for the cardboard look

### Deliverable:
Textured GLB file ready for TTS import.

---

## Phase 6: TTS Integration & Tuning

**Goal**: Verify everything works end-to-end in Tabletop Simulator.

### Tasks:
1. Import testing in TTS
2. Scale verification (1 inch = 1 TTS inch)
3. Model placement testing on all surfaces
4. Adjust geometry if any tipping issues arise
5. Performance testing (polygon count, load times)
6. Generation parameter tuning for good Mordheim gameplay

### Deliverable:
Fully playable Mordheim map imported into TTS.
