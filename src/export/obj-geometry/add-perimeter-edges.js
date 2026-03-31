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
