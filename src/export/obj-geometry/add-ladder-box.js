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
