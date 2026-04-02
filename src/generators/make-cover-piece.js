import { COVER } from '../config.js';
import { pickCoverType } from './pick/pickCoverType.js';

const COVER_THIN = COVER.thin;

/**
 * Create a cover piece randomly placed within a rect.
 */
export function makeCoverPiece(rect, y, rng) {
  const type = pickCoverType(rng);
  const isWide = rng.chance(0.5);
  const w = isWide ? COVER_THIN : rng.float(2, 4);
  const d = isWide ? rng.float(2, 4) : COVER_THIN;

  if (w > rect.w - 0.5 || d > rect.d - 0.5) return null;

  const pad = COVER.placementPadding;
  const x = rng.float(rect.x + pad, rect.x + rect.w - w - pad);
  const z = rng.float(rect.z + pad, rect.z + rect.d - d - pad);

  return { x, z, w, d, height: type.height, y };
}
