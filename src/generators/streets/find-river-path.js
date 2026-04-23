/**
 * Selects two edge nodes and finds a path between them via A*.
 * Source is chosen at random; mouth is the edge node farthest from the source.
 * Retries with a different source if A* finds no path.
 */

const MAX_RETRIES = 5;

export function findRiverPath(nodes, rng) {
  const edgeNodes = nodes.filter(n => n.isEdgeNode);
  if (edgeNodes.length < 2) return null;

  // Shuffle so retries try different sources
  const shuffled = edgeNodes.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  for (let attempt = 0; attempt < Math.min(MAX_RETRIES, shuffled.length); attempt++) {
    const source = shuffled[attempt];
    const mouth  = farthestEdgeNode(source, edgeNodes);
    if (!mouth) continue;

    const path = aStar(source.id, mouth.id, nodes);
    if (path) return path;
  }

  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function farthestEdgeNode(from, edgeNodes) {
  let best = null, bestDist = -1;
  for (const node of edgeNodes) {
    if (node.id === from.id) continue;
    const d = dist(from.center, node.center);
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

      const edgeCost     = dist(nodes[current].center, nodes[neighbour].center);
      const tentativeG   = gScore.get(current) + edgeCost;
      const existingG    = gScore.get(neighbour) ?? Infinity;

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
