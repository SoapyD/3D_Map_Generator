/**
 * Test: export a single small building as a subdivided OBJ with texture atlas.
 * Run: node src/export/test-building-export.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { PNG } from 'pngjs';

const SEG_SIZE = 3;

// Building: 6x6 footprint, 2 tiers (6" tall), 0.5" thick floors, 0.25" thick walls
const building = { x: 0, z: 0, w: 6, d: 6, tiers: 2, tierHeight: 3, slabThickness: 0.5, wallThickness: 0.25 };

// Load textures
const wallTex = readFileSync('assets/textures/loaded/walls/Bricks_02_Grey_3.png');
const floorTex = readFileSync('assets/textures/loaded/floors/Wood_Planks_02_Brown_1.png');

// Build atlas: 2 tiles side by side (wall + floor)
const srcWall = PNG.sync.read(wallTex);
const srcFloor = PNG.sync.read(floorTex);
const TILE = 256;
const atlas = new PNG({ width: TILE * 2, height: TILE });

// Tile 0: wall
for (let y = 0; y < TILE; y++) {
  for (let x = 0; x < TILE; x++) {
    const si = (y % srcWall.height * srcWall.width + x % srcWall.width) * 4;
    const di = (y * TILE * 2 + x) * 4;
    atlas.data[di] = srcWall.data[si];
    atlas.data[di + 1] = srcWall.data[si + 1];
    atlas.data[di + 2] = srcWall.data[si + 2];
    atlas.data[di + 3] = 255;
  }
}
// Tile 1: floor
for (let y = 0; y < TILE; y++) {
  for (let x = 0; x < TILE; x++) {
    const si = (y % srcFloor.height * srcFloor.width + x % srcFloor.width) * 4;
    const di = (y * TILE * 2 + (x + TILE)) * 4;
    atlas.data[di] = srcFloor.data[si];
    atlas.data[di + 1] = srcFloor.data[si + 1];
    atlas.data[di + 2] = srcFloor.data[si + 2];
    atlas.data[di + 3] = 255;
  }
}

writeFileSync('output/test_building.png', PNG.sync.write(atlas));

// UV regions for each material
const wallUV = { uMin: 0, uMax: 0.5, vMin: 0, vMax: 1 };
const floorUV = { uMin: 0.5, uMax: 1, vMin: 0, vMax: 1 };

const lines = [];
let vertOff = 1;
let uvOff = 1;
let normOff = 1;

lines.push('# Test building - subdivided');
lines.push('');

function addSubdividedBox(name, x0, y0, z0, sizeX, sizeY, sizeZ, uv) {
  const segsX = Math.max(1, Math.ceil(sizeX / SEG_SIZE));
  const segsY = Math.max(1, Math.ceil(sizeY / SEG_SIZE));
  const segsZ = Math.max(1, Math.ceil(sizeZ / SEG_SIZE));
  const stepX = sizeX / segsX;
  const stepY = sizeY / segsY;
  const stepZ = sizeZ / segsZ;

  lines.push(`o ${name}`);

  for (let sx = 0; sx < segsX; sx++) {
    for (let sy = 0; sy < segsY; sy++) {
      for (let sz = 0; sz < segsZ; sz++) {
        const bx0 = x0 + sx * stepX;
        const by0 = y0 + sy * stepY;
        const bz0 = z0 + sz * stepZ;
        const bx1 = bx0 + stepX;
        const by1 = by0 + stepY;
        const bz1 = bz0 + stepZ;

        const verts = [
          [bx0,by0,bz0], [bx1,by0,bz0], [bx1,by1,bz0], [bx0,by1,bz0],
          [bx0,by0,bz1], [bx1,by0,bz1], [bx1,by1,bz1], [bx0,by1,bz1],
        ];
        for (const v of verts) {
          lines.push(`v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}`);
        }

        // Per-face UVs matched to vertex winding order
        // Verts: 0=x0y0z0, 1=x1y0z0, 2=x1y1z0, 3=x0y1z0, 4=x0y0z1, 5=x1y0z1, 6=x1y1z1, 7=x0y1z1
        const L = uv.uMin, R = uv.uMax, B = uv.vMin, T = uv.vMax;
        // Face winding -> UV: [vert0, vert1, vert2, vert3]
        const faceUVs = [
          // -Z face: verts [0,3,2,1] = BL, TL, TR, BR
          [[L,B], [L,T], [R,T], [R,B]],
          // +Z face: verts [4,5,6,7] = BL, BR, TR, TL
          [[R,B], [L,B], [L,T], [R,T]],
          // -Y face: verts [0,1,5,4] = bottom, horizontal
          [[L,B], [R,B], [R,T], [L,T]],
          // +Y face: verts [2,3,7,6] = top, horizontal
          [[R,B], [L,B], [L,T], [R,T]],
          // -X face: verts [0,4,7,3] = BL, BR, TR, TL
          [[R,B], [L,B], [L,T], [R,T]],
          // +X face: verts [1,2,6,5] = BL, TL, TR, BR
          [[L,B], [L,T], [R,T], [R,B]],
        ];
        for (const uvSet of faceUVs) {
          for (const c of uvSet) {
            lines.push(`vt ${c[0].toFixed(6)} ${c[1].toFixed(6)}`);
          }
        }

        const norms = [[0,0,-1],[0,0,1],[0,-1,0],[0,1,0],[-1,0,0],[1,0,0]];
        for (const n of norms) {
          lines.push(`vn ${n[0]} ${n[1]} ${n[2]}`);
        }

        const vo = vertOff;
        const uo = uvOff;
        const no = normOff;

        const faces = [
          { vi: [0,3,2,1], ufi: 0, ni: 0 },
          { vi: [4,5,6,7], ufi: 1, ni: 1 },
          { vi: [0,1,5,4], ufi: 2, ni: 2 },
          { vi: [2,3,7,6], ufi: 3, ni: 3 },
          { vi: [0,4,7,3], ufi: 4, ni: 4 },
          { vi: [1,2,6,5], ufi: 5, ni: 5 },
        ];

        for (const face of faces) {
          const [a, b, c, d] = face.vi;
          const ub = uo + face.ufi * 4;
          const n = no + face.ni;
          lines.push(`f ${vo+a}/${ub}/${n} ${vo+b}/${ub+1}/${n} ${vo+c}/${ub+2}/${n}`);
          lines.push(`f ${vo+a}/${ub}/${n} ${vo+c}/${ub+2}/${n} ${vo+d}/${ub+3}/${n}`);
        }

        vertOff += 8;
        uvOff += 24;
        normOff += 6;
      }
    }
  }
  lines.push('');
}

const { x, z, w, d, tiers, tierHeight, slabThickness, wallThickness } = building;

// Ground floor slab
addSubdividedBox('floor_t0', x, 0, z, w, slabThickness, d, floorUV);

// Tier 1 floor slab
addSubdividedBox('floor_t1', x, tierHeight, z, w, slabThickness, d, floorUV);

// Tier 2 floor slab
addSubdividedBox('floor_t2', x, tierHeight * 2, z, w, slabThickness, d, floorUV);

// Walls: 2 walls per tier (north + east)
for (let tier = 0; tier < tiers; tier++) {
  const baseY = tier * tierHeight + slabThickness;
  const wallH = tierHeight - slabThickness;

  // North wall (along X at z=0)
  addSubdividedBox(`wall_north_t${tier}`, x, baseY, z, w, wallH, wallThickness, wallUV);

  // East wall (along Z at x+w)
  addSubdividedBox(`wall_east_t${tier}`, x + w - wallThickness, baseY, z, wallThickness, wallH, d, wallUV);
}

writeFileSync('output/test_building.obj', lines.join('\n'));

const totalSegs = (vertOff - 1) / 8;
console.log(`Building: ${w}x${d}, ${tiers} tiers`);
console.log(`Total segments: ${totalSegs}`);
console.log(`Vertices: ${vertOff - 1}`);
console.log('Output: output/test_building.obj + output/test_building.png');
