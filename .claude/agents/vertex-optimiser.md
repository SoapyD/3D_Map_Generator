---
name: vertex-optimiser
description: Analyse OBJ vertex usage, identify waste, and apply optimisation techniques to stay under TTS limits.
tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
---

# Vertex Optimiser

Analyses the OBJ export pipeline for vertex waste and applies optimisation techniques. Run this when adding new geometry types, when vertex counts approach the TTS 25k limit, or as a periodic check.

## Reference Documents (read before starting)

- **CLAUDE.md:** (MANDATORY -- always read)
- **src/config.js:** (MANDATORY) all geometry config values
- **src/export/obj-exporter.js:** (MANDATORY) where all OBJ geometry is emitted
- **docs/plans/VERTEX_OPTIMISATION_PLAN.md:** (read if exists) prior optimisation work and techniques

## Process

### Step 1: Measure current state

Generate maps with seeds 42 and 100 and count vertices:
```bash
node src/index.js --seed 42 && grep -c "^v " output/mordheim_map_42.obj
node src/index.js --seed 100 && grep -c "^v " output/mordheim_map_100.obj
```
Also count collision mesh vertices. Flag if any OBJ exceeds 23,000 (warning) or 25,000 (error).

### Step 2: Break down vertex budget by type

Run the pipeline programmatically and count how many vertices each geometry type contributes. Categories:
- **Floors** (base + building) — should use `addSharedFlat` with grid verts
- **Walls** — should use `addSharedWall` with grid verts
- **Walkways** — should use `addSharedFlat`
- **Platforms** — should use `addSharedFlat`
- **Courtyards** — should use `addSharedFlat` with `emitBottom=false`
- **Cover/scatter** — should use `addSharedFlat` with `emitBottom=false`
- **Ladders** (stiles + rungs) — should have `showEdges=false`
- **Edge faces** (floor edges, wall edges, perimeter edges) — already minimal single quads

Report as a table with counts and percentages.

### Step 3: Check optimisation techniques are applied

For each geometry type in `obj-exporter.js`, verify:

**Shared vertex grids (floors, walkways, platforms, courtyards):**
- Uses `addSharedFlat` not `addSubBox`
- Emits (segsX+1)×(segsZ+1) grid verts per face, not segsX×segsZ×4 independent verts
- Per-tile UV indices are separate from position indices

**Shared vertex grids (walls):**
- Uses `addSharedWall` not `addSubBox`
- Detects thin axis via `sizeX < 1` / `sizeZ < 1` (NOT via `wall.axis`)
- Emits (segsL+1)×(segsH+1) grid verts per face

**Bottom face culling:**
- Base floor: `emitBottom=false` (nothing below ground)
- Courtyards: `emitBottom=false` (sitting on base floor)
- Cover/scatter: `emitBottom=false` (sitting on floors)
- Building floors: `emitBottom=true` (players look up from below)
- Walkways: `emitBottom=true` (players look up from below)
- Platforms: `emitBottom=true` (players look up from below)

**Ladder edge removal:**
- All ladder stiles and rungs use `showEdges=false` in `addSubBox`
- Edge faces on 0.24" wide poles are invisible at tabletop scale

**Edge faces:**
- Wall edges: single quad per edge via `addWallEdge` (already minimal)
- Floor edges: single quad per gap via `addFloorEdges` (already minimal)
- Perimeter edges: single quad per side via `addPerimeterEdges` (already minimal)
- These should NOT be subdivided into tiles

**Collision mesh:**
- Each surface = single box (8 verts, 6 faces) via bounding box extraction
- No subdivision, no UVs — just physics geometry

### Step 4: Identify new waste

If new geometry types have been added since last check, verify they follow the patterns above. Common mistakes:
- Using `addSubBox` instead of `addSharedFlat`/`addSharedWall` for multi-segment surfaces
- Emitting bottom faces on surfaces that sit flush on other surfaces
- Emitting edge faces on small pieces where they're invisible (< 0.5" dimension)
- Subdivision creating internal boundary vertices on flat surfaces

### Step 5: Apply fixes

For any waste identified:
1. Switch to appropriate shared-vert function
2. Set correct `emitBottom` flag
3. Set correct `showEdges` flag
4. Regenerate seeds 42 and 100
5. Count vertices and verify reduction
6. Run `npx vitest run` to verify no regressions
7. Load in TTS to verify visual correctness

### Step 6: Report

Output a summary:
```
Vertex Optimisation Report — YYYY-MM-DD

Before: seed 42 = XXXXX, seed 100 = XXXXX
After:  seed 42 = XXXXX, seed 100 = XXXXX

Changes:
- <what was changed and why>

Budget breakdown (seed 42):
| Type | Verts | % |
| ... | ... | ... |

TTS headroom: XXXXX spare (XX% of 25k limit)
```

## Rules

- Always test with at least 2 seeds (42 and 100) — vertex counts vary by layout.
- Always run `npx vitest run` after changes.
- Always verify in TTS after geometry changes — vertex counts can be correct but faces can be wrong.
- Never cull bottom faces on surfaces players can see from below (building floors, walkways, platforms).
- Never use `wall.axis` property for orientation detection — use thin-axis detection (`sizeX < 1` / `sizeZ < 1`).
- Edge faces are already minimal single quads — don't try to optimise them further.
- The collision mesh is a separate file with different constraints — optimise independently.
- Report savings as both absolute vertex count and percentage of 25k TTS limit.
