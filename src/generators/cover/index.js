import { CELL } from '../collision/matrix.js';

const CARDINALS = [[-1,0],[1,0],[0,-1],[0,1]];

const STREET_COLORS = [
  '#ff6655', '#ffaa33', '#eedd22', '#44ee77', '#33bbff',
  '#aa66ff', '#ff66aa', '#ff9944', '#88ee44', '#33ddcc',
];

const SMALL_PIECES = [
  { w: 2, d: 2, h: 1 },
  { w: 2, d: 2, h: 2 },
];

const LONG_PIECES = [
  { w: 2, d: 3, h: 1 }, { w: 3, d: 2, h: 1 },
  { w: 2, d: 3, h: 2 }, { w: 3, d: 2, h: 2 },
];

const MAX_PLACE_ATTEMPTS = 20;

// --- Neighbour checks ---

function aboveCellNextToPillar(cx, cy, cz, matrix) {
  const ay = cy + 1;
  for (const [dx, dz] of CARDINALS) {
    if (matrix.getCell(cx + dx, ay, cz + dz) === CELL.PILLAR) return true;
  }
  return false;
}

function adjacentToRiverBank(cx, cy, cz, matrix) {
  for (const [dx, dz] of CARDINALS) {
    if (matrix.getCell(cx + dx, cy, cz + dz) === CELL.RIVER_BANK) return true;
  }
  return false;
}

// --- Grouping helpers ---

function findBuildingIndex(wx, wz, buildings) {
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (wx >= b.x && wx < b.x + b.w && wz >= b.z && wz < b.z + b.d) return i;
  }
  return -1;
}

function cyToTier(cy, config) {
  const levelHeight = config.tierHeight + config.slabThickness;
  return Math.round((cy + config.slabThickness) / levelHeight);
}

function groupFloorCells(cells, buildings, config) {
  const map = new Map();
  for (const entry of cells) {
    const bi   = findBuildingIndex(entry.wx, entry.wz, buildings);
    const tier = cyToTier(entry.cy, config);
    const key  = `${bi}-${tier}`;
    if (!map.has(key)) map.set(key, { buildingIndex: bi, tier, cells: [], pieces: [] });
    map.get(key).cells.push(entry);
  }
  return [...map.values()].sort((a, b) => a.buildingIndex - b.buildingIndex || a.tier - b.tier);
}

function groupRoofCells(cells, buildings) {
  const map = new Map();
  for (const entry of cells) {
    const bi = findBuildingIndex(entry.wx, entry.wz, buildings);
    if (!map.has(bi)) map.set(bi, { buildingIndex: bi, cells: [], pieces: [] });
    map.get(bi).cells.push(entry);
  }
  return [...map.values()].sort((a, b) => a.buildingIndex - b.buildingIndex);
}

function groupStreetCells(cells, streets) {
  const groups = streets.map((r, i) => ({
    index: i,
    rect: r,
    cells: [],
    pieces: [],
    color: STREET_COLORS[i % STREET_COLORS.length],
  }));
  for (const entry of cells) {
    const g = groups.find(g =>
      entry.wx >= g.rect.x && entry.wx < g.rect.x + g.rect.w &&
      entry.wz >= g.rect.z && entry.wz < g.rect.z + g.rect.d
    );
    if (g) g.cells.push(entry);
  }
  return groups.filter(g => g.cells.length > 0);
}

// --- Placement ---

function tryPlacePiece(available, arrCache, piece, rng) {
  for (let attempt = 0; attempt < MAX_PLACE_ATTEMPTS; attempt++) {
    if (!arrCache.length) break;
    const key = rng.pick(arrCache);
    const comma = key.indexOf(',');
    const cx = +key.slice(0, comma);
    const cz = +key.slice(comma + 1);
    let fits = true;
    const toRemove = [];
    outer: for (let dx = 0; dx < piece.w; dx++) {
      for (let dz = 0; dz < piece.d; dz++) {
        const k = `${cx + dx},${cz + dz}`;
        if (!available.has(k)) { fits = false; break outer; }
        toRemove.push(k);
      }
    }
    if (fits) {
      for (const k of toRemove) available.delete(k);
      arrCache.length = 0;
      arrCache.push(...available);
      return { cx, cz };
    }
  }
  return null;
}

function placeInGroup(group, cy, pieceList, rng, ox, oz, cellSize) {
  if (!group.cells.length || !pieceList.length) return;
  const available = new Set(group.cells.map(c => `${c.cx},${c.cz}`));
  const arrCache  = [...available];
  const wy = (cy + 1) * cellSize;

  for (const piece of pieceList) {
    const placed = tryPlacePiece(available, arrCache, piece, rng);
    if (!placed) continue;
    group.pieces.push({
      x: placed.cx * cellSize + ox,
      y: wy,
      z: placed.cz * cellSize + oz,
      w: piece.w,
      height: piece.h,
      d: piece.d,
    });
  }
}

