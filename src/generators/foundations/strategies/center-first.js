import { bspSplit } from '../bsp-split.js';
import { biasedCenter } from '../split-strategies/biased-center.js';
import { GRID } from '../../../config.js';

const MIN_BLOCK = GRID.minBlockSize;

function snapToBBD(v, bbd) { return Math.round(v / bbd) * bbd; }

/**
 * Places one foundation whose centre is as close to the map centre as the BBD
 * grid allows, then BSP-fills the four surrounding rectangular regions.
 * The centre block's size is picked using the same mechanism BSP uses for its
 * split positions: rng.float within a valid range, snapped to BBD.
 */
export function generateCenterFirst(activeArea, rng, streetWidth, bbd) {
  const { x: ox, z: oz, w: aw, d: ad } = activeArea;
  const cx = ox + aw / 2;
  const cz = oz + ad / 2;

  // Same sizing mechanism as BSP splits — rng.float in a valid range, BBD-snapped.
  // Max leaves room for a street gap plus at least one surrounding block on each side.
  const minSize = MIN_BLOCK;
  const maxSize = Math.max(minSize, aw - 2 * (MIN_BLOCK + streetWidth));
  const blockW = snapToBBD(rng.float(minSize, maxSize), bbd);
  const blockD = snapToBBD(rng.float(minSize, Math.max(minSize, ad - 2 * (MIN_BLOCK + streetWidth))), bbd);

  // Snap position so the block's centre lands as close as possible to the map centre.
  // Odd-BBD sizes sit half a BBD off — your spec allowed that ("offset a little").
  const blockX = snapToBBD(cx - blockW / 2, bbd);
  const blockZ = snapToBBD(cz - blockD / 2, bbd);

  const centerBlock = { x: blockX, z: blockZ, w: blockW, d: blockD };
  const leaves = [centerBlock];

  // Four rectangular regions surrounding the centre block (street gap on each side)
  const sw = streetWidth;
  const regions = [
    // top strip — full width
    { x: ox,              z: oz,              w: aw,                       d: blockZ - oz - sw          },
    // bottom strip — full width
    { x: ox,              z: blockZ+blockD+sw, w: aw,                      d: oz+ad - (blockZ+blockD+sw) },
    // left column — centre band only
    { x: ox,              z: blockZ,           w: blockX - ox - sw,        d: blockD                    },
    // right column — centre band only
    { x: blockX+blockW+sw, z: blockZ,          w: ox+aw-(blockX+blockW+sw), d: blockD                   },
  ];

  for (const r of regions) {
    if (r.w >= MIN_BLOCK && r.d >= MIN_BLOCK) {
      bspSplit(r, rng, sw, bbd, leaves, biasedCenter);
    }
  }

  return leaves;
}
