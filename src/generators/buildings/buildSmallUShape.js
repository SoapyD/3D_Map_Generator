import { BUILDING } from '../../config.js';

const FOOTPRINTS = BUILDING.footprints;

/**
 * Build a small U: 2x3 grid, each cell is tower-sized, 5 of 6 filled.
 * Returns an array of building objects to push.
 */
export function buildSmallUShape(shape, x, z, maxTier, heightKey, rng, startIndex) {
  const groupId = startIndex;
  const tFp = FOOTPRINTS.tower || { min: 2, max: 3 };
  const segW = rng.float(tFp.min, tFp.max);
  const segD = rng.float(tFp.min, tFp.max);
  const bProps = { maxTier, size: 'small', height: heightKey, blockIndex: 0, shape: 'full', textureGroup: groupId };

  // Grid positions (row, col) -> { x, z, w: segW, d: segD }
  // Gap position determines which cell is empty
  const cells = [];
  let gapR, gapC; // row, col of the gap
  if (shape === 'uSmallN') { gapR = 1; gapC = 1; }      // ##  #.  ##
  else if (shape === 'uSmallS') { gapR = 1; gapC = 0; }  // ##  .#  ##
  else if (shape === 'uSmallE') { gapR = 2; gapC = 1; }  // ###  #.#  (3x2, gap bottom-middle)
  else { gapR = 0; gapC = 1; }                            // #.#  ###  (3x2, gap top-middle)

  const isRotated = shape === 'uSmallE' || shape === 'uSmallW';
  const cols = isRotated ? 3 : 2;
  const rows = isRotated ? 2 : 3;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === gapR && c === gapC) continue;
      const cx = x + c * segW;
      const cz = z + r * segD;

      // Suppress edges facing adjacent filled cells
      const sup = [];
      // Check each neighbor
      if (r > 0 && !(r - 1 === gapR && c === gapC)) sup.push({ edge: 'north' });
      if (r < rows - 1 && !(r + 1 === gapR && c === gapC)) sup.push({ edge: 'south' });
      if (c > 0 && !(r === gapR && c - 1 === gapC)) sup.push({ edge: 'west' });
      if (c < cols - 1 && !(r === gapR && c + 1 === gapC)) sup.push({ edge: 'east' });

      cells.push({ x: cx, z: cz, w: segW, d: segD, suppressEdges: sup });
    }
  }

  return cells.map(cell => ({
    x: cell.x, z: cell.z, w: cell.w, d: cell.d, ...bProps, suppressEdges: cell.suppressEdges,
  }));
}
