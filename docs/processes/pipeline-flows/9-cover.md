# Stage 9: Cover

> Last verified: 2026-04-24

## Overview

Scans the collision matrix for placeable surface cells, groups them by logical region (building+tier, roof, street corridor), places cover scatter pieces within each group, and produces the `cover` and `streetScatter` flat arrays consumed by the geometry stage. Also exposes a `freeSpace` debug structure used by the visualiser's Debug Free Space overlay.

## Input Contract

```js
data: {
  buildings: Building[],        // need .size and footprint (.x .z .w .d)
  streets: StreetRect[],        // corridor rects for street grouping
  // all prior pipeline fields
}
config: {
  slabThickness: number,        // used to derive cyMin for ground-floor scan
  tierHeight: number,           // used to map cy back to tier index
}
matrix: CollisionMatrix         // read-only scan for FLOOR, ROOF, STREET cells
rng: Rng
```

## Algorithm

### Phase 1 — Free space scan

Iterates every cell from `cy = -ceil(slabThickness)` (ground floor) to `cy < maxY`:

- **Keep** cells with value `CELL.FLOOR` (1), `CELL.ROOF` (40), or `CELL.STREET` (110).
- **Reject** any cell where any of the 4 cardinal neighbours at `cy+1` (the air cell above) contains `CELL.PILLAR` — placing cover next to a support pillar is physically wrong.
- **Reject** `CELL.STREET` cells that are adjacent (same cy) to `CELL.RIVER_BANK` — keeps cover away from river edges.

Survivors are split into three raw arrays: `rawFloor`, `rawRoof`, `rawStreet`.

### Phase 2 — Grouping

- **Shells** (`rawFloor`): each cell is mapped to `{ buildingIndex, tier }`. `buildingIndex` = first building whose world footprint contains the cell's (wx, wz). `tier` = `round((cy + slabThickness) / levelHeight)`. Produces one group per building-per-tier, sorted by building then tier.
- **Roofs** (`rawRoof`): one group per building, keyed by building footprint containment.
- **Streets** (`rawStreet`): each cell is matched to the `data.streets` rect it falls inside. One group per matched corridor, each with a cycling debug colour.

### Phase 3 — Piece placement

Each group runs `placeInGroup(group, cy, pieceList, rng, ox, oz, cellSize)`:

1. Build a `Set<"cx,cz">` from the group's cells.
2. For each piece in the list: call `tryPlacePiece(available, arrCache, piece, rng)` — pick a random anchor key, check if the full `piece.w × piece.d` footprint is available, remove those keys and rebuild the cache on success.
3. Max **20 attempts** per piece before giving up on that piece.

**Piece types:**
| Name | w × d × h |
|---|---|
| Small short | 2 × 2 × 1 |
| Small tall | 2 × 2 × 2 |
| Long short (two orientations) | 2 × 3 × 1 and 3 × 2 × 1 |
| Long tall (two orientations) | 2 × 3 × 2 and 3 × 2 × 2 |

**Budget per building size (per shell group and per roof group):**
| Building size | Budget |
|---|---|
| small / ruins-small | 0 or 1 small (50% chance) |
| medium / ruins-medium-* | 2 small OR 1 long (50/50) |
| large* | 2 small + 1 long (40%) / 2 long (30%) / 3 small (30%) |

Building sizes `largeA`, `largeB` both map to the large budget via `normaliseSize()`.

**Budget per street corridor (by area):**
| Corridor area | Count | Long chance |
|---|---|---|
| ≤ 20 sq in | 0–1 | 0% |
| 21–48 sq in | 1–2 | 20% |
| ≥ 49 sq in | 2–3 | 35% |

### Phase 4 — Flatten

Shell and roof pieces are concatenated into `data.cover`. Street pieces go into `data.streetScatter`. These are the property names the geometry stage reads.

## Output Contract

```js
{
  ...data,                       // all prior fields pass through
  freeSpace: {
    shells: [{ buildingIndex, tier, cells: [...], pieces: [...] }],
    roofs:  [{ buildingIndex,       cells: [...], pieces: [...] }],
    streets:[{ index, rect, color, cells: [...], pieces: [...] }],
  },
  cover:         [{ x, y, z, w, height, d }],   // shell + roof pieces
  streetScatter: [{ x, y, z, w, height, d }],   // street corridor pieces
}
```

## Key Files

- [src/generators/cover/index.js](../../../../src/generators/cover/index.js) — entry; scan, group, place, flatten

## Edge Cases & Constraints

- Ground floor cells are at `cy = -slabThickness` (negative world Y). The scan starts at `cyMin = -ceil(slabThickness / cellSize)` so they are included.
- Buildings with unrecognised size values fall through `normaliseSize()` to `'small'` budget.
- If a group has too few available cells to fit any piece in 20 attempts, that piece is silently skipped — never infinite loops.
- STREET cells adjacent to RIVER_BANK are excluded because the bank geometry visually occupies that edge; cover pieces there would intersect bank walls.
- The `freeSpace` structure is debug-only and drives the visualiser's **Debug Free Space [F]** overlay — it is not used by downstream pipeline stages.
