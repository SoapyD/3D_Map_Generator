import { addEdgeFace } from './add-edge-face.js';

/**
 * Emit a subdivided double-sided wall (front + back faces) along one axis.
 *
 * @param {object} state      OBJ writer state
 * @param {string} name       Object name
 * @param {object} p          Position/size: { x0, y0, z0, sizeX, sizeY, sizeZ }
 * @param {object} uv         UV bounds { uMin, uMax, vMin, vMax }
 * @param {object} seg        Segmentation params: { segsL, segsH, stepL, stepH }
 * @param {object} uvParams   { uvStep, uvStepV, baseSegU, baseSegV, SEGS_PER_TILE }
 * @param {boolean} showEdges Whether to emit edge faces
 * @param {Function} emitVert (gh, gl) => vertex string for front grid
 * @param {Function} emitVertBack (gh, gl) => vertex string for back grid
 * @param {number[]} frontNormal  [nx, ny, nz]
 * @param {number[]} backNormal   [nx, ny, nz]
 * @param {boolean} flipFrontWinding  If true, swap winding for front faces
 * @param {Function} emitEdgeFaces (state, p, uv) => void — edge face emitter
 */
export function addWallPair(state, name, p, uv, seg, uvParams, showEdges, emitVert, emitVertBack, frontNormal, backNormal, flipFrontWinding, emitEdgeFaces) {
  const { segsL, segsH, stepL, stepH } = seg;
  const { uvStep, uvStepV, baseSegU, baseSegV, SEGS_PER_TILE } = uvParams;

  state.objLines.push(`o ${name}`);

  const gridW = segsL + 1;
  const gridH = segsH + 1;

  const voFront = state.vertOff;
  for (let gh = 0; gh < gridH; gh++)
    for (let gl = 0; gl < gridW; gl++)
      state.objLines.push(emitVert(gh, gl));
  state.vertOff += gridW * gridH;

  const voBack = state.vertOff;
  for (let gh = 0; gh < gridH; gh++)
    for (let gl = 0; gl < gridW; gl++)
      state.objLines.push(emitVertBack(gh, gl));
  state.vertOff += gridW * gridH;

  state.objLines.push(`vn ${frontNormal[0]} ${frontNormal[1]} ${frontNormal[2]}`);
  state.objLines.push(`vn ${backNormal[0]} ${backNormal[1]} ${backNormal[2]}`);
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
      if (flipFrontWinding) {
        state.objLines.push(`f ${f00}/${uo}/${noFront} ${f01}/${uo+3}/${noFront} ${f11}/${uo+2}/${noFront}`);
        state.objLines.push(`f ${f00}/${uo}/${noFront} ${f11}/${uo+2}/${noFront} ${f10}/${uo+1}/${noFront}`);
      } else {
        state.objLines.push(`f ${f00}/${uo}/${noFront} ${f10}/${uo+1}/${noFront} ${f11}/${uo+2}/${noFront}`);
        state.objLines.push(`f ${f00}/${uo}/${noFront} ${f11}/${uo+2}/${noFront} ${f01}/${uo+3}/${noFront}`);
      }

      const uob = state.uvOff;
      state.objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
      state.objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
      state.objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
      state.objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
      state.uvOff += 4;

      const b00 = voBack + sh * gridW + sl, b10 = b00 + 1, b01 = b00 + gridW, b11 = b01 + 1;
      if (flipFrontWinding) {
        state.objLines.push(`f ${b00}/${uob}/${noBack} ${b10}/${uob+1}/${noBack} ${b11}/${uob+2}/${noBack}`);
        state.objLines.push(`f ${b00}/${uob}/${noBack} ${b11}/${uob+2}/${noBack} ${b01}/${uob+3}/${noBack}`);
      } else {
        state.objLines.push(`f ${b00}/${uob}/${noBack} ${b01}/${uob+3}/${noBack} ${b11}/${uob+2}/${noBack}`);
        state.objLines.push(`f ${b00}/${uob}/${noBack} ${b11}/${uob+2}/${noBack} ${b10}/${uob+1}/${noBack}`);
      }
    }
  }

  if (showEdges) {
    emitEdgeFaces(state, uv);
  }
}
