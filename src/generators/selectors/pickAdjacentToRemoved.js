const ADJACENT = {
  0: [1, 2],
  1: [0, 3],
  2: [0, 3],
  3: [1, 2],
};

export function pickAdjacentToRemoved(removed, rng) {
  const candidates = new Set();
  for (const r of removed) {
    for (const adj of ADJACENT[r]) {
      if (!removed.has(adj)) candidates.add(adj);
    }
  }
  if (candidates.size === 0) return null;
  return rng.pick([...candidates]);
}
