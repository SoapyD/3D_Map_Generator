/**
 * Stage 6: Cover Placement
 *
 * Places small cover boxes on:
 * - Building rooftops (highest tier, on each non-deleted floor quadrant)
 * - Ground level (in the footprints of deleted buildings, 1-3 per area)
 *
 * Two types:
 * - Wide: 1.5" wide × 1.5" tall × random depth (2-4")
 * - Long: random width (2-4") × 1.5" tall × 1.5" deep
 */

import { COVER } from '../config.js';

const COVER_THIN = COVER.thin;
const COVER_TYPES = COVER.types;

export function generateCover(data, config, rng) {
  const { tierHeight, slabThickness } = config;
  const cover = [];

  // Track tall cover counts (max 3 total across both types)
  let tallTotal = 0;
  const MAX_TALL = COVER.maxTall;

  // Rooftop cover: place on each top-tier quadrant with a chance
  for (let bi = 0; bi < data.buildings.length; bi++) {
    const b = data.buildings[bi];
    const bq = data.buildingQuadrants[bi];
    const topTier = b.maxTier;
    const present = bq.tiers[topTier];
    if (!present) continue;

    const mx = b.x + b.w / 2;
    const mz = b.z + b.d / 2;
    const y = topTier * tierHeight + slabThickness;

    for (const q of present) {
      // 50% chance per quadrant
      if (!rng.chance(COVER.rooftopChance)) continue;

      const qr = {
        0: { x: b.x, z: b.z, w: b.w / 2, d: b.d / 2 },
        1: { x: mx, z: b.z, w: b.w / 2, d: b.d / 2 },
        2: { x: b.x, z: mz, w: b.w / 2, d: b.d / 2 },
        3: { x: mx, z: mz, w: b.w / 2, d: b.d / 2 },
      }[q];

      const piece = makeCoverPiece(qr, y, rng);
      if (!piece) continue;
      // Enforce max 3 tall objects total
      if (piece.height > 1.5 && tallTotal >= MAX_TALL) continue;
      let overlaps = false;
      for (const existing of cover) {
        if (Math.abs(existing.y - piece.y) > 1) continue;
        if (piece.x < existing.x + existing.w && piece.x + piece.w > existing.x &&
            piece.z < existing.z + existing.d && piece.z + piece.d > existing.z) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        if (piece.height > 1.5) tallTotal++;
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

    const mx = b.x + b.w / 2;
    const mz = b.z + b.d / 2;

    for (let tier = 1; tier < b.maxTier; tier++) {
      const present = bq.tiers[tier];
      if (!present) continue;

      const y = tier * tierHeight + slabThickness;
      // Large: 2-3, Medium: biased 0-1 (roll twice, take higher)
      const minObjects = b.size === 'large' ? 2 : 0;
      const count = b.size === 'large'
        ? rng.int(minObjects, maxObjects)
        : Math.max(rng.int(0, maxObjects), rng.int(0, maxObjects));

      for (let i = 0; i < count; i++) {
        // Pick a random present quadrant
        const q = rng.pick([...present]);
        const qr = {
          0: { x: b.x, z: b.z, w: b.w / 2, d: b.d / 2 },
          1: { x: mx, z: b.z, w: b.w / 2, d: b.d / 2 },
          2: { x: b.x, z: mz, w: b.w / 2, d: b.d / 2 },
          3: { x: mx, z: mz, w: b.w / 2, d: b.d / 2 },
        }[q];

        // Only low walls inside buildings
        const isWide = rng.chance(0.5);
        const w = isWide ? COVER_THIN : rng.float(2, 4);
        const d = isWide ? rng.float(2, 4) : COVER_THIN;
        if (w > qr.w - 0.5 || d > qr.d - 0.5) continue;

        const px = rng.float(qr.x + 0.25, qr.x + qr.w - w - 0.25);
        const pz = rng.float(qr.z + 0.25, qr.z + qr.d - d - 0.25);

        // Check doesn't overlap existing interior cover on same tier
        let overlaps = false;
        for (const existing of interiorCover) {
          if (Math.abs(existing.y - y) > 1) continue;
          if (px < existing.x + existing.w && px + w > existing.x &&
              pz < existing.z + existing.d && pz + d > existing.z) {
            overlaps = true;
            break;
          }
        }
        if (overlaps) continue;

        interiorCover.push({ x: px, z: pz, w, d, height: COVER_THIN, y, interior: true });
      }
    }
  }

  // Ground cover: use deleted building footprints, 1-3 pieces each
  // Check new pieces don't overlap existing cover
  // If footprint is under a larger building, cap height at 3"
  const deleted = data.deletedBuildings || [];
  for (const db of deleted) {
    // Check if this footprint is under a big building (medium/large)
    const underBigBuilding = data.buildings.some((b) =>
      b.size !== 'small' &&
      db.x < b.x + b.w && db.x + db.w > b.x &&
      db.z < b.z + b.d && db.z + db.d > b.z
    );
    const maxHeight = underBigBuilding ? COVER.maxHeightUnderBuilding : Infinity;

    const count = rng.int(1, 3);
    for (let i = 0; i < count; i++) {
      const piece = makeCoverPiece(db, 0, rng);
      if (!piece) continue;
      // Cap height if under a big building
      if (piece.height > maxHeight) piece.height = maxHeight;
      // Enforce max 3 tall objects total
      if (piece.height > 1.5 && tallTotal >= MAX_TALL) continue;
      // Check doesn't overlap existing cover
      let overlaps = false;
      for (const existing of cover) {
        if (Math.abs(existing.y - piece.y) > 1) continue;
        if (piece.x < existing.x + existing.w && piece.x + piece.w > existing.x &&
            piece.z < existing.z + existing.d && piece.z + piece.d > existing.z) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        if (piece.height > 1.5) tallTotal++;
        cover.push(piece);
      }
    }
  }

  // Replace 1 random ground cover piece (not under a building) with a tall object
  const groundNotUnder = cover.filter((c) => {
    if (c.y !== 0 || c.height > 1.5) return false;
    return !data.buildings.some((b) =>
      b.size !== 'small' &&
      c.x < b.x + b.w && c.x + c.w > b.x &&
      c.z < b.z + b.d && c.z + c.d > b.z
    );
  });
  if (groundNotUnder.length > 0) {
    const pick = rng.pick(groundNotUnder);
    pick.height = rng.chance(0.5) ? 3.0 : 6.0;
    pick.w = COVER_THIN;
    pick.d = COVER_THIN;
  }

  // Debug: generate pink footprints for deleted building positions
  const deletedFootprints = deleted.map((db, i) => ({
    x: db.x, z: db.z, w: db.w, d: db.d, index: i,
  }));

  return { ...data, cover, interiorCover, deletedFootprints };
}

/**
 * Create a cover piece randomly placed within a rect.
 * Picks from cover types: 70% low wall, 20% pillar (3"), 10% tall pillar (6").
 * The two taller types are 1.5" x 1.5" footprint.
 */
function makeCoverPiece(rect, y, rng) {
  // Pick cover type
  const roll = rng.random();
  let type;
  let cumulative = 0;
  for (const t of COVER_TYPES) {
    cumulative += t.chance;
    if (roll < cumulative) { type = t; break; }
  }
  if (!type) type = COVER_TYPES[0];

  let w, d;
  if (type.height > 1.5) {
    // Taller types are always 1.5" x 1.5"
    w = COVER_THIN;
    d = COVER_THIN;
  } else {
    // Low wall: one dimension is 1.5", the other is 2-4"
    const isWide = rng.chance(0.5);
    w = isWide ? COVER_THIN : rng.float(2, 4);
    d = isWide ? rng.float(2, 4) : COVER_THIN;
  }

  if (w > rect.w - 0.5 || d > rect.d - 0.5) return null;

  const x = rng.float(rect.x + 0.25, rect.x + rect.w - w - 0.25);
  const z = rng.float(rect.z + 0.25, rect.z + rect.d - d - 0.25);

  return { x, z, w, d, height: type.height, y };
}
