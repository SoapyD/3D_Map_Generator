# Code Audit Report

**Date**: 2026-03-28
**Scope**: All `.js` source files under `src/`
**Files audited**: 15 files

---

## 1. Unused Code (Dead Functions, Imports, Variables)

### 1.1 Dead functions in `src/generators/buildings.js`

Three functions are defined but never called anywhere in the codebase:

- **`fillBlock()`** (line 150) -- grid-based building filler, completely unused.
- **`chooseMix()`** (line 194) -- picks building size mix, never called.
- **`collides()`** (line 213) -- AABB collision check for buildings, never called.

These appear to be remnants of an earlier placement algorithm that was replaced by the current cell-grid + big-layout approach.

### 1.2 Dead functions in `src/generators/connectivity.js`

Seven helper functions at the bottom of the file (lines 981-1282) are defined but never called from the exported `generateConnectivity()` function or anywhere else:

- **`walkwayHitsWall()`** (line 981) -- wall collision check, superseded by inline logic at lines 150-167.
- **`placeRamp()`** (line 1088) -- ramp placement logic. References an undefined variable `RAMP_WIDTH` (see bug section).
- **`placeLadder()`** (line 1141) -- ladder placement between nodes.
- **`placeWalkway()`** (line 1182) -- walkway placement between nodes.
- **`findNearestReachable()`** (line 1230) -- graph search helper.
- **`findNearestBelow()`** (line 1260) -- graph search helper.
- **`propagateReachability()`** (line 1067) -- flood-fill reachability propagation.

These are all part of the original graph-based connectivity algorithm described in the file's header comments. The actual implementation (lines 30-932) uses a completely different approach (per-building edge scanning + multi-pass culling). The `adjacency` variable built on line 52 is also never used after construction.

### 1.3 Unused variables in `src/generators/connectivity.js`

- **`ramps`** (line 34) -- declared as `const ramps = []` but never populated or returned.
- **`adjacency`** (line 52) -- built via `buildAdjacency(nodes)` but the result is never used.
- **`nodes`** (line 37) -- built and populated but only `nodes[i].reachable` is set, and `.reachable` is never read in the main function. The node graph is effectively dead code.
- **`RAMP_DEPTH`** (line 27) -- only used inside the dead `placeRamp()` function (and its own dead code path).
- **`RAMP_THICKNESS`** (line 28) -- only used as a dead variable (never referenced in live code).

### 1.4 Unused function in `src/generators/generate-textures.js`

- **`writeLadderPng()`** (line 30) -- defined but never called. Only `writeSolidPng()` is used.

### 1.5 Variable shadowing in `src/generators/connectivity.js`

- **`LADDER_WIDTH` and `LADDER_DEPTH`** are declared as module-level constants (lines 24-25) from config, then **re-declared** as block-scoped `const` inside the walkway-ladder loop (lines 229-230) with identical values (`1.0` and `0.5`). The inner declarations shadow the outer ones.

### 1.6 Unused variable `PLATFORM_THICKNESS` in `src/generators/connectivity.js`

- **`PLATFORM_THICKNESS`** (line 856) -- declared as `0.2` but never used. The platform thickness is hardcoded as `0.2` directly in `scene-builder.js` (line 188) and `obj-exporter.js` (line 668).

---

## 2. Hardcoded Magic Numbers

### 2.1 Grid partitioning -- `src/generators/grid.js`

- **`MIN_BLOCK_SIZE = 10`** (line 10) -- minimum block dimension. Should be in `config.js`.

### 2.2 Building placement -- `src/generators/buildings.js`

- **`margin = 2`** (line 113 in `placeBigLayout`) -- map edge margin for big buildings. Unrelated to `CONNECTIVITY.mapBoundaryMargin`.
- **`rng.int(0, 4)`** (line 58) -- layout count is hardcoded to 5 options.

### 2.3 Connectivity -- `src/generators/connectivity.js`