// --- Piece budget decisions ---

function normaliseSize(size) {
  if (!size) return 'small';
  if (size.startsWith('large')) return 'large';
  if (size.startsWith('ruins-medium')) return 'medium';
  if (size.startsWith('ruins-small') || size === 'ruins') return 'small';
  return size; // 'small' | 'medium'
}

function shellPieceList(size, rng) {
  switch (normaliseSize(size)) {
    case 'small':
      return rng.chance(0.5) ? [rng.pick(SMALL_PIECES)] : [];
    case 'medium':
      return rng.chance(0.5)
        ? [rng.pick(SMALL_PIECES), rng.pick(SMALL_PIECES)]
        : [rng.pick(LONG_PIECES)];
    case 'large': {
      const roll = rng.random();
      if (roll < 0.4) return [rng.pick(SMALL_PIECES), rng.pick(SMALL_PIECES), rng.pick(LONG_PIECES)];
      if (roll < 0.7) return [rng.pick(LONG_PIECES), rng.pick(LONG_PIECES)];
      return [rng.pick(SMALL_PIECES), rng.pick(SMALL_PIECES), rng.pick(SMALL_PIECES)];
    }
    default: return [];
  }
}

function streetPieceList(area, rng) {
  let count, longChance;
  if      (area <= 20) { count = rng.int(0, 1); longChance = 0; }
  else if (area <= 48) { count = rng.int(1, 2); longChance = 0.20; }
  else                 { count = rng.int(2, 3); longChance = 0.35; }
  return Array.from({ length: count }, () =>
    rng.chance(longChance) ? rng.pick(LONG_PIECES) : rng.pick(SMALL_PIECES)
  );
}

// --- Main ---

export function generateCover(data, config, rng, matrix) {
  const { W, D, maxY, ox, oz, cellSize } = matrix;
  const cyMin     = -Math.ceil(config.slabThickness / cellSize);
  const buildings = data.buildings ?? [];
  const streets   = data.streets   ?? [];

  const rawFloor  = [];
  const rawRoof   = [];
  const rawStreet = [];

  for (let cy = cyMin; cy < maxY; cy++) {
    for (let cz = 0; cz < D; cz++) {
      for (let cx = 0; cx < W; cx++) {
        const v        = matrix.getCell(cx, cy, cz);
        const isFloor  = v === CELL.FLOOR;
        const isRoof   = v === CELL.ROOF;
        const isStreet = v === CELL.STREET;
        if (!isFloor && !isRoof && !isStreet) continue;
        if (aboveCellNextToPillar(cx, cy, cz, matrix)) continue;
        if (isStreet && adjacentToRiverBank(cx, cy, cz, matrix)) continue;

        const wx = cx * cellSize + ox;
        const wy = (cy + 1) * cellSize;
        const wz = cz * cellSize + oz;
        const entry = { cx, cy, cz, wx, wy, wz };

        if      (isFloor)  rawFloor.push(entry);
        else if (isRoof)   rawRoof.push(entry);
        else               rawStreet.push(entry);
      }
    }
  }

  const shells       = groupFloorCells(rawFloor, buildings, config);
  const roofs        = groupRoofCells(rawRoof, buildings);
  const streetGroups = groupStreetCells(rawStreet, streets);

  for (const group of shells) {
    const b = buildings[group.buildingIndex];
    if (!b) continue;
    placeInGroup(group, group.cells[0].cy, shellPieceList(b.size, rng), rng, ox, oz, cellSize);
  }

  for (const group of roofs) {
    const b = buildings[group.buildingIndex];
    if (!b) continue;
    placeInGroup(group, group.cells[0].cy, shellPieceList(b.size, rng), rng, ox, oz, cellSize);
  }

  for (const group of streetGroups) {
    const area = group.rect.w * group.rect.d;
    placeInGroup(group, group.cells[0].cy, streetPieceList(area, rng), rng, ox, oz, cellSize);
  }

  const cover        = [...shells, ...roofs].flatMap(g => g.pieces);
  const streetScatter = streetGroups.flatMap(g => g.pieces);
  const totalPieces  = cover.length + streetScatter.length;

  console.log(
    `  Free space: ${rawFloor.length} floor (${shells.length} groups), ` +
    `${rawRoof.length} roof (${roofs.length} buildings), ` +
    `${rawStreet.length} street (${streetGroups.length} corridors)`
  );
  console.log(`  Cover placed: ${totalPieces} pieces total`);

  return { ...data, freeSpace: { shells, roofs, streets: streetGroups }, cover, streetScatter };
}
