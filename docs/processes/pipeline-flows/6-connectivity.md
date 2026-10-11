# Stage 6: Connectivity

> Last verified: 2026-04-23 (added river crossing anchors)

## Overview

Discovers walkway connection points between buildings by scanning the collision matrix for floor/roof edge labels. Four phases produce a curated set of surviving connections, then stamps doors, rasterises walkways and crossings into the matrix, and places support pillars under long spans. See `docs/plans/archive/CONNECTIVITY_PLAN_V2_2026_04_20.md` for full design rationale.

## Input Contract

```js
data: {
  floors: FloorRecord[],   // from Stage 3 — needed to build cell→buildingId map
  roofs:  RoofRecord[],    // from Stage 4 — same
  buildings: Building[],
  // all prior fields carried forward
}
config: {
  anchorPeriod: number,            // P — grid counter period (default 4)
  // (no maxConnectionLength is passed for ordinary connections: the cap is
  //  floor(max(matrix.W, matrix.D) * CONNECTIVITY.maxLengthMapFraction) cells; 0.5 by default,
  //  1 in the withering profile. River crossings use riverCrossingMaxLength.)
  filterStrategy: string,          // 'longestAndShortest' | 'longest' | 'shortest' | 'random'
  filterN: number,                 // quota per building per tier
  bridgeMinLength: number,         // min length (cells) eligible for bridge type (default 6)
  bridgeLongThreshold: number,     // length at which long-bridge chances apply (default 12)
  riverCrossingMaxLength: number,  // max ray length for river crossing candidates (default 5)
  riverCrossingSpacing: number,    // reserved for future spacing cull (default 3)
}
rng: RNG
matrix: CollisionMatrix
```

## Algorithm

### Phase 1a — Building anchor emission (`emitAnchors`)

For every Y level that contains a floor or roof slab:

**N-S pass** (sweeps columns — outer Z, inner X):
- At every `cx` where `cx % period === 0`, check the pair `(cx, cz)` and `(cx+1, cz)`.
- If both cells carry an N-facing label and both cells one step north are empty → emit an N-facing 2-cell anchor at `(cx, cz-1)` and `(cx+1, cz-1)`.
- Same check for S-facing labels, anchor goes one step south.

**W-E pass** (sweeps rows — outer X, inner Z):
- At every `cz` where `cz % period === 0`, check the pair `(cx, cz)` and `(cx, cz+1)`.
- E-facing: anchor at `(cx+1, cz)` and `(cx+1, cz+1)`. W-facing: anchor at `(cx-1, cz)` and `(cx-1, cz+1)`.

"Empty" means `CELL.EMPTY` (255) or `CELL.SHELL` (0).

Each anchor record:
```js
{
  id: string,           // 'A0001' etc.
  direction: 'N'|'S'|'E'|'W',
  buildingId: string,   // from cell→buildingId map; null if unmapped
  cells: [{ cx, cy, cz }, { cx, cy, cz }],
  tier: cy,
}
```

Trigger cells (the floor-edge cells the anchor fired from) are also recorded separately for debug rendering when `config.visualize` is set.

### Phase 1b — River crossing anchor emission (`emitRiverCrossingAnchors`)

Runs after Phase 1a. For each bank record in `data.rivers[].banks`:
- Anchor direction = `OPPOSITE[bank.facing]` (fires toward the river)
- `cy = Math.floor(-slabThickness / cellSize)` — matches tier-0 floor anchors so walkways sit flush with ground
- Walk along the bank edge checking `cx % anchorPeriod === 0` (WE-axis) or `cz % anchorPeriod === 0` (NS-axis) — same global grid as building anchors
- Emit 2-wide anchor where both cells are `CELL.EMPTY` at that cy
- `buildingId = 'river_crossing'` — flags candidates for dedicated culling in the filter pass

River crossing candidates are paired separately with `maxConnectionLength = 5` (river corridors are 4 cells wide), then merged into the main candidate list before the stacking cull.

