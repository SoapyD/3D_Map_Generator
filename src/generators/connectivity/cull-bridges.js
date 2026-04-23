import { CONNECTIVITY } from '../../config.js';
import { enumerateCells } from './enumerate-cells.js';

export function cullBridges(survivors, config, rng) {
  const minLen  = config.bridgeMinLength     ?? CONNECTIVITY.bridgeMinLength;
  const longLen = config.bridgeLongThreshold ?? CONNECTIVITY.bridgeLongThreshold;

  // Identify connections involved in crossings — these are immune to culling
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
    if (conn.length < minLen || crossingProtected.has(conn)) {
      kept.push(conn);
      continue;
    }

    const survivalChance = conn.length >= longLen ? 0.3 : 0.5;
    if (rng.random() < survivalChance) {
      kept.push(conn);
    } else {
      conn.bridgeCulled = true;
      culled.push(conn);
    }
  }

  return { survivors: kept, culled };
}
