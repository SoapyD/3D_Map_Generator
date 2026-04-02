/**
 * Stage 6: Cover Placement
 *
 * Places small cover boxes on:
 * - Building rooftops (highest tier, on each non-deleted floor quadrant)
 * - Ground level (in the footprints of deleted buildings, 1-3 per area)
 * - Street scatter (random placement across the ground floor)
 *
 * Two types:
 * - Wide: 1.5" wide × 0.75-1.5" tall × random depth (2-4")
 * - Long: random width (2-4") × 0.75-1.5" tall × 1.5" deep
 */

import { COVER, DELETIONS, GEOMETRY } from '../config.js';
import { getQuadrantRect } from '../core/get-quadrant-rect.js';
import { pickCoverType } from './pick-cover-type.js';
import { overlapsAny } from './cover-overlap.js';
import { hitsAnyWall } from './cover-hits-wall.js';
import { makeCoverPiece } from './make-cover-piece.js';

const COVER_THIN = COVER.thin;

export function generateCover(data, config, rng) {
  const { tierHeight, slabThickness } = config;
  const cover = [];

  // Rooftop cover: place on each top-tier quadrant with a chance
  for (let bi = 0; bi < data.buildings.length; bi++) {
    const b = data.buildings[bi];
    if (b.pyramidRoof) continue; // no cover on pyramid roofs
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
      if (!overlapsAny(piece, cover)) {
        cover.push(piece);
      }
    }
  }

  // Interior cover: medium/large buildings get objects on mid-floors (not ground or roof)
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

  // Generate courtyard footprints first, cull, then place cover only on survivors
  const deleted = data.deletedBuildings || [];
  const expansion = COVER.courtyardExpansion;
  let deletedFootprints = deleted.map((db, i) => ({
    x: db.x - expansion, z: db.z - expansion, w: db.w + expansion * 2, d: db.d + expansion * 2, index: i,
  }));
  if (DELETIONS.courtyardWallCull) {
    deletedFootprints = deletedFootprints.filter((fp) => !hitsAnyWall(fp, data.walls));
  }

  // Ground cover: place on surviving courtyard footprints only
  const allLadders = [
    ...(data.connections?.ladders || []),
    ...(data.connections?.groundLadders || []),
    ...(data.connections?.orangeLadders || []),
    ...(data.connections?.interiorLadders || []),
  ];
  const groundY = COVER.groundCoverY;
  for (const fp of deletedFootprints) {
    const count = rng.int(1, 3);
    for (let i = 0; i < count; i++) {
      const piece = makeCoverPiece(fp, groundY, rng);
      if (!piece) continue;
      if (overlapsAny(piece, cover)) continue;
      if (overlapsAny(piece, allLadders)) continue;
      cover.push(piece);
    }
  }

  // Street scatter: random objects placed anywhere on ground floor
  const streetScatter = [];
  const mapW = config.mapWidth;
  const mapD = config.mapDepth;
  const scatterTarget = COVER.streetScatterTarget;
  const scatterAttempts = COVER.streetScatterAttempts;
  for (let attempt = 0; attempt < scatterAttempts && streetScatter.length < scatterTarget; attempt++) {
    const type = pickCoverType(rng);
    const isWide = rng.chance(0.5);
    const w = isWide ? COVER_THIN : rng.float(2, 4);
    const d = isWide ? rng.float(2, 4) : COVER_THIN;
    const x = rng.float(0.5, mapW - w - 0.5);
    const z = rng.float(0.5, mapD - d - 0.5);
    const piece = { x, z, w, d, height: type.height, y: groundY, streetScatter: true };

    if (hitsAnyWall(piece, data.walls, true)) continue;
    if (overlapsAny(piece, allLadders)) continue;
    if (overlapsAny(piece, cover)) continue;
    if (overlapsAny(piece, streetScatter)) continue;
    if (overlapsAny(piece, deletedFootprints)) continue;

    streetScatter.push(piece);
  }

  // Remove ground-level cover that intersects visible building walls
  const filteredCover = cover.filter((c) => {
    if (c.y > slabThickness + 0.1) return true;
    return !hitsAnyWall(c, data.walls);
  });

  return { ...data, cover: filteredCover, interiorCover, deletedFootprints, streetScatter };
}
