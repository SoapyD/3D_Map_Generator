/**
 * Test: export a single wall as a subdivided OBJ.
 * Run: node src/export/test-wall-export.js
 */

import { writeFileSync } from 'fs';
import { PNG } from 'pngjs';

const SEG_SIZE = 3; // inches per segment

// A single wall: 12" wide × 3" tall × 0.25" deep
const wall = { x: 0, y: 0, z: 0, w: 12, h: 3, d: 0.25 };

// Create a tiny atlas: just one 32px tile
const TILE_SIZE = 32;
const atlas = new PNG({ width: TILE_SIZE, height: TILE_SIZE });
for (let i = 0; i < TILE_SIZE * TILE_SIZE; i++) {
  atlas.data[i * 4] = 89;     // brownish wall colour
  atlas.data[i * 4 + 1] = 77;
  atlas.data[i * 4 + 2] = 64;
  atlas.data[i * 4 + 3] = 255;
}
writeFileSync('output/test_wall.png', PNG.sync.write(atlas));

// Subdivide the wall into SEG_SIZE chunks
const segsX = Math.max(1, Math.ceil(wall.w / SEG_SIZE));
const segsY = Math.max(1, Math.ceil(wall.h / SEG_SIZE));
const segsZ = Math.max(1, Math.ceil(wall.d / SEG_SIZE));
const stepX = wall.w / segsX;
const stepY = wall.h / segsY;
const stepZ = wall.d / segsZ;

const lines = [];
let vertOff = 1;

lines.push('# Test wall - single subdivided wall');
lines.push('');

for (let sx = 0; sx < segsX; sx++) {
  for (let sy = 0; sy < segsY; sy++) {
    for (let sz = 0; sz < segsZ; sz++) {
      const x0 = wall.x + sx * stepX;
      const y0 = wall.y + sy * stepY;
      const z0 = wall.z + sz * stepZ;
      const x1 = x0 + stepX;
      const y1 = y0 + stepY;
      const z1 = z0 + stepZ;

      // 8 verts
      const verts = [
        [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
        [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
      ];
      for (const v of verts) {
        lines.push(`v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}`);
      }

      // UVs: each face maps 0-1 (full texture)
      const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
      for (let f = 0; f < 6; f++) {
        for (const uv of uvs) {
          lines.push(`vt ${uv[0].toFixed(6)} ${uv[1].toFixed(6)}`);
        }
      }

      // Normals
      const norms = [[0,0,-1], [0,0,1], [0,-1,0], [0,1,0], [-1,0,0], [1,0,0]];
      for (const n of norms) {
        lines.push(`vn ${n[0]} ${n[1]} ${n[2]}`);
      }

      // Faces
      const vo = vertOff;
      const uo = vertOff; // UV offset matches vert offset pattern
      const uBase = (vertOff - 1) / 8 * 24 + 1; // 24 UVs per sub-box
      const nBase = (vertOff - 1) / 8 * 6 + 1;   // 6 normals per sub-box

      const faces = [
        { vi: [0,3,2,1], ufi: 0, ni: 0 }, // -Z
        { vi: [4,5,6,7], ufi: 1, ni: 1 }, // +Z
        { vi: [0,1,5,4], ufi: 2, ni: 2 }, // -Y
        { vi: [2,3,7,6], ufi: 3, ni: 3 }, // +Y
        { vi: [0,4,7,3], ufi: 4, ni: 4 }, // -X
        { vi: [1,2,6,5], ufi: 5, ni: 5 }, // +X
      ];

      for (const face of faces) {
        const [a, b, c, d] = face.vi;
        const ub = uBase + face.ufi * 4;
        const n = nBase + face.ni;
        lines.push(`f ${vo+a}/${ub}/${n} ${vo+b}/${ub+1}/${n} ${vo+c}/${ub+2}/${n}`);
        lines.push(`f ${vo+a}/${ub}/${n} ${vo+c}/${ub+2}/${n} ${vo+d}/${ub+3}/${n}`);
      }

      vertOff += 8;
    }
  }
}

writeFileSync('output/test_wall.obj', lines.join('\n'));

console.log(`Wall: ${wall.w}x${wall.h}x${wall.d}`);
console.log(`Segments: ${segsX}x${segsY}x${segsZ} = ${segsX * segsY * segsZ}`);
console.log(`Vertices: ${(vertOff - 1)}`);
console.log('Output: output/test_wall.obj + output/test_wall.png');
