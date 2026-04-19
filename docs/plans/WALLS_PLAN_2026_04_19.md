# Walls Sub-Plan

**Created:** 2026-04-19  
**Last updated:** 2026-04-20  
**Parent plan:** PIPELINE_MIGRATION_PLAN_2026_04_19.md  
**Depends on:** FLOORS_PLAN_2026_04_19.md

---

# Phase 1 — Exterior Wall Generation

**Status:** ✅ Complete

---

## Wall thickness

`wallThickness: 0.25"` — outer face flush with cell edge, body extends inward.

---

## Implementation summary

### Pass 1 — Direction labelling ✅

**File:** `src/generators/floors/label-floor-cells.js` (moved to floors stage — runs at end of `generateFloors`)

Uses shared utility `src/generators/utils/label-cells.js`.

For each FLOOR cell at a known slab Y level, counts exposed cardinal edges and assigns a label. Precedence (highest first):

| Count | Label assigned |
|---|---|
| 4 exposed | `CELL.FLOOR_ISLAND` |
| 3 exposed | `CELL.FLOOR_END_N/S/E/W` (named by the one connected face) |
| 2 exposed, right-angle pair | `CELL.FLOOR_NE/NW/SE/SW` |
| 1 exposed | `CELL.FLOOR_N/S/E/W` |
| 0 exposed | stays `CELL.FLOOR` (interior cell) |

**Divergence from original plan:**
- Diagonal checks (internal concave corner logic) were removed — not needed in practice.
- Corner types `FLOOR_NE/NW/SE/SW` (values 14–17) were added beyond the original `N/S/E/W` set.
- End types `FLOOR_END_N/S/E/W` (values 30–33) and `FLOOR_ISLAND` (34) were added for 3- and 4-exposed-edge cells.
- Internal corner walls were explicitly removed (diagonal check pass dropped).

### Pass 2 — Segment grouping ✅

**File:** `src/generators/walls/extract-wall-segments.js`

Each direction (N/S/E/W) collects its own label set plus both corner types that include it:

| Direction | Floor labels collected |
|---|---|
| N | `FLOOR_N`, `FLOOR_NE`, `FLOOR_NW` |
| S | `FLOOR_S`, `FLOOR_SE`, `FLOOR_SW` |
| E | `FLOOR_E`, `FLOOR_NE`, `FLOOR_SE` |
| W | `FLOOR_W`, `FLOOR_NW`, `FLOOR_SW` |

Contiguous runs along the shared axis are grouped into single wall rects.

**Corner truncation:** N/S walls are trimmed by `wallThickness` at each end where an E/W wall meets them, preventing 0.25"×0.25" corner overlaps. E/W walls run full length.

**End and island cells** are handled in a separate per-cell pass after the main direction loop. N/S faces on end/island cells are trimmed where E/W faces co-exist on the same cell.

### Wall world position

```
t  = wallThickness (0.25")
s  = cellSize (1")
wallY      = floor.yCollisionLevel + slabThickness   // top of slab
wallHeight = tierHeight                               // 3"

N: z = oz + cz*s,           d = t,  x = ox + run_start*s,     w = runLength*s
S: z = oz + (cz+1)*s - t,   d = t,  x = ox + run_start*s,     w = runLength*s
E: x = ox + (cx+1)*s - t,   w = t,  z = oz + run_start*s,     d = runLength*s
W: x = ox + cx*s,            w = t,  z = oz + run_start*s,     d = runLength*s
```

Walls are also written into the collision matrix as `CELL.WALL_N/S/E/W` (values 20–23).  
Walls are **never placed above roof slabs** — the wall stage only reads `data.floors`, not `data.roofs`.

---

## Files produced

| File | Purpose |
|---|---|
| `src/generators/walls/index.js` | Entry point — calls segment extraction, returns `{ ...data, walls }` |
| `src/generators/walls/extract-wall-segments.js` | Pass 2 — grouping, truncation, end/island handling |

