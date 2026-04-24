import { GEOMETRY } from '../../config.js';
import { addVerticalQuad } from './add-vertical-quad.js';
import { addLadderBox } from './add-ladder-box.js';

const POLE_WIDTH = GEOMETRY.ladderPoleWidth;
const POLE_DEPTH = GEOMETRY.ladderPoleDepth;
const RUNG_HEIGHT = GEOMETRY.ladderRungHeight;
const RUNG_DEPTH = GEOMETRY.ladderRungDepth;
const RUNG_SPACING = GEOMETRY.ladderRungSpacing;
const RUNG_INSET = GEOMETRY.ladderRungInset;

/**
 * Emit OBJ ladder from primitive placement data.
 */
export function emitLadder(state, prim, uv, flat = GEOMETRY.flatLadders) {
  const height = prim.y1 - prim.y0;
  if (height <= 0) return;

  const isThinX = prim.isThinX;
  const ladderWidth = isThinX ? prim.d : prim.w;
  const cx = prim.x + prim.w / 2;
  const cz = prim.z + prim.d / 2;
  const halfSpread = (ladderWidth / 2) - POLE_WIDTH / 2 - RUNG_INSET;

  if (flat) {
    const FLAT_OFFSET = 0.15;
    const offsetDir = prim.wallOffsetDir;

    if (isThinX) {
      const fx = cx + FLAT_OFFSET * offsetDir;
      const lz = cz - halfSpread - POLE_WIDTH/2;
      const rz = cz + halfSpread - POLE_WIDTH/2;
      addVerticalQuad(state, `${prim.name}_stile_L`,
        [fx, prim.y0, lz], [fx, prim.y0, lz + POLE_WIDTH], [fx, prim.y0 + height, lz + POLE_WIDTH], [fx, prim.y0 + height, lz],
        1, 0, 0, uv);
      addVerticalQuad(state, `${prim.name}_stile_R`,
        [fx, prim.y0, rz], [fx, prim.y0, rz + POLE_WIDTH], [fx, prim.y0 + height, rz + POLE_WIDTH], [fx, prim.y0 + height, rz],
        1, 0, 0, uv);
      const rungCount = Math.floor(height / RUNG_SPACING);
      for (let r = 1; r <= rungCount; r++) {
        const ry = prim.y0 + r * RUNG_SPACING;
        if (ry >= prim.y1 - RUNG_SPACING * 0.3) break;
        const rungLen = halfSpread * 2 + POLE_WIDTH;
        addVerticalQuad(state, `${prim.name}_rung_${r}`,
          [fx, ry - RUNG_HEIGHT/2, lz], [fx, ry - RUNG_HEIGHT/2, lz + rungLen],
          [fx, ry + RUNG_HEIGHT/2, lz + rungLen], [fx, ry + RUNG_HEIGHT/2, lz],
          1, 0, 0, uv);
      }
    } else {
      const fz = cz + FLAT_OFFSET * offsetDir;
      const lx = cx - halfSpread - POLE_WIDTH/2;
      const rx = cx + halfSpread - POLE_WIDTH/2;
      addVerticalQuad(state, `${prim.name}_stile_L`,
        [lx, prim.y0, fz], [lx + POLE_WIDTH, prim.y0, fz], [lx + POLE_WIDTH, prim.y0 + height, fz], [lx, prim.y0 + height, fz],
        0, 0, 1, uv);
      addVerticalQuad(state, `${prim.name}_stile_R`,
        [rx, prim.y0, fz], [rx + POLE_WIDTH, prim.y0, fz], [rx + POLE_WIDTH, prim.y0 + height, fz], [rx, prim.y0 + height, fz],
        0, 0, 1, uv);
      const rungCount = Math.floor(height / RUNG_SPACING);
      for (let r = 1; r <= rungCount; r++) {
        const ry = prim.y0 + r * RUNG_SPACING;
        if (ry >= prim.y1 - RUNG_SPACING * 0.3) break;
        const rungLen = halfSpread * 2 + POLE_WIDTH;
        addVerticalQuad(state, `${prim.name}_rung_${r}`,
          [lx, ry - RUNG_HEIGHT/2, fz], [lx + rungLen, ry - RUNG_HEIGHT/2, fz],
          [lx + rungLen, ry + RUNG_HEIGHT/2, fz], [lx, ry + RUNG_HEIGHT/2, fz],
          0, 0, 1, uv);
      }
    }
  } else {
    // 3D box mode
    if (isThinX) {
      addLadderBox(state, `${prim.name}_stile_L`, cx - POLE_DEPTH/2, prim.y0, cz - halfSpread - POLE_WIDTH/2, POLE_DEPTH, height, POLE_WIDTH, uv);
      addLadderBox(state, `${prim.name}_stile_R`, cx - POLE_DEPTH/2, prim.y0, cz + halfSpread - POLE_WIDTH/2, POLE_DEPTH, height, POLE_WIDTH, uv);
    } else {
      addLadderBox(state, `${prim.name}_stile_L`, cx - halfSpread - POLE_WIDTH/2, prim.y0, cz - POLE_DEPTH/2, POLE_WIDTH, height, POLE_DEPTH, uv);
      addLadderBox(state, `${prim.name}_stile_R`, cx + halfSpread - POLE_WIDTH/2, prim.y0, cz - POLE_DEPTH/2, POLE_WIDTH, height, POLE_DEPTH, uv);
    }

    const rungCount = Math.floor(height / RUNG_SPACING);
    for (let r = 1; r <= rungCount; r++) {
      const ry = prim.y0 + r * RUNG_SPACING;
      if (ry >= prim.y1 - RUNG_SPACING * 0.3) break;
      const rungLen = halfSpread * 2 + POLE_WIDTH;
      if (isThinX) {
        addLadderBox(state, `${prim.name}_rung_${r}`, cx - RUNG_DEPTH/2, ry - RUNG_HEIGHT/2, cz - halfSpread - POLE_WIDTH/2, RUNG_DEPTH, RUNG_HEIGHT, rungLen, uv);
      } else {
        addLadderBox(state, `${prim.name}_rung_${r}`, cx - halfSpread - POLE_WIDTH/2, ry - RUNG_HEIGHT/2, cz - RUNG_DEPTH/2, rungLen, RUNG_HEIGHT, RUNG_DEPTH, uv);
      }
    }
  }
}
