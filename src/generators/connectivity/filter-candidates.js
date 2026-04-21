/**
 * Phase 3, Steps 6b–6e — per-tier filter pass.
 *
 * For each tier:
 *   6b. Group candidates by fromBuildingId, sort each group by length ascending.
 *   6c. Determine strategy iteration order (shortest, longest, longestAndShortest, random).
 *   6d. Walk each building's ordered list; accept a candidate only if the tier's
 *       filtered registry doesn't already have a connection between that building pair.
 *       Stop when the building's N-quota is satisfied.
 *   6e. Each tier is processed independently.
 *
 * Candidates not selected are marked filterCulled: true.
 * Returns { survivors, culled } — caller decides what to pass forward vs. debug-only.
 */
export function filterCandidates(activeCandidates, config, rng) {
  const strategy = config.filterStrategy ?? 'longestAndShortest';
  const N        = config.filterN        ?? 2;

  // 6e — per-tier independence
  const byTier = new Map();
  for (const c of activeCandidates) {
    const tier = c.from.tier;
    if (!byTier.has(tier)) byTier.set(tier, []);
    byTier.get(tier).push(c);
  }

  const survivors = [];
  const culled    = [];

  for (const tierCandidates of byTier.values()) {
    const kept = filterTier(tierCandidates, strategy, N, rng);
    const keptSet = new Set(kept);
    for (const c of tierCandidates) {
      if (keptSet.has(c)) {
        survivors.push(c);
      } else {
        c.filterCulled = true;
        culled.push(c);
      }
    }
  }

  return { survivors, culled };
}

// --- internals ---

function filterTier(candidates, strategy, N, rng) {
  // 6b — group by fromBuildingId, sort each group ascending by length
  const byBuilding = new Map();
  for (const c of candidates) {
    if (!byBuilding.has(c.fromBuildingId)) byBuilding.set(c.fromBuildingId, []);
    byBuilding.get(c.fromBuildingId).push(c);
  }
  for (const list of byBuilding.values()) {
    list.sort((a, b) => a.length - b.length);
  }

  const registry = []; // accepted connections for this tier

  for (const sortedList of byBuilding.values()) {
    // 6c — build iteration order for this building
    const quota   = strategy === 'longestAndShortest' ? N * 2 : N;
    const ordered = strategyOrder(sortedList, strategy, N, rng);

    // 6d — filter loop
    let accepted = 0;
    for (const c of ordered) {
      if (accepted >= quota) break;
      const alreadyConnected = registry.some(r =>
        (r.fromBuildingId === c.fromBuildingId && r.toBuildingId === c.toBuildingId) ||
        (r.fromBuildingId === c.toBuildingId   && r.toBuildingId === c.fromBuildingId)
      );
      if (!alreadyConnected) {
        registry.push(c);
        accepted++;
      }
    }
  }

  return registry;
}

function strategyOrder(sortedList, strategy, N, rng) {
  switch (strategy) {
    case 'shortest':
      return sortedList.slice();

    case 'longest':
      return sortedList.slice().reverse();

    case 'longestAndShortest': {
      // Shortest-first half, then longest-first half — deduped
      const seen   = new Set();
      const result = [];
      const addUniq = c => { if (!seen.has(c)) { seen.add(c); result.push(c); } };
      for (const c of sortedList)                  addUniq(c); // shortest first
      for (const c of sortedList.slice().reverse()) addUniq(c); // longest first (already in result, skipped)
      // Re-order: take up to N from front, then up to N from back of original sorted list
      const front = sortedList.slice(0, N);
      const back  = sortedList.slice(-N).reverse();
      const combined = new Set();
      const out = [];
      for (const c of front) { combined.add(c); out.push(c); }
      for (const c of back)  { if (!combined.has(c)) out.push(c); }
      return out;
    }

    case 'random': {
      const shuffled = sortedList.slice();
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    }

    default:
      return sortedList.slice();
  }
}