### Phase 2 — Anchor pairing (`pairAnchors`)

For each anchor, project a ray outward cell-by-cell in its facing direction. The ray terminates when:
- Distance exceeds `maxConnectionLength` → anchor dies.
- A non-empty, non-shell matrix cell blocks the path → ray blocked.
- The ray hits another anchor facing the **opposite** direction (N↔S, W↔E) → candidate pair found.

Partial-cell hits are accepted: if anchor cells from two buildings don't align exactly on the perpendicular axis, a one-cell offset is tolerated as long as only one ray cell hits the opposite anchor and the other is clear. Hits on two different anchors are rejected.

Duplicate pairs (both anchors fire, so each pair is discovered twice) are deduplicated via a seen-set.

Each candidate:
```js
{
  from: Anchor, to: Anchor,
  fromBuildingId, toBuildingId,
  axis: 'NS' | 'WE',
  length: number,         // span in cells
  blocked: false,
  debugRect: { x, z, w, d },
}
```

### Phase 3 — Filter pass

**Step 6a — Vertical stacking cull** (runs before per-building filter):
- Group candidates by lane key `"${axis}|${perp}"` (perp = z for WE, x for NS).
- Within each lane, union-find any pair whose travel-axis spans overlap.
- For each component of 2+, mark all but the longest `stackCulled = true`. RNG breaks ties.

**Steps 6b–6e — Per-building filter (`filterCandidates`)**:

River crossing candidates (`fromBuildingId === 'river_crossing'`) are separated first and processed by `cullRiverCrossings`:
- Group by **section key**: `czAnchor` for NS-axis, `cxAnchor` for WE-axis — each unique value corresponds to one river corridor rect (stretch between two nodes)
- Shuffle within each group; keep 1
- **Long stretch rule**: if any remaining candidate is >10 cells from the first along the corridor, randomly pick one as a guaranteed 2nd
- **Short stretch fallback**: 10% chance of a 2nd otherwise

Regular candidates (non-river) are then processed normally:
- Remove stack-culled candidates; group by `fromBuildingId`; sort ascending by length
- Apply `filterStrategy` to select up to `filterN` per building (or `2*filterN` for `longestAndShortest`)
- Bidirectional duplicate check per tier
- Rejected candidates marked `filterCulled = true`

**Bridge culling (`cullBridges`)**:
- Enumerates span cells for all filter survivors to find crossing connections (cells shared by ≥ 2 connections). Crossing connections are immune to culling.
- Short bridges (`bridgeMinLength ≤ length < bridgeLongThreshold`, 6–11 cells): 50% survival chance.
- Long bridges (`length ≥ bridgeLongThreshold`, 12+ cells): 30% survival chance.
- Connections below `bridgeMinLength` (ground-level walkways) are never culled here.
- Rejected candidates are marked `bridgeCulled = true`.

### Phase 4 — Stamp, rasterise, and pillar

**Door stamping (`stampDoors`)**:
For each surviving connection, derive trigger cells from anchor cells by stepping one cell back toward the floor edge. Stamp `CELL.DOOR` (value 90) at each trigger cell from `cy+1` to `cy+3` (2 cells wide × 3 cells tall). Deduplication prevents double-stamping when two connections share an anchor.

**Rasterisation (`rasteriseConnections`)**:
1. Assign connection type per survivor: `walkway` (ground-level or short), `bridge_low`, or `bridge_battlement` based on length band and a weighted RNG roll against `CONNECTIVITY.bridgeVariants` / `bridgeVariantsLong`.
2. Enumerate span cells for each connection.
3. Detect cell-level crossings (shared span cells between two connections). Crossing connections share a `texIndex` via union-find so the renderer can apply a consistent texture across the junction. Connection type propagates from the union root.
4. Split crossing connections into segments (`isCrossing: true/false`) for geometry.
5. Write `CELL.WALKWAY` and `CELL.WALKWAY_CROSSING` into the matrix (non-crossing pass first, then crossing pass).

