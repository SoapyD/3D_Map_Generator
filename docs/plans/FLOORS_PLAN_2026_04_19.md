# Floors Sub-Plan

**Date:** 2026-04-19
**Parent plan:** PIPELINE_MIGRATION_PLAN_2026_04_19.md
**Scope:** Port and adapt the old floor generation system to the new treemap/foundation pipeline.

---

## Collision grid vertical resolution

- Y resolution = **1 inch per cell**
- **Room height** = 3" | **Slab thickness** = 1" | **Per-level total** = 4"
- Ground room occupies Y 0–2; first floor slab sits at Y 3 (the 4th Y level, 0-indexed); first floor room occupies Y 4–6; second floor slab at Y 7; etc.
- Formula: `slabY(floorIndex) = floorIndex * 4 + 3`

---

## What we are NOT doing yet

- **Tier 0 / base slab** — the full-map ground floor is deferred.
  - When added later, it should be split into two variants:
    - **Foundation areas** — solid slab covering each foundation block footprint (same damage-cutout process as building floors).
    - **Street areas** — can be converted to **rivers/waterways** instead of solid floor (see WATERWAYS_PLAN for context).

---

## Step 1 — Audit treemap building shape vs floor input contract

Read one real treemap building object from `src/generators/buildings/` output and verify it exposes:

| Field needed by floors | Source in treemap building |
|---|---|
| `id` / `buildingId` | TBC |
| bounding footprint (x, z, width, depth) | TBC — likely from cell placement data |
| `height` (total shell height in inches) | TBC |
| `damage` (0–1 factor for cutout bias) | TBC — may not exist yet, default to 0.5 |

Document any missing fields and add them (or an adapter) before proceeding to Step 2.

---

## Step 2 — Collision matrix: typed cell values

**File:** `src/generators/collision/`

Currently the matrix stores occupied/unoccupied as a flat `Uint8Array`. Change so each cell stores a **type value**:

| Value | Meaning |
|---|---|
| `0` | Shell (wall/structural geometry) |
| `1` | Floor plate |
| (future) `2+` | Other types (walkway, cover, etc.) |

> **Note:** empty/unoccupied cells will need a sentinel distinct from 0 — use `255` for "empty" (fits in Uint8Array, clearly out-of-band).

Changes:
- Add constants file `src/generators/collision/cell-types.js` exporting `EMPTY = 255`, `SHELL = 0`, `FLOOR = 1`
- Update all existing collision writes (shell placement in buildings stage) to write `CELL_TYPES.SHELL` instead of `1`
- Update all existing collision reads (overlap checks) to test `cell !== CELL_TYPES.EMPTY` instead of `cell !== 0`
- Add a `setCellType(x, y, z, type)` helper alongside the existing `markOccupied`

---

## Step 3 — Floor generation per building shell

**New file:** `src/generators/floors/index.js` (replaces old system)

### Input

```js
{
  buildings: Building[],   // treemap output, shape confirmed in Step 1
  collisionMatrix: CollisionMatrix,
  rng: RNG,
}
```

### Algorithm

For each building:

1. Determine floor count: `Math.floor(building.height / 4)` — one slab per 4" level (3" room + 1" slab) up to shell height.
2. For each floor `i` (0-indexed from 0 to floorCount - 1):
   - **Y collision level** = `i * 4 + 3` (first slab at Y=3, second at Y=7, etc.)
   - Start with building footprint as a single rect (from Step 1 adapter)
   - Apply damage cutouts (same logic as old `apply-damage.js` — see below)
   - Write each resulting rect cell into the collision matrix at the computed Y level with type `CELL_TYPES.FLOOR`
3. Record output floor record (see Output Contract below)

### Damage cutouts (port from `_old_system/floors/apply-damage.js`)

- Sample cutout count from RNG, biased by `building.damage` and floor index (higher floors = more cutouts)
- Per cutout: pick random edge (N/S/E/W), random inset depth, random width
- Axis-aligned subtraction only
- Enforce 2"×2" minimum walkable area per remaining section — if not met, restore last cutout
- Tier 0 equivalent (ground floor of a shell, i=0) still receives cutouts unlike the old system's base slab

### Output Contract

```js
{
  // prior pipeline fields forwarded, plus:
  floors: [
    {
      buildingId: string,
      floorIndex: number,       // 0-indexed from ground up
      yCollisionLevel: number,  // collision grid Y index = floorIndex*4+3
      rects: Rect[],            // axis-aligned rects after damage subtraction
      cutouts: Rect[],          // applied cutouts
      materialKey: string,      // from floor-texture-key.js
    }
  ]
}
```

---

## Step 4 — Grid draw system: typed collision visualisation

**File:** wherever the current grid/debug overlay lives (likely `src/generators/scene/` or a debug util — locate before starting)

Change the collision visualisation from a single on/off toggle to a **dropdown multi-select**:

- Dropdown lists available collision types; each has a checkbox
- Initial options:
  - ☑ Shell (`CELL_TYPES.SHELL = 0`)
  - ☑ Floor (`CELL_TYPES.FLOOR = 1`)
- Rendering: draw a cell only if its type is in the active set; use distinct colours per type (e.g. shell = red, floor = blue)
- Empty cells (`255`) are never drawn

No changes to the underlying collision data structure beyond what Step 2 defines.

---

## Execution order

1. **Step 1** — audit treemap building shape, write adapter if needed
2. **Step 2** — update collision matrix (typed cells + constants)
3. **Step 3** — port floor generation
4. **Step 4** — update grid draw system
5. Verify visually: floors appear at correct heights inside shells, collision overlay shows shell vs floor correctly
6. Commit, then mark Stage 1 done in PIPELINE_MIGRATION_PLAN_2026_04_19.md

---

## Deferred / out of scope for this plan

- Foundation slab generation (Tier 0 equivalent)
- Street-to-river conversion
- Walls, connectivity, cover (later stages in parent plan)
