# Walkway Improvements Plan

**Date:** 2026-03-30
**Status:** Active
**Priority:** High

## Summary

Improve walkway and bridge generation to create more interesting, varied, and tactically useful connections between buildings. Current walkways are straight, short, and sometimes stack on top of each other.

---

## Completed Work

### Already Implemented

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Max walkway length increased to 24" (half map width) | Done | `CONNECTIVITY.maxWalkwayLength: 24` |
| 2 | Anti-stacking for regular walkways (same axis, different tier) | Done | Check at walkway generation push |
| 3 | Bridge walkways with low walls (0.75") | Done | `bridgeVariants.low` |
| 4 | Bridge walkways with battlements (1.5" spaced sections) | Done | `bridgeVariants.battlement` |
| 5 | Bridge chance for tier 2+ walkways (40%) | Done | `CONNECTIVITY.bridgeChance` |
| 6 | Grid-based gap detection | Done | 1" grid per tier, scans rows + columns for gaps |
| 7 | Forced connections span large gaps (min 6") | Done | `CONNECTIVITY.forcedMinGap: 6` |
| 8 | Forced connections include roofs as valid endpoints | Done | Roofs populated in grid |
| 9 | Forced connections go through bridge upgrade | Done | Moved gap detection before bridge step |
| 10 | Building pair dedup (no duplicate connections) | Done | Uses textureGroup to identify composite parts |
| 11 | Cross-axis criss-cross prevention (same tier) | Done | Grid marks walkways, blocks any crossing at same tier |
| 12 | Forced connections can stack on regular walkways | Done | `isStackedOnForced` only blocks stacking on other forced connections |
| 13 | Diagonal tolerance for gap detection | Done | `CONNECTIVITY.forcedDiagTolerance: 4` tries adjacent columns/rows |
| 14 | `findFloorEdge` returns furthest edge for multi-section buildings | Done | Fixed bug where near edge was returned instead of far edge |
| 15 | Orientation-aware passthrough check | Done | N/S connections don't block E/W and vice versa |
| 16 | Wall clearing at forced connection endpoints | Done | If wall blocks >50% of walkway width at endpoint, wall segments are removed; ≤50% left as-is |

### Config Values

| Setting | Default | Key |
|---|---|---|
| Minimum gap for forced connection | 6" | `CONNECTIVITY.forcedMinGap` |
| Forced connections kept per map | [3, 6] | `CONNECTIVITY.forcedMaxCount` — keeps top N longest, random within range |
| Diagonal tolerance (cells) | 4 | `CONNECTIVITY.forcedDiagTolerance` |

### Known Issues

- **Bridge width stacking**: Regular walkways (2" wide) pass anti-stacking, but when upgraded to bridges (3" wide) they can overlap. Bridge upgrade step needs its own overlap check.
- **Forced connections near ladder platforms**: Forced connections can visually appear to connect to a nearby ladder platform instead of the actual floor section. Not a bug — the floor IS there, the platform is just adjacent.

---

## Planned Improvements

### 1. Gap Detection — Grid-Based Spatial Analysis

**Problem:** Buildings can cluster on one side of the map leaving big gaps with no connections. The previous approach (flood-fill clusters + nearest-pair) was unreliable because it worked backwards from walkway endpoints.

**Solution:** Build a spatial grid per tier, then scan for gaps between occupied cells.

**Grid Structure:**
- Grid cell size = smallest floor quadrant (half of smallest building footprint, ~2-3")
- One grid per tier of elevation
- Each cell stores:
  - `floor`: boolean — whether a floor section covers this cell
  - `buildingIndex`: which building this cell belongs to (-1 if none)
  - `walls`: bitmask for which edges have walls (N=1, S=2, E=4, W=8)

**Gap Scanning Algorithm:**
1. After all building/floor/wall positions are resolved, populate the grid
2. For each tier, scan rows (left to right) looking for runs of empty cells between two occupied cells from different buildings
3. Do the same scanning columns (top to bottom)
4. Each gap found = { tier, axis, startCell, endCell, buildingA, buildingB, gapWidth }
5. Filter: ignore gaps < 2 cells (buildings touching) and gaps > half map width (too far)

**Connection Point Selection:**
- On each side of the gap, pick the cell that does NOT have a wall facing the gap direction
- If both sides have wall-free edges = ideal bridge placement
- If one side has a wall = blocked walkway (yellow ladder will be added)
- Prefer connections where both endpoints have floors at the same tier

**Implementation Steps:**

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Create grid data structure (per tier, cell size from config) | Pending | Cell = { floor, buildingIndex, walls bitmask } |
| 2 | Populate grid from floor sections | Pending | Map each floor section to grid cells |
| 3 | Populate wall bitmask from wall segments | Pending | Check each wall against grid cells |
| 4 | Row scanning: find horizontal gaps between occupied cells | Pending | Different buildings on each side |
| 5 | Column scanning: find vertical gaps | Pending | Same logic, orthogonal |
| 6 | Filter gaps by width (min 2 cells, max half map) | Pending | |
| 7 | Select connection points (prefer wall-free edges) | Pending | |
| 8 | Generate forced walkways/bridges at connection points | Pending | Use bridge variant for long spans |
| 9 | Anti-stacking check against existing walkways | Pending | |
| 10 | Per-tier grids (different floor layouts per tier) | Pending | |

**Complexity:** M
**Impact:** High — reliable gap detection, prevents dead zones

### 2. Cornered (L-shaped) Walkways

**Problem:** If two buildings are offset diagonally, no straight walkway can connect them. Currently these buildings stay disconnected.

**Solution:** When a straight walkway can't find a target along one axis, try an L-shaped path:
1. Extend out along one axis to an intermediate point
2. Turn 90° and extend to reach the target building
3. Create a small platform at the corner junction

**Geometry:**
- Two walkway segments meeting at a right angle
- A small square platform (2"×2") at the corner
- Both segments get the same texture and bridge variant (if applicable)
- Corner platform acts as a standing point (included in collision mesh)

**Implementation:**
- After straight walkway generation, identify buildings with floor sections at the same tier but no connection
- For each pair, check if an L-path can reach (one axis then the other)
- Verify both segments are clear of walls
- Generate the two segments + corner platform

**Complexity:** M-H
**Impact:** Medium — adds visual variety and solves diagonal connections

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Identify unconnected same-tier building pairs | Pending | Post straight walkway generation |
| 2 | L-path calculation (pick corner point) | Pending | |
| 3 | Wall clearance check for both segments | Pending | |
| 4 | Corner platform generation | Pending | 2"×2" platform at junction |
| 5 | Render L-walkway in GLB scene builder | Pending | Two segments + platform |
| 6 | Render L-walkway in OBJ exporter | Pending | |
| 7 | Collision mesh for L-walkway | Pending | Both segments + platform |

### 3. Pillar Supports for Long Walkways

**Problem:** Long walkways (15"+) float in the air with no visible support. Looks unrealistic.

**Solution:** Add vertical pillar boxes underneath long walkways at regular intervals.

**Geometry:**
- Thin box pillars (0.5"×0.5") from ground level up to the walkway underside
- Spaced every 6-8" along the walkway length
- Use wall/stone texture
- Act as partial cover for ground-level units

**Complexity:** S
**Impact:** Medium — visual improvement, adds tactical cover under long walkways

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Config for pillar spacing and dimensions | Pending | |
| 2 | Pillar generation for walkways/bridges exceeding threshold length | Pending | e.g. > 8" |
| 3 | Render pillars in GLB + OBJ | Pending | Thin box geometry |
| 4 | Include pillars in collision mesh | Pending | Ground-level cover |

### 4. Walkway Chains (Multi-Span)

**Problem:** A single long walkway is visually boring and structurally implausible.

**Solution:** For walkways exceeding a threshold length, split into 2-3 shorter segments connected via small platforms. Each platform can have ladders to create multi-level routes.

**Complexity:** M
**Impact:** Medium — visual variety, new route options

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Split long walkways into segments at platform points | Pending | |
| 2 | Platform generation at segment junctions | Pending | |
| 3 | Optional ladders at platforms | Pending | |

### 5. Branching Walkways (T and + Junctions)

**Problem:** Current walkways are point-to-point connections between two buildings. A long walkway passing near a third or fourth building has no way to branch off and connect to them.

**Solution:** After generating straight walkways, identify walkways that pass within range of additional buildings at the same tier. Add perpendicular branch segments that connect from the walkway midpoint to those buildings.

**Variants:**
- **T-junction:** One branch from the middle of a walkway to a third building (3 connections total)
- **+ junction:** Two branches from the middle, connecting 4 buildings total (the original two endpoints + two branches)

**Geometry:**
- Branch segment: same width/thickness as the parent walkway
- Junction platform: small square (2"×2") where the branch meets the main walkway
- Branch inherits the parent's bridge variant (if the parent is a bridge, branch gets side walls too)

**Implementation:**
- After walkway generation, for each walkway find buildings within range that are perpendicular to the walkway axis
- Generate branch segments from the walkway to those buildings
- Add a junction platform at the branch point
- Limit to 1-2 branches per walkway to avoid spider-web complexity
- Branches must not overlap existing walkways or branches

**Complexity:** M
**Impact:** High — creates more complex elevated route networks, more tactical options

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Identify candidate buildings perpendicular to existing walkways | Pending | Same tier, within range |
| 2 | Branch segment generation (perpendicular to parent) | Pending | |
| 3 | Junction platform at branch point | Pending | 2"×2" square |
| 4 | Inherit bridge variant from parent | Pending | Side walls on branches |
| 5 | Anti-overlap check against existing walkways/branches | Pending | |
| 6 | Max 2 branches per walkway | Pending | Config value |
| 7 | Render branches in GLB + OBJ | Pending | |

### 6. Tier-Spanning Ramps

**Problem:** Currently walkways only connect buildings at the same tier. A ramp could connect tier 1 of one building to tier 2 of an adjacent taller building.

**Solution:** Angled walkway geometry that spans one tier vertically while crossing horizontally.

**Complexity:** H (angled geometry, collision, UV mapping)
**Impact:** High — new tactical routes

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Angled slab geometry generation | Pending | Non-axis-aligned |
| 2 | Collision mesh for angled surface | Pending | |
| 3 | UV mapping on angled surface | Pending | |

---

## Implementation Order

| Phase | Items | Notes |
|---|---|---|
| 1 | Gap detection (#1) | Highest impact, prevents dead zones |
| 2 | Branching walkways (#5) | Creates route networks, high tactical value |
| 3 | Pillar supports (#3) | Quick visual win |
| 4 | Cornered walkways (#2) | Solves diagonal connections |
| 5 | Walkway chains (#4) | Nice to have |
| 6 | Tier-spanning ramps (#6) | Complex, save for later |
