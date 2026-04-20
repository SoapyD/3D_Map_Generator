# Connectivity Plan

**Created:** 2026-04-20
**Depends on:** Walls Phase 2 (complete), Floors (complete)
**Source reference:** `src/generators/_old_system/connectivity/`

---

## Blockers — must be resolved before implementation

### BLOCKER A — Connection point definition
How are connection points determined per building face per tier?
Options: single midpoint per exposed face, one point per contiguous run of boundary cells, multiple evenly-spaced points per face.
This determines the density and placement of all candidate connections.

### BLOCKER B — Proximity cull ordering
What ordering is used when iterating candidates during the proximity cull (Step 4)?
The ordering determines which connections survive when two candidates are within proximity of each other.
Options: shortest-first, longest-first, by source building index, randomised via seeded RNG.

---

## Config values

| Key | Value | Notes |
|---|---|---|
| `maxConnectionLength` | `mapSize / 2` | Global. `mapSize` is the longer of map width/depth. |
| `proximityDistance` | TBD | Edge-to-edge minimum gap between accepted connections at the same tier. |
| `walkwayWidth` | carry from old `CONNECTIVITY.walkwayWidth` | |

---

## Pipeline position

Connectivity runs after Walls Phase 2 and before Cover.
It reads labelled floor cells (`FLOOR_N/S/E/W`) and wall cells (`20–23`) from the collision matrix.
It writes accepted connections back into `data.connections`.

---

## Step 1 — Collect connection points per tier

For each building at each tier, derive connection points from exposed boundary floor cells labelled `FLOOR_N`, `FLOOR_S`, `FLOOR_E`, `FLOOR_W` in the collision matrix.

**Blocked by:** BLOCKER A.

**Old system note:** Old pipeline used `getQuadrantRect` edge midpoints driven by quadrant presence sets. Those structures no longer exist — boundary extraction must come from labelled floor cells instead.

---

## Step 2 — Cast all candidate connections (full graph)

For every connection point, cast a straight axis-aligned ray (x or z only) toward all other buildings at the same tier.

Accept a candidate when:
- Ray is strictly axis-aligned
- Ray terminates on a valid landing point on another building's exposed face
- Length ≤ `maxConnectionLength`

This produces the full candidate graph for the tier before any pruning.

**Old system note:** `findNearestSection` found only the single nearest section per edge. This step replaces it with a full enumeration — every reachable building within range is a candidate target, not just the closest.

---

## Step 3 — Both-ends landing validation

Reject any candidate where either endpoint overlaps the target face by less than 50% of walkway width.
Prevents connections that barely clip a building corner.

**Old system carry-over:** `validateWalkway` `startOverlap / wSpan < 0.5` check.
Replace section rect lookups with labelled floor cell queries against the collision matrix.

---

## Step 4 — Wall collision check

Check whether the candidate's axis-aligned span passes through any wall cell (`CELL` values `20–23`) in the collision matrix.
Flag as `blocked = true` rather than rejecting — same behaviour as old system.

**Old system carry-over:** `validateWalkway` wall-hit logic.
Replace the old `data.walls` AABB loop with a direct matrix span scan — same outcome, faster.

---

## Step 5 — Same-orientation overlap cull

Reject any candidate whose bounding rect overlaps an already-accepted connection of the same axis at the same tier.
Same-tier connections in the same orientation must not stack.

**Old system carry-over:** `walkwaysIntersect` + `stripIntersectingWalkways`. Port as-is, remove `DELETIONS` flag (always-on in new pipeline).

---

## Step 6 — Proximity cull

Reject any candidate within `proximityDistance` (edge-to-edge) of any already-accepted connection at the same tier.
Iteration order determines survivors.

**Blocked by:** BLOCKER B (ordering).

**Old system carry-over:** `proximityCullWalkways` + `isClose`. Port as-is, remove `DELETIONS` flag.

**Old system clash:** Old proximity cull ran after a randomised tier-ratio shuffle (`cullWalkwaysByTier`). That shuffle is dropped — proximity cull is now the primary reduction mechanism, applied deterministically per BLOCKER B's resolved ordering.

---

## Step 7 — Upgrade to bridges

Connections spanning a vertical gap greater than one tier height become bridges rather than flat walkways.

**Old system carry-over:** `upgradeToBridges` — port as-is, no structural changes needed.

---

## Dropped old-system logic

| Old file | Reason |
|---|---|
| `cullWalkwaysByTier` | Replaced by deterministic proximity cull (Step 6) |
| `findNearestSection` | Replaced by full candidate graph (Step 2) |
| `getQuadrantRect` | Replaced by labelled floor cell boundary extraction |
| `collectTierSections` | Replaced by collision matrix queries |
| Ladder types (yellow, orange, red, interior, tower, cyan) | Separate sub-stage — not in this plan |
| Pillars | Separate sub-stage — depends on finalised walkway layout |
| Gap detection | Separate sub-stage — port alongside ladders |

---

## Output shape

```js
data.connections = {
  walkways: [],   // accepted flat connections
  bridges: [],    // upgraded from walkways spanning tier height gap
}
```

Ladders, pillars, and platforms are added by subsequent sub-stages.