- **`0.3`** used as `margin` in at least 5 places (lines 153, 238, 272, 374, 390, 512) -- should use `CONNECTIVITY.wallCheckMargin` consistently. The config has `wallCheckMargin: 0.3` (line 74 in config.js) but it is never imported or referenced.
- **`0.3`** used as `wallOffset` in at least 4 places (lines 272, 374, 512) -- should use `CONNECTIVITY.ladderWallOffset` from config.
- **`0.5`** used as tier comparison margin (e.g., `Math.abs(wall.baseY - wallTierY) > 0.5`) in at least 8 places.
- **`20`** (line 111) -- max walkway search distance, should use `CONNECTIVITY.maxWalkwayLength`.
- **`PLATFORM_SIZE = 2`** (line 855) -- ladder platform size, should be in config.
- **`RAMP_DEPTH = 4.0`** (line 27) and **`RAMP_THICKNESS = 0.3`** (line 28) -- should be in config if ramps are re-enabled.

### 2.4 Cover placement -- `src/generators/cover.js`

- **`0.65`** (lines 150, 197) -- Y position for ground-level cover. Used twice but not in config.
- **`0.75`** (line 95) -- 75% chance for short interior cover (duplicates `COVER.types[0].chance`).
- **`0.25`** (lines 101-102, 295-296) -- edge inset margin for cover placement within quadrants.
- **`1.5`** (line 124) -- courtyard expansion padding (`db.w + 1.5, db.d + 1.5`).
- **`200`** (line 182) -- max attempts for street scatter placement.
- **`20`** (line 182) -- target street scatter count.

### 2.5 Scene builder -- `src/generators/scene-builder.js`

- **`0.5`** (line 42) -- building match tolerance in `findBuildingIndex`.
- **`0.3`** (lines 155, 188) -- walkway/platform thickness, should use config or `CONNECTIVITY.walkwayThickness`.

### 2.6 OBJ exporter -- `src/export/obj-exporter.js`

- **`POLE_WIDTH = 0.24`**, **`POLE_DEPTH = 0.24`**, **`RUNG_HEIGHT = 0.18`**, **`RUNG_DEPTH = 0.18`**, **`RUNG_SPACING = 0.75`**, **`RUNG_INSET = 0.05`** (lines 22-27) -- ladder mesh dimensions, independent of the `LADDER_DISPLAY` config used in `geometry.js`. These define a different ladder style.
- **`PADDING = 4`** (line 19) -- atlas padding pixels.
- **`0.55`** and **`0.1`** (line 605) -- deleted footprint Y position and thickness, duplicated from scene-builder.js line 231.

### 2.7 Geometry -- `src/core/geometry.js`

- **`0.7123, 0.3917, 0.5431, 0.9281, 0.1637`** (lines 43-44) -- UV hash constants. Duplicated identically in `obj-exporter.js` lines 174-175.

---

## 3. Duplicate Code Patterns (3+ occurrences)

### 3.1 AABB overlap check (13+ occurrences)

The pattern:
```js
a.x < b.x + b.w && a.x + a.w > b.x && a.z < b.z + b.d && a.z + a.d > b.z
```
appears at least 13 times across `cover.js` (6 times) and `connectivity.js` (7+ times). This should be extracted into a shared `rectsOverlap(a, b)` utility function.

### 3.2 Wall extent calculation (9 occurrences)

The pattern:
```js
const wallX1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
const wallZ1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
```
appears 9 times across `connectivity.js` (6 times) and `cover.js` (3 times). Should be a utility like `getWallBounds(wall)`.

### 3.3 Quadrant rect computation (3 independent implementations)

The quadrant-to-rect mapping:
```js
{ 0: {x, z, w/2, d/2}, 1: {mx, z, w/2, d/2}, 2: {x, mz, w/2, d/2}, 3: {mx, mz, w/2, d/2} }
```
is implemented in:
- `connectivity.js` line 966 (`getQuadrantRect()` function)
- `cover.js` lines 38-43 (inline object literal, rooftop)
- `cover.js` lines 87-92 (inline object literal, interior)
- `floors.js` lines 104-109 (inline `quads` object)

