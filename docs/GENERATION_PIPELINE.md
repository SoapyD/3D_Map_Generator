# Generation Pipeline

> Last verified: 2026-10-10 against `src/pipeline.js`

## Overview

The generator runs as a sequential pipeline. Each stage takes the previous stage's output, enriches it, and returns it. Stages 2–9 also read and write a shared **collision matrix** (1" cells; see `architecture/collision_matrix.md`).

```
Seed → Grid → Buildings → Floors → Roofs → Streets → Connectivity → Ladders → Walls → Cover → Geometry → Scene & Export
```

Order matters: Streets/rivers run before Connectivity (river cells must exist for bridge anchors), and Ladders run after Connectivity but before Walls (ladder door stamps must exist before wall segments are cut).

## Stages

Each stage has a detailed flow doc (input contract, algorithm, output contract, edge cases). **Read the flow doc rather than the source.**

| # | Stage | Summary | Flow doc |
|---|---|---|---|
| 1 | Grid | BSP partition into city blocks, streets and foundations | [1-grid](processes/pipeline-flows/1-grid.md) |
| 2 | Buildings | Treemap fill of each block with BBD-aligned buildings; writes shells to the matrix | [2-buildings](processes/pipeline-flows/2-buildings.md) |
| 3 | Floors | Quadrant-based floor plates per tier with progressive damage | [3-floors](processes/pipeline-flows/3-floors.md) |
| 4 | Roofs | Roof slabs on top of each building | [4-roofs](processes/pipeline-flows/4-roofs.md) |
| 5 | Streets | Rivers (A\*), street surfaces, pavements | [5-streets](processes/pipeline-flows/5-streets.md) |
| 6 | Connectivity | Walkways, bridges, pillars, river crossings | [6-connectivity](processes/pipeline-flows/6-connectivity.md) |
| 7 | Ladders | Ground-to-roof ladder paths, door stamps | [7-ladders](processes/pipeline-flows/7-ladders.md) |
| 8 | Walls | Edge-detected walls with window/blob/row damage | [8-walls](processes/pipeline-flows/8-walls.md) |
| 9 | Cover | Rooftop, courtyard, interior and street scatter | [9-cover](processes/pipeline-flows/9-cover.md) |
| 10 | Geometry | Matrix and stage data → renderer-agnostic primitives | [10-geometry](processes/pipeline-flows/10-geometry.md) |
| 11 | Scene & Export | Three.js scene → GLB; OBJ + atlas; collision OBJ; optional per-tier split | [11-scene-and-export](processes/pipeline-flows/11-scene-and-export.md) |

CLAUDE.md groups these into 7 headline stages (Grid, Buildings, Floors, Walls, Connectivity, Cover, Export). Roofs, Streets, Ladders and Geometry are the finer-grained steps inside that grouping.

## Configuration

All tunable values live in `src/config.js`; see [architecture/docs_and_config_guide.md](architecture/docs_and_config_guide.md) for what each section controls and the CLI flag list in the README.

## Removed from the original design

The original 8-stage design had separate **Sightline Analysis** and **Texturing** stages. They no longer exist as stages: texture assignment happens in Geometry/Scene, and the 24" sightline limit is enforced by design (building layout and cover) rather than by a dedicated pass. The old flow docs are kept in `processes/pipeline-flows/archive/`.
