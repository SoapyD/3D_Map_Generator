/**
 * Converts streetBounds rects into an adjacency graph.
 * Each rect is a node; nodes are connected when their rects share a full edge.
 * Nodes whose rect touches the activeArea boundary are marked as edge nodes.
 */
export function buildNodeGraph(streetBounds, activeArea) {
  const nodes = streetBounds.map((rect, id) => ({
    id,
    rect,
    center: { x: rect.x + rect.w / 2, z: rect.z + rect.d / 2 },
    isEdgeNode: false,
    neighbours: [],
  }));

  const { x: ax, z: az, w: aw, d: ad } = activeArea;
  for (const node of nodes) {
    const { x, z, w, d } = node.rect;
    node.isEdgeNode = x === ax || x + w === ax + aw || z === az || z + d === az + ad;
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (areAdjacent(nodes[i].rect, nodes[j].rect)) {
        nodes[i].neighbours.push(j);
        nodes[j].neighbours.push(i);
      }
    }
  }

  return nodes;
}

function areAdjacent(a, b) {
  // Touch on X axis (east/west neighbours) with overlapping Z spans
  const touchX = a.x + a.w === b.x || b.x + b.w === a.x;
  if (touchX) {
    const zOverlap = Math.min(a.z + a.d, b.z + b.d) - Math.max(a.z, b.z);
    if (zOverlap > 0) return true;
  }

  // Touch on Z axis (north/south neighbours) with overlapping X spans
  const touchZ = a.z + a.d === b.z || b.z + b.d === a.z;
  if (touchZ) {
    const xOverlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    if (xOverlap > 0) return true;
  }

  return false;
}