*(Pass 1 labelling moved to `src/generators/floors/label-floor-cells.js`)*

---

## Output contract

```js
{
  walls: [
    {
      direction: 'N' | 'S' | 'E' | 'W',
      floorY: number,
      x, y, z,   // world position (y = top of slab)
      w, h, d,   // width, height (tierHeight), depth
    }
  ]
}
```

---

---

# Phase 2 — Wall Damage & Interior Walls

**Status:** ⬜ Not started

---

## Phase 2a — Wall Damage

**Source:** `_old_system/walls/apply-wall-damage.js`, `_old_system/walls/merge-segments.js`

Each exterior wall segment is subdivided into a column × 2-row quadrant grid. Quadrants are randomly removed (adjacency-spreading) to produce the ruined aesthetic.

### Algorithm (port directly)

1. `cols = Math.max(1, Math.round(wallLength / WALL.quadSize))`
2. Each cell = `(wallLength / cols)` wide × `(wallHeight / 2)` tall
3. **Upper row** removal: random start column, spread adjacently; remove up to `externalUpperRemovalRatio` of columns
4. **Lower row** removal: only remove columns adjacent to an already-removed upper cell; remove up to `externalLowerRemovalRatio`
5. Merge contiguous same-row runs back into rect segments (`merge-segments.js`)
6. Output segments replace the original wall entry

### Config (already in `src/config.js`)

```js
export const WALL = {
  wallThickness: 0.25,
  quadSize: 1.5,
  externalUpperRemovalRatio: 0.7,
  externalLowerRemovalRatio: 0.5,
  internalUpperRemovalRatio: 0.6,
  internalLowerRemovalRatio: 0.3,
  interiorWallChance: { medium: 0.75, largeA: 1.0, largeB: 1.0 },
};
```

### New files

| File | Purpose |
|---|---|
| `src/generators/walls/apply-wall-damage.js` | Port — quadrant subdivision + removal |
| `src/generators/walls/merge-segments.js` | Port — merges contiguous wall segments |

---

## Phase 2b — Interior Walls

**Source:** `_old_system/walls/generate-interior-walls.js`

For medium and large buildings, place internal dividing walls through the centre of each floor room.

### Eligibility

- Building `size` is `medium`, `largeA`, or `largeB`
- Per-floor random chance: `WALL.interiorWallChance[building.size]`
- Only place if the floor above (`floorIndex + 1`) exists and has ≥ 2 quadrants present

### Variants (port directly)

| Variant | Description |
|---|---|
| `centreNS` | Wall from north edge midpoint, runs half-depth toward centre, with door gap |
| `centreSN` | Same from south edge midpoint |
| `centreEW` | From west edge midpoint, runs half-width toward centre, with door gap |
| `centreWE` | From east edge midpoint |
| `cross` | Two crossing walls through building centre |

Weights: `cross = 0.3`, each centre variant = `0.175`. Door gap = `WALL.quadSize` (1.5").

### Adaptation notes

- Old system used `data.buildingQuadrants[bi].tiers[tier+1]`. New system: find `floors` where `buildingIndex === bi && floorIndex === i + 1`, check `4 - floor.removedQuadrants.length >= 2`.
- `pickInteriorVariant` is in `src/generators/selectors/pickInteriorVariant.js` — re-enable its export in `selectors/index.js`.
- Apply `applyWallDamage(def, rng, 'internal')` to each interior wall before pushing.

### New files

| File | Purpose |
|---|---|
| `src/generators/walls/generate-interior-walls.js` | Port + adapt from old system |

---

## Phase 2 execution order

1. Port `merge-segments.js`
2. Port and adapt `apply-wall-damage.js`
3. Integrate damage into Phase 1 exterior walls
4. Port and adapt `generate-interior-walls.js`
5. Wire interior walls into `walls/index.js`
6. Re-enable `pickInteriorVariant` export in `selectors/index.js`
7. Verify visually: interior walls appear in medium/large buildings, damage on both exterior and interior
