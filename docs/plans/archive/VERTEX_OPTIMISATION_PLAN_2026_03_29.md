# Vertex Optimisation Plan

**Date:** 2026-03-29
**Completed:** 2026-03-29
**Status:** Archived
**Outcome:** Reduced seed 42 from 24,672 to 13,943 vertices (43.5% reduction). Collision mesh reduced from 4,032 to 1,504 (62.7%). Both well under the 25,000 TTS limit with room for future content.

---

## Summary

The OBJ export subdivided all geometry into independent 3" segment boxes, creating thousands of duplicate vertices at internal boundaries. By using shared vertex grids with per-face UV indices, internal boundary vertices were eliminated. Additional savings from ladder edge removal, bottom face culling, dedicated ladder box emitter, and collision mesh simplification.

---

## Final Results (seed 42)

| Optimisation | Vertices | Saving |
|---|---|---|
| Original | 24,672 | — |
| Ladder edge face removal | 18,736 | -5,936 |
| Shared vertex grids — floors | ~-1,759 | — |
| Shared vertex grids — walls | ~-676 | — |
| Shared vertex grids — walkways/platforms | ~-216 | — |
| Cover/scatter/courtyard bottom face culling | ~-248 | — |
| Base floor simple bottom quad | ~-285 | — |
| Dedicated ladder box emitter (fixes thin-axis misdetection) | — | — |
| **Final (3D ladders)** | **13,943** | **-10,729 (43.5%)** |
| **Final (flat ladders)** | **12,459** | **-12,213 (49.5%)** |

**Collision mesh:** 4,032 → 1,504 (single bounding box per surface, no subdivision)

## Implementation Details

### What was implemented

1. **`addSharedFlat()`** — grid vertex emitter for horizontal surfaces (floors, walkways, platforms, courtyards, cover). Emits (segsX+1)×(segsZ+1) position verts with per-tile UV indices. Supports `emitBottom` and `simpleBottom` flags.

2. **`addSharedWall()`** — grid vertex emitter for walls. Uses thin-axis detection (`sizeX < 1` / `sizeZ < 1`) instead of `wall.axis` property. Emits front + back face grids.

3. **`addLadderBox()`** — dedicated 8-vert, 6-face box emitter for 3D ladder parts. Bypasses `addSubBox` which misdetected ladder dimensions due to multiple thin axes.

4. **`addVerticalQuad()`** — flat front-facing quad for 2D ladder mode. Offsets away from nearest wall to prevent z-fighting.

5. **`flatLadders` config toggle** — switches between 3D boxes and flat quads.

6. **Ladder texture mapping** — both modes now use full tile-spanning UVs instead of centre-point.

7. **Collision mesh** — rewritten to emit single bounding boxes (8 verts) per surface instead of dumping Three.js BoxGeometry (24 verts).

### What was tried and reverted

- **Bottom face culling on building floors/walkways** — reverted because players look up from below and see through missing faces.
- **Wall back face culling** — reverted because walls are visible from both sides through damaged sections.
- **Flat quad rungs** — reverted in favour of keeping rungs as 3D boxes; rung spacing increase was rejected as unnecessary.

### Key lessons

- `wall.axis` property is counterintuitive — `axis: 'z'` means the wall sits on a Z edge, not that it runs along Z. Always use thin-axis detection instead.
- `addSubBox` misdetects geometry when multiple dimensions are < 1 (ladder parts). Dedicated emitters are safer for small geometry.
- Edge faces were already minimal (single quads per edge) — no further optimisation possible there.
- TTS handles shared vertex/UV indices correctly — no compatibility issues.

---

## Items

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Ladder edge face removal | Done | -5,936 verts, zero visual impact |
| 2 | Shared vertex grids — base floor | Done | -1,759 verts, grid approach |
| 3 | Shared vertex grids — building floors | Done | via addSharedFlat |
| 4 | Shared vertex grids — walls | Done | via addSharedWall, thin-axis detection |
| 5 | Shared vertex grids — walkways/platforms | Done | via addSharedFlat |
| 6 | Cover/scatter/courtyard bottom face culling | Done | emitBottom=false |
| 7 | Base floor simple bottom quad | Done | simpleBottom flag |
| 8 | Collision mesh simplification | Done | 8 verts per surface |
| 9 | Dedicated ladder box emitter | Done | fixes thin-axis misdetection |
| 10 | Flat ladder mode with config toggle | Done | flatLadders config |
| 11 | Ladder texture mapping (full tile UVs) | Done | both 2D and 3D modes |
| 12 | Flat ladder wall-aware offset | Done | offsets away from nearest wall |
