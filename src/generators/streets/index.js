import { buildNodeGraph } from './build-node-graph.js';
import { findRiverPaths } from './find-river-path.js';
import { writeRiver } from './write-river.js';
import { deriveRiverBanks } from './derive-river-banks.js';
import { writeStreets } from './write-streets.js';
import { writePavements } from './write-pavements.js';
import { STREETS } from '../../config.js';

// Weighted river mode selection — probabilities must sum to 1.
// Override with --all-rivers flag to force all-rivers mode.
const RIVER_WEIGHTS = [
  { mode: 'none', p: 0.800 },
  { mode: 'one',  p: 0.100 },
  { mode: 'two',  p: 0.075 },
  { mode: 'all',  p: 0.025 },
];

function pickRiverMode(rng) {
  let roll = rng.random(), cum = 0;
  for (const { mode, p } of RIVER_WEIGHTS) {
    cum += p;
    if (roll < cum) return mode;
  }
  return 'none';
}

export function generateStreets(data, config, rng, matrix) {
  const { blocks, streetBounds, activeArea } = data;

  // Phase 1 — street node graph
  const streetNodes = buildNodeGraph(streetBounds, activeArea);
  console.log(`  ${streetNodes.length} street nodes, ${streetNodes.filter(n => n.isEdgeNode).length} edge nodes`);

  // Phase 2 — river paths
  const riverDepth   = config.riverDepth ?? STREETS.riverDepth;
  const riverPathSet = new Set();
  const rivers       = [];

  // Build the list of (pathIds, rects) pairs.
  // --all-rivers flag overrides the random selection.
  const riverMode = config.allRivers ? 'all' : 'one';
  const riverCount = riverMode === 'none' ? 0 : riverMode === 'one' ? 1 : riverMode === 'two' ? 2 : 0;

  let riverRectLists;
  if (riverMode === 'all') {
    streetBounds.forEach(r => riverPathSet.add(r));
    riverRectLists = [{ pathIds: [], rects: streetBounds }];
    console.log(`  Rivers: all-rivers mode — ${streetBounds.length} corridors`);
  } else if (riverCount === 0) {
    riverRectLists = [];
  } else {
    const riverPaths = findRiverPaths(streetNodes, riverCount, rng);
    riverRectLists = riverPaths.map(pathIds => {
      const rects = pathIds.map(id => streetNodes[id].rect);
      rects.forEach(r => riverPathSet.add(r));
      return { pathIds, rects };
    });
  }

  // Phase 3a — write ALL river volumes first so the full river picture is in the
  // matrix before any bank derivation runs. Banks check for CELL.RIVER neighbours,
  // so they must see every river path, not just the one currently being processed.
  for (const { rects } of riverRectLists) {
    writeRiver(rects, matrix, config);
  }

  // Phase 3b — derive banks now that all river cells are present in the matrix
  for (const { pathIds, rects } of riverRectLists) {
    const newBanks = deriveRiverBanks(rects, matrix, riverDepth);
    const banks    = deduplicateBanks(newBanks, rivers);
    rivers.push({ path: pathIds, rects, banks });
    if (riverMode === 'all') {
      console.log(`  River banks: ${banks.length} edges`);
    } else {
      console.log(`  River ${rivers.length}: ${rects.length} segments (${pathIds[0]} → ${pathIds[pathIds.length - 1]}), ${banks.length} banks`);
    }
  }

  if (rivers.length === 0) console.log('  Rivers: none generated');

  // Phase 4 — street surfaces (all street rects not covered by any river path)
  const nonRiverStreets = streetBounds.filter(r => !riverPathSet.has(r));
  writeStreets(nonRiverStreets, matrix, config);
  console.log(`  Streets: ${nonRiverStreets.length} surfaces`);

  // Phase 5 — pavements (foundation areas not covered by building shells)
  const { cellCount: pavementCells, rects: pavementRects } = writePavements(blocks, matrix, config);
  console.log(`  Pavements: ${pavementCells} cells, ${pavementRects.length} rects`);

  return {
    ...data,
    streetNodes,
    rivers,
    streets:   nonRiverStreets,
    pavements: pavementRects,
  };
}

// Remove banks whose position+axis+facing duplicate one already in a prior river.
function deduplicateBanks(newBanks, priorRivers) {
  const seen = new Set();
  for (const river of priorRivers) {
    for (const b of river.banks) seen.add(bankKey(b));
  }
  return newBanks.filter(b => {
    const k = bankKey(b);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function bankKey(b) {
  return `${b.x},${b.z},${b.length},${b.axis},${b.facing}`;
}
