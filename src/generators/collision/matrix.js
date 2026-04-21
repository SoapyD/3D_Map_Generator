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
  // Exterior roof corner labels — two exposed edges
  ROOF_NE: 45, ROOF_NW: 46, ROOF_SE: 47, ROOF_SW: 48,
  // Ground-level placeholders (replaced by real geometry in later stages)
  FOUNDATION_PLACEHOLDER: 50,
  STREET_PLACEHOLDER:     51,
  // Interior-facing floor edge labels (exposed face neighbour is CELL.SHELL)
  IFLOOR_N: 60, IFLOOR_S: 61, IFLOOR_E: 62, IFLOOR_W: 63,
  IFLOOR_NE: 64, IFLOOR_NW: 65, IFLOOR_SE: 66, IFLOOR_SW: 67,
  IFLOOR_END_N: 70, IFLOOR_END_S: 71, IFLOOR_END_E: 72, IFLOOR_END_W: 73,
  IFLOOR_ISLAND: 74,
  // Internal wall markers (logged at wall position, no geometry generated)
  INTERNAL_WALL_N: 80, INTERNAL_WALL_S: 81, INTERNAL_WALL_E: 82, INTERNAL_WALL_W: 83,
  // Doorway openings — stamped by connectivity into the building shell before wall generation
  DOOR: 90,
  // Interior-facing roof edge labels (exposed face neighbour is CELL.SHELL)
  IROOF_N: 91, IROOF_S: 92, IROOF_E: 93, IROOF_W: 94,
  IROOF_NE: 95, IROOF_NW: 96, IROOF_SE: 97, IROOF_SW: 98,
  IROOF_END_N: 100, IROOF_END_S: 101, IROOF_END_E: 102, IROOF_END_W: 103,
  IROOF_ISLAND: 104,
  // Walkway / bridge span cells — stamped by connectivity Step 7c
  WALKWAY:          105,
  WALKWAY_CROSSING: 106,
};

// Stage enum used in write-history records.
export const STAGE = {
  BUILDINGS:    0,
  FLOORS:       1,
  FLOORS_LABEL: 2,
  ROOFS:        3,
  ROOFS_LABEL:  4,
  CONNECTIVITY: 5,
  WALLS_LABEL:  6,
  WALLS:        7,
  WALLS_INT:    8,
  WALKWAYS:     9,
  UNKNOWN:      255,
};

const STAGE_NAMES = {
  0: 'buildings', 1: 'floors', 2: 'floors-label', 3: 'roofs', 4: 'roofs-label',
  5: 'connectivity', 6: 'walls-label', 7: 'walls', 8: 'walls-internal', 9: 'walkways', 255: 'unknown',
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

  // Write history — always-on, sparse Map of 5-byte records per cell.
  // Record layout: [prev:Uint8, next:Uint8, stage:Uint8, sourceIndex:Uint16LE]
  const history = new Map();
  let writeCtxStage = STAGE.UNKNOWN;
  let writeCtxSource = 0;

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

  function recordWrite(cellIndex, prev, next) {
    if (prev === next) return;
    let buf = history.get(cellIndex);
    const offset = buf ? buf.length : 0;
    const next_buf = new Uint8Array(offset + 5);
    if (buf) next_buf.set(buf);
    next_buf[offset]     = prev;
    next_buf[offset + 1] = next;
    next_buf[offset + 2] = writeCtxStage;
    next_buf[offset + 3] = writeCtxSource & 0xff;
    next_buf[offset + 4] = (writeCtxSource >> 8) & 0xff;
    history.set(cellIndex, next_buf);
  }

  return {
    W, D, maxY, ox, oz, cellSize,
    CELL,
    worldToCell,
    cellToWorld,
    setWriteContext(stage, sourceIndex) {
      writeCtxStage  = stage;
      writeCtxSource = sourceIndex;
    },
    isOccupied(cx, cy, cz) {
      return inBounds(cx, cy, cz) && data[idx(cx, cy, cz)] !== CELL.EMPTY;
    },
    setCellType(cx, cy, cz, type) {
      if (!inBounds(cx, cy, cz)) return;
      const i = idx(cx, cy, cz);
      recordWrite(i, data[i], type);
      data[i] = type;
    },
    getCell(cx, cy, cz) {
      return inBounds(cx, cy, cz) ? data[idx(cx, cy, cz)] : CELL.EMPTY;
    },
    setCell(cx, cy, cz, value = CELL.FLOOR) {
      if (!inBounds(cx, cy, cz)) return;
      const i = idx(cx, cy, cz);
      recordWrite(i, data[i], value);
      data[i] = value;
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
            if (inBounds(cx, cy, cz)) {
              const i = idx(cx, cy, cz);
              recordWrite(i, data[i], value);
              data[i] = value;
            }
    },
    // Like fillBox but skips any cell whose current value matches skipValue.
    fillBoxUnless(x, y, z, w, h, d, value, skipValue) {
      const c0 = worldToCell(x, y, z);
      const cxEnd = Math.ceil((x + w - ox) / cellSize);
      const cyEnd = Math.ceil((y + h) / cellSize);
      const czEnd = Math.ceil((z + d - oz) / cellSize);
      for (let cy = c0.cy; cy < cyEnd; cy++)
        for (let cz = c0.cz; cz < czEnd; cz++)
          for (let cx = c0.cx; cx < cxEnd; cx++)
            if (inBounds(cx, cy, cz) && data[idx(cx, cy, cz)] !== skipValue) {
              const i = idx(cx, cy, cz);
              recordWrite(i, data[i], value);
              data[i] = value;
            }
    },
    getCellHistory(cx, cy, cz) {
      if (!inBounds(cx, cy, cz)) return undefined;
      const buf = history.get(idx(cx, cy, cz));
      if (!buf) return undefined;
      const records = [];
      for (let o = 0; o < buf.length; o += 5) {
        records.push({
          prev:        buf[o],
          next:        buf[o + 1],
          stage:       buf[o + 2],
          stageName:   STAGE_NAMES[buf[o + 2]] ?? 'unknown',
          sourceIndex: buf[o + 3] | (buf[o + 4] << 8),
        });
      }
      return records;
    },
    dumpHistory() {
      return history;
    },
    toDebugJSON() {
      return { W, D, maxY, belowGround: BELOW_GROUND, ox, oz, cellSize, cells: Array.from(data) };
    },
  };
}
