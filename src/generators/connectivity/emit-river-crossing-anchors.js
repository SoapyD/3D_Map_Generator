/**
 * Emits ground-level anchors from pavement/river boundary edges (bank records).
 *
 * Instead of scanning for floor-edge labels (as emitAnchors does), this walks
 * each bank edge and fires 2-wide anchors at cy=0 pointing toward the river.
 * The river corridor at cy=0 is CELL.EMPTY so ray-casts pass freely without
 * any changes to pair-anchors.js.
 *
 * Anchor buildingId = 'river_crossing' so filterCandidates can pass them through
 * without applying the per-building quota.
 */
import { CELL } from '../collision/matrix.js';
import { CONNECTIVITY } from '../../config.js';

const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };

let rcCounter = 0;

function makeAnchor(direction, cx0, cy, cz0, cx1, cz1, matrix) {
  const cs   = matrix.cellSize;
  const wp   = matrix.cellToWorld(cx0, cy, cz0);
  const isNS = direction === 'N' || direction === 'S';
  return {
    id:               `RC${String(++rcCounter).padStart(4, '0')}`,
    direction,
    buildingId:       'river_crossing',
    pairedBuildingId: null,
    cells: [{ cx: cx0, cy, cz: cz0 }, { cx: cx1, cy, cz: cz1 }],
    tier: cy,
    x: wp.x,
    y: wp.y + cs - 0.25,
    z: wp.z,
    w: isNS ? 2 * cs : cs,
    d: isNS ? cs     : 2 * cs,
  };
}

export function emitRiverCrossingAnchors(rivers, matrix, config) {
  rcCounter = 0;
  const period = CONNECTIVITY.anchorPeriod ?? 4;
  const { ox, oz, cellSize: cs } = matrix;
  // Match the cy used by tier-0 floor anchors so walkways sit flush with ground.
  const cy = Math.floor(-config.slabThickness / cs);
  const anchors = [];

  for (const river of rivers) {
    for (const bank of (river.banks ?? [])) {
      const anchorDir = OPPOSITE[bank.facing];

      if (bank.axis === 'WE') {
        // Bank runs along X (N or S facing).
        // Anchor pairs are 2-wide in X at a fixed cz inside the river.
        // Use the same global cx % period === 0 grid as emitAnchors.
        const czAnchor = bank.facing === 'N'
          ? Math.round((bank.z - oz) / cs)       // N-facing: first river cell south
          : Math.round((bank.z - oz) / cs) - 1;  // S-facing: last river cell north

        const cxStart = Math.round((bank.x - ox) / cs);
        const nCells  = Math.round(bank.length / cs);

        for (let dcx = 0; dcx <= nCells - 2; dcx++) {
          const cx = cxStart + dcx;
          if (cx % period !== 0) continue;
          if (matrix.getCell(cx,     cy, czAnchor) !== CELL.EMPTY) continue;
          if (matrix.getCell(cx + 1, cy, czAnchor) !== CELL.EMPTY) continue;
          anchors.push(makeAnchor(anchorDir, cx, cy, czAnchor, cx + 1, czAnchor, matrix));
        }

      } else {
        // Bank runs along Z (E or W facing).
        // Anchor pairs are 2-wide in Z at a fixed cx inside the river.
        // Use the same global cz % period === 0 grid as emitAnchors.
        const cxAnchor = bank.facing === 'W'
          ? Math.round((bank.x - ox) / cs)       // W-facing: first river cell east
          : Math.round((bank.x - ox) / cs) - 1;  // E-facing: last river cell west

        const czStart = Math.round((bank.z - oz) / cs);
        const nCells  = Math.round(bank.length / cs);

        for (let dcz = 0; dcz <= nCells - 2; dcz++) {
          const cz = czStart + dcz;
          if (cz % period !== 0) continue;
          if (matrix.getCell(cxAnchor, cy, cz    ) !== CELL.EMPTY) continue;
          if (matrix.getCell(cxAnchor, cy, cz + 1) !== CELL.EMPTY) continue;
          anchors.push(makeAnchor(anchorDir, cxAnchor, cy, cz, cxAnchor, cz + 1, matrix));
        }
      }
    }
  }

  return anchors;
}
