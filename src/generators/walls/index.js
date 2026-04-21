import { extractWallSegments } from './extract-wall-segments.js';
import { subdivideWall }       from './subdivide-wall.js';
import { buildWindowPlans, applyWindowPlan } from './place-windows.js';
import { applyBlobDamage }     from './apply-blob-damage.js';
import { mergeWallCells }      from './merge-wall-cells.js';
import { CELL, STAGE } from '../collision/matrix.js';
import { WALL } from '../../config.js';

const WALL_CELL = { N: CELL.WALL_N, S: CELL.WALL_S, E: CELL.WALL_E, W: CELL.WALL_W };

// Find the building whose footprint contains the wall's midpoint.
function findBuildingIndex(wall, buildings) {
  const midX = wall.x + wall.w / 2;
  const midZ = wall.z + wall.d / 2;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (midX >= b.x && midX <= b.x + b.w && midZ >= b.z && midZ <= b.z + b.d) return i;
  }
  return 0;
}

function ruinsMediumKeep(dirs, size, rng) {
  const longDirs  = size === 'ruins-medium-h' ? ['N', 'S'] : ['E', 'W'];
  const shortDirs = size === 'ruins-medium-h' ? ['E', 'W'] : ['N', 'S'];
  const long  = rng.pick(longDirs.filter(d => dirs.has(d)));
  const short = rng.pick(shortDirs.filter(d => dirs.has(d)));
  return new Set([long, short].filter(Boolean));
}

// For each building+floor, randomly keep at most 2 wall directions and discard the rest.
function cullToTwoSides(walls, buildings, rng) {
  const kept = new Map(); // key → Set of 2 directions to keep
  for (const wall of walls) {
    const key = `${findBuildingIndex(wall, buildings)}:${wall.floorY}`;
    if (!kept.has(key)) kept.set(key, new Set());
    kept.get(key).add(wall.direction);
  }
  for (const [key, dirs] of kept) {
    if (dirs.size <= 2) continue;
    const bi = parseInt(key.split(':')[0]);
    const size = buildings[bi].size;
    if (size === 'ruins-medium-h' || size === 'ruins-medium-v') {
      kept.set(key, ruinsMediumKeep(dirs, size, rng));
    } else {
      const first  = rng.pick([...dirs]);
      const second = rng.pick([...dirs].filter(d => d !== first));
      kept.set(key, new Set([first, second]));
    }
  }
  return walls.filter(wall => {
    const key = `${findBuildingIndex(wall, buildings)}:${wall.floorY}`;
    return kept.get(key).has(wall.direction);
  });
}

export function generateWalls(data, config, rng, matrix) {
  const { walls: rawWalls, internalWalls } = extractWallSegments(data, config, matrix);

  const culledWalls = WALL.applySegmentCull ? cullToTwoSides(rawWalls, data.buildings, rng) : rawWalls;
  const windowPlans = buildWindowPlans(data.buildings, rng);

  const walls = [];

  for (const wall of culledWalls) {
    const bi    = findBuildingIndex(wall, data.buildings);
    const plans = windowPlans[bi];
    const isNS  = wall.direction === 'N' || wall.direction === 'S';
    const plan  = plans ? (isNS ? plans.ns : plans.ew) : null;

    const grid = subdivideWall(wall);
    if (WALL.applyBlobDamage) applyBlobDamage(grid, rng);
    if (WALL.applyWindows) applyWindowPlan(grid, wall, plan, data.buildings[bi]);

    for (const seg of mergeWallCells(grid, wall)) {
      matrix.setWriteContext(STAGE.WALLS, walls.length);
      walls.push(seg);
      matrix.fillBoxUnless(seg.x, seg.y, seg.z, seg.w, seg.h, seg.d, WALL_CELL[wall.direction], CELL.DOOR);
    }
  }

  return { ...data, walls, internalWalls };
}
