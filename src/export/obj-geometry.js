/**
 * OBJ Geometry Helpers — subdivided box, flat, and edge emission.
 *
 * All functions receive a mutable `state` object:
 *   { objLines: string[], vertOff: number, uvOff: number, normOff: number }
 * and mutate it in place (pushing lines and incrementing offsets).
 */

import { GEOMETRY } from '../config.js';

const SEG_SIZE = 3;
const SEGS_PER_TILE = GEOMETRY.objAtlasTileSize / GEOMETRY.objSegmentPixelSize;

/**
 * Subdivided box — floors, walls, or columns depending on dimensions.
 */
export function addSubBox(state, name, x0, y0, z0, sizeX, sizeY, sizeZ, uv, showEdges = false, rotateUV = false, thinAxis = null) {
  const isFloor = thinAxis ? false : sizeY < 1;
  const isColumn = !thinAxis && sizeX < 1 && sizeZ < 1;
  const isWallX = thinAxis === 'x' || (!thinAxis && sizeX < 1 && sizeZ >= 1);
  const isWallZ = thinAxis === 'z' || (!thinAxis && sizeZ < 1 && sizeX >= 1);

  const tileW = uv.uMax - uv.uMin;
  const tileH = uv.vMax - uv.vMin;
  const uvStep = tileW / SEGS_PER_TILE;
  const uvStepV = tileH / SEGS_PER_TILE;

  const fract = (v) => v - Math.floor(v);
  const [hu0, hu1] = GEOMETRY.uvHashU;
  const [hv0, hv1, hv2] = GEOMETRY.uvHashV;
  const hashU = fract(x0 * hu0 + z0 * hu1) * SEGS_PER_TILE;
  const hashV = fract(x0 * hv0 + z0 * hv1 + y0 * hv2) * SEGS_PER_TILE;
  const baseSegU = Math.floor(hashU);
  const baseSegV = Math.floor(hashV);

  if (isColumn) {
    // Column (thin in both X and Z) — emit both wall pairs for full coverage
    addSubBox(state, name + '_zf', x0, y0, z0, sizeX, sizeY, sizeZ, uv, false, rotateUV, 'z');
    addSubBox(state, name + '_xf', x0, y0, z0, sizeX, sizeY, sizeZ, uv, false, rotateUV, 'x');
    return;
  }

  if (isFloor || (!isWallX && !isWallZ)) {
    // Horizontal slab — subdivide XZ
    const segsX = Math.max(1, Math.ceil((rotateUV ? sizeZ : sizeX) / SEG_SIZE));
    const segsZ = Math.max(1, Math.ceil((rotateUV ? sizeX : sizeZ) / SEG_SIZE));
    const stepX = sizeX / segsX;
    const stepZ = sizeZ / segsZ;

    state.objLines.push(`o ${name}`);
    const voTop = state.vertOff;
    for (let sz = 0; sz <= segsZ; sz++) {
      for (let sx = 0; sx <= segsX; sx++) {
        state.objLines.push(`v ${(x0 + sx * stepX).toFixed(6)} ${(y0 + sizeY).toFixed(6)} ${(z0 + sz * stepZ).toFixed(6)}`);
      }
    }
    state.vertOff += (segsX + 1) * (segsZ + 1);

    const voBot = state.vertOff;
    for (let sz = 0; sz <= segsZ; sz++) {
      for (let sx = 0; sx <= segsX; sx++) {
        state.objLines.push(`v ${(x0 + sx * stepX).toFixed(6)} ${y0.toFixed(6)} ${(z0 + sz * stepZ).toFixed(6)}`);
      }
    }
    state.vertOff += (segsX + 1) * (segsZ + 1);

    state.objLines.push('vn 0 1 0');
    state.objLines.push('vn 0 -1 0');
    const noTop = state.normOff, noBot = state.normOff + 1;
    state.normOff += 2;

    const gridW = segsX + 1;
    for (let sz = 0; sz < segsZ; sz++) {
      for (let sx = 0; sx < segsX; sx++) {
        const uOff = ((sx + baseSegU) % SEGS_PER_TILE) * uvStep, vOff = ((sz + baseSegV) % SEGS_PER_TILE) * uvStepV;

        const uo = state.uvOff;
        state.objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
        state.objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
        state.objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
        state.objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
        state.uvOff += 4;

        const v00 = voTop + sz * gridW + sx;
        const v10 = v00 + 1;
        const v01 = v00 + gridW;
        const v11 = v01 + 1;
        state.objLines.push(`f ${v01}/${uo+3}/${noTop} ${v11}/${uo+2}/${noTop} ${v10}/${uo+1}/${noTop}`);
        state.objLines.push(`f ${v01}/${uo+3}/${noTop} ${v10}/${uo+1}/${noTop} ${v00}/${uo}/${noTop}`);

        const uob = state.uvOff;
        state.objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
        state.objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
        state.objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
        state.objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
        state.uvOff += 4;

        const b00 = voBot + sz * gridW + sx;
        const b10 = b00 + 1;
        const b01 = b00 + gridW;
        const b11 = b01 + 1;
        state.objLines.push(`f ${b00}/${uob}/${noBot} ${b10}/${uob+1}/${noBot} ${b11}/${uob+2}/${noBot}`);
        state.objLines.push(`f ${b00}/${uob}/${noBot} ${b11}/${uob+2}/${noBot} ${b01}/${uob+3}/${noBot}`);
      }
    }

    if (showEdges) {
      const x1 = x0 + sizeX, y1 = y0 + sizeY, z1 = z0 + sizeZ;

      function addEdgeFace(v0, v1, v2, v3, nx, ny, nz) {
        const vo = state.vertOff;
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

      addEdgeFace([x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0], 0,0,-1);
      addEdgeFace([x1,y0,z1],[x0,y0,z1],[x0,y1,z1],[x1,y1,z1], 0,0,1);
      addEdgeFace([x0,y0,z1],[x0,y0,z0],[x0,y1,z0],[x0,y1,z1], -1,0,0);
      addEdgeFace([x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0], 1,0,0);
    }
  } else if (isWallZ) {
    // Thin along Z — wall facing -Z/+Z
    const segsL = Math.max(1, Math.ceil(sizeX / SEG_SIZE));
    const segsH = Math.max(1, Math.ceil(sizeY / SEG_SIZE));
    const stepL = sizeX / segsL;
    const stepH = sizeY / segsH;

    state.objLines.push(`o ${name}`);

    const gridW = segsL + 1;
    const gridH = segsH + 1;

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

    if (showEdges) {
      const y1 = y0 + sizeY;
      function addEdgeFace(v0, v1, v2, v3, nx, ny, nz) {
        const vo = state.vertOff;
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
      addEdgeFace([x0,y0+sizeY,z0],[x0+sizeX,y0+sizeY,z0],[x0+sizeX,y0+sizeY,z1],[x0,y0+sizeY,z1], 0,1,0);
      addEdgeFace([x0,y0,z1],[x0+sizeX,y0,z1],[x0+sizeX,y0,z0],[x0,y0,z0], 0,-1,0);
      addEdgeFace([x0,y0,z1],[x0,y0,z0],[x0,y1,z0],[x0,y1,z1], -1,0,0);
      addEdgeFace([x0+sizeX,y0,z0],[x0+sizeX,y0,z1],[x0+sizeX,y1,z1],[x0+sizeX,y1,z0], 1,0,0);
    }
  } else if (isWallX) {
    // Thin along X — wall facing -X/+X
    const segsL = Math.max(1, Math.ceil(sizeZ / SEG_SIZE));
    const segsH = Math.max(1, Math.ceil(sizeY / SEG_SIZE));
    const stepL = sizeZ / segsL;
    const stepH = sizeY / segsH;

    state.objLines.push(`o ${name}`);

    const gridW = segsL + 1;
    const gridH = segsH + 1;

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

    if (showEdges) {
      const y1 = y0 + sizeY;
      function addEdgeFace(v0, v1, v2, v3, nx, ny, nz) {
        const vo = state.vertOff;
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
      addEdgeFace([x0,y1,z0],[x0+sizeX,y1,z0],[x0+sizeX,y1,z0+sizeZ],[x0,y1,z0+sizeZ], 0,1,0);
      addEdgeFace([x0,y0,z0+sizeZ],[x0+sizeX,y0,z0+sizeZ],[x0+sizeX,y0,z0],[x0,y0,z0], 0,-1,0);
      addEdgeFace([x0+sizeX,y0,z0],[x0,y0,z0],[x0,y1,z0],[x0+sizeX,y1,z0], 0,0,-1);
      addEdgeFace([x0,y0,z0+sizeZ],[x0+sizeX,y0,z0+sizeZ],[x0+sizeX,y1,z0+sizeZ],[x0,y1,z0+sizeZ], 0,0,1);
    }
  }

  state.objLines.push('');
}

/**
 * Full perimeter edge faces for a freestanding flat object.
 */
export function addPerimeterEdges(state, x0, y0, z0, sizeX, sizeY, sizeZ, uv) {
  const x1 = x0 + sizeX, y1 = y0 + sizeY, z1 = z0 + sizeZ;
  const cu = ((uv.uMin + uv.uMax) / 2).toFixed(6);
  const cv = ((uv.vMin + uv.vMax) / 2).toFixed(6);

  function addEdgeFace(v0, v1, v2, v3, nx, ny, nz) {
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

  addEdgeFace([x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0], 0,0,-1);
  addEdgeFace([x1,y0,z1],[x0,y0,z1],[x0,y1,z1],[x1,y1,z1], 0,0,1);
  addEdgeFace([x0,y0,z1],[x0,y0,z0],[x0,y1,z0],[x0,y1,z1], -1,0,0);
  addEdgeFace([x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0], 1,0,0);
}

/**
 * Shared-vertex flat surface (floors, bridge decks, ceilings).
 */
export function addSharedFlat(state, name, x0, y0, z0, sizeX, sizeY, sizeZ, uv, emitBottom = true, rotateUV = false, simpleBottom = false, emitTop = true) {
  const segsX = Math.max(1, Math.ceil(sizeX / SEG_SIZE));
  const segsZ = Math.max(1, Math.ceil(sizeZ / SEG_SIZE));
  const stepX = sizeX / segsX;
  const stepZ = sizeZ / segsZ;

  const tileW = uv.uMax - uv.uMin;
  const tileH = uv.vMax - uv.vMin;
  const uvStep = tileW / SEGS_PER_TILE;
  const uvStepV = tileH / SEGS_PER_TILE;

  const fract = (v) => v - Math.floor(v);
  const [hu0, hu1] = GEOMETRY.uvHashU;
  const [hv0, hv1, hv2] = GEOMETRY.uvHashV;
  const baseSegU = Math.floor(fract(x0 * hu0 + z0 * hu1) * SEGS_PER_TILE);
  const baseSegV = Math.floor(fract(x0 * hv0 + z0 * hv1 + y0 * hv2) * SEGS_PER_TILE);

  const yTop = y0 + sizeY;

  state.objLines.push(`o ${name}`);

  const gridW = segsX + 1;
  const voTop = state.vertOff;
  for (let gz = 0; gz <= segsZ; gz++) {
    for (let gx = 0; gx <= segsX; gx++) {
      state.objLines.push(`v ${(x0 + gx * stepX).toFixed(6)} ${yTop.toFixed(6)} ${(z0 + gz * stepZ).toFixed(6)}`);
    }
  }
  state.vertOff += gridW * (segsZ + 1);

  const voBot = state.vertOff;
  for (let gz = 0; gz <= segsZ; gz++) {
    for (let gx = 0; gx <= segsX; gx++) {
      state.objLines.push(`v ${(x0 + gx * stepX).toFixed(6)} ${y0.toFixed(6)} ${(z0 + gz * stepZ).toFixed(6)}`);
    }
  }
  state.vertOff += gridW * (segsZ + 1);

  state.objLines.push('vn 0 1 0');
  state.objLines.push('vn 0 -1 0');
  const noTop = state.normOff, noBot = state.normOff + 1;
  state.normOff += 2;

  for (let sz = 0; sz < segsZ; sz++) {
    for (let sx = 0; sx < segsX; sx++) {
      let rsx = sx, rsz = sz;
      if (rotateUV) { rsx = sz; rsz = sx; }

      const uOff = ((rsx + baseSegU) % SEGS_PER_TILE) * uvStep;
      const vOff = ((rsz + baseSegV) % SEGS_PER_TILE) * uvStepV;

      if (emitTop) {
        const uo = state.uvOff;
        state.objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
        state.objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
        state.objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
        state.objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
        state.uvOff += 4;

        const v00 = voTop + sz * gridW + sx;
        const v10 = v00 + 1;
        const v01 = v00 + gridW;
        const v11 = v01 + 1;
        state.objLines.push(`f ${v01}/${uo+3}/${noTop} ${v11}/${uo+2}/${noTop} ${v10}/${uo+1}/${noTop}`);
        state.objLines.push(`f ${v01}/${uo+3}/${noTop} ${v10}/${uo+1}/${noTop} ${v00}/${uo}/${noTop}`);
      }

      if (emitBottom) {
        if (simpleBottom) {
          if (sx === 0 && sz === 0) {
            const b0 = voBot, b1 = voBot + segsX, b2 = voBot + segsZ * gridW + segsX, b3 = voBot + segsZ * gridW;
            const uo = state.uvOff;
            state.objLines.push(`vt ${uv.uMin.toFixed(6)} ${uv.vMin.toFixed(6)}`);
            state.objLines.push(`vt ${uv.uMax.toFixed(6)} ${uv.vMin.toFixed(6)}`);
            state.objLines.push(`vt ${uv.uMax.toFixed(6)} ${uv.vMax.toFixed(6)}`);
            state.objLines.push(`vt ${uv.uMin.toFixed(6)} ${uv.vMax.toFixed(6)}`);
            state.uvOff += 4;
            state.objLines.push(`f ${b0}/${uo}/${noBot} ${b1}/${uo+1}/${noBot} ${b2}/${uo+2}/${noBot}`);
            state.objLines.push(`f ${b0}/${uo}/${noBot} ${b2}/${uo+2}/${noBot} ${b3}/${uo+3}/${noBot}`);
          }
        } else {
          const uob = state.uvOff;
          state.objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          state.objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          state.objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          state.objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          state.uvOff += 4;

          const b00 = voBot + sz * gridW + sx;
          const b10 = b00 + 1;
          const b01 = b00 + gridW;
          const b11 = b01 + 1;
          state.objLines.push(`f ${b00}/${uob}/${noBot} ${b10}/${uob+1}/${noBot} ${b11}/${uob+2}/${noBot}`);
          state.objLines.push(`f ${b00}/${uob}/${noBot} ${b11}/${uob+2}/${noBot} ${b01}/${uob+3}/${noBot}`);
        }
      }
    }
  }

  state.objLines.push('');
}
