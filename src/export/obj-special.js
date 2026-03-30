/**
 * OBJ Special Helpers — walls, ladders, quads, floor edges, wall coverage.
 *
 * All functions receive a mutable `state` object:
 *   { objLines: string[], vertOff: number, uvOff: number, normOff: number }
 */

import { GEOMETRY } from '../config.js';

const SEG_SIZE = 3;
const SEGS_PER_TILE = GEOMETRY.objAtlasTileSize / GEOMETRY.objSegmentPixelSize;

// Ladder dimensions
const POLE_WIDTH = GEOMETRY.ladderPoleWidth;
const POLE_DEPTH = GEOMETRY.ladderPoleDepth;
const RUNG_HEIGHT = GEOMETRY.ladderRungHeight;
const RUNG_DEPTH = GEOMETRY.ladderRungDepth;
const RUNG_SPACING = GEOMETRY.ladderRungSpacing;
const RUNG_INSET = GEOMETRY.ladderRungInset;

/**
 * Shared-vertex wall (building walls).
 */
export function addSharedWall(state, name, x0, y0, z0, sizeX, sizeY, sizeZ, uv) {
  const isWallZ = sizeZ < 1;
  const isWallX = sizeX < 1;

  const lenAxis = isWallZ ? sizeX : sizeZ;
  const segsL = Math.max(1, Math.ceil(lenAxis / SEG_SIZE));
  const segsH = Math.max(1, Math.ceil(sizeY / SEG_SIZE));
  const stepL = lenAxis / segsL;
  const stepH = sizeY / segsH;

  const tileW = uv.uMax - uv.uMin;
  const tileH = uv.vMax - uv.vMin;
  const uvStep = tileW / SEGS_PER_TILE;
  const uvStepV = tileH / SEGS_PER_TILE;

  const fract = (v) => v - Math.floor(v);
  const [hu0, hu1] = GEOMETRY.uvHashU;
  const [hv0, hv1, hv2] = GEOMETRY.uvHashV;
  const baseSegU = Math.floor(fract(x0 * hu0 + z0 * hu1) * SEGS_PER_TILE);
  const baseSegV = Math.floor(fract(x0 * hv0 + z0 * hv1 + y0 * hv2) * SEGS_PER_TILE);

  state.objLines.push(`o ${name}`);

  const gridW = segsL + 1;
  const gridH = segsH + 1;

  if (isWallZ) {
    const voFront = state.vertOff;
    for (let gh = 0; gh < gridH; gh++)
      for (let gl = 0; gl < gridW; gl++)
        state.objLines.push(`v ${(x0 + gl * stepL).toFixed(6)} ${(y0 + gh * stepH).toFixed(6)} ${z0.toFixed(6)}`);
    state.vertOff += gridW * gridH;

    const voBack = state.vertOff;
    const z1 = z0 + sizeZ;
    for (let gh = 0; gh < gridH; gh++)
      for (let gl = 0; gl < gridW; gl++)
        state.objLines.push(`v ${(x0 + gl * stepL).toFixed(6)} ${(y0 + gh * stepH).toFixed(6)} ${z1.toFixed(6)}`);
    state.vertOff += gridW * gridH;

    state.objLines.push('vn 0 0 -1');
    state.objLines.push('vn 0 0 1');
    const noFront = state.normOff, noBack = state.normOff + 1;
    state.normOff += 2;

    for (let sl = 0; sl < segsL; sl++) {
      for (let sh = 0; sh < segsH; sh++) {
        const uOff = ((sl + baseSegU) % SEGS_PER_TILE) * uvStep;
        const vOff = ((sh + baseSegV) % SEGS_PER_TILE) * uvStepV;

        const uo = state.uvOff;
        state.objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
        state.objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
        state.objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
        state.objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
        state.uvOff += 4;

        const f00 = voFront + sh * gridW + sl, f10 = f00 + 1, f01 = f00 + gridW, f11 = f01 + 1;
        state.objLines.push(`f ${f00}/${uo}/${noFront} ${f01}/${uo+3}/${noFront} ${f11}/${uo+2}/${noFront}`);
        state.objLines.push(`f ${f00}/${uo}/${noFront} ${f11}/${uo+2}/${noFront} ${f10}/${uo+1}/${noFront}`);

        const uob = state.uvOff;
        state.objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
        state.objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
        state.objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
        state.objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
        state.uvOff += 4;

        const b00 = voBack + sh * gridW + sl, b10 = b00 + 1, b01 = b00 + gridW, b11 = b01 + 1;
        state.objLines.push(`f ${b00}/${uob}/${noBack} ${b10}/${uob+1}/${noBack} ${b11}/${uob+2}/${noBack}`);
        state.objLines.push(`f ${b00}/${uob}/${noBack} ${b11}/${uob+2}/${noBack} ${b01}/${uob+3}/${noBack}`);
      }
    }
  } else if (isWallX) {
    const voFront = state.vertOff;
    for (let gh = 0; gh < gridH; gh++)
      for (let gl = 0; gl < gridW; gl++)
        state.objLines.push(`v ${x0.toFixed(6)} ${(y0 + gh * stepH).toFixed(6)} ${(z0 + gl * stepL).toFixed(6)}`);
    state.vertOff += gridW * gridH;

    const voBack = state.vertOff;
    const x1 = x0 + sizeX;
    for (let gh = 0; gh < gridH; gh++)
      for (let gl = 0; gl < gridW; gl++)
        state.objLines.push(`v ${x1.toFixed(6)} ${(y0 + gh * stepH).toFixed(6)} ${(z0 + gl * stepL).toFixed(6)}`);
    state.vertOff += gridW * gridH;

    state.objLines.push('vn -1 0 0');
    state.objLines.push('vn 1 0 0');
    const noFront = state.normOff, noBack = state.normOff + 1;
    state.normOff += 2;

    for (let sl = 0; sl < segsL; sl++) {
      for (let sh = 0; sh < segsH; sh++) {
        const uOff = ((sl + baseSegU) % SEGS_PER_TILE) * uvStep;
        const vOff = ((sh + baseSegV) % SEGS_PER_TILE) * uvStepV;

        const uo = state.uvOff;
        state.objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
        state.objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
        state.objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
        state.objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
        state.uvOff += 4;

        const f00 = voFront + sh * gridW + sl, f10 = f00 + 1, f01 = f00 + gridW, f11 = f01 + 1;
        state.objLines.push(`f ${f00}/${uo}/${noFront} ${f10}/${uo+1}/${noFront} ${f11}/${uo+2}/${noFront}`);
        state.objLines.push(`f ${f00}/${uo}/${noFront} ${f11}/${uo+2}/${noFront} ${f01}/${uo+3}/${noFront}`);

        const uob = state.uvOff;
        state.objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
        state.objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
        state.objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
        state.objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
        state.uvOff += 4;

        const b00 = voBack + sh * gridW + sl, b10 = b00 + 1, b01 = b00 + gridW, b11 = b01 + 1;
        state.objLines.push(`f ${b00}/${uob}/${noBack} ${b01}/${uob+3}/${noBack} ${b11}/${uob+2}/${noBack}`);
        state.objLines.push(`f ${b00}/${uob}/${noBack} ${b11}/${uob+2}/${noBack} ${b10}/${uob+1}/${noBack}`);
      }
    }
  }

  state.objLines.push('');
}

