import { COVER } from '../../config.js';
import { getQuadrantRect } from '../../core/get-quadrant-rect.js';
import { overlapsAny } from './cover-overlap.js';

const COVER_THIN = COVER.thin;

export function generateInteriorCover(data, config, rng) {
  const { tierHeight, slabThickness } = config;
  const interiorCover = [];
  for (let bi = 0; bi < data.buildings.length; bi++) {
    const b = data.buildings[bi];
    if (b.size !== 'medium' && b.size !== 'large') continue;
    const bq = data.buildingQuadrants[bi];
    const maxObjects = b.size === 'large' ? COVER.interiorMaxLarge : COVER.interiorMaxMedium;
    for (let tier = 1; tier < b.maxTier; tier++) {
      const present = bq.tiers[tier];
      if (!present) continue;
      const y = tier * tierHeight + slabThickness;
      const minObjects = b.size === 'large' ? 2 : 0;
      const count = b.size === 'large'
        ? rng.int(minObjects, maxObjects)
        : Math.max(rng.int(0, maxObjects), rng.int(0, maxObjects));
      for (let i = 0; i < count; i++) {
        const q = rng.pick([...present]);
        const qr = getQuadrantRect(b, q);
        const interiorHeight = rng.chance(COVER.interiorShortChance) ? 0.75 : COVER_THIN;
        const isWide = rng.chance(0.5);
        const w = isWide ? COVER_THIN : rng.float(2, 4);
        const d = isWide ? rng.float(2, 4) : COVER_THIN;
        if (w > qr.w - 0.5 || d > qr.d - 0.5) continue;
        const pad = COVER.placementPadding;
        const px = rng.float(qr.x + pad, qr.x + qr.w - w - pad);
        const pz = rng.float(qr.z + pad, qr.z + qr.d - d - pad);
        const candidate = { x: px, z: pz, w, d, y };
        if (!overlapsAny(candidate, interiorCover)) {
          interiorCover.push({ x: px, z: pz, w, d, height: interiorHeight, y, interior: true });
        }
      }
    }
  }
  return interiorCover;
}
