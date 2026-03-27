/**
 * Test: generate a small map with only small buildings, export as subdivided OBJ.
 * Uses the real generator pipeline but stops after buildings + floors + walls.
 * No large buildings, no deletions, no connectivity, no cover.
 *
 * Run: node src/export/test-small-map.js
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { PNG } from 'pngjs';
import { createRng } from '../core/rng.js';
import { generateGrid } from '../generators/grid.js';
import { generateBuildings } from '../generators/buildings.js';
import { generateFloors } from '../generators/floors.js';
import { generateWalls } from '../generators/walls.js';
import { generateConnectivity } from '../generators/connectivity.js';
import { generateCover } from '../generators/cover.js';
import { BUILDING, GEOMETRY } from '../config.js';

const SEG_SIZE = 3;
const SEGS_PER_TILE = 4;
const TILE_SIZE = 256;

const config = {
  seed: 42,
  mapWidth: 48,
  mapDepth: 48,
  tiers: 3,
  tierHeight: 3,
  slabThickness: 0.5,
  wallThickness: 0.25,
  streetWidth: 3.5,
  damageLevel: 0.5,
};

const rng = createRng(config.seed);

// Step 1: Generate grid
const gridData = generateGrid(config, rng);
console.log(`Grid: ${gridData.blocks.length} blocks`);

// Step 2: Place buildings (real pipeline — small grid + large layouts + deletions)
const buildingData = generateBuildings(gridData, config, rng);
const buildings = buildingData.buildings;
console.log(`Buildings: ${buildings.length} (S:${buildings.filter(b=>b.size==='small').length} M:${buildings.filter(b=>b.size==='medium').length} L:${buildings.filter(b=>b.size==='large').length})`);

// Step 3: Generate floors
const floorData = generateFloors(buildingData, config, rng);
console.log(`Floors: ${floorData.floors.map(f => 't' + f.tier + ':' + f.sections.length).join(', ')}`);

// Step 4: Generate walls
const wallData = generateWalls(floorData, config, rng);
console.log(`Walls: ${wallData.walls.length}`);

// Step 5: Connectivity (walkways)
const connData = generateConnectivity(wallData, config, rng);
const walkways = connData.connections.walkways;
console.log(`Walkways: ${walkways.length}`);

// Step 6: Cover + pink footprints
const coverData = generateCover(connData, config, rng);
console.log(`Cover: ${coverData.cover.length}, Interior: ${coverData.interiorCover.length}, Pink: ${coverData.deletedFootprints.length}`);

// --- Load textures ---
const packDir = 'assets/textures/loaded';
function loadTex(category) {
  const dir = `${packDir}/${category}`;
  if (!existsSync(dir)) return null;
  const files = readdirSync(dir).filter(f => f.endsWith('.png'));
  if (files.length === 0) return null;
  return files.map(f => PNG.sync.read(readFileSync(`${dir}/${f}`)));
}

const wallTextures = loadTex('walls') || [];
const landmarkTextures = loadTex('landmark_walls') || [];
const floorTextures = loadTex('floors') || [];
const baseTextures = loadTex('base_map') || [];
const walkwayTextures = loadTex('walkways') || floorTextures;
const objectTextures = loadTex('objects') || [];
const courtyardTextures = loadTex('courtyards') || baseTextures;

// Build atlas: collect unique textures needed
const allTextures = [];
const texMap = new Map(); // name -> atlas index

function addTexture(name, png) {
  if (!texMap.has(name)) {
    texMap.set(name, allTextures.length);
    allTextures.push(png);
  }
  return texMap.get(name);
}

// Add base map texture
const baseIdx = addTexture('base', baseTextures[0] || wallTextures[0]);

// Per-building texture indices — landmark buildings use different wall textures
const buildingWallIdx = [];
const buildingFloorIdx = [];
for (let bi = 0; bi < buildings.length; bi++) {
  const b = buildings[bi];
  const isLandmark = b.size === 'medium' || b.size === 'large';
  const wPool = isLandmark ? landmarkTextures : wallTextures;
  const wTex = wPool[bi % wPool.length];
  const fTex = floorTextures[bi % floorTextures.length];
  const prefix = isLandmark ? 'landmark' : 'wall';
  buildingWallIdx.push(addTexture(`${prefix}_${bi % wPool.length}`, wTex));
  buildingFloorIdx.push(addTexture(`floor_${bi % floorTextures.length}`, fTex));
}

// Add walkway texture
const walkwayIdx = addTexture('walkway_0', walkwayTextures[0]);

// Add object textures
const objectIdx = addTexture('object_0', objectTextures.length > 0 ? objectTextures[0] : wallTextures[0]);

// Add courtyard textures (for pink footprints)
const courtyardIdx = addTexture('courtyard_0', courtyardTextures[0]);

console.log(`Atlas tiles: ${allTextures.length}`);

// Build atlas image
const gridSz = Math.ceil(Math.sqrt(allTextures.length));
const atlasSize = gridSz * TILE_SIZE;
const atlas = new PNG({ width: atlasSize, height: atlasSize });
// Fill opaque black
for (let i = 0; i < atlasSize * atlasSize; i++) atlas.data[i * 4 + 3] = 255;

for (let ti = 0; ti < allTextures.length; ti++) {
  const col = ti % gridSz;
  const row = Math.floor(ti / gridSz);
  const src = allTextures[ti];
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const si = ((y % src.height) * src.width + (x % src.width)) * 4;
      const di = ((row * TILE_SIZE + y) * atlasSize + (col * TILE_SIZE + x)) * 4;
      atlas.data[di] = src.data[si];
      atlas.data[di + 1] = src.data[si + 1];
      atlas.data[di + 2] = src.data[si + 2];
      atlas.data[di + 3] = 255;
    }
  }
}

writeFileSync('output/test_smallmap.png', PNG.sync.write(atlas));
console.log(`Atlas: ${atlasSize}x${atlasSize}`);

// Helper: get UV region for an atlas tile
function getUV(tileIdx) {
  const col = tileIdx % gridSz;
  const row = Math.floor(tileIdx / gridSz);
  const margin = 0.001;
  return {
    uMin: col / gridSz + margin,
    uMax: (col + 1) / gridSz - margin,
    vMin: 1 - (row + 1) / gridSz + margin,
    vMax: 1 - row / gridSz - margin,
  };
}

// Find which building a section belongs to
function findBuilding(section) {
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (section.x >= b.x - 0.1 && section.z >= b.z - 0.1 &&
        section.x + section.w <= b.x + b.w + 0.1 &&
        section.z + section.d <= b.z + b.d + 0.1) {
      return i;
    }
  }
  return -1;
}

// Find which building a wall belongs to
function findBuildingForWall(wall) {
  const wx = wall.axis === 'x' ? wall.x + wall.length / 2 : wall.x;
  const wz = wall.axis === 'z' ? wall.z + wall.length / 2 : wall.z;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (wx >= b.x - 1 && wx <= b.x + b.w + 1 && wz >= b.z - 1 && wz <= b.z + b.d + 1) {
      return i;
    }
  }
  return -1;
}

// --- OBJ export with subdivision ---
const objLines = [];
let vertOff = 1, uvOff = 1, normOff = 1;

objLines.push('# Test small map - subdivided');
objLines.push('');

function addSubBox(name, x0, y0, z0, sizeX, sizeY, sizeZ, uv) {
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

  objLines.push(`o ${name}`);

  for (let sx = 0; sx < segsX; sx++) {
    for (let sy = 0; sy < segsY; sy++) {
      for (let sz = 0; sz < segsZ; sz++) {
        const bx0 = x0 + sx * stepX;
        const by0 = y0 + sy * stepY;
        const bz0 = z0 + sz * stepZ;

        const verts = [
          [bx0, by0, bz0], [bx0 + stepX, by0, bz0], [bx0 + stepX, by0 + stepY, bz0], [bx0, by0 + stepY, bz0],
          [bx0, by0, bz0 + stepZ], [bx0 + stepX, by0, bz0 + stepZ], [bx0 + stepX, by0 + stepY, bz0 + stepZ], [bx0, by0 + stepY, bz0 + stepZ],
        ];
        for (const v of verts) objLines.push(`v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}`);

        const uOffX = (sx % SEGS_PER_TILE) * uvStep;
        const uOffZ = (sz % SEGS_PER_TILE) * uvStep;
        const vOffY = (sy % SEGS_PER_TILE) * uvStepV;
        const vOffZ = (sz % SEGS_PER_TILE) * uvStepV;

        const faceUVs = [
          [[uv.uMin+uOffX,uv.vMin+vOffY],[uv.uMin+uOffX,uv.vMin+vOffY+uvStepV],[uv.uMin+uOffX+uvStep,uv.vMin+vOffY+uvStepV],[uv.uMin+uOffX+uvStep,uv.vMin+vOffY]],
          [[uv.uMin+uOffX+uvStep,uv.vMin+vOffY],[uv.uMin+uOffX,uv.vMin+vOffY],[uv.uMin+uOffX,uv.vMin+vOffY+uvStepV],[uv.uMin+uOffX+uvStep,uv.vMin+vOffY+uvStepV]],
          [[uv.uMin+uOffX,uv.vMin+vOffZ],[uv.uMin+uOffX+uvStep,uv.vMin+vOffZ],[uv.uMin+uOffX+uvStep,uv.vMin+vOffZ+uvStepV],[uv.uMin+uOffX,uv.vMin+vOffZ+uvStepV]],
          [[uv.uMin+uOffX+uvStep,uv.vMin+vOffZ],[uv.uMin+uOffX,uv.vMin+vOffZ],[uv.uMin+uOffX,uv.vMin+vOffZ+uvStepV],[uv.uMin+uOffX+uvStep,uv.vMin+vOffZ+uvStepV]],
          [[uv.uMin+uOffZ+uvStep,uv.vMin+vOffY],[uv.uMin+uOffZ,uv.vMin+vOffY],[uv.uMin+uOffZ,uv.vMin+vOffY+uvStepV],[uv.uMin+uOffZ+uvStep,uv.vMin+vOffY+uvStepV]],
          [[uv.uMin+uOffZ,uv.vMin+vOffY],[uv.uMin+uOffZ,uv.vMin+vOffY+uvStepV],[uv.uMin+uOffZ+uvStep,uv.vMin+vOffY+uvStepV],[uv.uMin+uOffZ+uvStep,uv.vMin+vOffY]],
        ];
        for (const uvSet of faceUVs) for (const c of uvSet) objLines.push(`vt ${c[0].toFixed(6)} ${c[1].toFixed(6)}`);

        for (const n of [[0,0,-1],[0,0,1],[0,-1,0],[0,1,0],[-1,0,0],[1,0,0]]) objLines.push(`vn ${n[0]} ${n[1]} ${n[2]}`);

        const vo = vertOff, uo = uvOff, no = normOff;
        for (const face of [
          {vi:[0,3,2,1],ufi:0,ni:0},{vi:[4,5,6,7],ufi:1,ni:1},{vi:[0,1,5,4],ufi:2,ni:2},
          {vi:[2,3,7,6],ufi:3,ni:3},{vi:[0,4,7,3],ufi:4,ni:4},{vi:[1,2,6,5],ufi:5,ni:5},
        ]) {
          const [a,b,c,d] = face.vi;
          const ub = uo + face.ufi * 4, n = no + face.ni;
          objLines.push(`f ${vo+a}/${ub}/${n} ${vo+b}/${ub+1}/${n} ${vo+c}/${ub+2}/${n}`);
          objLines.push(`f ${vo+a}/${ub}/${n} ${vo+c}/${ub+2}/${n} ${vo+d}/${ub+3}/${n}`);
        }
        vertOff += 8; uvOff += 24; normOff += 6;
      }
    }
  }
  objLines.push('');
}

// Export base floor
const baseFloor = floorData.floors[0].sections[0];
addSubBox('base_floor', baseFloor.x, 0, baseFloor.z, baseFloor.w, config.slabThickness, baseFloor.d, getUV(baseIdx));

// Export building floors (tier 1+)
for (let t = 1; t < floorData.floors.length; t++) {
  const tier = floorData.floors[t];
  for (const section of tier.sections) {
    const bi = findBuilding(section);
    const texIdx = bi >= 0 ? buildingFloorIdx[bi] : baseIdx;
    addSubBox(`floor_t${tier.tier}_${Math.round(section.x)}_${Math.round(section.z)}`,
      section.x, tier.tier * config.tierHeight, section.z,
      section.w, config.slabThickness, section.d, getUV(texIdx));
  }
}

// Export walls
for (let i = 0; i < wallData.walls.length; i++) {
  const wall = wallData.walls[i];
  const bi = findBuildingForWall(wall);
  const texIdx = bi >= 0 ? buildingWallIdx[bi] : buildingWallIdx[0];
  const wx = wall.axis === 'x' ? wall.length : wall.thickness;
  const wz = wall.axis === 'z' ? wall.length : wall.thickness;
  addSubBox(`wall_${i}`, wall.x, wall.baseY, wall.z, wx, wall.height, wz, getUV(texIdx));
}

// Export walkways
for (let i = 0; i < walkways.length; i++) {
  const w = walkways[i];
  addSubBox(`walkway_${i}`, w.x, w.y, w.z, w.w, 0.3, w.d, getUV(walkwayIdx));
}

// Export cover (purple objects)
for (let i = 0; i < coverData.cover.length; i++) {
  const c = coverData.cover[i];
  addSubBox(`cover_${i}`, c.x, c.y, c.z, c.w, c.height, c.d, getUV(objectIdx));
}

// Export interior cover (grey objects)
for (let i = 0; i < coverData.interiorCover.length; i++) {
  const c = coverData.interiorCover[i];
  addSubBox(`interior_cover_${i}`, c.x, c.y, c.z, c.w, c.height, c.d, getUV(objectIdx));
}

// Export pink footprints
for (let i = 0; i < coverData.deletedFootprints.length; i++) {
  const df = coverData.deletedFootprints[i];
  addSubBox(`deleted_${i}`, df.x, 0.55, df.z, df.w, 0.1, df.d, getUV(courtyardIdx));
}

writeFileSync('output/test_smallmap.obj', objLines.join('\n'));

console.log(`\nVertices: ${vertOff - 1}`);
console.log('Output: output/test_smallmap.obj + output/test_smallmap.png');