### 3.4 `findBuildingIndex` / `findBuilding` (4 implementations)

Building lookup functions appear in:
- `connectivity.js` line 1016 -- `findBuildingIndex(section, buildings)` (matches by section bounds)
- `scene-builder.js` line 39 -- `findBuildingIndex(x, z, buildings)` (matches by point + 0.5 tolerance)
- `obj-exporter.js` line 130 -- `findBuilding(section)` (matches by section bounds + 0.1 tolerance)
- `obj-exporter.js` line 143 -- `findBuildingForWall(wall)` (matches by wall midpoint + 1.0 tolerance)

Each uses slightly different tolerances.

### 3.5 Cover type selection (2 occurrences, same logic)

The weighted type selection:
```js
let cumulative = 0;
for (const t of COVER_TYPES) { cumulative += t.chance; if (roll < cumulative) { type = t; break; } }
```
appears at `cover.js` lines 281-287 (`makeCoverPiece`) and lines 186-189 (street scatter). Should be extracted to a shared helper.

### 3.6 Texture loading in `obj-exporter.js` (double-load)

Lines 47-50 call `loadTexPool()` twice for the same category when checking fallbacks:
```js
const walkwayTextures = loadTexPool(packDir, 'walkways').length > 0 ? loadTexPool(packDir, 'walkways') : floorTextures;
```
This loads from disk twice if walkway textures exist. Same pattern on lines 49-50.

---

## 4. Naming Inconsistencies

### 4.1 Parameter naming: `data` vs specific names

- `floors.js` uses `data` as parameter name
- `cover.js` uses `data`
- `connectivity.js` uses `data`
- But `buildings.js` uses `gridData`

### 4.2 Quadrant neighbor mapping

Three different neighbor mapping patterns exist:
- `floors.js` lines 21-25: `ADJACENT` object
- `connectivity.js` lines 76-79: inline ternary chains for `neighborN/S/W/E`
- `connectivity.js` lines 577-581: structured `neighbors` array with `{ nq, side, axis }`

### 4.3 Ladder type naming

Ladders are referred to by colour in code and comments:
- `yellow` = walkway-wall ladders (`ladders`)
- `red` = ground ladders (`groundLadders`)
- `orange` = free-standing ladders (`orangeLadders`)
- `cyan` = interior ladders (`interiorLadders`)

The property names don't match the colour names used in DELETIONS config and comments. For example, `connections.ladders` stores "yellow" ladders but the property name is just `ladders`.

---

## 5. Inefficiencies

### 5.1 O(n^2) adjacency building -- `connectivity.js` line 1037

`buildAdjacency()` compares all node pairs (O(n^2)). With many buildings and tiers, this could be slow. However, since the adjacency result is never used (dead code), this is wasted computation at runtime.

### 5.2 Repeated linear scans in cover.js

Cover placement does nested linear scans for overlap checking:
- Each new cover piece checks against ALL existing cover pieces (lines 48-56, 106-114, 153-161)
- Street scatter checks against walls, ladders, existing cover, other scatter, AND courtyards (lines 199-254)

For large maps, a spatial index would be more efficient.

### 5.3 Double texture loading in obj-exporter.js

As noted in 3.6, `loadTexPool()` is called twice for walkways, courtyards, and ladders when the fallback check fails (lines 47-50). Each call reads files from disk synchronously.

### 5.4 Unused node graph computation -- `connectivity.js`

Lines 37-52 build a full node graph with adjacency, which is O(n^2). This entire computation is wasted since the result (`nodes`, `adjacency`) is never used by the actual connectivity algorithm.

---

## 6. Potential Bugs

### 6.1 CRITICAL: Undefined variable `RAMP_WIDTH` -- `connectivity.js` line 1100

`placeRamp()` references `RAMP_WIDTH` (lines 1100, 1102, 1107, 1109, 1115, 1117, 1122, 1124) but this variable is never declared anywhere in the file or imported. If `placeRamp()` were ever called, it would throw a `ReferenceError`. Currently safe because `placeRamp()` is dead code.

