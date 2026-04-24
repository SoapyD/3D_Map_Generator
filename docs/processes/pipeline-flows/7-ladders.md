# Stage 7: Ladder Placement

> Last verified: 2026-04-23

## Overview

Places ladder geometry on building exteriors and interiors so every building has at least one traversable ground-to-roof route. The stage runs **before** Wall generation so that floor/roof edge label cells are still present in the matrix when the candidate scan runs; door stamps written here suppress wall segments in Stage 7. Ladders are emitted as world-space rects plus door markers — no mesh is produced directly.

## Input Contract

```js
data: {
  buildings: Building[],
  floors: FloorRecord[],
  roofs: RoofRecord[],
  // all prior fields carried forward
}
config: {
  tierHeight: number,
  slabThickness: number,
  mapWidth: number,
  mapDepth: number,
  // LADDERS config constants used implicitly:
  //   mapEdgeClearance, connectionClearance, buildingClearance,
  //   pathSpacing, maxSideCount
}
rng: RNG
matrix: CollisionMatrix
```

## Algorithm

### Phase 1 — Candidate scan

Iterates every cell in the matrix. For each cell carrying a floor or roof edge label (`FLOOR_*`, `IFLOOR_*`, `ROOF_*`, `IROOF_*`), the label's facing directions are looked up in a static `CELL_FACINGS` map. For each facing direction, a candidate is emitted at the adjacent **ladder cell** (one step outward from the edge).

Each candidate is then tagged with any cull reasons that apply:

| Cull reason | Rule |
|---|---|
| `mapEdge` | Ladder cell world position is within `mapEdgeClearance` of the map boundary |
| `connection` | A `CELL.WALKWAY`, `CELL.WALKWAY_CROSSING`, or `CELL.DOOR` cell exists within `connectionClearance` radius at the same Y |
| `cell` | The ladder cell itself is not `CELL.EMPTY` or `CELL.SHELL` |
| `building` | Another building's shell appears within `buildingClearance` steps outward from the ladder cell |

Cull reasons are collected but not applied yet — all candidates (including culled) are returned for phase 2.

### Phase 2 — Column grouping

Groups phase-1 candidates by `(lcx, lcz, direction, buildingIndex)` — i.e. all edge cells that would place a ladder at the same position facing the same way on the same building. Within each group, candidates are sorted by `cy` ascending.

For each group a **ladder record** is produced:
- Height span: walk downward from the lowest `cy` in the group through `CELL.EMPTY`/`CELL.SHELL` cells to find the base (`bottomY`). `topY` = highest `cy + 1`. If the downward walk hits a walkway or door cell, a `connection` cull reason is added.
- Cull reasons are the union of all candidates' cull reasons.
- World-space rect: `x`, `z`, `w`, `d` are computed from the ladder cell position and a fixed `THICKNESS` (0.25), oriented flush against the wall face.

Ladder records with zero or negative height are dropped.

### Phase 3 — Path discovery

For each building, attempts to find chains of ladder records that together span from ground (tier 0) to roof. A greedy DFS (`findChain`) builds chains by matching `startTier` → `endTier` across ladder records, preferring the largest span at each tier. Multiple non-overlapping chains are extracted until no ground-to-roof path can be formed from the remaining ladder records.

Each path record:
```js
{
  ladders: LadderRecord[],
  totalLadders: number,
  directions: Set<string>,
  hasExternal: boolean,
  hasInternal: boolean,
}
```

### Phase 4 — Path selection

Per building, selects paths up to a size-based quota:

| Building size | Quota |
|---|---|
| `ruins-small`, `small` | 1 |
| `medium`, `ruins-medium-*` | 2 |
| `largeA`, `largeB` | 3 |

Selection applies progressive constraint relaxation per slot — each relaxation pass is tried in order until a valid path is found:
1. Direction novelty + proximity spacing + side count limit
2. Relax direction novelty
3. Relax proximity spacing
4. Relax side count limit

Proximity spacing (`LADDERS.pathSpacing`) and per-side count (`LADDERS.maxSideCount`) prevent ladders from clustering on a single face of a building.

### Phase 5 — Output and door stamps

The debug path builder (`buildDebugPaths`) iterates selected external, non-culled ladders per building and produces multi-segment path records from ground to roof. `ruins-small` buildings have a 40% chance of skipping ladder generation entirely.

For each segment, `CELL.DOOR` is stamped into the matrix at every floor level the segment crosses — 3 cells wide (centred on the ladder's edge cell), 3 cells tall. These door stamps cause the Wall stage to leave openings for the ladder access points.

## Output Contract

```js
{
  // all prior fields carried forward, plus:
  ladders: [],                 // reserved; ladder geometry is in ladderPaths
  ladderCandidates: [...],     // all phase-1 candidates including culled (debug)
  ladderGroups: LadderRecord[], // all phase-2 column-grouped records including culled (debug)
  ladderPaths: [               // finalised paths per building
    {
      buildingIndex: number,
      pathIndex: number,
      segments: [
        {
          x, z, w, d,           // world-space rect of the ladder strip
          cx, cz,               // edge cell coordinates
          direction: string,
          keptBottomY, keptTopY,
          hasDeleted: boolean,
          deletedBottomY, deletedTopY,
        }
      ],
    }
  ],
}
```

## Key Files

- [src/generators/ladders/generate-ladders.js](../../../../src/generators/ladders/generate-ladders.js) — all five phases and the main `generateLadders` export
- [src/generators/ladders/index.js](../../../../src/generators/ladders/index.js) — re-exports `generateLadders`

## Edge Cases & Constraints

- Must run **before** Wall generation. Ladder door stamps must exist in the matrix before `extractWallSegments` runs, otherwise wall segments will fill the ladder openings.
- Must run **after** Connectivity. The candidate scan checks for `CELL.WALKWAY` and `CELL.DOOR` within `connectionClearance` — if ladders ran first, no walkway cells would exist and the clearance check would never fire, potentially placing ladders on top of connections.
- `ruins-small` buildings have a 40% chance of generating no ladders at all.
- The `ladders: []` field in the output is currently reserved — ladder geometry is contained in `ladderPaths[].segments` and used directly by the geometry stage.
- Cull reasons on individual candidates are unioned across all candidates in a column group, so a group is culled if *any* candidate in it fails a rule.
