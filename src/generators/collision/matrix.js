import { GLOBAL_GRID } from '../../config.js';

export const CELL = { EMPTY: 0, FLOOR: 1, WALL: 2, OBJECT: 3 };

export function createCollisionMatrix(activeArea, maxTiers, tierHeight) {
  const { cellSize } = GLOBAL_GRID;
  const W   = Math.ceil(activeArea.w / cellSize);
  const D   = Math.ceil(activeArea.d / cellSize);
  const maxY = Math.ceil(((maxTiers + 1) * tierHeight) / cellSize); // +1 tier headroom
  const ox = activeArea.x;
  const oz = activeArea.z;

  // Flat Uint8Array, row-major: index = cx + cz * W + cy * W * D
  const data = new Uint8Array(W * D * maxY);

  function inBounds(cx, cy, cz) {
    return cx >= 0 && cx < W && cy >= 0 && cy < maxY && cz >= 0 && cz < D;
  }

  function idx(cx, cy, cz) {
    return cx + cz * W + cy * W * D;
  }

  function worldToCell(x, y, z) {
    return {
      cx: Math.floor((x - ox) / cellSize),
      cy: Math.floor(y / cellSize),
      cz: Math.floor((z - oz) / cellSize),
    };
  }

  function cellToWorld(cx, cy, cz) {
    return { x: cx * cellSize + ox, y: cy * cellSize, z: cz * cellSize + oz };
  }

  return {
    W, D, maxY, ox, oz, cellSize,
    CELL,
    worldToCell,
    cellToWorld,
    isOccupied(cx, cy, cz) {
      return inBounds(cx, cy, cz) && data[idx(cx, cy, cz)] !== CELL.EMPTY;
    },
    getCell(cx, cy, cz) {
      return inBounds(cx, cy, cz) ? data[idx(cx, cy, cz)] : CELL.EMPTY;
    },
    setCell(cx, cy, cz, value = CELL.FLOOR) {
      if (inBounds(cx, cy, cz)) data[idx(cx, cy, cz)] = value;
    },
    fillBox(x, y, z, w, h, d, value = CELL.FLOOR) {
      const c0 = worldToCell(x, y, z);
      const c1 = worldToCell(x + w, y + h, z + d);
      for (let cy = c0.cy; cy < c1.cy; cy++)
        for (let cz = c0.cz; cz < c1.cz; cz++)
          for (let cx = c0.cx; cx < c1.cx; cx++)
            if (inBounds(cx, cy, cz)) data[idx(cx, cy, cz)] = value;
    },
    toDebugJSON() {
      return { W, D, maxY, ox, oz, cellSize, cells: Array.from(data) };
    },
  };
}