/**
 * Check if a wall's edge is covered by an adjacent wall.
 */
export function wallEdgeCovered(wallPrim, side, allWallPrims) {
  const margin = 0.5;
  let edgeX, edgeZ;
  if (wallPrim.axis === 'x') {
    edgeX = side === 'start' ? wallPrim.x : wallPrim.x + wallPrim.w;
    edgeZ = wallPrim.z;
  } else {
    edgeX = wallPrim.x;
    edgeZ = side === 'start' ? wallPrim.z : wallPrim.z + wallPrim.d;
  }

  for (const other of allWallPrims) {
    if (other === wallPrim) continue;
    if (Math.abs(wallPrim.y - other.y) > 0.5) continue;
    if (edgeX >= other.x - margin && edgeX <= other.x + other.w + margin &&
        edgeZ >= other.z - margin && edgeZ <= other.z + other.d + margin) {
      return true;
    }
  }
  return false;
}

/**
 * Floor edge faces (adjacency-aware, from gap data).
 */
export function addFloorEdgesFromGaps(state, x0, y0, z0, w, h, d, edgeGaps, uv) {
  const x1 = x0 + w, y1 = y0 + h, z1 = z0 + d;
  const cu = ((uv.uMin + uv.uMax) / 2).toFixed(6);
  const cv = ((uv.vMin + uv.vMax) / 2).toFixed(6);

  function addEdge(v0, v1, v2, v3, nx, ny, nz) {
    const vo = state.vertOff;
    for (const v of [v0,v1,v2,v3]) state.objLines.push(`v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}`);
    for (let i = 0; i < 4; i++) state.objLines.push(`vt ${cu} ${cv}`);
    state.objLines.push(`vn ${nx} ${ny} ${nz}`);
    state.objLines.push(`vn ${-nx} ${-ny} ${-nz}`);
    const uo = state.uvOff, no = state.normOff;
    state.objLines.push(`f ${vo}/${uo}/${no} ${vo+1}/${uo+1}/${no} ${vo+2}/${uo+2}/${no}`);
    state.objLines.push(`f ${vo}/${uo}/${no} ${vo+2}/${uo+2}/${no} ${vo+3}/${uo+3}/${no}`);
    state.objLines.push(`f ${vo+2}/${uo+2}/${no+1} ${vo+1}/${uo+1}/${no+1} ${vo}/${uo}/${no+1}`);
    state.objLines.push(`f ${vo+3}/${uo+3}/${no+1} ${vo+2}/${uo+2}/${no+1} ${vo}/${uo}/${no+1}`);
    state.vertOff += 4; state.uvOff += 4; state.normOff += 2;
  }

  if (edgeGaps.north) {
    for (const gap of edgeGaps.north)
      addEdge([gap.start,y0,z0],[gap.end,y0,z0],[gap.end,y1,z0],[gap.start,y1,z0], 0,0,-1);
  }
  if (edgeGaps.south) {
    for (const gap of edgeGaps.south)
      addEdge([gap.end,y0,z1],[gap.start,y0,z1],[gap.start,y1,z1],[gap.end,y1,z1], 0,0,1);
  }
  if (edgeGaps.west) {
    for (const gap of edgeGaps.west)
      addEdge([x0,y0,gap.end],[x0,y0,gap.start],[x0,y1,gap.start],[x0,y1,gap.end], -1,0,0);
  }
  if (edgeGaps.east) {
    for (const gap of edgeGaps.east)
      addEdge([x1,y0,gap.start],[x1,y0,gap.end],[x1,y1,gap.end],[x1,y1,gap.start], 1,0,0);
  }
}

