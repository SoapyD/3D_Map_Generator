/**
 * River path finding — single and multiple path variants.
 *
 * findRiverPaths(nodes, count, rng):
 *   Finds up to `count` river paths through the street node graph.
 *   Each path connects a unique (source, mouth) edge node pair.
 *   Multiple paths may share intermediate nodes (intersections) but
 *   no two paths may use the same source-mouth combination.
 */

export function findRiverPaths(nodes, count, rng) {
  const edgeNodes = nodes.filter(n => n.isEdgeNode);
  if (edgeNodes.length < 2) return [];

  // Shuffle for variety across seeds
  const shuffled = edgeNodes.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const usedPairs = new Set();
  const paths     = [];

  for (const source of shuffled) {
    if (paths.length >= count) break;
    const mouth = farthestUnused(source, edgeNodes, usedPairs);
    if (!mouth) continue;
    const path = aStar(source.id, mouth.id, nodes);
    if (path) {
      usedPairs.add(pairId(source.id, mouth.id));
      paths.push(path);
    }
  }

  return paths;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pairId(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function farthestUnused(source, edgeNodes, usedPairs) {
  let best = null, bestDist = -1;
  for (const node of edgeNodes) {
    if (node.id === source.id) continue;
    if (usedPairs.has(pairId(source.id, node.id))) continue;
    const d = dist(source.center, node.center);
    if (d > bestDist) { bestDist = d; best = node; }
  }
  return best;
}

function aStar(sourceId, mouthId, nodes) {
  const h = id => dist(nodes[id].center, nodes[mouthId].center);

  const gScore   = new Map([[sourceId, 0]]);
  const cameFrom = new Map([[sourceId, null]]);
  const open     = [{ id: sourceId, f: h(sourceId) }];
  const openSet  = new Set([sourceId]);
  const closed   = new Set();

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const { id: current } = open.shift();
    openSet.delete(current);

    if (current === mouthId) return reconstructPath(cameFrom, mouthId);

    closed.add(current);

    for (const neighbour of nodes[current].neighbours) {
      if (closed.has(neighbour)) continue;

      const edgeCost   = dist(nodes[current].center, nodes[neighbour].center);
      const tentativeG = gScore.get(current) + edgeCost;
      const existingG  = gScore.get(neighbour) ?? Infinity;

      if (tentativeG < existingG) {
        gScore.set(neighbour, tentativeG);
        cameFrom.set(neighbour, current);
        const f = tentativeG + h(neighbour);
        if (openSet.has(neighbour)) {
          const entry = open.find(n => n.id === neighbour);
          if (entry) entry.f = f;
        } else {
          open.push({ id: neighbour, f });
          openSet.add(neighbour);
        }
      }
    }
  }

  return null;
}

function reconstructPath(cameFrom, mouthId) {
  const path = [];
  let id = mouthId;
  while (id !== null) {
    path.unshift(id);
    id = cameFrom.get(id);
  }
  return path;
}
