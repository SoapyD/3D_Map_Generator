# Stage 5: Connectivity

> Last verified: 2026-04-18

## Overview

Ensures every elevated floor section is reachable from ground level. Builds a graph of all floor sections, identifies isolated nodes, and places ladders, walkways, and bridges to connect them. Validates full connectivity via flood-fill before returning. This is the most complex pipeline stage.

## Input Contract

```js
{
  floors: Floor[],
  walls: Wall[],
  buildings: Building[],
  blocks: Block[],
  rng: RNG,
}
```

## Algorithm

### Phase A: Graph Construction

1. Create one node per floor section (each entry in `floors[]`, grouped by `buildingId` + `tier`)
2. Two nodes are **adjacent** if their floor rects share an edge at the same tier (same-building adjacency)
3. Two nodes are **near** if they are on the same tier in different buildings within 14" of each other (candidate for forced connection)

### Phase B: Forced Connections (Gap Detection)

4. Build a 1" spatial grid per tier, marking occupied cells
5. Scan rows and columns for gaps between buildings at the same tier
6. For each gap found, calculate a candidate walkway: clamped to the floor overlap between the two buildings
7. Reject candidates where overlap is < 50% of the narrower building's dimension
8. Keep the longest 3-6 valid candidates, weighted by gap width and coverage
9. For each kept candidate, record a forced connection: `{ from: nodeId, to: nodeId, rect: Rect }`

### Phase C: Wall Clearing at Connection Points

10. At each end of a forced connection, check for walls blocking > 50% of the walkway width
11. Remove blocking walls (mark them as removed in `walls[]`)
12. Walls blocking ≤ 50% are left as-is (partial coverage is a feature, not a bug)

### Phase D: Branching

13. For each forced connection, scan perpendicular directions for nearby buildings within 3-14"
14. If a valid branch target exists, create a T-junction branch (maximum 2 branches per map)
15. Branches inherit the parent connection's bridge variant and texture

### Phase E: Bridge Upgrade

16. Any walkway at Tier 2+ (including forced connections and branches) has a 40% chance to become a bridge:
    - Walkway widens from 2" to 3"
    - Side walls added: low (0.75") or battlement (1.5"), chosen by RNG
    - Wall gaps are placed at branch connection points

### Phase F: Ladder Placement

17. For each upper-tier floor section not yet connected to a lower section, find the nearest lower-tier floor section (or ground)
18. Place a ladder: thin slab (0.5" wide, ~80° angle) from the lower floor up to the upper edge
19. Multiple ladders allowed if multiple isolated sections exist

### Phase G: Validation

20. Flood-fill the graph from ground level (Tier 0)
21. If any node is unreachable, place additional connections (ladders preferred) until all nodes are reachable
22. If validation fails after 10 retry passes, log a warning and continue (the map is sub-optimal but not broken)

## Output Contract

```js
{
  // all prior output fields carried forward, plus:
  connections: [
    {
      type: 'walkway' | 'bridge' | 'ladder' | 'branch',
      fromNodeId: string,
      toNodeId: string,
      rect: Rect,              // XZ footprint of the connection geometry
      y: number,               // Y of the lower connection point
      height: number,          // rise from lower to upper (0 for flat walkways)
      bridgeWalls: Wall[],     // populated for bridge type only
      materialKey: string,     // 'wood_plank', 'ladder', etc.
    }
  ],
  // walls[] is mutated (some walls marked as removed for wall-clearing)
}
```

## Key Files

- `src/generators/connectivity/index.js` — public entry, orchestrates all phases
- `src/generators/connectivity/build-graph.js` — node + adjacency construction
- `src/generators/connectivity/place-ladders.js` — ladder placement and angle calc
- `src/generators/connectivity/place-walkways.js` — walkway/bridge placement
- `src/generators/gap-detection/` — spatial grid scanning for forced connections

## Edge Cases & Constraints

- Walkway overhang must be ≥ 50% of the narrower floor's dimension, or the candidate is rejected
- Maximum 2 T-junction branches per map to prevent visual clutter
- Bridge side walls have gaps at all branch connection points — walls with no gaps leave branches inaccessible
- Ladder placement does not consider walls — a ladder placed against a wall is valid (the wall provides the "leaning" geometry implicitly)

## Testing Notes

- Primary test: flood-fill from Tier 0 reaches all floor nodes (connectivity guarantee)
- Tests verify no walkway rect overlaps another connection rect by more than 10%
- Seed 42 regression: connection count and type distribution are snapshot-tested
