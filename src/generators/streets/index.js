import { buildNodeGraph } from './build-node-graph.js';
import { findRiverPath } from './find-river-path.js';
import { writeRiver } from './write-river.js';
import { deriveRiverBanks } from './derive-river-banks.js';
import { writeStreets } from './write-streets.js';
import { writePavements } from './write-pavements.js';
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
    ? deriveRiverBanks(riverRects, matrix, riverDepth)
    : [];
  if (riverBanks.length > 0) {
    console.log(`  River banks: ${riverBanks.length} edges`);
  }

  // Phase 4 — street surfaces (all street rects not on the river path)
  const riverRectSet   = new Set(riverRects);
  const nonRiverStreets = streetBounds.filter(r => !riverRectSet.has(r));
  writeStreets(nonRiverStreets, matrix, config);
  console.log(`  Streets: ${nonRiverStreets.length} surfaces`);

  // Phase 5 — pavements (foundation areas not covered by building shells)
  const pavementCells = writePavements(blocks, matrix, config);
  console.log(`  Pavements: ${pavementCells} cells`);

  return {
    ...data,
    streetNodes,
    rivers:    riverRects.length > 0 ? [{ path: riverNodeIds, rects: riverRects, banks: riverBanks }] : [],
    streets:   nonRiverStreets,
    pavements: blocks,
  };
}
