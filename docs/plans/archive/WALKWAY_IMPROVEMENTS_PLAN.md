# Walkway Improvements Plan

**Date:** 2026-03-30
**Completed:** 2026-03-30
**Status:** Archived
**Priority:** High
**Outcome:** Implemented gap detection (forced connections with cross-axis clamping, wall clearing, overhang rejection), branching T-junctions off forced connections with bridge/texture inheritance, and pillar supports under long walkways/bridges. Phases 1-3 complete; phases 4-6 (L-shaped walkways, chains, ramps) deferred to future work.

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
| 17 | Cross-axis clamping for forced connections | Done | Walkway Z/X clamped to overlap of both endpoint floor ranges |
| 18 | Overhang rejection for regular walkways | Done | ≥50% cross-axis overlap required at both ends |
| 19 | Forced connection count range | Done | `forcedMaxCount: [3, 6]` keeps top N longest |
| 20 | Branching walkways (T-junctions) | Done | Off forced connections, max 2 per map, 3-14" length |
| 21 | Branch inherits parent bridge type + texture | Done | `textureId` system, two-pass bridge upgrade |
| 22 | Bridge wall gaps at branch entry points | Done | Side walls split into segments with gaps |

### Config Values

| Setting | Default | Key |
|---|---|---|
| Minimum gap for forced connection | 6" | `CONNECTIVITY.forcedMinGap` |
| Forced connections kept per map | [3, 6] | `CONNECTIVITY.forcedMaxCount` — keeps top N longest, random within range |
| Diagonal tolerance (cells) | 4 | `CONNECTIVITY.forcedDiagTolerance` |
| Max branches per map | 2 | `CONNECTIVITY.branchMaxPerMap` |
| Branch min length | 3" | `CONNECTIVITY.branchMinLength` |
| Branch max length | 14" | `CONNECTIVITY.branchMaxLength` |

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
| 1 | Create grid data structure (per tier, cell size from config) | Done | 1" cell grid per tier |
| 2 | Populate grid from floor sections | Done | Floor + roof sections marked |
| 3 | Populate wall bitmask from wall segments | N/A | Wall check done via clearBlockingWalls instead |
| 4 | Row scanning: find horizontal gaps between occupied cells | Done | Different buildings on each side |
| 5 | Column scanning: find vertical gaps | Done | Same logic, orthogonal |
| 6 | Filter gaps by width (min 2 cells, max half map) | Done | `forcedMinGap: 6` |
| 7 | Select connection points (prefer wall-free edges) | Done | Cross-axis clamping to floor overlap + wall clearing at endpoints |
| 8 | Generate forced walkways/bridges at connection points | Done | Bridge upgrade for tier 2+ |
| 9 | Anti-stacking check against existing walkways | Done | `isStackedOnForced` + `crossesWalkway` |
| 10 | Per-tier grids (different floor layouts per tier) | Done | One grid per tier |
| 11 | Keep only top N longest forced connections | Done | `forcedMaxCount: [3, 6]` random range |
| 12 | Cross-axis clamping to endpoint floor ranges | Done | Prevents overhang at endpoints |
| 13 | Overhang rejection for regular walkways | Done | ≥50% cross-axis overlap required at both ends |

**Complexity:** M
**Impact:** High — reliable gap detection, prevents dead zones
**Status:** Complete

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
**Status:** Complete

**Implementation:**
- Pillars generated after bridge upgrade, before return from `generateConnectivity()`
- Stops at flush floor/roof surfaces below; skipped entirely on partial overlap
- Skipped if overlapping another walkway/bridge
- Inherits parent walkway/bridge texture via `textureId`
- Config: `pillarWidth: 0.5`, `pillarSpacing: 6`, `pillarEdgeInset: 1.0`, `pillarMinWalkwayLength: 8`, `pillarMinHeight: 1.0`

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Config for pillar spacing and dimensions | Done | `CONNECTIVITY.pillar*` values |
| 2 | Pillar generation for walkways/bridges exceeding threshold length | Done | >8" walkways, flush/partial floor checks |
| 3 | Render pillars in GLB + OBJ | Done | `createSlab`, parent texture inheritance |
| 4 | Include pillars in collision mesh | Done | `pillar_` prefix in collision exporter |

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

### 5. Branching Walkways (T-Junctions)

**Problem:** Forced connections are long spans that pass near buildings without connecting to them.

**Solution:** After gap detection, scan each forced walkway perpendicular for nearby building floors at the same tier. Create a branch segment from the walkway to that building.

**Implementation:**
- `generateBranches()` runs after gap detection, before bridge upgrade
- For each forced walkway, scan all floor/roof sections at the same tier
- Target section must overlap the walkway's cross-axis range and be 3-14" away perpendicular
- Branch meets parent flush (no junction platform needed)
- Branch inherits parent's bridge upgrade decision and texture via `textureId`
- Bridge side walls are split into segments with gaps where branches connect (both low wall and battlement variants)
- Max 2 branches per map, preferring longest spans
- Passthrough and overlap checks filter invalid branches (parent walkway excluded from overlap check)

**Config:**
- `CONNECTIVITY.branchMaxPerMap: 2`
- `CONNECTIVITY.branchMinLength: 3`
- `CONNECTIVITY.branchMaxLength: 14`

**Complexity:** M
**Impact:** High — creates T-junction route networks off forced connections
**Status:** Complete

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Scan forced walkways for perpendicular building floors | Done | All sections at same tier, cross-axis overlap check |
| 2 | Branch segment generation | Done | Perpendicular to parent, clamped to target section |
| 3 | Inherit bridge variant + texture from parent | Done | `textureId` system, two-pass bridge upgrade |
| 4 | Bridge wall gaps at branch entry points | Done | Side walls split into segments, battlements respect gaps |
| 5 | Anti-overlap + passthrough checks | Done | Parent excluded from overlap check |
| 6 | Max 2 branches per map | Done | `branchMaxPerMap: 2`, keeps longest |
| 7 | Render in GLB + collision mesh | Done | Walkway/bridge prefixes in collision exporter |

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

| Phase | Items | Status | Notes |
|---|---|---|---|
| 1 | Gap detection (#1) | **Complete** | Grid-based, cross-axis clamping, wall clearing, overhang rejection |
| 2 | Branching walkways (#5) | **Complete** | T-junctions off forced connections, texture + bridge inheritance |
| 3 | Pillar supports (#3) | **Complete** | Flush floor/roof detection, parent texture inheritance |
| 4 | Cornered walkways (#2) | Deferred | Solves diagonal connections |
| 5 | Walkway chains (#4) | Deferred | Nice to have |
| 6 | Tier-spanning ramps (#6) | Deferred | Complex, save for later |
