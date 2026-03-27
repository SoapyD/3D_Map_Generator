/**
 * Test: one ladder with poles + rungs as OBJ geometry.
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
const POLE_RADIUS = 0.1;
const RUNG_RADIUS = 0.08;
const RUNG_SPACING = 0.75;
const SEGMENTS = 6; // polygon segments for cylinders

const lines = [];
let vertOff = 1, uvOff = 1, normOff = 1;

lines.push('# Test ladder - poles + rungs');
lines.push('');

// UV: centre point (solid colour from atlas)
const cu = '0.500000', cv = '0.500000';

/**
 * Add a cylinder to the OBJ.
 * @param {number} cx,cy,cz - centre position
 * @param {number} radius
 * @param {number} height
 * @param {string} axis - 'y' for vertical poles, 'x' or 'z' for rungs
 */
function addCylinder(name, cx, cy, cz, radius, height, axis) {
  lines.push(`o ${name}`);

  const segs = SEGMENTS;
  const halfH = height / 2;

  // Generate two circles of vertices (top + bottom)
  const topVerts = [];
  const botVerts = [];

  for (let i = 0; i < segs; i++) {
    const angle = (i / segs) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    let tx, ty, tz, bx, by, bz;

    if (axis === 'y') {
      tx = cx + cos * radius; ty = cy + halfH; tz = cz + sin * radius;
      bx = cx + cos * radius; by = cy - halfH; bz = cz + sin * radius;
    } else if (axis === 'z') {
      tx = cx + cos * radius; ty = cy + sin * radius; tz = cz + halfH;
      bx = cx + cos * radius; by = cy + sin * radius; bz = cz - halfH;
    } else { // x
      tx = cx + halfH; ty = cy + cos * radius; tz = cz + sin * radius;
      bx = cx - halfH; by = cy + cos * radius; bz = cz + sin * radius;
    }

    topVerts.push([tx, ty, tz]);
    botVerts.push([bx, by, bz]);
  }

  // Top centre + bottom centre
  let topCx, topCy, topCz, botCx, botCy, botCz;
  if (axis === 'y') {
    topCx = cx; topCy = cy + halfH; topCz = cz;
    botCx = cx; botCy = cy - halfH; botCz = cz;
  } else if (axis === 'z') {
    topCx = cx; topCy = cy; topCz = cz + halfH;
    botCx = cx; botCy = cy; botCz = cz - halfH;
  } else {
    topCx = cx + halfH; topCy = cy; topCz = cz;
    botCx = cx - halfH; botCy = cy; botCz = cz;
  }

  // Output vertices: bottom ring, top ring, bottom centre, top centre
  for (const v of botVerts) lines.push(`v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}`);
  for (const v of topVerts) lines.push(`v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}`);
  lines.push(`v ${botCx.toFixed(6)} ${botCy.toFixed(6)} ${botCz.toFixed(6)}`);
  lines.push(`v ${topCx.toFixed(6)} ${topCy.toFixed(6)} ${topCz.toFixed(6)}`);

  const totalVerts = segs * 2 + 2;

  // UVs — all centre point
  for (let i = 0; i < totalVerts; i++) lines.push(`vt ${cu} ${cv}`);

  // Normal — just use a single up normal (TTS lighting is basic)
  lines.push('vn 0 1 0');

  const vo = vertOff;
  const uo = uvOff;
  const no = normOff;
  const botCentreIdx = vo + segs * 2;
  const topCentreIdx = vo + segs * 2 + 1;

  // Side faces (quads as 2 triangles)
  for (let i = 0; i < segs; i++) {
    const i2 = (i + 1) % segs;
    const b1 = vo + i, b2 = vo + i2;
    const t1 = vo + segs + i, t2 = vo + segs + i2;
    lines.push(`f ${b1}/${uo+i}/${no} ${b2}/${uo+i2}/${no} ${t2}/${uo+segs+i2}/${no}`);
    lines.push(`f ${b1}/${uo+i}/${no} ${t2}/${uo+segs+i2}/${no} ${t1}/${uo+segs+i}/${no}`);
  }

  // Top cap
  for (let i = 0; i < segs; i++) {
    const i2 = (i + 1) % segs;
    lines.push(`f ${topCentreIdx}/${uo+segs*2+1}/${no} ${vo+segs+i}/${uo+segs+i}/${no} ${vo+segs+i2}/${uo+segs+i2}/${no}`);
  }

  // Bottom cap
  for (let i = 0; i < segs; i++) {
    const i2 = (i + 1) % segs;
    lines.push(`f ${botCentreIdx}/${uo+segs*2}/${no} ${vo+i2}/${uo+i2}/${no} ${vo+i}/${uo+i}/${no}`);
  }

  vertOff += totalVerts;
  uvOff += totalVerts;
  normOff += 1;
  lines.push('');
}

// Build ladder
const height = ladder.y1 - ladder.y0;
const isThinX = ladder.w < ladder.d;
const ladderWidth = isThinX ? ladder.d : ladder.w;
const cx = ladder.x + ladder.w / 2;
const cz = ladder.z + ladder.d / 2;
const cy = ladder.y0 + height / 2;
const halfSpread = (ladderWidth / 2) - POLE_RADIUS - 0.1;

// Two poles
if (isThinX) {
  addCylinder('pole_left', cx, cy, cz - halfSpread, POLE_RADIUS, height, 'y');
  addCylinder('pole_right', cx, cy, cz + halfSpread, POLE_RADIUS, height, 'y');
} else {
  addCylinder('pole_left', cx - halfSpread, cy, cz, POLE_RADIUS, height, 'y');
  addCylinder('pole_right', cx + halfSpread, cy, cz, POLE_RADIUS, height, 'y');
}

// Rungs
const rungCount = Math.floor(height / RUNG_SPACING);
const rungLength = halfSpread * 2;
for (let i = 1; i <= rungCount; i++) {
  const ry = ladder.y0 + i * RUNG_SPACING;
  if (ry >= ladder.y1 - RUNG_SPACING * 0.3) break;
  const rungAxis = isThinX ? 'z' : 'x';
  addCylinder(`rung_${i}`, cx, ry, cz, RUNG_RADIUS, rungLength, rungAxis);
}

writeFileSync('output/test_ladder.obj', lines.join('\n'));

console.log(`Ladder: ${ladder.w}x${ladder.d}, height ${height}`);
console.log(`Vertices: ${vertOff - 1}`);
console.log('Output: output/test_ladder.obj + output/test_ladder.png');
