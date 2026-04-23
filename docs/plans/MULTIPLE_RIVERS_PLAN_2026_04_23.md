# Multiple Rivers — Plan
_2026-04-23_

## Overview

Extend the river generator to support a randomised number of rivers (0–6). Each
river is an independent A\* path through the street node graph between two distinct
edge nodes. Multiple rivers may share intermediate nodes (e.g. both pass through the
same intersection) but no two rivers may connect the same source-mouth pair.

**Starting point:** hardcode 2 rivers and verify the output before enabling
randomisation.

---

## Constraints

| Rule | Detail |
|---|---|
| No duplicate pairs | If source A → mouth B is used, neither A→B nor B→A can be used again |
| Shared nodes allowed | Two rivers may pass through the same intermediate node |
| Same node, different pair | A node can be the source of one river and an intermediate of another |
| Hardcoded start | Begin with `riverCount = 2`; randomise once confirmed working |

---

## Changes to `find-river-path.js`

### Current behaviour (single river)

1. Shuffle edge nodes.
2. Pick first as source; mouth = farthest edge node from source.
3. Run A\*. Retry up to 5 times if no path.
4. Return ordered node id list or `null`.

### New behaviour (multiple rivers)

```
findRiverPaths(nodes, count, rng) → path[][]
```

1. Collect all edge nodes. If fewer than 2, return `[]`.
2. Build a `usedPairs` set of `"minId|maxId"` strings to track used source-mouth combinations.
3. Shuffle edge nodes once with RNG.
4. For each river slot (up to `count`):
   a. Try each shuffled edge node as source (skipping already-used positions).
   b. From the remaining edge nodes, find the farthest one **not already paired** with this source.
   c. Run A\*. If no path found, try next candidate mouth.
   d. If a path is found, record it and add `"min(src,mouth)|max(src,mouth)"` to `usedPairs`.
   e. If no valid pair exists for this slot, stop (fewer rivers than requested is acceptable).
5. Return array of paths (each path = ordered node id list).

### Farthest-unused-mouth selection

```js
function farthestUnused(source, edgeNodes, usedPairs) {
  let best = null, bestDist = -1;
  for (const candidate of edgeNodes) {
    if (candidate.id === source.id) continue;
    const pairKey = pairId(source.id, candidate.id);
    if (usedPairs.has(pairKey)) continue;
    const d = dist(source.center, candidate.center);
    if (d > bestDist) { bestDist = d; best = candidate; }
  }
  return best;
}

function pairId(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }
```

---

## Changes to `streets/index.js`

### Current

```js
const riverNodeIds = findRiverPath(streetNodes, rng);   // single path
const riverRects   = riverNodeIds ? riverNodeIds.map(id => streetNodes[id].rect) : [];
```

### Updated

```js
const riverCount  = 2; // hardcoded initially; randomise later: rng.int(0, 7)
const riverPaths  = findRiverPaths(streetNodes, riverCount, rng);
```

Build river objects from paths:

```js
const riverPathSet = new Set();
const rivers = [];

for (const pathIds of riverPaths) {
  const rects = pathIds.map(id => streetNodes[id].rect);
  rects.forEach(r => riverPathSet.add(r));

  writeRiver(rects, matrix, config);
  const banks = deriveRiverBanks(rects, matrix, riverDepth);

  rivers.push({ path: pathIds, rects, banks });
  console.log(`  River: ${rects.length} segments (${pathIds[0]} → ${pathIds[pathIds.length - 1]})`);
}

if (rivers.length === 0) console.log('  Rivers: none generated');
```

Street rects exclude ALL river rects across ALL rivers:

```js
const nonRiverStreets = streetBounds.filter(r => !riverPathSet.has(r));
```

---

## Randomisation (deferred until 2-river test passes)

Replace the hardcoded `2` with:

```js
const riverCount = rng.int(0, 7); // 0–6 inclusive
```

Add to `STREETS` config:

```js
riverCountMin: 0,
riverCountMax: 6,
```

---

## Output contract change

`data.rivers` becomes an array of river objects (already the case from the current
single-river implementation — no structural change needed):

```js
rivers: [
  { path: number[], rects: [{x,z,w,d}], banks: [...] },
  { path: number[], rects: [{x,z,w,d}], banks: [...] },
  // ...
]
```

---

## Visual / debug

The debug recorder's `riverElements` function already iterates `data.rivers` and
renders each river separately. Multiple rivers will appear as separate animated
steps within stage 10 — no recorder changes needed.

---

## Edge cases

- If the node graph has fewer than 4 edge nodes, fewer than 2 unique pairs may be
  available — accept whatever count A\* can find.
- If two rivers share a rect (both paths visit the same intersection node), the rect
  appears in both `rivers[i].rects` arrays. The matrix write is idempotent
  (`CELL.RIVER` on an already-`CELL.RIVER` cell is a no-op). Bank derivation on a
  shared rect generates duplicate bank records — deduplicate by (x,z,length,axis)
  before returning.
- The `riverPathSet` for street-surface exclusion uses `Set` reference equality,
  which works because rects come directly from `streetNodes[id].rect` (same object
  references as `streetBounds`).
