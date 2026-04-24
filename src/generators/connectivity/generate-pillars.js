import { CELL, STAGE, BELOW_GROUND } from '../collision/matrix.js';
import { CONNECTIVITY, GEOMETRY } from '../../config.js';

function isSlabCell(v) {
  return v === CELL.FLOOR
    || (v >= 10 && v <= 34)
    || (v >= 40 && v <= 48)
    || (v >= 60 && v <= 74)
    || (v >= 91 && v <= 104);
}

// Returns the slab thickness of the connection so the pillar top meets the underside.
function connSlabThickness(connectionType) {
  return connectionType?.startsWith('bridge_')
    ? CONNECTIVITY.bridgeThickness
    : GEOMETRY.walkwayThickness;
}

function placePillar(cx, cz, cy, connectionType, matrix, slabThickness) {
  // topY_world = underside of the connection slab (fractional).
  // Slab top = cy + 1 (cell top), slab bottom = cy + 1 - connThickness.
  const connThickness = connSlabThickness(connectionType);
  const topY_world = cy + 1 - connThickness;

  // Scan downward from cy-1 to find a surface to land on.
  // Extends into negative Y so pillars over rivers reach the river bed.
  // Aborts if another connection is in the way.
  let bottomY = 0;
  for (let scanY = cy - 1; scanY >= -BELOW_GROUND; scanY--) {
    const v = matrix.getCell(cx, scanY, cz);
    if (v === CELL.WALKWAY || v === CELL.WALKWAY_CROSSING) return null;
    if (v === CELL.RIVER || isSlabCell(v)) {
      bottomY = scanY + slabThickness;
      break;
    }
  }

  const h = topY_world - bottomY;
  if (h < 1) return null;

  // Fill the integer cell column below the connection with CELL.PILLAR.
  for (let fillY = Math.ceil(bottomY); fillY < cy; fillY++) {
    matrix.setCell(cx, fillY, cz, CELL.PILLAR);
  }

  // Center the 0.25" pillar within its 1" cell.
  const inset = (matrix.cellSize - CONNECTIVITY.pillarWidth) / 2;
  const wp = matrix.cellToWorld(cx, 0, cz);
  return {
    cx, cz,
    x: wp.x + inset,
    y: bottomY,
    z: wp.z + inset,
    w: CONNECTIVITY.pillarWidth,
    h,
    d: CONNECTIVITY.pillarWidth,
  };
}

export function generatePillars(survivors, matrix, config) {
  const { pillarMinLength, pillarSpacing, pillarEdgeInset } = CONNECTIVITY;
  const { slabThickness } = config;
  const pillars = [];

  for (const conn of survivors) {
    if (conn.length < pillarMinLength) continue;

    const { axis, from, to } = conn;
    const cy = from.cells[0].cy;

    let w0, w1, tMin, tMax;
    if (axis === 'NS') {
      w0 = from.cells[0].cx;  w1 = from.cells[1].cx;
      tMin = Math.min(from.cells[0].cz, to.cells[0].cz);
      tMax = Math.max(from.cells[0].cz, to.cells[0].cz);
    } else {
      w0 = from.cells[0].cz;  w1 = from.cells[1].cz;
      tMin = Math.min(from.cells[0].cx, to.cells[0].cx);
      tMax = Math.max(from.cells[0].cx, to.cells[0].cx);
    }

    const posStart = tMin + pillarEdgeInset;
    const posEnd   = tMax - pillarEdgeInset;
    if (posStart > posEnd) continue;

    const usable = posEnd - posStart;
    const numIntervals = Math.max(1, Math.ceil(usable / pillarSpacing));
    const step = usable / numIntervals;

    for (let i = 0; i <= numIntervals; i++) {
      const t = Math.round(posStart + i * step);

      for (const wCell of [w0, w1]) {
        const cx = axis === 'NS' ? wCell : t;
        const cz = axis === 'NS' ? t     : wCell;

        matrix.setWriteContext(STAGE.PILLARS, pillars.length);
        const pillar = placePillar(cx, cz, cy, conn.connectionType, matrix, slabThickness);
        if (pillar) {
          pillars.push({ ...pillar, connectionType: conn.connectionType });
        }
      }
    }
  }

  if (pillars.length > 0) console.log(`  Pillar supports: ${pillars.length}`);
  return pillars;
}
