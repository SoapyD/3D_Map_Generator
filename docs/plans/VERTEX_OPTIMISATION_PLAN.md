# Vertex Optimisation Plan

**Date:** 2026-03-29
**Baseline:** Seed 42 = 18,736 vertices (after ladder edge removal)
**Target:** Maximise headroom under 25,000 TTS limit

---

## Summary

Current OBJ export subdivides all geometry into independent 3" segment boxes. Each segment has 8 position vertices (4 top + 4 bottom). Internal segment boundaries create invisible edges — no player ever sees where one 3" tile meets the next on a flat surface.

### Key Insight

OBJ format separates position indices (`v`) from UV indices (`vt`) on face lines. A floor surface needs only **4 position vertices** (the corners) regardless of how many UV tiles it has. Each tile face references the shared corner positions but its own UV coordinates.

**Estimated total savings: ~6,160 position vertices → new total ~12,576 (seed 42)**

---

## Savings Breakdown (seed 42)

| Surface Type | Count | Current Verts | New Verts | Saving | Notes |
|---|---|---|---|---|---|
| Base floor | 1 | 2,048 | 4 | **-2,044** | Top only, bottom invisible |
| Building floors | 89 | 2,776 | 712 | **-2,064** | Top + bottom (players look up) |
| Walls | 216 | 3,080 | 1,728 | **-1,352** | Front + back (both visible) |
| Walkways | 23 | 400 | 184 | **-216** | Top + bottom |
| Courtyards | 5 | 312 | 20 | **-292** | Top only, bottom on ground |
| Cover/scatter | 44 | 352 | 352 | **0** | Mostly 1 segment already |
| Platforms | 26 | 400 | 208 | **-192** | Top + bottom |
| Ladders | 51 | 2,968 | 2,968 | **0** | Already 1 segment per piece |
| Edge faces | — | 6,400 | 6,400 | **0** | Already minimal |
| **TOTAL** | | **18,736** | **12,576** | **-6,160** | |

### Where the savings come from

- **Base floor: -2,044** — the single biggest win. 16×16 segments collapse to 4 corner verts.
- **Building floors: -2,064** — many are 2×2 or larger after quadrant splitting.
- **Walls: -1,352** — moderate savings, many walls are 2+ segments long.
- **Small objects (cover, ladders): 0** — already 1 segment, can't improve.

---

## Implementation Approach

### Per-surface shared vertex emission

Replace the current per-segment box emission with:

```
For a floor section (w × d):
  1. Emit 4 position verts (top corners): v x0 yTop z0, v x1 yTop z0, v x1 yTop z1, v x0 yTop z1
  2. Emit 4 position verts (bottom corners): v x0 y0 z0, etc. (skip if culled)
  3. For each tile (sx, sz):
     - Emit 4 vt entries with atlas-offset UVs (same logic as now)
     - Emit face referencing the 4 shared position verts but per-tile UVs
  4. Emit normals (1 for top, 1 for bottom)
```

OBJ face format: `f v1/vt1/vn1 v2/vt2/vn1 v3/vt3/vn1` — position and UV indices are independent.

### What stays the same

- UV tiling logic (atlas offsets, per-object hash, rotateUV for walkways)
- Edge face generation (already uses separate minimal verts)
- Ladder meshes (already 1 segment per piece)
- Cover objects (mostly 1 segment)
- Collision mesh export (separate file, not affected)
- GLB export (uses Three.js BoxGeometry, not affected)

### Surfaces to skip bottom face

- Base floor (sitting on nothing)
- Courtyards (sitting on base floor)

### Surfaces to keep both faces

- Building floors (players look up from below)
- Walkways (players look up from below)
- Platforms (players look up from below)
- Cover objects (visible from angles)

---

## Implementation Phases

| Phase | Work | Saving | New Total |
|---|---|---|---|
| 1 | Base floor: 4 shared verts, top only, skip bottom | -2,044 | 16,692 |
| 2 | Building floors: shared corner verts per section | -2,064 | 14,628 |
| 3 | Walls: shared corner verts per segment | -1,352 | 13,276 |
| 4 | Walkways + platforms: shared corner verts | -408 | 12,868 |
| 5 | Courtyards: shared verts, top only | -292 | 12,576 |

Phase 1 is the biggest single win and the simplest (one surface, known dimensions).
Phases 2-5 are the same pattern applied to different surface types.

---

## Risks & Edge Cases

- **UV correctness:** Each face must reference the right UV coordinates for its tile position. The per-face UV index approach is standard OBJ but differs from current per-vertex approach. Must verify atlas sampling is correct after change.
- **TTS compatibility:** Verify TTS handles shared vertex indices correctly. Some importers expect 1:1 vertex-to-UV mapping. If TTS chokes, fall back to the grid approach (shared positions with duplicated UVs per shared vert).
- **Face winding:** With shared verts, face winding must be consistent. Currently each box has its own winding; shared verts need careful index ordering to maintain correct normals.
- **Regression testing:** Run multiple seeds and compare visual output before/after. Vertex count changes but geometry shape must be identical.
