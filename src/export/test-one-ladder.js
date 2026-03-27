/**
 * Test: one ladder with flat stiles + rungs as OBJ geometry.
 * Run: node src/export/test-one-ladder.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { PNG } from 'pngjs';

const TILE_SIZE = 256;

// Load ladder texture
const ladderTex = PNG.sync.read(readFileSync('assets/textures/loaded/ladders/Wood_Planks_01_Yellow_4.png'));
const atlas = new PNG({ width: TILE_SIZE, height: TILE_SIZE });
for (let y = 0; y < TILE_SIZE; y++) {
  for (let x = 0; x < TILE_SIZE; x++) {
    const si = ((y % ladderTex.height) * ladderTex.width + (x % ladderTex.width)) * 4;
    const di = (y * TILE_SIZE + x) * 4;
    atlas.data[di] = ladderTex.data[si];
    atlas.data[di + 1] = ladderTex.data[si + 1];
    atlas.data[di + 2] = ladderTex.data[si + 2];
    atlas.data[di + 3] = 255;
  }
}
writeFileSync('output/test_ladder.png', PNG.sync.write(atlas));

// Ladder params
const ladder = { x: 0, z: 0, w: 1, d: 0.5, y0: 0, y1: 6 };
const POLE_WIDTH = 0.08;
const POLE_DEPTH = 0.08;
const RUNG_HEIGHT = 0.06;
const RUNG_DEPTH = 0.06;
const RUNG_SPACING = 0.75;
const RUNG_INSET = 0.05;

const lines = [];
let vertOff = 1, uvOff = 1, normOff = 1;

lines.push('# Test ladder - flat stiles + rungs');
lines.push('');

const cu = '0.500000', cv = '0.500000';

// Add a flat double-sided quad
function addQuad(name, v0, v1, v2, v3, nx, ny, nz) {
  lines.push(`o ${name}`);
  const vo = vertOff;
  for (const v of [v0,v1,v2,v3]) lines.push(`v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}`);
  for (let i = 0; i < 4; i++) lines.push(`vt ${cu} ${cv}`);
  lines.push(`vn ${nx} ${ny} ${nz}`);
  lines.push(`vn ${-nx} ${-ny} ${-nz}`);
  const uo = uvOff, no = normOff;
  // Front
  lines.push(`f ${vo}/${uo}/${no} ${vo+1}/${uo+1}/${no} ${vo+2}/${uo+2}/${no}`);
  lines.push(`f ${vo}/${uo}/${no} ${vo+2}/${uo+2}/${no} ${vo+3}/${uo+3}/${no}`);
  // Back
  lines.push(`f ${vo+2}/${uo+2}/${no+1} ${vo+1}/${uo+1}/${no+1} ${vo}/${uo}/${no+1}`);
  lines.push(`f ${vo+3}/${uo+3}/${no+1} ${vo+2}/${uo+2}/${no+1} ${vo}/${uo}/${no+1}`);
  vertOff += 4; uvOff += 4; normOff += 2;
  lines.push('');
}

// Build ladder
const height = ladder.y1 - ladder.y0;
const isThinX = ladder.w < ladder.d;
const ladderWidth = isThinX ? ladder.d : ladder.w;
const cx = ladder.x + ladder.w / 2;
const cz = ladder.z + ladder.d / 2;
const halfSpread = (ladderWidth / 2) - POLE_WIDTH / 2 - RUNG_INSET;

// Two stiles (vertical flat rectangles)
if (isThinX) {
  // Stiles run along Z, thin in X
  const lz = cz - halfSpread;
  const rz = cz + halfSpread;
  // Left stile
  addQuad('stile_left',
    [cx, ladder.y0, lz - POLE_WIDTH/2],
    [cx, ladder.y0, lz + POLE_WIDTH/2],
    [cx, ladder.y1, lz + POLE_WIDTH/2],
    [cx, ladder.y1, lz - POLE_WIDTH/2],
    1, 0, 0);
  // Right stile
  addQuad('stile_right',
    [cx, ladder.y0, rz - POLE_WIDTH/2],
    [cx, ladder.y0, rz + POLE_WIDTH/2],
    [cx, ladder.y1, rz + POLE_WIDTH/2],
    [cx, ladder.y1, rz - POLE_WIDTH/2],
    1, 0, 0);
} else {
  // Stiles run along X, thin in Z
  const lx = cx - halfSpread;
  const rx = cx + halfSpread;
  addQuad('stile_left',
    [lx - POLE_WIDTH/2, ladder.y0, cz],
    [lx + POLE_WIDTH/2, ladder.y0, cz],
    [lx + POLE_WIDTH/2, ladder.y1, cz],
    [lx - POLE_WIDTH/2, ladder.y1, cz],
    0, 0, 1);
  addQuad('stile_right',
    [rx - POLE_WIDTH/2, ladder.y0, cz],
    [rx + POLE_WIDTH/2, ladder.y0, cz],
    [rx + POLE_WIDTH/2, ladder.y1, cz],
    [rx - POLE_WIDTH/2, ladder.y1, cz],
    0, 0, 1);
}

// Rungs (horizontal flat rectangles spanning between stiles)
const rungCount = Math.floor(height / RUNG_SPACING);
for (let i = 1; i <= rungCount; i++) {
  const ry = ladder.y0 + i * RUNG_SPACING;
  if (ry >= ladder.y1 - RUNG_SPACING * 0.3) break;

  if (isThinX) {
    // Rung runs along Z
    addQuad(`rung_${i}`,
      [cx, ry - RUNG_HEIGHT/2, cz - halfSpread],
      [cx, ry - RUNG_HEIGHT/2, cz + halfSpread],
      [cx, ry + RUNG_HEIGHT/2, cz + halfSpread],
      [cx, ry + RUNG_HEIGHT/2, cz - halfSpread],
      1, 0, 0);
  } else {
    // Rung runs along X
    addQuad(`rung_${i}`,
      [cx - halfSpread, ry - RUNG_HEIGHT/2, cz],
      [cx + halfSpread, ry - RUNG_HEIGHT/2, cz],
      [cx + halfSpread, ry + RUNG_HEIGHT/2, cz],
      [cx - halfSpread, ry + RUNG_HEIGHT/2, cz],
      0, 0, 1);
  }
}

writeFileSync('output/test_ladder.obj', lines.join('\n'));

console.log(`Ladder: ${ladder.w}x${ladder.d}, height ${height}`);
console.log(`Rungs: ${rungCount}`);
console.log(`Vertices: ${vertOff - 1}`);
console.log('Output: output/test_ladder.obj + output/test_ladder.png');
