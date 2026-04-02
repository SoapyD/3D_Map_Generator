import { GEOMETRY } from '../../config.js';

const SEG_SIZE = 3;
const SEGS_PER_TILE = GEOMETRY.objAtlasTileSize / GEOMETRY.objSegmentPixelSize;

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
