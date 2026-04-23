import { buildNodeGraph } from './build-node-graph.js';
import { findRiverPath } from './find-river-path.js';
import { writeRiver } from './write-river.js';
import { deriveRiverBanks } from './derive-river-banks.js';
import { STREETS } from '../../config.js';

export function generateStreets(data, config, rng, matrix) {
  const { blocks, streetBounds, activeArea } = data;

  // Phase 1 — street node graph
  const streetNodes = buildNodeGraph(streetBounds, activeArea);
  console.log(`  ${streetNodes.length} street nodes, ${streetNodes.filter(n => n.isEdgeNode).length} edge nodes`);

  // Phase 2 — river path
  const riverNodeIds = findRiverPath(streetNodes, rng);
  const riverRects   = riverNodeIds ? riverNodeIds.map(id => streetNodes[id].rect) : [];

  if (riverRects.length > 0) {
    console.log(`  River: ${riverRects.length} segments (${riverNodeIds[0]} → ${riverNodeIds[riverNodeIds.length - 1]})`);
  } else {
    console.log('  River: no path found, skipped');
  }

  // Phase 3a — river volume
  if (riverRects.length > 0) {
    writeRiver(riverRects, matrix, config);
  }

  // Phase 3b — bank edges (foundation faces adjacent to river)
  const riverDepth = config.riverDepth ?? STREETS.riverDepth;
  const riverBanks = riverRects.length > 0
    ? deriveRiverBanks(riverRects, blocks, riverDepth)
    : [];
  if (riverBanks.length > 0) {
    console.log(`  River banks: ${riverBanks.length} edges`);
  }

  // Phases 4 & 5 (street surfaces, pavements) — not yet implemented

  return {
    ...data,
    streetNodes,
    rivers:    riverRects.length > 0 ? [{ path: riverNodeIds, rects: riverRects, banks: riverBanks }] : [],
    streets:   [],
    pavements: [],
  };
}
