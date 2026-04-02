/**
 * Emit a double-sided edge quad using centre-UV coordinates.
 *
 * @param {object} state  OBJ writer state (objLines, vertOff, uvOff, normOff)
 * @param {number[]} v0   Vertex 0 [x,y,z]
 * @param {number[]} v1   Vertex 1
 * @param {number[]} v2   Vertex 2
 * @param {number[]} v3   Vertex 3
 * @param {number} nx     Normal X
 * @param {number} ny     Normal Y
 * @param {number} nz     Normal Z
 * @param {string} cu     Centre U (pre-formatted)
 * @param {string} cv     Centre V (pre-formatted)
 */
export function addEdge(state, v0, v1, v2, v3, nx, ny, nz, cu, cv) {
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
