import { GEOMETRY } from '../../config.js';

const SEG_SIZE = 3;
const SEGS_PER_TILE = GEOMETRY.objAtlasTileSize / GEOMETRY.objSegmentPixelSize;

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
