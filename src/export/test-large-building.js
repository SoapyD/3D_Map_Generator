/**
 * Test: export a large building with subdivided geometry + flowing UVs.
 * Run: node src/export/test-large-building.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { PNG } from 'pngjs';

const SEG_SIZE = 3;
const SEGS_PER_TILE = 4;

// Large building: 14x12 footprint, 3 tiers, with floor quadrant removal
const building = {
  x: 0, z: 0, w: 14, d: 12,
  tiers: 3, tierHeight: 3, slabThickness: 0.5, wallThickness: 0.25,
};

// Load textures
const wallTex = readFileSync('assets/textures/loaded/walls/Bricks_04_Brown_2.png');
const landmarkTex = readFileSync('assets/textures/loaded/landmark_walls/Bricks_02_Grey_1.png');
const floorTex = readFileSync('assets/textures/loaded/floors/Wood_Planks_03_Brown_1.png');
const baseTex = readFileSync('assets/textures/loaded/base_map/Dirt_Cracked_01_Grey_1.png');

// Build atlas: 2x2 grid = 4 tiles
const srcTextures = [wallTex, floorTex, landmarkTex, baseTex].map(b => PNG.sync.read(b));
const TILE = 256;
const atlas = new PNG({ width: TILE * 2, height: TILE * 2 });

for (let ti = 0; ti < 4; ti++) {
  const col = ti % 2;
  const row = Math.floor(ti / 2);
  const src = srcTextures[ti];
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const si = ((y % src.height) * src.width + (x % src.width)) * 4;
      const di = ((row * TILE + y) * TILE * 2 + (col * TILE + x)) * 4;
      atlas.data[di] = src.data[si];
      atlas.data[di + 1] = src.data[si + 1];
      atlas.data[di + 2] = src.data[si + 2];
      atlas.data[di + 3] = 255;
    }
  }
}

writeFileSync('output/test_large.png', PNG.sync.write(atlas));

// UV regions: 2x2 grid
const wallUV =     { uMin: 0.0, uMax: 0.5, vMin: 0.5, vMax: 1.0 };
const floorUV =    { uMin: 0.5, uMax: 1.0, vMin: 0.5, vMax: 1.0 };
const landmarkUV = { uMin: 0.0, uMax: 0.5, vMin: 0.0, vMax: 0.5 };
const baseUV =     { uMin: 0.5, uMax: 1.0, vMin: 0.0, vMax: 0.5 };

const lines = [];
let vertOff = 1;
let uvOff = 1;
let normOff = 1;

lines.push('# Test large building');
lines.push('');

function addSubdividedBox(name, x0, y0, z0, sizeX, sizeY, sizeZ, uv) {
  const segsX = Math.max(1, Math.ceil(sizeX / SEG_SIZE));
  const segsY = Math.max(1, Math.ceil(sizeY / SEG_SIZE));
  const segsZ = Math.max(1, Math.ceil(sizeZ / SEG_SIZE));
  const stepX = sizeX / segsX;
  const stepY = sizeY / segsY;
  const stepZ = sizeZ / segsZ;

  const tileW = uv.uMax - uv.uMin;
  const tileH = uv.vMax - uv.vMin;
  const uvStep = tileW / SEGS_PER_TILE;
  const uvStepV = tileH / SEGS_PER_TILE;

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

        const uOffX = ((sx % SEGS_PER_TILE) * uvStep);
        const uOffZ = ((sz % SEGS_PER_TILE) * uvStep);
        const vOffY = ((sy % SEGS_PER_TILE) * uvStepV);
        const vOffZ = ((sz % SEGS_PER_TILE) * uvStepV);

        const faceUVs = [
          [[uv.uMin + uOffX, uv.vMin + vOffY], [uv.uMin + uOffX, uv.vMin + vOffY + uvStepV], [uv.uMin + uOffX + uvStep, uv.vMin + vOffY + uvStepV], [uv.uMin + uOffX + uvStep, uv.vMin + vOffY]],
          [[uv.uMin + uOffX + uvStep, uv.vMin + vOffY], [uv.uMin + uOffX, uv.vMin + vOffY], [uv.uMin + uOffX, uv.vMin + vOffY + uvStepV], [uv.uMin + uOffX + uvStep, uv.vMin + vOffY + uvStepV]],
          [[uv.uMin + uOffX, uv.vMin + vOffZ], [uv.uMin + uOffX + uvStep, uv.vMin + vOffZ], [uv.uMin + uOffX + uvStep, uv.vMin + vOffZ + uvStepV], [uv.uMin + uOffX, uv.vMin + vOffZ + uvStepV]],
          [[uv.uMin + uOffX + uvStep, uv.vMin + vOffZ], [uv.uMin + uOffX, uv.vMin + vOffZ], [uv.uMin + uOffX, uv.vMin + vOffZ + uvStepV], [uv.uMin + uOffX + uvStep, uv.vMin + vOffZ + uvStepV]],
          [[uv.uMin + uOffZ + uvStep, uv.vMin + vOffY], [uv.uMin + uOffZ, uv.vMin + vOffY], [uv.uMin + uOffZ, uv.vMin + vOffY + uvStepV], [uv.uMin + uOffZ + uvStep, uv.vMin + vOffY + uvStepV]],
          [[uv.uMin + uOffZ, uv.vMin + vOffY], [uv.uMin + uOffZ, uv.vMin + vOffY + uvStepV], [uv.uMin + uOffZ + uvStep, uv.vMin + vOffY + uvStepV], [uv.uMin + uOffZ + uvStep, uv.vMin + vOffY]],
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
const mx = w / 2;
const mz = d / 2;

// Ground floor slab (base texture)
addSubdividedBox('base_floor', x, 0, z, w, slabThickness, d, baseUV);

// Tier 1: full floor
addSubdividedBox('floor_t1', x, tierHeight, z, w, slabThickness, d, floorUV);

// Tier 2: floor with quadrant 1 (top-right) removed
addSubdividedBox('floor_t2_q0', x, tierHeight * 2, z, mx, slabThickness, mz, floorUV);
addSubdividedBox('floor_t2_q2', x, tierHeight * 2, z + mz, mx, slabThickness, mz, floorUV);
addSubdividedBox('floor_t2_q3', x + mx, tierHeight * 2, z + mz, mx, slabThickness, mz, floorUV);

// Tier 3: floor with quadrants 1 and 3 removed (only left column)
addSubdividedBox('floor_t3_q0', x, tierHeight * 3, z, mx, slabThickness, mz, floorUV);
addSubdividedBox('floor_t3_q2', x, tierHeight * 3, z + mz, mx, slabThickness, mz, floorUV);

// Walls: north + west on all tiers (landmark texture for this large building)
for (let tier = 0; tier < tiers; tier++) {
  const baseY = tier * tierHeight + slabThickness;
  const wallH = tierHeight - slabThickness;

  // North wall (along X at z=0)
  addSubdividedBox(`wall_north_t${tier}`, x, baseY, z, w, wallH, wallThickness, landmarkUV);

  // West wall (along Z at x=0)
  addSubdividedBox(`wall_west_t${tier}`, x, baseY, z, wallThickness, wallH, d, landmarkUV);
}

writeFileSync('output/test_large.obj', lines.join('\n'));

const totalSegs = (vertOff - 1) / 8;
console.log(`Building: ${w}x${d}, ${tiers} tiers`);
console.log(`Total segments: ${totalSegs}`);
console.log(`Vertices: ${vertOff - 1}`);
console.log(`Atlas: 512x512 (4 tiles)`);
console.log('Output: output/test_large.obj + output/test_large.png');
