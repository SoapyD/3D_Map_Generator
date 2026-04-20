import { COVER } from '../../config.js';
import { getQuadrantRect } from '../../core/get-quadrant-rect.js';
import { overlapsAny } from './cover-overlap.js';
import { makeCoverPiece } from './make-cover-piece.js';

export function generateRooftopCover(data, config, rng) {
  const { tierHeight, slabThickness } = config;
  const cover = [];
  for (let bi = 0; bi < data.buildings.length; bi++) {
    const b = data.buildings[bi];
    if (b.pyramidRoof) continue;
    const bq = data.buildingQuadrants[bi];
    const topTier = b.maxTier;
    const present = bq.tiers[topTier];
    if (!present) continue;
    const y = topTier * tierHeight + slabThickness;
    for (const q of present) {
      if (!rng.chance(COVER.rooftopChance)) continue;
      const qr = getQuadrantRect(b, q);
      const piece = makeCoverPiece(qr, y, rng);
      if (!piece) continue;
      if (!overlapsAny(piece, cover)) cover.push(piece);
    }
  }
  return cover;
}
