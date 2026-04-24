# Connectivity Plan

**Created:** 2026-04-20
**Last updated:** 2026-04-20
**Depends on:** Walls Phase 2 (complete), Floors (complete)
**Source reference:** `src/generators/_old_system/connectivity/`

---

## Blockers — must be resolved before implementation

### BLOCKER A — Connection point definition
What point represents each building at each tier for the Delaunay node set?
Options: building floor centroid, midpoint of each exposed face, one point per contiguous run of boundary cells.
This determines node density and therefore which buildings the triangulation connects.

---

## Core approach — Delaunay Triangulation + MST (per tier)

Each tier is treated independently. The algorithm produces a minimum spanning tree of buildings at that tier, optionally with a small number of extra edges reintroduced to create loops.

```
Per tier:
  1. Collect one node per building present at this tier (BLOCKER A)
  2. Delaunay triangulation of those nodes → candidate edge set
  3. Kruskal's MST on candidate edges weighted by distance → minimum connection set
  4. Re-add N% of non-MST Delaunay edges → loop edges
  5. For each accepted edge (MST + loops): route an axis-aligned walkway between the two buildings
  6. Validate each walkway (wall collision, landing overlap)
  7. Reject invalid walkways — no fallback routing
```

MST guarantees all buildings at a tier are connected with the minimum number of edges.
Delaunay ensures only geometrically natural connections are candidates — no long diagonal crossings.
Applied per tier only — cross-tier connectivity is handled by the ladders sub-stage, not here.

---

## Config values

| Key | Value | Notes |
|---|---|---|
| `loopEdgeRatio` | 0.15 | Fraction of non-MST Delaunay edges re-added for loops |
| `maxConnectionLength` | `mapSize / 2` | Hard cap — Delaunay edges longer than this are excluded before MST |
| `walkwayWidth` | carry from old `CONNECTIVITY.walkwayWidth` | |

---

## Pipeline position

Connectivity runs after Walls Phase 2 and before Cover.
Reads labelled floor cells (`FLOOR_N/S/E/W`) and wall cells (`20–23`) from the collision matrix.
Writes accepted connections to `data.connections`.

---

## Step 1 — Collect nodes per tier

For each tier, collect one node per building present at that tier.
Node position resolves from BLOCKER A — likely building floor centroid or exposed face midpoint.

**Old plan carry-over:** Same as old Step 1. Still needed — now feeding Delaunay instead of ray casting.

---

## Step 2 — Delaunay triangulation

Compute the Delaunay triangulation of the node set for this tier.
Produces the candidate edge set: pairs of buildings with geometrically natural connections.
Exclude any edge longer than `maxConnectionLength` before passing to MST.

**Replaces:** Old Step 2 (full candidate graph via axis-aligned ray casting).
Ray casting enumerated all possible axis-aligned targets — Delaunay replaces this with a geometrically constrained candidate set. No ray casting needed.

**Note on axis-alignment:** Delaunay edges connect centroids and are not inherently axis-aligned.
Axis-alignment is enforced in Step 5 (routing), not here. The Delaunay edge defines *which* two buildings to connect; the walkway geometry is derived separately.

---

## Step 3 — Kruskal's MST

Run Kruskal's algorithm on the Delaunay edges, weighted by Euclidean distance between nodes.
Produces the minimum spanning tree — the smallest set of edges that connects all buildings at this tier.

**Replaces:** Old Steps 5 + 6 (same-orientation overlap cull + proximity cull).
MST makes both culls largely redundant — it will never connect the same two buildings twice, and it naturally minimises total path length. Proximity and overlap culling only applied to the re-added loop edges (Step 4).

**Resolves:** BLOCKER B (ordering). Kruskal's processes edges shortest-first, giving deterministic ordering without needing a separate config decision.

---

## Step 4 — Re-add loop edges

From the non-MST Delaunay edges, randomly re-add `loopEdgeRatio` fraction (seeded RNG) to create cycles.
Apply same-orientation overlap check against already-accepted edges before adding each one.

**Old plan carry-over:** Same-orientation overlap cull (`walkwaysIntersect`) still applies here for loop edges only.
Proximity cull (`isClose`) is dropped entirely — MST handles minimum spacing implicitly.

---

## Step 5 — Axis-aligned walkway routing

For each accepted edge (MST + loops), derive an axis-aligned walkway between the two buildings.
The Delaunay edge gives the building pair — find the closest pair of exposed face points between them and route along the dominant axis (x or z, whichever gives a shorter walkway).

**Old plan carry-over:** Both-ends landing validation (old Step 3) still applies here — reject any walkway where either endpoint overlaps less than 50% of walkway width with a floor section.

---

## Step 6 — Wall collision check

For each routed walkway, scan its axis-aligned span in the collision matrix for wall cells (`20–23`).
Flag as `blocked = true` rather than rejecting.

**Old plan carry-over:** Identical to old Step 4. No change.

---

## Dropped from old plan

| Old step / file | Reason |
|---|---|
| Step 2 — ray casting full candidate graph | Replaced by Delaunay triangulation |
| Step 6 — proximity cull (`isClose`) | Replaced by MST minimum edge selection |
| `cullWalkwaysByTier` (tier-ratio shuffle) | Replaced by MST |
| `findNearestSection` | Replaced by Delaunay + axis-aligned routing |
| `getQuadrantRect` / `collectTierSections` | Replaced by collision matrix queries |
| Step 7 — upgrade to bridges | Dropped — MST is per-tier only, no cross-tier edges generated |

---

## Kept from old plan

| Item | Status |
|---|---|
| BLOCKER A — connection point definition | Still blocks Step 1 |
| Both-ends landing validation (50% overlap) | Kept in Step 5 |
| Wall collision check + `blocked` flag | Kept in Step 6 |
| Same-orientation overlap cull | Kept in Step 4 (loop edges only) |
| `maxConnectionLength` hard cap | Kept — applied before MST in Step 2 |

---

## Output shape

```js
data.connections = {
  walkways: [],  // accepted flat connections (MST + loop edges)
}
```

Bridges are dropped — MST is per-tier, so no cross-tier walkways are generated here.
Ladders, pillars, and platforms are added by subsequent sub-stages.
