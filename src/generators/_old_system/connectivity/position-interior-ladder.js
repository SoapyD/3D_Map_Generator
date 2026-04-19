import { CONNECTIVITY } from '../../config.js';

const LADDER_WIDTH = CONNECTIVITY.ladderWidth;
const LADDER_DEPTH = CONNECTIVITY.ladderDepth;

export function positionInteriorLadder(qr, side) {
  let x, z, w, d;
  if (side === 'east') {
    x = qr.x + qr.w - LADDER_DEPTH / 2;
    z = qr.z + qr.d / 2 - LADDER_WIDTH / 2;
    w = LADDER_DEPTH; d = LADDER_WIDTH;
  } else if (side === 'west') {
    x = qr.x - LADDER_DEPTH / 2;
    z = qr.z + qr.d / 2 - LADDER_WIDTH / 2;
    w = LADDER_DEPTH; d = LADDER_WIDTH;
  } else if (side === 'south') {
    x = qr.x + qr.w / 2 - LADDER_WIDTH / 2;
    z = qr.z + qr.d - LADDER_DEPTH / 2;
    w = LADDER_WIDTH; d = LADDER_DEPTH;
  } else {
    x = qr.x + qr.w / 2 - LADDER_WIDTH / 2;
    z = qr.z - LADDER_DEPTH / 2;
    w = LADDER_WIDTH; d = LADDER_DEPTH;
  }
  return { x, z, w, d };
}
