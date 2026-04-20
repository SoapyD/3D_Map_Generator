import { COVER } from '../../config.js';
import { pickCoverType } from '../selectors/index.js';
import { overlapsAny } from './cover-overlap.js';
import { hitsAnyWall } from './cover-hits-wall.js';
import { makeCoverPiece } from './make-cover-piece.js';

const COVER_THIN = COVER.thin;

export function generateGroundAndStreetCover(data, config, rng, cover, allLadders, deletedFootprints) {
  const groundY = COVER.groundCoverY;
  const groundCover = [];

  for (const fp of deletedFootprints) {
    const count = rng.int(1, 3);
    for (let i = 0; i < count; i++) {
      const piece = makeCoverPiece(fp, groundY, rng);
      if (!piece) continue;
      if (overlapsAny(piece, cover)) continue;
      if (overlapsAny(piece, groundCover)) continue;
      if (overlapsAny(piece, allLadders)) continue;
      groundCover.push(piece);
    }
  }

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
    if (overlapsAny(piece, groundCover)) continue;
    if (overlapsAny(piece, streetScatter)) continue;
    if (overlapsAny(piece, deletedFootprints)) continue;
    streetScatter.push(piece);
  }

  return { groundCover, streetScatter };
}