**Pillar generation (`generatePillars`)**:
Connections with `length ≥ CONNECTIVITY.pillarMinLength` (default 8) receive support pillars. Pillar pairs are placed at `pillarSpacing` intervals along the travel axis, inset `pillarEdgeInset` cells from each end. Written as `CELL.PILLAR` into the matrix.

## Output Contract

```js
{
  // all prior fields carried forward, plus:
  connections: {
    anchors: Anchor[],          // all emitted anchors (including culled)
    triggerCells: TriggerCell[], // floor-edge cells (visualize mode only)
    candidates: Connection[],   // survivors after all filter passes
    doors: [                    // one per stamped anchor end
      { anchorId, direction, x, y, z, w, h, d }
    ],
    walkways: [                 // one per surviving connection
      {
        id, connectionType, axis,
        fromBuildingId, toBuildingId,
        tier, hasCrossing, texIndex,
        segments: [{ isCrossing, cells, worldRect }],
      }
    ],
    crossings: [{ cx, cy, cz, connectionIds }],
    pillars: PillarRecord[],
  },
}
```

## Key Files

- [src/generators/connectivity/index.js](../../../../src/generators/connectivity/index.js) — entry; orchestrates all phases, stacking cull, door stamping, rasterisation, pillars
- [src/generators/connectivity/emit-anchors.js](../../../../src/generators/connectivity/emit-anchors.js) — Phase 1; N-S and W-E matrix scans
- [src/generators/connectivity/pair-anchors.js](../../../../src/generators/connectivity/pair-anchors.js) — Phase 2; ray projection and candidate registration
- [src/generators/connectivity/filter-candidates.js](../../../../src/generators/connectivity/filter-candidates.js) — Phase 3 steps 6b–6e; strategy-based per-building selection
- [src/generators/connectivity/cull-bridges.js](../../../../src/generators/connectivity/cull-bridges.js) — Phase 3 bridge culling; crossing detection + probabilistic survival rates
- [src/generators/connectivity/enumerate-cells.js](../../../../src/generators/connectivity/enumerate-cells.js) — shared helper; span cell enumeration (used by cull-bridges and rasterise-connections)
- [src/generators/connectivity/rasterise-connections.js](../../../../src/generators/connectivity/rasterise-connections.js) — Phase 4; type assignment, crossing detection, segment splitting, matrix writes
- [src/generators/connectivity/generate-pillars.js](../../../../src/generators/connectivity/generate-pillars.js) — Phase 4; pillar placement for long spans; scan extended to `-BELOW_GROUND` so pillars over rivers reach the river bed
- [src/generators/connectivity/emit-river-crossing-anchors.js](../../../../src/generators/connectivity/emit-river-crossing-anchors.js) — Phase 1b; ground-level anchors from bank edges

## Edge Cases & Constraints

- Connectivity runs **before** Walls. The wall generator reads `CELL.DOOR` markers to skip those cells during wall placement (`fillBoxUnless`).
- Connectivity runs **after** Ladders. Ladder door stamps (`CELL.DOOR`) are already present in the matrix, and the anchor ray-cast treats them as passable so walkways can still connect over ladder openings.
- Anchors only emit from cells whose Y level matches a known floor or roof Y — no free-floating anchor emission.
- `IFLOOR_*` and `IROOF_*` cells are included in the eligible label sets, so walkways can bridge damaged quadrants within a single building and connect to rooftop edges.
- Bridge culling survival rates are probabilistic per-connection. Crossing-protected connections are immune regardless of length band.
- River crossing anchors emit at `cy = -slabThickness` to match tier-0 floor anchors — `CELL.STREET_PLACEHOLDER` is cleared from river rects in the Streets stage so these cells are `CELL.EMPTY`.
- River crossings are always `connectionType = 'walkway'` (not bridge) because `cy = -1` → `elevated = false` in `assignType`.
- `generate-pillars` scan extended to `-BELOW_GROUND` so bridge pillars over rivers reach `CELL.RIVER` at the river bed rather than stopping at ground level.
