# Vertex Budget System — Project Plan

**Date:** 2026-03-29
**Updated:** 2026-03-29 (post vertex optimisation)

TTS imposes a hard limit of **25,000 vertices** per OBJ. After the vertex optimisation work, seed 42 now produces **13,943** (55.7% of budget) in 3D ladder mode, or **12,459** (49.8%) in flat ladder mode. Seed 100 produces **~11,000**. There is significant headroom, but a budget system is still valuable as a safety net for future content additions and edge-case seeds.

---

## 1. Current Vertex Sources (post-optimisation)

### How geometry is emitted

| Function | Used for | Technique | Verts per unit |
|---|---|---|---|
| `addSharedFlat()` | Floors, walkways, platforms, courtyards, cover, scatter | Grid of position verts, per-tile UV indices | (segsX+1)×(segsZ+1) per face |
| `addSharedWall()` | Walls | Grid verts, thin-axis detection | (segsL+1)×(segsH+1) per face × 2 faces |
| `addLadderBox()` | 3D ladder stiles + rungs | Full 8-vert box, 6 faces, tile-spanning UVs | 8 per piece |
| `addVerticalQuad()` | Flat ladder stiles + rungs | 4-vert double-sided quad, tile-spanning UVs | 4 per piece |
| `addFloorEdges()` | Building floor perimeter edges | Single quad per gap (adjacency-aware) | 4 per edge |
| `addWallEdge()` | Wall top/bottom/side edges | Single quad per edge | 4 per edge |
| `addPerimeterEdges()` | Walkway/cover/scatter/courtyard/platform edges | 4 quads per object | 16 per object |

### Estimated Budget Breakdown (seed 42 = 13,943 verts, 3D ladders)

| Category | Estimated Verts | % of Total | Notes |
|----------|----------------|------------|-------|
| Base floor (top grid + simple bottom) | ~293 | 2% | 17×17 grid top + 4 bottom |
| Building floors (grids + edges) | ~2,500 | 18% | Shared grids, adjacency-aware edges |
| Walls (grids + edges) | ~3,800 | 27% | Shared wall grids + top/bottom/side edges |
| Walkways (grids + edges) | ~450 | 3% | Small surfaces, perimeter edges |
| Cover + interior cover + scatter | ~900 | 6% | Mostly 1-segment, bottom culled, perimeter edges |
| Courtyards | ~200 | 1% | Bottom culled, perimeter edges |
| Ladders (3D mode) | ~2,968 | 21% | 8 verts per stile/rung, no edge faces |
| Ladder platforms | ~450 | 3% | Shared grids + perimeter edges |
| **Total** | **~13,943** | | |

### Key changes from pre-optimisation

- Floors/walkways/platforms/courtyards use `addSharedFlat` — grid verts instead of per-segment boxes
- Walls use `addSharedWall` — grid verts with correct thin-axis detection
- Ladder edge faces removed (`showEdges=false`)
- Ladder stiles/rungs use dedicated `addLadderBox` (avoids `addSubBox` thin-axis misdetection)
- Cover/scatter/courtyard bottom faces culled
- Base floor bottom is a single 4-vert quad
- Collision mesh uses single bounding boxes (8 verts per surface)
- `flatLadders` config toggle for additional savings (~1,484 verts)

---

## 2. Budget System Strategy

### 2.1 When is it needed?

With current headroom (~11k spare), the budget system is a **safety net** rather than an active requirement. It becomes critical if:
- Map size increases beyond 48×48
- New geometry types are added (bridges, interior walls, rubble)
- Tier count increases
- Building density increases

### 2.2 Two-Pass Architecture (unchanged)

**Pass 1 — Predict:** Compute vertex cost from pipeline data without generating OBJ.
**Pass 2 — Export:** If under limit, export as-is. If over, apply reductions then export.

### 2.3 Cost Prediction Functions

These need updating to match the new emission functions:

```js
function floorVertexCost(section) {
  const segsX = Math.max(1, Math.ceil(section.w / SEG_SIZE));
  const segsZ = Math.max(1, Math.ceil(section.d / SEG_SIZE));
  const topGrid = (segsX + 1) * (segsZ + 1);
  const bottomGrid = topGrid; // skip if emitBottom=false
  return topGrid + bottomGrid;
}

function wallVertexCost(wall) {
  const len = wall.length;
  const segsL = Math.max(1, Math.ceil(len / SEG_SIZE));
  const segsH = Math.max(1, Math.ceil(wall.height / SEG_SIZE));
  return (segsL + 1) * (segsH + 1) * 2; // front + back grids
}

function ladderVertexCost(ladder, flat) {
  const height = ladder.y1 - ladder.y0;
  const rungCount = countRungs(height);
  const pieces = 2 + rungCount;
  return pieces * (flat ? 4 : 8); // flat quad vs full box
}
```

---

## 3. Reduction Priority (revised)

With the optimisations already applied, the remaining levers are:

### Tier 1 — Easy Wins (if needed)

1. **Switch to flat ladders** — `flatLadders: true` saves ~1,484 verts with minimal visual impact at TTS zoom. Already implemented, just a config toggle.

2. **Reduce street scatter count** — Drop from 20 to 10. Saves ~240 verts. Purely cosmetic.

3. **Remove courtyard perimeter edges** — Courtyards are 0.1" thick, edges invisible. Saves ~80 verts.

### Tier 2 — Moderate Impact

4. **Increase rung spacing** — From 0.75" to 1.5" halves rung count. Saves ~1,080 verts (3D) or ~540 (flat).

5. **Reduce cover counts** — Lower `rooftopChance`, cap interior cover. Saves ~200-400 verts.

6. **Remove wall bottom edges** — Faces downward, rarely visible. Saves ~400-800 verts.

### Tier 3 — Last Resort

7. **Reduce building count** — Increase delete ratio. Cascading savings across all geometry.

8. **Reduce max tiers** — Cap at 3 instead of 4.

---

## 4. Implementation Steps

### Phase 1 — Instrumentation

1. Add vertex counter to `obj-exporter.js` that prints total and per-category breakdown.
2. Add vertex count to standard output: `Vertices: 13,943 / 25,000 (55.8%)`.
3. Add breakdown table to `--debug` output.

### Phase 2 — Cost Prediction

4. Create `src/export/vertex-budget.js` with prediction functions matching the new emission logic.
5. Validate predictions against actual counts across 20+ seeds.

### Phase 3 — Budget Controller

6. If predicted total exceeds limit, apply reductions in tier order.
7. Log what was cut.
8. Test across seeds 1-200 to verify no seed exceeds 25,000.

### Phase 4 — CLI Integration

9. Add `--vertex-budget N` flag to override the 25k limit.
10. Always print vertex count in output log.
11. The `check-vertex-count` hook already warns at 23k and errors at 25k.

---

## 5. Edge Cases

- **Flat ladders + wall offset:** Flat ladders offset away from nearest wall. If no wall is found, they offset in positive direction. This could be wrong for freestanding orange ladders — but these are rare and the offset is small (0.15").
- **Shared wall thin-axis detection:** Must use `sizeX < 1` / `sizeZ < 1`, NOT `wall.axis`. The `axis` property naming is counterintuitive.
- **addSubBox thin-axis misdetection:** Ladder parts have multiple dimensions < 1, causing wrong face emission. Always use `addLadderBox` for ladder geometry.
- **Reachability after ladder culling:** Budget-driven ladder removal must not create unreachable floor sections. Check reachability after culling.
