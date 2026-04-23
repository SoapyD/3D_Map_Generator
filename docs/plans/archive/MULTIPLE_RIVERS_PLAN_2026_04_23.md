# Multiple Rivers — Plan
_2026-04-23_

**Status: ✅ Implemented 2026-04-23**

## Overview

Extended the river generator to support a randomised river mode. Four modes are
selected by weighted RNG each generation. Multiple A\* rivers share no source-mouth
pairs but may share intermediate nodes. An `--all-rivers` flag overrides the random
selection.

---

## Constraints

| Rule | Detail |
|---|---|
| No duplicate pairs | If source A → mouth B is used, neither A→B nor B→A can be used again |
| Shared nodes allowed | Two rivers may pass through the same intermediate node |
| All-rivers mode | All street corridors become rivers; A\* skipped entirely |
| Override flag | `--all-rivers` forces all-rivers mode regardless of RNG |

---

## River mode selection

Implemented in `streets/index.js` via `pickRiverMode(rng)`:

```js
const RIVER_WEIGHTS = [
  { mode: 'none', p: 0.40 },
  { mode: 'one',  p: 0.25 },
  { mode: 'two',  p: 0.25 },
  { mode: 'all',  p: 0.10 },
];
```

`config.allRivers` (set by `--all-rivers` flag) bypasses this and forces `'all'` mode.

---

## `find-river-path.js` — `findRiverPaths(nodes, count, rng)`

1. Collect all edge nodes. If fewer than 2, return `[]`.
2. Shuffle edge nodes with RNG for variety.
3. Build a `usedPairs` set tracking `"minId|maxId"` strings.
4. Iterate shuffled nodes as candidate sources. For each:
   - Find the farthest edge node not already paired with this source (`farthestUnused`).
   - Run A\*. If a path is found, record it and mark the pair used.
   - Stop when `count` paths collected or no more valid pairs exist.
5. Return array of ordered node-id lists.

---

## `streets/index.js` pipeline

### Phase ordering (critical)

All river volumes are written to the matrix **before** any bank derivation runs.
This ensures banks for River 1 cannot span positions that River 2 will later occupy.

```
1. Determine mode via pickRiverMode (or --all-rivers override)
2. Collect all (pathIds, rects) pairs
3. Write ALL river volumes → matrix (Phase 3a)
4. Derive banks for each river (Phase 3b) — full river picture now in matrix
5. Write non-river street surfaces (Phase 4)
6. Write pavements (Phase 5)
```

### All-rivers mode

Skips A\* entirely. Creates a single river entry with all `streetBounds` as rects.
`pathIds = []` (no A\* path). Bank deduplication still runs.

### Bank deduplication

When two rivers share an intersection node (same rect in both paths), `deriveRiverBanks`
would produce duplicate bank records. Deduplicated by `"x,z,length,axis,facing"` key
across all prior rivers before pushing each river's banks.

---

## Output contract

```js
rivers: [
  { path: number[], rects: [{x,z,w,d}], banks: [{x, z, length, axis, facing, bottomY, topY}] },
  // ... one entry per river (or one entry for all-rivers mode)
]
```

`path: []` in all-rivers mode.

---

## Files changed

| File | Change |
|---|---|
| `src/generators/streets/find-river-path.js` | Replaced `findRiverPath` with `findRiverPaths(nodes, count, rng)` |
| `src/generators/streets/index.js` | `RIVER_WEIGHTS` table + `pickRiverMode`; two-pass write/bank loop; all-rivers mode |
| `src/config.js` | `allRivers: false` default; `--all-rivers` flag in `parseArgs` |

---

## Edge cases

- Fewer than 2 edge nodes → no rivers regardless of mode.
- A\* failure for a given pair → that slot is skipped; fewer rivers than requested is acceptable.
- Shared intersection rects → idempotent matrix write; bank deduplication handles duplicate records.
- `riverPathSet` uses Set reference equality — works because rects are the same object references as `streetBounds` elements.
- Debug recorder `streetElements` uses `Array.isArray(data.streets)` (not `?.length`) to correctly render 0 streets in all-rivers mode without falling back to derived rects.