/**
 * Vertical quad (double-sided) for flat ladders.
 */
export function addVerticalQuad(state, name, v0, v1, v2, v3, nx, ny, nz, uv) {
  const vo = state.vertOff;
  state.objLines.push(`o ${name}`);
  for (const v of [v0,v1,v2,v3]) state.objLines.push(`v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}`);
  state.objLines.push(`vt ${uv.uMin.toFixed(6)} ${uv.vMin.toFixed(6)}`);
  state.objLines.push(`vt ${uv.uMax.toFixed(6)} ${uv.vMin.toFixed(6)}`);
  state.objLines.push(`vt ${uv.uMax.toFixed(6)} ${uv.vMax.toFixed(6)}`);
  state.objLines.push(`vt ${uv.uMin.toFixed(6)} ${uv.vMax.toFixed(6)}`);
  state.objLines.push(`vn ${nx} ${ny} ${nz}`);
  state.objLines.push(`vn ${-nx} ${-ny} ${-nz}`);
  const uo = state.uvOff, no = state.normOff;
  state.objLines.push(`f ${vo}/${uo}/${no} ${vo+1}/${uo+1}/${no} ${vo+2}/${uo+2}/${no}`);
  state.objLines.push(`f ${vo}/${uo}/${no} ${vo+2}/${uo+2}/${no} ${vo+3}/${uo+3}/${no}`);
  state.objLines.push(`f ${vo+2}/${uo+2}/${no+1} ${vo+1}/${uo+1}/${no+1} ${vo}/${uo}/${no+1}`);
  state.objLines.push(`f ${vo+3}/${uo+3}/${no+1} ${vo+2}/${uo+2}/${no+1} ${vo}/${uo}/${no+1}`);
  state.vertOff += 4; state.uvOff += 4; state.normOff += 2;
}

/**
 * 3D ladder box (6-face box with simple UVs).
 */
