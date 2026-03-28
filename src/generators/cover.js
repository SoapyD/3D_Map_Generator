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

import { COVER, DELETIONS } from '../config.js';

const COVER_THIN = COVER.thin;
const COVER_TYPES = COVER.types;

export function generateCover(data, config, rng) {
  const { tierHeight, slabThickness } = config;
  const cover = [];

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

        // Interior cover: 75% chance 0.75" tall, 25% chance 1.5" tall
        const interiorHeight = rng.chance(0.75) ? 0.75 : COVER_THIN;
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

        interiorCover.push({ x: px, z: pz, w, d, height: interiorHeight, y, interior: true });
      }
    }
  }

  // Generate courtyard footprints first, cull, then place cover only on survivors
  const deleted = data.deletedBuildings || [];
  let deletedFootprints = deleted.map((db, i) => ({
    x: db.x - 0.75, z: db.z - 0.75, w: db.w + 1.5, d: db.d + 1.5, index: i,
  }));
  if (DELETIONS.courtyardWallCull) {
    deletedFootprints = deletedFootprints.filter((fp) => {
      for (const wall of data.walls) {
        const wallX1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
        const wallZ1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
        if (fp.x < wallX1 && fp.x + fp.w > wall.x &&
            fp.z < wallZ1 && fp.z + fp.d > wall.z) {
          return false;
        }
      }
      return true;
    });
  }

  // Ground cover: place on surviving courtyard footprints only
  const allLadders = [
    ...(data.connections?.ladders || []),
    ...(data.connections?.groundLadders || []),
    ...(data.connections?.orangeLadders || []),
    ...(data.connections?.interiorLadders || []),
  ];
  for (const fp of deletedFootprints) {
    const count = rng.int(1, 3);
    for (let i = 0; i < count; i++) {
      const piece = makeCoverPiece(fp, 0.65, rng);
      if (!piece) continue;
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
      // Check doesn't overlap ladders
      if (!overlaps) {
        for (const l of allLadders) {
          if (piece.x < l.x + l.w && piece.x + piece.w > l.x &&
              piece.z < l.z + l.d && piece.z + piece.d > l.z) {
            overlaps = true;
            break;
          }
        }
      }
      if (!overlaps) {
        cover.push(piece);
      }
    }
  }

  // Street scatter: 20 random objects placed anywhere on ground floor
  const streetScatter = [];
  const mapW = config.mapWidth;
  const mapD = config.mapDepth;
  for (let attempt = 0; attempt < 200 && streetScatter.length < 20; attempt++) {
    const roll = rng.random();
    let type;
    let cumulative = 0;
    for (const t of COVER_TYPES) {
      cumulative += t.chance;
      if (roll < cumulative) { type = t; break; }
    }
    if (!type) type = COVER_TYPES[0];

    const isWide = rng.chance(0.5);
    const w = isWide ? COVER_THIN : rng.float(2, 4);
    const d = isWide ? rng.float(2, 4) : COVER_THIN;
    const x = rng.float(0.5, mapW - w - 0.5);
    const z = rng.float(0.5, mapD - d - 0.5);
    const piece = { x, z, w, d, height: type.height, y: 0.65, streetScatter: true };

    // Check against walls
    let blocked = false;
    for (const wall of data.walls) {
      if (wall.baseY > 1) continue; // only ground-level walls
      const wallX1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
      const wallZ1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
      if (piece.x < wallX1 && piece.x + piece.w > wall.x &&
          piece.z < wallZ1 && piece.z + piece.d > wall.z) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    // Check against ladders
    for (const l of allLadders) {
      if (piece.x < l.x + l.w && piece.x + piece.w > l.x &&
          piece.z < l.z + l.d && piece.z + piece.d > l.z) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    // Check against existing cover
    for (const existing of cover) {
      if (Math.abs(existing.y - piece.y) > 1) continue;
      if (piece.x < existing.x + existing.w && piece.x + piece.w > existing.x &&
          piece.z < existing.z + existing.d && piece.z + piece.d > existing.z) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    // Check against other street scatter
    for (const existing of streetScatter) {
      if (piece.x < existing.x + existing.w && piece.x + piece.w > existing.x &&
          piece.z < existing.z + existing.d && piece.z + piece.d > existing.z) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    // Check against courtyards
    for (const fp of deletedFootprints) {
      if (piece.x < fp.x + fp.w && piece.x + piece.w > fp.x &&
          piece.z < fp.z + fp.d && piece.z + piece.d > fp.z) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    streetScatter.push(piece);
  }

  // Remove ground-level cover that intersects visible building walls
  const filteredCover = cover.filter((c) => {
    if (c.y > slabThickness + 0.1) return true; // only check ground level
    for (const wall of data.walls) {
      const wallX1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
      const wallZ1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
      if (c.x < wallX1 && c.x + c.w > wall.x &&
          c.z < wallZ1 && c.z + c.d > wall.z) {
        return false;
      }
    }
    return true;
  });

  return { ...data, cover: filteredCover, interiorCover, deletedFootprints, streetScatter };
}

/**
 * Create a cover piece randomly placed within a rect.
 * Picks from cover types (0.75" rubble or 1.5" low wall).
 * One dimension is 1.5", the other is 2-4".
 */
function makeCoverPiece(rect, y, rng) {
  const roll = rng.random();
  let type;
  let cumulative = 0;
  for (const t of COVER_TYPES) {
    cumulative += t.chance;
    if (roll < cumulative) { type = t; break; }
  }
  if (!type) type = COVER_TYPES[0];

  const isWide = rng.chance(0.5);
  const w = isWide ? COVER_THIN : rng.float(2, 4);
  const d = isWide ? rng.float(2, 4) : COVER_THIN;

  if (w > rect.w - 0.5 || d > rect.d - 0.5) return null;

  const x = rng.float(rect.x + 0.25, rect.x + rect.w - w - 0.25);
  const z = rng.float(rect.z + 0.25, rect.z + rect.d - d - 0.25);

  return { x, z, w, d, height: type.height, y };
}
