# Pillar Generation Plan
**Date:** 2026-04-21

## Overview
Add support pillar pairs beneath elevated walkways and bridges. Each connection spans 2 collision cells in width, so pillars are placed in pairs (one per width cell) at regular intervals along the travel axis. Placement uses the collision matrix for surface detection rather than iterating pipeline data objects.

---

## Requirements
- Pillars placed in **pairs** — one per width cell of the connection
- Only on connections **≥ pillarMinLength** units long
- Spaced every **pillarSpacing** units along travel axis, inset from each end
- Each pillar descends from the connection base to the **first slab surface below** (detected via matrix scan), or to **ground (y=0)** if nothing found
- Pillar footprint **fills its cell** (1"×1", aligned to grid)
- Pillars written to collision matrix as `CELL.PILLAR`
- Documented in `collision_matrix.md`

---

## Step 1 — Add `CELL.PILLAR` to matrix.js
- Value: `107` (after `WALKWAY_CROSSING = 106`)
- File: `src/generators/collision/matrix.js`

```js
PILLAR: 107,
```

---

## Step 2 — Add config values to `CONNECTIVITY` block
File: `src/config.js`

```js
pillarSpacing:    6,  // travel-axis cells between pillar pairs
pillarMinLength:  8,  // min connection length to receive pillars
pillarEdgeInset:  1,  // cells inset from each end before first pair
pillarWidth:      1,  // pillar footprint size in inches (full cell)
```

---

## Step 3 — Write `src/generators/connectivity/generate-pillars.js`

### Logic per connection:
1. Skip if `conn.length < pillarMinLength`
2. Determine **width cells** (the two cells perpendicular to travel):
   - NS axis (travels Z, width in X): `w0 = from.cells[0].cx`, `w1 = from.cells[1].cx`
   - WE axis (travels X, width in Z): `w0 = from.cells[0].cz`, `w1 = from.cells[1].cz`
3. Determine **travel range**: `tMin` to `tMax` along travel axis (from anchor cells)
4. Compute pillar positions along travel axis:
   - `posStart = tMin + pillarEdgeInset`
   - `posEnd   = tMax - pillarEdgeInset`
   - Step: `pillarSpacing` units, distribute evenly across usable range
5. For each travel position `t`, emit **two pillars** at `(w0, t)` and `(w1, t)`:

### Per pillar placement `(wCell, tCell)`:
- `topY` = connection base world Y = `conn.from.cells[0].cy` (the walkway/bridge cell floor)
- Scan matrix downward from `cy = topY - 1` to `cy = 0`:
  - At each step check `matrix.getCell(cx, cy, cz)` — use `isSlabCell(v)` 
  - First slab hit → `bottomY = cy + slabThickness` (world Y of that slab's top face)
- If no slab found → `bottomY = 0`
- Skip if `topY - bottomY < 1` (pillar would be too short)
- Compute world rect from cell coords via `matrix.cellToWorld(cx, bottomY, cz)`
- Write `CELL.PILLAR` into matrix for all cells `(cx, bottomY..topY-1, cz)`
- Emit: `{ cx, cz, x, y: bottomY, z, w: pillarWidth, h: topY - bottomY, d: pillarWidth, connectionType }`

---

## Step 4 — Wire into `connectivity/index.js`
After `rasteriseConnections`:

```js
import { generatePillars } from './generate-pillars.js';

const pillars = generatePillars(survivors, matrix, config);
// attach to connections output:
connections: { ..., pillars }
```

---

## Step 5 — Update `build-pillar-primitives.js`
Replace broken `textureId` lookup with `connectionType`:

```js
const texKey = p.connectionType?.startsWith('bridge_')
  ? `wall:landmark:${i}`
  : `walkway:${i}`;
```

Emit a `slab` primitive per pillar (existing structure is fine, just fix tex key).

---

## Step 6 — Update `collision_matrix.md`
- Add `PILLAR = 107` to the cell type table
- Add to write order section (written during CONNECTIVITY stage)

---

## Status

- [ ] Step 1 — Add `CELL.PILLAR`
- [ ] Step 2 — Config values
- [ ] Step 3 — `generate-pillars.js`
- [ ] Step 4 — Wire into index
- [ ] Step 5 — Fix `build-pillar-primitives.js`
- [ ] Step 6 — Update `collision_matrix.md`
