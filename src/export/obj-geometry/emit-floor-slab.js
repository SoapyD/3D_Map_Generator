import { addEdgeFace } from './add-edge-face.js';

/** Horizontal slab — subdivide XZ, emit top + bottom faces. */
export function emitFloorSlab(state, name, x0, y0, z0, sizeX, sizeY, sizeZ, uv, uvParams, showEdges, rotateUV) {
  const { uvStep, uvStepV, baseSegU, baseSegV, SEGS_PER_TILE } = uvParams;
  const segsX = Math.max(1, Math.ceil((rotateUV ? sizeZ : sizeX) / 3));
  const segsZ = Math.max(1, Math.ceil((rotateUV ? sizeX : sizeZ) / 3));
  const stepX = sizeX / segsX;
  const stepZ = sizeZ / segsZ;

  state.objLines.push(`o ${name}`);
  const voTop = state.vertOff;
  for (let sz = 0; sz <= segsZ; sz++)
    for (let sx = 0; sx <= segsX; sx++)
      state.objLines.push(`v ${(x0 + sx * stepX).toFixed(6)} ${(y0 + sizeY).toFixed(6)} ${(z0 + sz * stepZ).toFixed(6)}`);
  state.vertOff += (segsX + 1) * (segsZ + 1);

  const voBot = state.vertOff;
  for (let sz = 0; sz <= segsZ; sz++)
    for (let sx = 0; sx <= segsX; sx++)
      state.objLines.push(`v ${(x0 + sx * stepX).toFixed(6)} ${y0.toFixed(6)} ${(z0 + sz * stepZ).toFixed(6)}`);
  state.vertOff += (segsX + 1) * (segsZ + 1);

  state.objLines.push('vn 0 1 0');
  state.objLines.push('vn 0 -1 0');
  const noTop = state.normOff, noBot = state.normOff + 1;
  state.normOff += 2;

  const gridW = segsX + 1;
  for (let sz = 0; sz < segsZ; sz++) {
    for (let sx = 0; sx < segsX; sx++) {
      const uOff = ((sx + baseSegU) % SEGS_PER_TILE) * uvStep;
      const vOff = ((sz + baseSegV) % SEGS_PER_TILE) * uvStepV;

      const uo = state.uvOff;
      state.objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
      state.objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
      state.objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
      state.objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
      state.uvOff += 4;

      const v00 = voTop + sz * gridW + sx, v10 = v00 + 1, v01 = v00 + gridW, v11 = v01 + 1;
      state.objLines.push(`f ${v01}/${uo+3}/${noTop} ${v11}/${uo+2}/${noTop} ${v10}/${uo+1}/${noTop}`);
      state.objLines.push(`f ${v01}/${uo+3}/${noTop} ${v10}/${uo+1}/${noTop} ${v00}/${uo}/${noTop}`);

      const uob = state.uvOff;
      state.objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
      state.objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
      state.objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
      state.objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
      state.uvOff += 4;

      const b00 = voBot + sz * gridW + sx, b10 = b00 + 1, b01 = b00 + gridW, b11 = b01 + 1;
      state.objLines.push(`f ${b00}/${uob}/${noBot} ${b10}/${uob+1}/${noBot} ${b11}/${uob+2}/${noBot}`);
      state.objLines.push(`f ${b00}/${uob}/${noBot} ${b11}/${uob+2}/${noBot} ${b01}/${uob+3}/${noBot}`);
    }
  }

  if (showEdges) {
    const x1 = x0 + sizeX, y1 = y0 + sizeY, z1 = z0 + sizeZ;
    addEdgeFace(state, [x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0], 0,0,-1, uv);
    addEdgeFace(state, [x1,y0,z1],[x0,y0,z1],[x0,y1,z1],[x1,y1,z1], 0,0,1, uv);
    addEdgeFace(state, [x0,y0,z1],[x0,y0,z0],[x0,y1,z0],[x0,y1,z1], -1,0,0, uv);
    addEdgeFace(state, [x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0], 1,0,0, uv);
  }
}
