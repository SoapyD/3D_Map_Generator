# Vertex Budget System — Project Plan

TTS imposes a hard limit of **25,000 vertices** per OBJ. Seed 42 produces 24,672 (98.7% of budget), seed 100 produces 18,752 (75%). The system needs to guarantee every seed stays under the limit while preserving visual quality and gameplay.

---

## 1. Where Vertices Come From

Every call to `addSubBox` in `obj-exporter.js` emits **8 vertices per subdivision segment**. Each edge face emits **4 vertices**. Ladder meshes call `addSubBox` for 2 stiles + N rungs, each with edges.

### Per-Object Vertex Costs

| Element | Subdivision | Verts per segment | Edge faces | Edge verts | Typical count | Notes |
|---------|------------|-------------------|------------|------------|---------------|-------|
| **Base floor** | ceil(48/3) x ceil(48/3) = 16x16 = 256 segs | 8 each = **2,048** | 4 perimeter edges | 16 | ~**2,064** | Single 48x48 slab, always present |
| **Building floors** (tier 1+) | ceil(w/3) x ceil(d/3) segs per section, 8 verts each | 8 | 4 adjacency-aware edges per section (only exposed gaps) | 4 each | **Highly variable** | Merged quadrants reduce section count. Typical: 40-80 sections x ~16-32 verts = 640-2,560 body + edges |
| **Floor edges** | N/A (flat quads) | N/A | 4 verts per gap per side, double-sided (front+back) | 4 per gap | **Variable** | `addFloorEdges` checks adjacency; only exposed edges get geometry. Easily 200-600 edge faces = 800-2,400 verts |
| **Walls** | ceil(length/3) x ceil(height/3) segs, 8 verts each | 8 | Top (always) + bottom (always) + 0-2 side edges | 4 each | **Large** | Each wall segment: 1-2 body segs (8-16) + 2-4 edges (8-16). 100-200 wall segments x ~20 = 2,000-4,000 |
| **Wall edges** | N/A | N/A | Top + bottom always; sides only if no adjacent wall | 4 each | Included above | Top/bottom always rendered = 2 edge faces per wall. Side edges conditional on `wallEdgeCovered`. |
| **Walkways** | ceil(w/3) x ceil(d/3) segs + 4 perimeter edges | 8 body + 4 edge | `showEdges=true` so 4 perimeter faces | 4 each | **Moderate** | ~8-15 walkways, each ~8-24 body + 16 edge = 24-40 verts. Total: ~200-600 |
| **Cover** (rooftop + ground) | 1x1 segs (small objects < 3") + 4 perimeter edges | 8 body | 4 edges | 4 each | **Moderate** | ~15-30 pieces x (8 + 16) = 24 each = 360-720 |
| **Interior cover** | 1x1 segs + 4 edges | 8 + 16 | 4 edges | 4 each | **Small** | ~5-15 pieces x 24 = 120-360 |
| **Courtyards** (deleted footprints) | ceil(w/3) x ceil(d/3) + 4 edges | 8 per seg | 4 edges | 4 each | **Moderate** | ~3-8 courtyards, larger ones (w+1.5, d+1.5) can be 2x2 = 4 segs = 32 + 16 edge = 48. Total: 150-400 |
| **Street scatter** | 1x1 segs + 4 edges | 8 + 16 | 4 edges | 4 each | **Small-Moderate** | Up to 20 pieces x 24 = 480 |
| **Ladders** (all types) | 2 stiles + N rungs, each with edges | 8 + 16 per piece | Each stile/rung gets `showEdges=true` | 4 each | **Expensive** | Per ladder: 2 stiles (48 verts) + ~3-8 rungs (24 each = 72-192). Total per ladder: ~120-240. 15-30 ladders = **1,800-7,200** |
| **Ladder platforms** | ceil(2/3)=1 seg + 4 edges | 8 + 16 | 4 edges | 4 each | **Moderate** | ~5-20 platforms x 24 = 120-480 |

### Estimated Budget Breakdown (seed 42 ~ 24,672 verts)

| Category | Estimated Verts | % of Budget |
|----------|----------------|-------------|
| Base floor | ~2,064 | 8% |
| Building floors (body) | ~1,500-2,500 | 8% |
| Building floor edges | ~800-2,400 | 7% |
| Walls (body) | ~2,000-3,500 | 11% |
| Wall edges (top/bottom/sides) | ~1,500-3,000 | 9% |
| Walkways | ~200-600 | 2% |
| Cover (all types) | ~500-1,100 | 4% |
| Courtyards | ~150-400 | 2% |
| Street scatter | ~300-480 | 2% |
| **Ladders (all types)** | **3,000-7,000** | **20-28%** |
| Ladder platforms | ~120-480 | 2% |
| **Total** | **~12,000-24,000** | |

Ladders are the single biggest variable cost due to their mesh complexity (stiles + rungs + edges on every piece).

---

## 2. Vertex Budget System Strategy

### 2.1 Counting Phase

Add a vertex counter to `obj-exporter.js` that tracks allocations during export. The counter increments inside `addSubBox` and `addEdgeFace`/`addEdge`/`addWallEdge`.

```
let vertexCount = 0;

// In addSubBox, after each segment:
vertexCount += 8;

// In edge face functions:
vertexCount += 4;
```

### 2.2 Two-Pass Architecture

**Pass 1 — Audit:** Run the OBJ export logic in "dry run" mode (or compute vertex costs from the pipeline data without building OBJ strings). This gives an exact total before any geometry is written.

**Pass 2 — Export with budget:** If Pass 1 exceeds the limit, apply reduction strategies in priority order until the budget fits, then run the real export.

### 2.3 Pre-Computation Cost Functions

Add helper functions that predict vertex cost without generating geometry:

```js
function floorVertexCost(section, slabThickness) {
  const segsX = Math.max(1, Math.ceil(section.w / SEG_SIZE));
  const segsZ = Math.max(1, Math.ceil(section.d / SEG_SIZE));
  return segsX * segsZ * 8; // body only, edges computed separately
}

function wallVertexCost(wall) {
  const wx = wall.axis === 'x' ? wall.length : wall.thickness;
  const wz = wall.axis === 'z' ? wall.length : wall.thickness;
  // Determine which branch: isWallX, isWallZ, isFloor
  const segs = /* compute based on branch */ ;
  return segs * 8;
}

function ladderVertexCost(ladder) {
  const height = ladder.y1 - ladder.y0;
  const rungCount = Math.floor(height / RUNG_SPACING);
  const pieces = 2 + rungCount; // 2 stiles + rungs
  return pieces * (8 + 16); // body + 4 edge faces at 4 verts each
}
```

---

## 3. Reduction Priority — What to Cut First

Ordered from **least visual/gameplay impact** to **most important to preserve**.

### Tier 1 — Cut First (Cosmetic, Low Impact)

1. **Wall bottom edges** — The underside of wall segments (the `addWallEdge` call for `y0` face). These face downward and are almost never visible from gameplay camera angles. Saves **4 verts per wall segment** (~400-800 total).

2. **Wall side edges where adjacent wall is nearby but not touching** — Relax the `wallEdgeCovered` margin from 0.5 to 1.0 to suppress more side edges. Saves ~200-400 verts.

3. **Street scatter reduction** — Drop from 20 to 10 pieces. These are purely cosmetic ground clutter. Saves ~240 verts.

4. **Courtyard edge faces** — Remove the 4 perimeter edge faces from courtyard slabs (they are only 0.1" thick, edges are nearly invisible). Saves ~100-200 verts.

5. **Floor edge suppression on base floor** — The base floor is at ground level; its 0.5" edge faces sit below almost everything. Saves ~64 verts (4 edge faces x 4 verts x 4 sides, but base floor only has the one section).

### Tier 2 — Cut Next (Moderate Impact)

6. **Ladder rung reduction** — Increase `RUNG_SPACING` from 0.75" to 1.0" or 1.5" under budget pressure. A 12" ladder drops from 16 rungs to 8 (saves ~192 verts per ladder, ~1,500-3,000 total). Ladders still read as ladders.

7. **Ladder edge removal** — Generate stiles and rungs without `showEdges=true`. Each ladder piece loses 16 edge verts. Per ladder with 10 pieces: saves ~160 verts. Total: ~2,000-4,000. The pieces are so small that edge faces contribute minimally.

8. **Interior cover reduction** — Cap at 1 per floor instead of 1-3. Saves ~120-360 verts.

9. **Rooftop cover reduction** — Lower `rooftopChance` from 0.5 to 0.25. Saves ~100-300 verts.

### Tier 3 — Cut Reluctantly (Visible but Acceptable)

10. **Walkway edge reduction** — Remove bottom face from walkways (facing down, rarely visible). Saves ~4 verts per walkway x ~10 = 40 verts. Minimal.

11. **Ladder platform edge removal** — Generate platforms without edges. Saves ~16 verts each x ~10 = 160 verts.

12. **Additional ladder culling** — Reduce `ladderCullRatio` from 0.6 to 0.4. Removes whole ladders. Each ladder removal saves ~120-240 verts. Be cautious: this affects reachability.

### Tier 4 — Last Resort (Gameplay Impact)

13. **Reduce building count** — Increase `deleteRatio` from 0.20 to 0.30. Removes buildings entirely, which reduces floors, walls, ladders, and cover all at once. Each building removal cascades into significant vertex savings (~200-500 verts per building across all geometry types).

14. **Reduce max tiers** — Cap `tiers` at 3 instead of 4. Massive reduction but changes map character.

15. **Remove walkways** — Extreme measure. Would need alternative connectivity.

---

## 4. Graceful Degradation Approach

### 4.1 Budget Allocation Model

Reserve vertex budget by category with fixed minimums:

```js
const VERTEX_LIMIT = 25000;
const SAFETY_MARGIN = 500; // keep 500 verts as buffer
const EFFECTIVE_LIMIT = VERTEX_LIMIT - SAFETY_MARGIN;

const BUDGET = {
  baseFloor: 2100,      // fixed, non-negotiable
  buildingFloors: null,  // computed, can reduce edges
  walls: null,           // computed, can reduce edges
  walkways: null,        // computed, small
  cover: null,           // computed, can reduce count
  ladders: null,         // computed, biggest lever
  platforms: null,       // computed, can cut edges
  courtyards: null,      // computed, can cut edges
  streetScatter: null,   // computed, can reduce count
};
```

### 4.2 Reduction Loop

```
1. Compute total vertex cost (dry run)
2. If total <= EFFECTIVE_LIMIT: export as-is
3. If total > EFFECTIVE_LIMIT:
   a. Calculate overage = total - EFFECTIVE_LIMIT
   b. Apply Tier 1 cuts (edges), recalculate savings
   c. If still over: apply Tier 2 cuts (rung spacing, ladder edges)
   d. If still over: apply Tier 3 cuts (cover reduction)
   e. If still over: apply Tier 4 cuts (building/tier reduction)
   f. Log what was cut and by how much
4. Export with applied reductions
```

### 4.3 Configuration Flags

Add to `config.js`:

```js
export const VERTEX_BUDGET = {
  limit: 25000,
  safetyMargin: 500,
  // Reduction toggles — set automatically by budget system
  suppressWallBottomEdges: false,
  suppressCourtyardEdges: false,
  suppressBaseFloorEdges: false,
  ladderRungSpacing: 0.75,    // increases under pressure
  ladderShowEdges: true,       // set false under pressure
  maxStreetScatter: 20,        // decreases under pressure
  maxRooftopChance: 0.5,       // decreases under pressure
};
```

---

## 5. Edge Cases and Oddities

### 5.1 Visual Oddities

- **Removing floor edges makes elevated platforms look paper-thin.** Floor edges are what give slabs their visible thickness. Removing them selectively (e.g., only on lower tiers or interior floors) could look inconsistent. Recommendation: if floor edges must be cut, cut them uniformly per tier rather than per-section.

- **Removing wall bottom edges creates a visible gap.** Wall bottom edges are less visible but if the camera goes below floor level (e.g., TTS camera), the missing bottom face creates a "floating wall" effect. May need to keep bottom edges on ground-tier walls specifically.

- **Ladder rung spacing changes are noticeable side-by-side.** If players compare maps, different rung densities might look odd. Consider using a fixed reduced spacing (1.0") rather than a variable one.

- **Removing edges from small objects (cover, rungs) has near-zero visual impact.** These items are so small that edges contribute almost no visible surface area. This is the safest cut.

### 5.2 Gameplay Concerns

- **Removing cover affects gameplay balance.** Cover provides line-of-sight blocking. If street scatter or rooftop cover is reduced, open sightlines increase. Log the reduction so players know.

- **Removing ladders affects reachability.** The connectivity system already does its own culling. Additional budget-driven culling could make upper tiers unreachable. The budget system must NOT remove a ladder that is the only path to a floor section.

- **Walkways are gameplay-critical.** They connect separate buildings at the same tier. Removing them is a last resort.

### 5.3 Seed Variability

- **Some seeds generate more buildings than others.** Layout 4 (4 medium buildings) displaces more small buildings than layout 0 (1 large), so layout 4 seeds tend to have fewer total buildings and lower vertex counts.

- **Damage level affects wall count.** Higher `damageLevel` removes more wall quadrants, reducing wall vertex count. Low damage maps are more likely to exceed the budget.

- **Tall buildings cascade.** A single tall building generates floors, walls, ladders, and cover across 4 tiers. The vertex cost of one `maxTier: 4` building is roughly 3x that of a `maxTier: 2` building.

### 5.4 Double-Sided Edge Rendering

The current edge face code emits **double-sided faces** (front + back normals, 4 faces total per edge). This means every edge face costs 4 vertices but renders 4 triangles. If TTS only needs single-sided rendering, halving edge faces would save significant vertices with no visual loss from the normal camera angle. This would need testing in TTS to confirm.

### 5.5 Subdivision Granularity

The current SEG_SIZE of 3" means a 6" wall generates 2 segments (16 verts) instead of 1 (8 verts). For budget pressure, increasing SEG_SIZE to 6" would halve floor and wall body vertices, but would break the UV tiling system (textures mapped per 3" segment). This approach requires changes to the UV calculation and atlas system and should be considered only as a nuclear option.

---

## 6. Implementation Steps

### Phase 1 — Instrumentation (Low Risk)

1. **Add vertex counter to `obj-exporter.js`.** Increment a counter in every place vertices are emitted. Print the total at the end of export alongside the existing log output. No behaviour changes.

2. **Add per-category counters.** Track vertices separately for: base floor, building floors, floor edges, walls, wall edges, walkways, cover, interior cover, courtyards, street scatter, ladders (per type), ladder platforms. Print a breakdown table.

3. **Test across seeds.** Run 20+ seeds and collect the breakdown data. Confirm which categories are the biggest contributors and which seeds are closest to the limit.

### Phase 2 — Cost Prediction Functions

4. **Create `src/export/vertex-budget.js`.** Functions to predict vertex cost from pipeline data without generating OBJ strings. One function per geometry category.

5. **Add `computeVertexBudget(data, config)` function.** Takes the same pipeline data and config that `exportToObj` takes, returns a category breakdown and total.

6. **Validate predictions.** Compare predicted costs vs actual counted costs across test seeds. Fix any discrepancies.

### Phase 3 — Edge Reduction

7. **Add `showEdges` parameter control.** Currently `addSubBox` takes `showEdges` as a parameter. Add budget-driven flags that suppress edges on specific categories:
   - `suppressWallBottomEdges` — skip the bottom `addWallEdge` call
   - `suppressWallSideEdges` — relax `wallEdgeCovered` margin
   - `suppressCourtyardEdges` — pass `false` for courtyard `showEdges`
   - `suppressLadderEdges` — pass `false` for ladder stile/rung `showEdges`

8. **Wire flags into the export function.** The budget system sets flags; the export function reads them.

### Phase 4 — Ladder Optimization

9. **Make rung spacing configurable per-export.** Pass `rungSpacing` through to `addLadderMesh` instead of using the constant. Budget system can increase it.

10. **Test visual impact.** Compare 0.75" vs 1.0" vs 1.5" rung spacing in TTS. Document acceptable threshold.

### Phase 5 — Content Reduction

11. **Add budget-aware street scatter cap.** In the export function, truncate `streetScatter` array if over budget.

12. **Add budget-aware cover reduction.** Reduce `rooftopChance` retroactively by randomly dropping cover pieces.

13. **Add budget-aware ladder culling.** Additional culling pass that removes ladders with the least connectivity impact (redundant paths first).

### Phase 6 — Budget Controller

14. **Create budget controller in `obj-exporter.js`.** Before the export loop:
    ```
    const predicted = computeVertexBudget(data, config);
    const reductions = planReductions(predicted, EFFECTIVE_LIMIT);
    applyReductions(reductions, data, exportConfig);
    ```

15. **Log reductions.** Print what was cut: "Reduced rung spacing to 1.0", "Removed ladder edges", "Capped street scatter at 12", etc.

16. **Test across all seeds 1-200.** Verify no seed exceeds 25,000. Verify no seed has inaccessible tiers due to over-culling.

### Phase 7 — Polish

17. **Add `--vertex-budget` CLI flag.** Allow overriding the 25,000 limit (e.g., for non-TTS exports).

18. **Add vertex count to output log.** Always print "Vertices: 23,456 / 25,000 (93.8%)" so the user knows headroom.

19. **Add budget breakdown to `--debug` output.** Print the full category table when debug mode is enabled.