export function addLadderBox(state, name, bx, by, bz, bw, bh, bd, uv) {
  const vo = state.vertOff;
  const x1 = bx + bw, y1 = by + bh, z1 = bz + bd;
  const uMin = uv.uMin.toFixed(6), uMax = uv.uMax.toFixed(6);
  const vMin = uv.vMin.toFixed(6), vMax = uv.vMax.toFixed(6);
  state.objLines.push(`o ${name}`);
  state.objLines.push(`v ${bx.toFixed(6)} ${by.toFixed(6)} ${bz.toFixed(6)}`);
  state.objLines.push(`v ${x1.toFixed(6)} ${by.toFixed(6)} ${bz.toFixed(6)}`);
  state.objLines.push(`v ${x1.toFixed(6)} ${by.toFixed(6)} ${z1.toFixed(6)}`);
  state.objLines.push(`v ${bx.toFixed(6)} ${by.toFixed(6)} ${z1.toFixed(6)}`);
  state.objLines.push(`v ${bx.toFixed(6)} ${y1.toFixed(6)} ${bz.toFixed(6)}`);
  state.objLines.push(`v ${x1.toFixed(6)} ${y1.toFixed(6)} ${bz.toFixed(6)}`);
  state.objLines.push(`v ${x1.toFixed(6)} ${y1.toFixed(6)} ${z1.toFixed(6)}`);
  state.objLines.push(`v ${bx.toFixed(6)} ${y1.toFixed(6)} ${z1.toFixed(6)}`);
  for (let i = 0; i < 6; i++) {
    state.objLines.push(`vt ${uMin} ${vMin}`);
    state.objLines.push(`vt ${uMax} ${vMin}`);
    state.objLines.push(`vt ${uMax} ${vMax}`);
    state.objLines.push(`vt ${uMin} ${vMax}`);
  }
  state.objLines.push('vn 0 -1 0'); state.objLines.push('vn 0 1 0');
  state.objLines.push('vn 0 0 -1'); state.objLines.push('vn 0 0 1');
  state.objLines.push('vn -1 0 0'); state.objLines.push('vn 1 0 0');
  const u = state.uvOff, n = state.normOff;
  state.objLines.push(`f ${vo}/${u}/${n} ${vo+1}/${u+1}/${n} ${vo+2}/${u+2}/${n}`);
  state.objLines.push(`f ${vo}/${u}/${n} ${vo+2}/${u+2}/${n} ${vo+3}/${u+3}/${n}`);
  state.objLines.push(`f ${vo+6}/${u+6}/${n+1} ${vo+5}/${u+5}/${n+1} ${vo+4}/${u+4}/${n+1}`);
  state.objLines.push(`f ${vo+7}/${u+7}/${n+1} ${vo+6}/${u+6}/${n+1} ${vo+4}/${u+4}/${n+1}`);
  state.objLines.push(`f ${vo}/${u+8}/${n+2} ${vo+4}/${u+11}/${n+2} ${vo+5}/${u+10}/${n+2}`);
  state.objLines.push(`f ${vo}/${u+8}/${n+2} ${vo+5}/${u+10}/${n+2} ${vo+1}/${u+9}/${n+2}`);
  state.objLines.push(`f ${vo+2}/${u+12}/${n+3} ${vo+6}/${u+14}/${n+3} ${vo+7}/${u+15}/${n+3}`);
  state.objLines.push(`f ${vo+2}/${u+12}/${n+3} ${vo+7}/${u+15}/${n+3} ${vo+3}/${u+13}/${n+3}`);
  state.objLines.push(`f ${vo+3}/${u+16}/${n+4} ${vo+7}/${u+19}/${n+4} ${vo+4}/${u+18}/${n+4}`);
  state.objLines.push(`f ${vo+3}/${u+16}/${n+4} ${vo+4}/${u+18}/${n+4} ${vo}/${u+17}/${n+4}`);
  state.objLines.push(`f ${vo+1}/${u+20}/${n+5} ${vo+5}/${u+23}/${n+5} ${vo+6}/${u+22}/${n+5}`);
  state.objLines.push(`f ${vo+1}/${u+20}/${n+5} ${vo+6}/${u+22}/${n+5} ${vo+2}/${u+21}/${n+5}`);
  state.vertOff += 8; state.uvOff += 24; state.normOff += 6;
}

/**
 * Emit OBJ ladder from primitive placement data.
 */
export function emitLadder(state, prim, uv) {
  const height = prim.y1 - prim.y0;
  if (height <= 0) return;

  const isThinX = prim.isThinX;
  const ladderWidth = isThinX ? prim.d : prim.w;
  const cx = prim.x + prim.w / 2;
  const cz = prim.z + prim.d / 2;
  const halfSpread = (ladderWidth / 2) - POLE_WIDTH / 2 - RUNG_INSET;
  const flat = GEOMETRY.flatLadders;

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
