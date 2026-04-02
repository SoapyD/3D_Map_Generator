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
