# Bridge Culling Pass — Plan
_2026-04-23_

## Overview

Add a probabilistic culling pass for elevated bridge candidates immediately before
survivors are stamped as doors. Ground-level walkways are untouched. Connections
involved in crossings are immune to culling.

---

## Pipeline location

In `index.js`, after `filterCandidates` returns `survivors` and before `stampDoors`:

```
filterCandidates(activeCandidates, config, rng)   ← existing
      ↓
cullBridges(survivors, config, rng)               ← NEW
      ↓
stampDoors(survivors, matrix)                     ← existing
```

---

## Culling rules

| Band | Condition | Crossing-protected? | Survival chance |
|---|---|---|---|
| Threshold 1 (walkway) | `length < bridgeMinLength` (< 6) | — | **no culling** |
| Short bridge | `bridgeMinLength ≤ length < bridgeLongThreshold` (6–11) | yes | **no culling** |
| Short bridge | `bridgeMinLength ≤ length < bridgeLongThreshold` (6–11) | no | **50%** |
| Long bridge | `length ≥ bridgeLongThreshold` (≥ 12) | yes | **no culling** |
| Long bridge | `length ≥ bridgeLongThreshold` (≥ 12) | no | **30%** |

Elevation is not a separate gate here — `bridgeMinLength` already only matters for
elevated connections in `assignType`. For the culling pass, `length` alone drives
the band; un-elevated short connections fall into the threshold-1 band and are
skipped.

---

## Crossing detection (pre-stamp)

`rasterise-connections.js` already detects crossings, but that runs *after* stamping.
We need the same information earlier.

Extract `enumerateCells` from `rasterise-connections.js` into a new shared helper:

```
src/generators/connectivity/enumerate-cells.js
  export function enumerateCells(conn)   ← pure, no external deps
```

`rasterise-connections.js` imports it from there (no behaviour change).

In `cullBridges`:
1. Call `enumerateCells(conn)` for every survivor.
2. Build a `cellKey → [conn, ...]` map.
3. Any connection that appears in a cell shared by ≥ 2 connections is
   **crossing-protected**. Collect these into a `Set`.

---

## New file: `cull-bridges.js`

```js
import { CONNECTIVITY } from '../../config.js';
import { enumerateCells } from './enumerate-cells.js';

export function cullBridges(survivors, config, rng) {
  const minLen  = config.bridgeMinLength     ?? CONNECTIVITY.bridgeMinLength;
  const longLen = config.bridgeLongThreshold ?? CONNECTIVITY.bridgeLongThreshold;

  // Identify crossing-protected connections
  const cellOwners = new Map();
  for (const conn of survivors) {
    for (const cell of enumerateCells(conn)) {
      const key = `${cell.cx},${cell.cy},${cell.cz}`;
      if (!cellOwners.has(key)) cellOwners.set(key, []);
      cellOwners.get(key).push(conn);
    }
  }
  const crossingProtected = new Set();
  for (const owners of cellOwners.values()) {
    if (owners.length >= 2) owners.forEach(c => crossingProtected.add(c));
  }

  const kept   = [];
  const culled = [];

  for (const conn of survivors) {
    const { length } = conn;

    if (length < minLen) {
      kept.push(conn);      // threshold 1 — no culling
      continue;
    }
    if (crossingProtected.has(conn)) {
      kept.push(conn);      // crossing — immune
      continue;
    }

    const survivalChance = length >= longLen ? 0.3 : 0.5;
    if (rng.random() < survivalChance) {
      kept.push(conn);
    } else {
      conn.bridgeCulled = true;
      culled.push(conn);
    }
  }

  return { survivors: kept, culled };
}
```

---

## Changes summary

| File | Change |
|---|---|
| `enumerate-cells.js` | **new** — extracted `enumerateCells` pure helper |
| `rasterise-connections.js` | import `enumerateCells` from new file instead of local def |
| `cull-bridges.js` | **new** — crossing detection + probabilistic culling |
| `index.js` | import `cullBridges`; call after `filterCandidates`, before `stampDoors`; thread culled array into debug dump |

---

## Debug output

Add culled bridge connections to the `debugConnectivity` dump in `index.js` so they
appear in `debug_connectivity.json` alongside stack-culled and filter-culled entries.
Flag field: `bridgeCulled: true`.
