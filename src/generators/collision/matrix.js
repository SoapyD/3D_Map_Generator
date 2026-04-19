import { GLOBAL_GRID } from '../../config.js';

// 255 = empty/unoccupied (Uint8Array default is 0, so we fill explicitly)
export const CELL = {
  EMPTY:   255,
  SHELL:   0,
  FLOOR:   1,
  WALL:    2,   // generic / interior wall
  OBJECT:  3,
  // Directional floor edge labels — single exposed edge
  FLOOR_N: 10, FLOOR_S: 11, FLOOR_E: 12, FLOOR_W: 13,
  // Corner floor edge labels — two exposed edges
  FLOOR_NE: 14, FLOOR_NW: 15, FLOOR_SE: 16, FLOOR_SW: 17,
  // Directional wall geometry
  WALL_N:  20, WALL_S:  21, WALL_E:  22, WALL_W:  23,
  // End cells — 3 exposed edges, named by the ONE connected (non-exposed) face
  FLOOR_END_N: 30, FLOOR_END_S: 31, FLOOR_END_E: 32, FLOOR_END_W: 33,
  // Island cell — all 4 cardinal edges exposed, no floor neighbours
  FLOOR_ISLAND: 34,
  // Roof slab — top of building shell
  ROOF:   40,
  ROOF_N: 41, ROOF_S: 42, ROOF_E: 43, ROOF_W: 44,
  // Ground-level placeholders (replaced by real geometry in later stages)
  FOUNDATION_PLACEHOLDER: 50,
  STREET_PLACEHOLDER:     51,
};

// Number of cells reserved below world Y=0 (for rivers, sewers, tunnels).
export const BELOW_GROUND = 12;

export function createCollisionMatrix(activeArea, maxTiers, tierHeight, slabThickness = 1) {
  const { cellSize } = GLOBAL_GRID;
  const W   = Math.ceil(activeArea.w / cellSize);
  const D   = Math.ceil(activeArea.d / cellSize);
  const maxY = (maxTiers + 1) * (tierHeight + slabThickness); // +1 tier headroom (above-ground only)
  const totalY = maxY + BELOW_GROUND;
  const ox = activeArea.x;
  const oz = activeArea.z;

  // Flat Uint8Array, row-major: index = cx + cz * W + (cy + BELOW_GROUND) * W * D
  // cy is a world cell coordinate; negative values address below-ground cells.
  const data = new Uint8Array(W * D * totalY);
  data.fill(CELL.EMPTY);

  function inBounds(cx, cy, cz) {
    return cx >= 0 && cx < W && cy >= -BELOW_GROUND && cy < maxY && cz >= 0 && cz < D;
  }

  function idx(cx, cy, cz) {
    return cx + cz * W + (cy + BELOW_GROUND) * W * D;
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
    setCellType(cx, cy, cz, type) {
      if (inBounds(cx, cy, cz)) data[idx(cx, cy, cz)] = type;
    },
    getCell(cx, cy, cz) {
      return inBounds(cx, cy, cz) ? data[idx(cx, cy, cz)] : CELL.EMPTY;
    },
    setCell(cx, cy, cz, value = CELL.FLOOR) {
      if (inBounds(cx, cy, cz)) data[idx(cx, cy, cz)] = value;
    },
    fillBox(x, y, z, w, h, d, value = CELL.FLOOR) {
      const c0 = worldToCell(x, y, z);
      // Use ceil so boxes smaller than one cell still mark at least one cell
      const cxEnd = Math.ceil((x + w - ox) / cellSize);
      const cyEnd = Math.ceil((y + h) / cellSize);
      const czEnd = Math.ceil((z + d - oz) / cellSize);
      for (let cy = c0.cy; cy < cyEnd; cy++)
        for (let cz = c0.cz; cz < czEnd; cz++)
          for (let cx = c0.cx; cx < cxEnd; cx++)
            if (inBounds(cx, cy, cz)) data[idx(cx, cy, cz)] = value;
    },
    toDebugJSON() {
      return { W, D, maxY, belowGround: BELOW_GROUND, ox, oz, cellSize, cells: Array.from(data) };
    },
  };
}
