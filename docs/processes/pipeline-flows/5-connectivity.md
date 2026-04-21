# Stage 5: Connectivity

> Last verified: 2026-04-21

## Overview

Discovers walkway connection points between buildings by scanning the collision matrix for floor/roof edge labels. Three phases produce a curated set of surviving connections, then `CELL.DOOR` markers are stamped into the matrix at each connection's trigger cells so the Wall stage can carve openings. See `docs/plans/CONNECTIVITY_PLAN_V2_2026_04_20.md` for full design rationale.

## Input Contract

```js
data: {
  floors: FloorRecord[],   // from Stage 3 — needed to build cell→buildingId map
  roofs:  RoofRecord[],    // from Stage 4 — same
  buildings: Building[],
  // all prior fields carried forward
}
config: {
  anchorPeriod: number,         // P — grid counter period (default 4)
  maxConnectionLength: number,  // cap on walkway span in cells
  filterStrategy: string,       // 'longestAndShortest' | 'longest' | 'shortest' | 'random'
  filterN: number,              // quota per building per tier
}
rng: RNG
matrix: CollisionMatrix
```

## Algorithm

### Phase 1 — Anchor emission (`emitAnchors`)

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

### Phase 2 — Anchor pairing (`pairAnchors`)

For each anchor, project a ray outward cell-by-cell in its facing direction. The ray terminates when:
- Distance exceeds `maxConnectionLength` → anchor dies.
- The ray hits another anchor facing the **opposite** direction (N↔S, W↔E) → candidate pair found.

Duplicate pairs (both anchors fire, so each pair is discovered twice) are deduplicated via a `{from, to}` registry check.

Each candidate:
```js
{
  from: Anchor, to: Anchor,
  fromBuildingId, toBuildingId,
  axis: 'NS' | 'WE',
  length: number,         // span in cells
  debugRect: { x, z, w, d },
}
```

### Phase 3 — Filter pass

**Step 6a — Vertical stacking cull** (runs before per-building filter):
- Group candidates by lane key `"${axis}|${perp}"` (perp = z for WE, x for NS).
- Within each lane, union-find any pair whose travel-axis spans overlap.
- For each component of 2+, mark all but the longest `stackCulled = true`. RNG breaks ties.

**Steps 6b–6e — Per-building filter (`filterCandidates`)**:
- Remove stack-culled candidates.
- Group remaining candidates by `fromBuildingId`.
- Within each group, sort by `length` ascending.
- Apply `filterStrategy` to select up to `filterN` candidates per building (or `2*filterN` for `longestAndShortest`).
- Bidirectional duplicate check: skip if a connection between this building pair already exists in the filtered output.

### Door stamping (`stampDoors`)

For each surviving connection, derive trigger cells from anchor cells by stepping one cell back toward the floor edge. Stamp `CELL.DOOR` (value 90) at each trigger cell from `cy+1` to `cy+3` (2 cells wide × 3 cells tall). Deduplication prevents double-stamping when two connections share an anchor.

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
    walkways: [],               // populated by Stage 7c (pending)
  },
}
```

## Key Files

- [src/generators/connectivity/index.js](../../../../src/generators/connectivity/index.js) — entry; orchestrates all phases, stacking cull, door stamping
- [src/generators/connectivity/emit-anchors.js](../../../../src/generators/connectivity/emit-anchors.js) — Phase 1; N-S and W-E matrix scans
- [src/generators/connectivity/pair-anchors.js](../../../../src/generators/connectivity/pair-anchors.js) — Phase 2; ray projection and candidate registration
- [src/generators/connectivity/filter-candidates.js](../../../../src/generators/connectivity/filter-candidates.js) — Phase 3 steps 6b–6e; strategy-based per-building selection

## Edge Cases & Constraints

- Connectivity runs **before** Walls. The wall generator reads `CELL.DOOR` markers to skip those cells during wall placement (`fillBoxUnless`).
- Anchors only emit from cells whose Y level matches a known floor or roof Y — no free-floating anchor emission.
- `IFLOOR_*` and `IROOF_*` cells are included in the eligible label sets, so walkways can bridge damaged quadrants within a single building and connect to rooftop edges.
- Walkway rasterisation (Step 7c) and full doorway carving (Step 7b-ii) are not yet implemented.