### 6.2 Variable shadowing -- `connectivity.js` lines 229-230

`LADDER_WIDTH` and `LADDER_DEPTH` are re-declared inside the walkway-ladder block:
```js
const LADDER_WIDTH = 1.0;  // line 229
const LADDER_DEPTH = 0.5;  // line 230
```
These shadow the module-level constants on lines 24-25 which have the same values. Not a bug today, but if the config values change, this inner declaration would silently override them.

### 6.3 Identical branches in scene-builder.js -- line 213

```js
material = (i % 2 === 0) ? pickFromPool(pools.objects, i + 50) : pickFromPool(pools.objects, i + 50);
```
Both branches of the ternary are identical. The condition `i % 2 === 0` has no effect. This was likely intended to alternate between different texture pools (e.g., `objects_medium` vs `objects_tall`).

### 6.4 `Math.random()` in config seed default -- `config.js` line 7

```js
seed: Math.floor(Math.random() * 100000),
```
The CLAUDE.md states: "Seed-based RNG everywhere -- no `Math.random()`". This is the only violation. The seed default uses `Math.random()` to generate a random seed when none is provided. This is arguably acceptable (it's generating the seed itself, not game randomness), but it means runs without `--seed` are not reproducible.

### 6.5 `0 * tierHeight` -- `connectivity.js` line 388

```js
const groundWallY = 0 * tierHeight + slabThickness;
```
The `0 *` multiplication is unnecessary. Should simply be `slabThickness`.

### 6.6 Texture categories loaded but never used

`textures.js` (line 25) loads categories `objects_medium`, `objects_tall`, and `domes` into texture pools, but:
- `objects_medium` is never referenced by any consumer
- `objects_tall` is never referenced by any consumer
- `domes` is never referenced by any consumer

These load textures from disk for no purpose.

### 6.7 `generate-textures.js` generates `domes/` textures but no consumer exists

The texture generator creates dome textures (lines 113-116), and `textures.js` loads them, but no code in scene-builder or obj-exporter ever uses a `domes` pool.

### 6.8 Inconsistent tolerances across `findBuildingIndex` implementations

As noted in section 3.4, each implementation uses different tolerance values (0.1, 0.5, 1.0). This could cause a section to match one building in one file and a different building (or no building) in another.

### 6.9 Stage numbering mismatch in index.js

Lines 55-63 show stages numbered `[5/7]` and `[6/7]`, but lines 33-51 show `[1/6]` through `[4/6]`. The denominator changed from 6 to 7 partway through, suggesting stages were added without updating earlier labels.

---

## 7. Summary Statistics

| Category | Count |
|---|---|
| Dead functions | 10 |
| Unused variables/constants | 6 |
| Magic number clusters | 30+ individual values |
| Duplicate patterns (3+ occurrences) | 6 distinct patterns |
| Naming inconsistencies | 4 categories |
| Performance concerns | 4 |
| Potential bugs | 9 |

### Priority Recommendations

1. **Remove dead code in connectivity.js** (lines 981-1282, lines 37-52) -- ~300 lines of unused code making the file harder to maintain.
2. **Remove dead code in buildings.js** (lines 150-224) -- 3 unused functions, ~75 lines.
3. **Fix identical ternary branches** in scene-builder.js line 213.
4. **Extract AABB overlap utility** to reduce duplication and error risk.
5. **Extract wall bounds utility** to centralize the wallX1/wallZ1 pattern.
6. **Move magic numbers to config.js** -- especially the `0.3` margin, `0.65` cover Y, `PLATFORM_SIZE`, and `MIN_BLOCK_SIZE`.
7. **Remove unused texture categories** (`objects_medium`, `objects_tall`, `domes`) from the CATEGORIES array in textures.js, or add consumers for them.
8. **Fix double texture loading** in obj-exporter.js lines 47-50.
9. **Fix stage numbering** in index.js console output.
