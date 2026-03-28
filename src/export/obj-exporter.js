/**
 * OBJ Exporter — subdivided geometry with texture atlas.
 *
 * Subdivides meshes into 3" segments for proper UV tiling within atlas tiles.
 * Generates edges only where visible (adjacency-aware).
 * Ladders exported as flat stiles + rungs.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import { PNG } from 'pngjs';
import path from 'path';
import { GEOMETRY } from '../config.js';

const SEG_SIZE = 3;
const SEGS_PER_TILE = GEOMETRY.objSegmentsPerTile;
const TILE_SIZE = GEOMETRY.objAtlasTileSize;
const PADDING = 4;
const PADDED_TILE = TILE_SIZE + PADDING * 2;

// Ladder dimensions
const POLE_WIDTH = 0.24;
const POLE_DEPTH = 0.24;
const RUNG_HEIGHT = 0.18;
const RUNG_DEPTH = 0.18;
const RUNG_SPACING = 0.75;
const RUNG_INSET = 0.05;

function loadTexPool(packDir, category) {
  const dir = path.join(packDir, category);
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter(f => f.endsWith('.png'));
  return files.map(f => PNG.sync.read(readFileSync(path.join(dir, f))));
}

/**
 * Export pipeline data to OBJ + texture atlas.
 */
export async function exportToObj(data, config, outputDir, baseName) {
  const packDir = path.join('assets', 'textures', config.textureSet || 'base');

  // Load texture pools
  const wallTextures = loadTexPool(packDir, 'walls');
  const landmarkTextures = loadTexPool(packDir, 'landmark_walls');
  const floorTextures = loadTexPool(packDir, 'floors');
  const baseTextures = loadTexPool(packDir, 'base_map');
  const walkwayTextures = loadTexPool(packDir, 'walkways').length > 0 ? loadTexPool(packDir, 'walkways') : floorTextures;
  const objectTextures = loadTexPool(packDir, 'objects');
  const courtyardTextures = loadTexPool(packDir, 'courtyards').length > 0 ? loadTexPool(packDir, 'courtyards') : baseTextures;
  const ladderTextures = loadTexPool(packDir, 'ladders').length > 0 ? loadTexPool(packDir, 'ladders') : wallTextures;

  // Build atlas: collect unique textures needed
  const allTextures = [];
  const texMap = new Map();

  function addTexture(name, png) {
    if (!texMap.has(name)) {
      texMap.set(name, allTextures.length);
      allTextures.push(png);
    }
    return texMap.get(name);
  }

  const buildings = data.buildings;
  const baseIdx = addTexture('base', baseTextures[0] || wallTextures[0]);

  // Per-building texture indices
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

  const walkwayIdx = addTexture('walkway_0', walkwayTextures[0]);
  const ladderIdx = addTexture('ladder_0', ladderTextures[0]);
  const objectIdx = addTexture('object_0', objectTextures.length > 0 ? objectTextures[0] : wallTextures[0]);
  const courtyardIdx = addTexture('courtyard_0', courtyardTextures[0]);

  // Build atlas image with padding border
  const gridSz = Math.ceil(Math.sqrt(allTextures.length));
  const atlasSize = gridSz * PADDED_TILE;
  const atlas = new PNG({ width: atlasSize, height: atlasSize });
  for (let i = 0; i < atlasSize * atlasSize; i++) atlas.data[i * 4 + 3] = 255;

  for (let ti = 0; ti < allTextures.length; ti++) {
    const col = ti % gridSz;
    const row = Math.floor(ti / gridSz);
    const src = allTextures[ti];
    for (let y = -PADDING; y < TILE_SIZE + PADDING; y++) {
      for (let x = -PADDING; x < TILE_SIZE + PADDING; x++) {
        const sx = Math.max(0, Math.min(src.width - 1, x % src.width));
        const sy = Math.max(0, Math.min(src.height - 1, y % src.height));
        const si = (sy * src.width + sx) * 4;
        const dx = col * PADDED_TILE + PADDING + x;
        const dy = row * PADDED_TILE + PADDING + y;
        if (dx < 0 || dx >= atlasSize || dy < 0 || dy >= atlasSize) continue;
        const di = (dy * atlasSize + dx) * 4;
        atlas.data[di] = src.data[si];
        atlas.data[di + 1] = src.data[si + 1];
        atlas.data[di + 2] = src.data[si + 2];
        atlas.data[di + 3] = 255;
      }
    }
  }

  await mkdir(outputDir, { recursive: true });
  const atlasPath = path.join(outputDir, `${baseName}.png`);
  await writeFile(atlasPath, PNG.sync.write(atlas));

  // Helper: get UV region for an atlas tile
  function getUV(tileIdx) {
    const col = tileIdx % gridSz;
    const row = Math.floor(tileIdx / gridSz);
    return {
      uMin: (col * PADDED_TILE + PADDING) / atlasSize,
      uMax: (col * PADDED_TILE + PADDING + TILE_SIZE) / atlasSize,
      vMin: 1 - (row * PADDED_TILE + PADDING + TILE_SIZE) / atlasSize,
      vMax: 1 - (row * PADDED_TILE + PADDING) / atlasSize,
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

  objLines.push('# Mordheim Map Generator - subdivided');
  objLines.push('');

  function addSubBox(name, x0, y0, z0, sizeX, sizeY, sizeZ, uv, showEdges = false, rotateUV = false) {
    const isFloor = sizeY < 1;
    const isWallX = sizeX < 1;
    const isWallZ = sizeZ < 1;

    const tileW = uv.uMax - uv.uMin;
    const tileH = uv.vMax - uv.vMin;
    const uvStep = tileW / SEGS_PER_TILE;
    const uvStepV = tileH / SEGS_PER_TILE;

    // Per-object UV offset to break tiling repetition
    const fract = (v) => v - Math.floor(v);
    const hashU = fract(x0 * 0.7123 + z0 * 0.3917) * SEGS_PER_TILE;
    const hashV = fract(x0 * 0.5431 + z0 * 0.9281 + y0 * 0.1637) * SEGS_PER_TILE;
    const baseSegU = Math.floor(hashU);
    const baseSegV = Math.floor(hashV);

    objLines.push(`o ${name}`);

    if (isFloor) {
      const segsX = Math.max(1, Math.ceil(sizeX / SEG_SIZE));
      const segsZ = Math.max(1, Math.ceil(sizeZ / SEG_SIZE));
      const stepX = sizeX / segsX;
      const stepZ = sizeZ / segsZ;

      for (let sx = 0; sx < segsX; sx++) {
        for (let sz = 0; sz < segsZ; sz++) {
          const qx = x0 + sx * stepX;
          const qz = z0 + sz * stepZ;
          const vo = vertOff;
          const yTop = y0 + sizeY;

          objLines.push(`v ${qx.toFixed(6)} ${y0.toFixed(6)} ${qz.toFixed(6)}`);
          objLines.push(`v ${(qx+stepX).toFixed(6)} ${y0.toFixed(6)} ${qz.toFixed(6)}`);
          objLines.push(`v ${(qx+stepX).toFixed(6)} ${y0.toFixed(6)} ${(qz+stepZ).toFixed(6)}`);
          objLines.push(`v ${qx.toFixed(6)} ${y0.toFixed(6)} ${(qz+stepZ).toFixed(6)}`);
          objLines.push(`v ${qx.toFixed(6)} ${yTop.toFixed(6)} ${qz.toFixed(6)}`);
          objLines.push(`v ${(qx+stepX).toFixed(6)} ${yTop.toFixed(6)} ${qz.toFixed(6)}`);
          objLines.push(`v ${(qx+stepX).toFixed(6)} ${yTop.toFixed(6)} ${(qz+stepZ).toFixed(6)}`);
          objLines.push(`v ${qx.toFixed(6)} ${yTop.toFixed(6)} ${(qz+stepZ).toFixed(6)}`);

          const uOff = ((sx + baseSegU) % SEGS_PER_TILE) * uvStep, vOff = ((sz + baseSegV) % SEGS_PER_TILE) * uvStepV;
          for (let f = 0; f < 2; f++) {
            if (rotateUV) {
              objLines.push(`vt ${(uv.uMin+vOff).toFixed(6)} ${(uv.vMin+uOff).toFixed(6)}`);
              objLines.push(`vt ${(uv.uMin+vOff).toFixed(6)} ${(uv.vMin+uOff+uvStep).toFixed(6)}`);
              objLines.push(`vt ${(uv.uMin+vOff+uvStepV).toFixed(6)} ${(uv.vMin+uOff+uvStep).toFixed(6)}`);
              objLines.push(`vt ${(uv.uMin+vOff+uvStepV).toFixed(6)} ${(uv.vMin+uOff).toFixed(6)}`);
            } else {
              objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
              objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
              objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
              objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
            }
          }

          objLines.push(`vn 0 -1 0`);
          objLines.push(`vn 0 1 0`);
          const uo = uvOff, no = normOff;
          objLines.push(`f ${vo}/${uo}/${no} ${vo+1}/${uo+1}/${no} ${vo+2}/${uo+2}/${no}`);
          objLines.push(`f ${vo}/${uo}/${no} ${vo+2}/${uo+2}/${no} ${vo+3}/${uo+3}/${no}`);
          objLines.push(`f ${vo+6}/${uo+6}/${no+1} ${vo+5}/${uo+5}/${no+1} ${vo+4}/${uo+4}/${no+1}`);
          objLines.push(`f ${vo+7}/${uo+7}/${no+1} ${vo+6}/${uo+6}/${no+1} ${vo+4}/${uo+4}/${no+1}`);
          vertOff += 8; uvOff += 8; normOff += 2;
        }
      }
    } else if (isWallZ) {
      const segsX = Math.max(1, Math.ceil(sizeX / SEG_SIZE));
      const segsY = Math.max(1, Math.ceil(sizeY / SEG_SIZE));
      const stepX = sizeX / segsX;
      const stepY = sizeY / segsY;

      for (let sx = 0; sx < segsX; sx++) {
        for (let sy = 0; sy < segsY; sy++) {
          const qx = x0 + sx * stepX;
          const qy = y0 + sy * stepY;
          const vo = vertOff;
          const z1 = z0 + sizeZ;

          objLines.push(`v ${qx.toFixed(6)} ${qy.toFixed(6)} ${z0.toFixed(6)}`);
          objLines.push(`v ${(qx+stepX).toFixed(6)} ${qy.toFixed(6)} ${z0.toFixed(6)}`);
          objLines.push(`v ${(qx+stepX).toFixed(6)} ${(qy+stepY).toFixed(6)} ${z0.toFixed(6)}`);
          objLines.push(`v ${qx.toFixed(6)} ${(qy+stepY).toFixed(6)} ${z0.toFixed(6)}`);
          objLines.push(`v ${qx.toFixed(6)} ${qy.toFixed(6)} ${z1.toFixed(6)}`);
          objLines.push(`v ${(qx+stepX).toFixed(6)} ${qy.toFixed(6)} ${z1.toFixed(6)}`);
          objLines.push(`v ${(qx+stepX).toFixed(6)} ${(qy+stepY).toFixed(6)} ${z1.toFixed(6)}`);
          objLines.push(`v ${qx.toFixed(6)} ${(qy+stepY).toFixed(6)} ${z1.toFixed(6)}`);

          const uOff = ((sx + baseSegU) % SEGS_PER_TILE) * uvStep, vOff = ((sy + baseSegV) % SEGS_PER_TILE) * uvStepV;
          for (let f = 0; f < 2; f++) {
            objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
            objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
            objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
            objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          }

          objLines.push(`vn 0 0 -1`);
          objLines.push(`vn 0 0 1`);
          const uo = uvOff, no = normOff;
          objLines.push(`f ${vo}/${uo}/${no} ${vo+3}/${uo+3}/${no} ${vo+2}/${uo+2}/${no}`);
          objLines.push(`f ${vo}/${uo}/${no} ${vo+2}/${uo+2}/${no} ${vo+1}/${uo+1}/${no}`);
          objLines.push(`f ${vo+4}/${uo+4}/${no+1} ${vo+5}/${uo+5}/${no+1} ${vo+6}/${uo+6}/${no+1}`);
          objLines.push(`f ${vo+4}/${uo+4}/${no+1} ${vo+6}/${uo+6}/${no+1} ${vo+7}/${uo+7}/${no+1}`);
          vertOff += 8; uvOff += 8; normOff += 2;
        }
      }
    } else if (isWallX) {
      const segsZ = Math.max(1, Math.ceil(sizeZ / SEG_SIZE));
      const segsY = Math.max(1, Math.ceil(sizeY / SEG_SIZE));
      const stepZ = sizeZ / segsZ;
      const stepY = sizeY / segsY;

      for (let sz = 0; sz < segsZ; sz++) {
        for (let sy = 0; sy < segsY; sy++) {
          const qz = z0 + sz * stepZ;
          const qy = y0 + sy * stepY;
          const vo = vertOff;
          const x1 = x0 + sizeX;

          objLines.push(`v ${x0.toFixed(6)} ${qy.toFixed(6)} ${qz.toFixed(6)}`);
          objLines.push(`v ${x0.toFixed(6)} ${qy.toFixed(6)} ${(qz+stepZ).toFixed(6)}`);
          objLines.push(`v ${x0.toFixed(6)} ${(qy+stepY).toFixed(6)} ${(qz+stepZ).toFixed(6)}`);
          objLines.push(`v ${x0.toFixed(6)} ${(qy+stepY).toFixed(6)} ${qz.toFixed(6)}`);
          objLines.push(`v ${x1.toFixed(6)} ${qy.toFixed(6)} ${qz.toFixed(6)}`);
          objLines.push(`v ${x1.toFixed(6)} ${qy.toFixed(6)} ${(qz+stepZ).toFixed(6)}`);
          objLines.push(`v ${x1.toFixed(6)} ${(qy+stepY).toFixed(6)} ${(qz+stepZ).toFixed(6)}`);
          objLines.push(`v ${x1.toFixed(6)} ${(qy+stepY).toFixed(6)} ${qz.toFixed(6)}`);

          const uOff = ((sz + baseSegU) % SEGS_PER_TILE) * uvStep, vOff = ((sy + baseSegV) % SEGS_PER_TILE) * uvStepV;
          for (let f = 0; f < 2; f++) {
            objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
            objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
            objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
            objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          }

          objLines.push(`vn -1 0 0`);
          objLines.push(`vn 1 0 0`);
          const uo = uvOff, no = normOff;
          objLines.push(`f ${vo}/${uo}/${no} ${vo+1}/${uo+1}/${no} ${vo+2}/${uo+2}/${no}`);
          objLines.push(`f ${vo}/${uo}/${no} ${vo+2}/${uo+2}/${no} ${vo+3}/${uo+3}/${no}`);
          objLines.push(`f ${vo+4}/${uo+4}/${no+1} ${vo+7}/${uo+7}/${no+1} ${vo+6}/${uo+6}/${no+1}`);
          objLines.push(`f ${vo+4}/${uo+4}/${no+1} ${vo+6}/${uo+6}/${no+1} ${vo+5}/${uo+5}/${no+1}`);
          vertOff += 8; uvOff += 8; normOff += 2;
        }
      }
    } else {
      // Generic thick object (cover, etc) — top + bottom
      const segsX = Math.max(1, Math.ceil(sizeX / SEG_SIZE));
      const segsZ = Math.max(1, Math.ceil(sizeZ / SEG_SIZE));
      const stepX = sizeX / segsX;
      const stepZ = sizeZ / segsZ;
      const yTop = y0 + sizeY;

      for (let sx = 0; sx < segsX; sx++) {
        for (let sz = 0; sz < segsZ; sz++) {
          const qx = x0 + sx * stepX;
          const qz = z0 + sz * stepZ;
          const vo = vertOff;

          objLines.push(`v ${qx.toFixed(6)} ${y0.toFixed(6)} ${qz.toFixed(6)}`);
          objLines.push(`v ${(qx+stepX).toFixed(6)} ${y0.toFixed(6)} ${qz.toFixed(6)}`);
          objLines.push(`v ${(qx+stepX).toFixed(6)} ${y0.toFixed(6)} ${(qz+stepZ).toFixed(6)}`);
          objLines.push(`v ${qx.toFixed(6)} ${y0.toFixed(6)} ${(qz+stepZ).toFixed(6)}`);
          objLines.push(`v ${qx.toFixed(6)} ${yTop.toFixed(6)} ${qz.toFixed(6)}`);
          objLines.push(`v ${(qx+stepX).toFixed(6)} ${yTop.toFixed(6)} ${qz.toFixed(6)}`);
          objLines.push(`v ${(qx+stepX).toFixed(6)} ${yTop.toFixed(6)} ${(qz+stepZ).toFixed(6)}`);
          objLines.push(`v ${qx.toFixed(6)} ${yTop.toFixed(6)} ${(qz+stepZ).toFixed(6)}`);

          const uOff = ((sx + baseSegU) % SEGS_PER_TILE) * uvStep, vOff = ((sz + baseSegV) % SEGS_PER_TILE) * uvStepV;
          for (let f = 0; f < 2; f++) {
            objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
            objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
            objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
            objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          }

          objLines.push(`vn 0 -1 0`);
          objLines.push(`vn 0 1 0`);
          const uo = uvOff, no = normOff;
          objLines.push(`f ${vo}/${uo}/${no} ${vo+1}/${uo+1}/${no} ${vo+2}/${uo+2}/${no}`);
          objLines.push(`f ${vo}/${uo}/${no} ${vo+2}/${uo+2}/${no} ${vo+3}/${uo+3}/${no}`);
          objLines.push(`f ${vo+6}/${uo+6}/${no+1} ${vo+5}/${uo+5}/${no+1} ${vo+4}/${uo+4}/${no+1}`);
          objLines.push(`f ${vo+7}/${uo+7}/${no+1} ${vo+6}/${uo+6}/${no+1} ${vo+4}/${uo+4}/${no+1}`);
          vertOff += 8; uvOff += 8; normOff += 2;
        }
      }
    }

    // Add edge faces around the full perimeter of the object
    if (showEdges) {
      const x1 = x0 + sizeX, y1 = y0 + sizeY, z1 = z0 + sizeZ;
      const cu = ((uv.uMin + uv.uMax) / 2).toFixed(6);
      const cv = ((uv.vMin + uv.vMax) / 2).toFixed(6);

      function addEdgeFace(v0, v1, v2, v3, nx, ny, nz) {
        const vo = vertOff;
        for (const v of [v0,v1,v2,v3]) objLines.push(`v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}`);
        for (let i = 0; i < 4; i++) objLines.push(`vt ${cu} ${cv}`);
        objLines.push(`vn ${nx} ${ny} ${nz}`);
        objLines.push(`vn ${-nx} ${-ny} ${-nz}`);
        const uo = uvOff, no = normOff;
        objLines.push(`f ${vo}/${uo}/${no} ${vo+1}/${uo+1}/${no} ${vo+2}/${uo+2}/${no}`);
        objLines.push(`f ${vo}/${uo}/${no} ${vo+2}/${uo+2}/${no} ${vo+3}/${uo+3}/${no}`);
        objLines.push(`f ${vo+2}/${uo+2}/${no+1} ${vo+1}/${uo+1}/${no+1} ${vo}/${uo}/${no+1}`);
        objLines.push(`f ${vo+3}/${uo+3}/${no+1} ${vo+2}/${uo+2}/${no+1} ${vo}/${uo}/${no+1}`);
        vertOff += 4; uvOff += 4; normOff += 2;
      }

      if (isFloor || (!isWallX && !isWallZ)) {
        addEdgeFace([x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0], 0,0,-1);
        addEdgeFace([x1,y0,z1],[x0,y0,z1],[x0,y1,z1],[x1,y1,z1], 0,0,1);
        addEdgeFace([x0,y0,z1],[x0,y0,z0],[x0,y1,z0],[x0,y1,z1], -1,0,0);
        addEdgeFace([x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0], 1,0,0);
      } else if (isWallZ) {
        addEdgeFace([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1], 0,1,0);
        addEdgeFace([x0,y0,z1],[x1,y0,z1],[x1,y0,z0],[x0,y0,z0], 0,-1,0);
        addEdgeFace([x0,y0,z1],[x0,y0,z0],[x0,y1,z0],[x0,y1,z1], -1,0,0);
        addEdgeFace([x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0], 1,0,0);
      } else if (isWallX) {
        addEdgeFace([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1], 0,1,0);
        addEdgeFace([x0,y0,z1],[x1,y0,z1],[x1,y0,z0],[x0,y0,z0], 0,-1,0);
        addEdgeFace([x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0], 0,0,-1);
        addEdgeFace([x1,y0,z1],[x0,y0,z1],[x0,y1,z1],[x1,y1,z1], 0,0,1);
      }
    }

    objLines.push('');
  }

  // --- Edge coverage helpers ---

  function getEdgeCoverage(section, side, allSections) {
    const margin = 0.1;
    let edgeStart, edgeEnd;
    const touchingSections = [];

    if (side === 'north' || side === 'south') {
      edgeStart = section.x;
      edgeEnd = section.x + section.w;
      const edgeZ = side === 'north' ? section.z : section.z + section.d;
      for (const other of allSections) {
        if (other === section) continue;
        const otherEdgeZ = side === 'north' ? other.z + other.d : other.z;
        if (Math.abs(otherEdgeZ - edgeZ) < margin) {
          if (other.x < edgeEnd - margin && other.x + other.w > edgeStart + margin) {
            touchingSections.push({ start: Math.max(edgeStart, other.x), end: Math.min(edgeEnd, other.x + other.w) });
          }
        }
      }
    } else {
      edgeStart = section.z;
      edgeEnd = section.z + section.d;
      const edgeX = side === 'west' ? section.x : section.x + section.w;
      for (const other of allSections) {
        if (other === section) continue;
        const otherEdgeX = side === 'west' ? other.x + other.w : other.x;
        if (Math.abs(otherEdgeX - edgeX) < margin) {
          if (other.z < edgeEnd - margin && other.z + other.d > edgeStart + margin) {
            touchingSections.push({ start: Math.max(edgeStart, other.z), end: Math.min(edgeEnd, other.z + other.d) });
          }
        }
      }
    }

    touchingSections.sort((a, b) => a.start - b.start);

    const gaps = [];
    let pos = edgeStart;
    for (const t of touchingSections) {
      if (t.start > pos + margin) {
        gaps.push({ start: pos, end: t.start });
      }
      pos = Math.max(pos, t.end);
    }
    if (pos < edgeEnd - margin) {
      gaps.push({ start: pos, end: edgeEnd });
    }

    return gaps;
  }

  function addFloorEdges(section, y, h, allSections, uv) {
    const x0 = section.x, z0 = section.z, x1 = x0 + section.w, z1 = z0 + section.d;
    const y0 = y, y1 = y + h;
    const cu = ((uv.uMin + uv.uMax) / 2).toFixed(6);
    const cv = ((uv.vMin + uv.vMax) / 2).toFixed(6);

    function addEdge(v0, v1, v2, v3, nx, ny, nz) {
      const vo = vertOff;
      for (const v of [v0,v1,v2,v3]) objLines.push(`v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}`);
      for (let i = 0; i < 4; i++) objLines.push(`vt ${cu} ${cv}`);
      objLines.push(`vn ${nx} ${ny} ${nz}`);
      objLines.push(`vn ${-nx} ${-ny} ${-nz}`);
      const uo = uvOff, no = normOff;
      objLines.push(`f ${vo}/${uo}/${no} ${vo+1}/${uo+1}/${no} ${vo+2}/${uo+2}/${no}`);
      objLines.push(`f ${vo}/${uo}/${no} ${vo+2}/${uo+2}/${no} ${vo+3}/${uo+3}/${no}`);
      objLines.push(`f ${vo+2}/${uo+2}/${no+1} ${vo+1}/${uo+1}/${no+1} ${vo}/${uo}/${no+1}`);
      objLines.push(`f ${vo+3}/${uo+3}/${no+1} ${vo+2}/${uo+2}/${no+1} ${vo}/${uo}/${no+1}`);
      vertOff += 4; uvOff += 4; normOff += 2;
    }

    for (const gap of getEdgeCoverage(section, 'north', allSections)) {
      addEdge([gap.start,y0,z0],[gap.end,y0,z0],[gap.end,y1,z0],[gap.start,y1,z0], 0,0,-1);
    }
    for (const gap of getEdgeCoverage(section, 'south', allSections)) {
      addEdge([gap.end,y0,z1],[gap.start,y0,z1],[gap.start,y1,z1],[gap.end,y1,z1], 0,0,1);
    }
    for (const gap of getEdgeCoverage(section, 'west', allSections)) {
      addEdge([x0,y0,gap.end],[x0,y0,gap.start],[x0,y1,gap.start],[x0,y1,gap.end], -1,0,0);
    }
    for (const gap of getEdgeCoverage(section, 'east', allSections)) {
      addEdge([x1,y0,gap.start],[x1,y0,gap.end],[x1,y1,gap.end],[x1,y1,gap.start], 1,0,0);
    }
  }

  function wallEdgeCovered(wall, side, allWalls) {
    const margin = 0.5;
    const wx = wall.axis === 'x' ? wall.length : wall.thickness;
    const wz = wall.axis === 'z' ? wall.length : wall.thickness;

    let edgeX, edgeZ;
    if (wall.axis === 'x') {
      edgeX = side === 'start' ? wall.x : wall.x + wx;
      edgeZ = wall.z;
    } else {
      edgeX = wall.x;
      edgeZ = side === 'start' ? wall.z : wall.z + wz;
    }

    for (const other of allWalls) {
      if (other === wall) continue;
      if (Math.abs(wall.baseY - other.baseY) > 0.5) continue;

      const ox = other.axis === 'x' ? other.length : other.thickness;
      const oz = other.axis === 'z' ? other.length : other.thickness;

      if (edgeX >= other.x - margin && edgeX <= other.x + ox + margin &&
          edgeZ >= other.z - margin && edgeZ <= other.z + oz + margin) {
        return true;
      }
    }
    return false;
  }

  // --- Export geometry ---

  // Base floor
  const floorData = data.floors || [];
  if (floorData.length > 0 && floorData[0].sections.length > 0) {
    const baseFloor = floorData[0].sections[0];
    addSubBox('base_floor', baseFloor.x, 0, baseFloor.z, baseFloor.w, config.slabThickness, baseFloor.d, getUV(baseIdx), true);
  }

  // Building floors (tier 1+)
  for (let t = 1; t < floorData.length; t++) {
    const tier = floorData[t];
    for (const section of tier.sections) {
      const bi = findBuilding(section);
      const texIdx = bi >= 0 ? buildingFloorIdx[bi] : baseIdx;
      addSubBox(`floor_t${tier.tier}_${Math.round(section.x)}_${Math.round(section.z)}`,
        section.x, tier.tier * config.tierHeight, section.z,
        section.w, config.slabThickness, section.d, getUV(texIdx));
      addFloorEdges(section, tier.tier * config.tierHeight, config.slabThickness, tier.sections, getUV(texIdx));
    }
  }

  // Walls with edge faces
  const walls = data.walls || [];
  for (let i = 0; i < walls.length; i++) {
    const wall = walls[i];
    const bi = findBuildingForWall(wall);
    const texIdx = bi >= 0 ? buildingWallIdx[bi] : buildingWallIdx[0];
    const wx = wall.axis === 'x' ? wall.length : wall.thickness;
    const wz = wall.axis === 'z' ? wall.length : wall.thickness;
    addSubBox(`wall_${i}`, wall.x, wall.baseY, wall.z, wx, wall.height, wz, getUV(texIdx));

    // Wall edges
    const uvc = getUV(texIdx);
    const cu = ((uvc.uMin + uvc.uMax) / 2).toFixed(6);
    const cv = ((uvc.vMin + uvc.vMax) / 2).toFixed(6);

    function addWallEdge(v0, v1, v2, v3, nx, ny, nz) {
      const vo = vertOff;
      for (const v of [v0,v1,v2,v3]) objLines.push(`v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}`);
      for (let j = 0; j < 4; j++) objLines.push(`vt ${cu} ${cv}`);
      objLines.push(`vn ${nx} ${ny} ${nz}`);
      objLines.push(`vn ${-nx} ${-ny} ${-nz}`);
      const uo = uvOff, no = normOff;
      objLines.push(`f ${vo}/${uo}/${no} ${vo+1}/${uo+1}/${no} ${vo+2}/${uo+2}/${no}`);
      objLines.push(`f ${vo}/${uo}/${no} ${vo+2}/${uo+2}/${no} ${vo+3}/${uo+3}/${no}`);
      objLines.push(`f ${vo+2}/${uo+2}/${no+1} ${vo+1}/${uo+1}/${no+1} ${vo}/${uo}/${no+1}`);
      objLines.push(`f ${vo+3}/${uo+3}/${no+1} ${vo+2}/${uo+2}/${no+1} ${vo}/${uo}/${no+1}`);
      vertOff += 4; uvOff += 4; normOff += 2;
    }

    const x0 = wall.x, z0 = wall.z;
    const x1 = x0 + wx, z1 = z0 + wz;
    const y0 = wall.baseY, y1 = y0 + wall.height;

    // Top + bottom always visible
    addWallEdge([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1], 0,1,0);
    addWallEdge([x0,y0,z1],[x1,y0,z1],[x1,y0,z0],[x0,y0,z0], 0,-1,0);

    // Side edges only if no adjacent wall
    if (wall.axis === 'x') {
      if (!wallEdgeCovered(wall, 'start', walls))
        addWallEdge([x0,y0,z1],[x0,y0,z0],[x0,y1,z0],[x0,y1,z1], -1,0,0);
      if (!wallEdgeCovered(wall, 'end', walls))
        addWallEdge([x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0], 1,0,0);
    } else {
      if (!wallEdgeCovered(wall, 'start', walls))
        addWallEdge([x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0], 0,0,-1);
      if (!wallEdgeCovered(wall, 'end', walls))
        addWallEdge([x1,y0,z1],[x0,y0,z1],[x0,y1,z1],[x1,y1,z1], 0,0,1);
    }
  }

  // Walkways
  const walkways = data.connections ? data.connections.walkways : [];
  for (let i = 0; i < walkways.length; i++) {
    const w = walkways[i];
    addSubBox(`walkway_${i}`, w.x, w.y, w.z, w.w, 0.3, w.d, getUV(walkwayIdx), true, w.w > w.d);
  }

  // Cover
  const cover = data.cover || [];
  for (let i = 0; i < cover.length; i++) {
    const c = cover[i];
    addSubBox(`cover_${i}`, c.x, c.y, c.z, c.w, c.height, c.d, getUV(objectIdx), true);
  }

  // Interior cover
  const interiorCover = data.interiorCover || [];
  for (let i = 0; i < interiorCover.length; i++) {
    const c = interiorCover[i];
    addSubBox(`interior_cover_${i}`, c.x, c.y, c.z, c.w, c.height, c.d, getUV(objectIdx), true);
  }

  // Deleted footprints (courtyards)
  const deletedFootprints = data.deletedFootprints || [];
  for (let i = 0; i < deletedFootprints.length; i++) {
    const df = deletedFootprints[i];
    addSubBox(`deleted_${i}`, df.x, 0.55, df.z, df.w, 0.1, df.d, getUV(courtyardIdx), true);
  }

  // Flat ladder meshes
  function addLadderMesh(prefix, l, uv) {
    const height = l.y1 - l.y0;
    if (height <= 0) return;

    const isThinX = l.w < l.d;
    const ladderWidth = isThinX ? l.d : l.w;
    const cx = l.x + l.w / 2;
    const cz = l.z + l.d / 2;
    const halfSpread = (ladderWidth / 2) - POLE_WIDTH / 2 - RUNG_INSET;

    if (isThinX) {
      addSubBox(`${prefix}_stile_L`, cx - POLE_DEPTH/2, l.y0, cz - halfSpread - POLE_WIDTH/2, POLE_DEPTH, height, POLE_WIDTH, uv, true);
      addSubBox(`${prefix}_stile_R`, cx - POLE_DEPTH/2, l.y0, cz + halfSpread - POLE_WIDTH/2, POLE_DEPTH, height, POLE_WIDTH, uv, true);
    } else {
      addSubBox(`${prefix}_stile_L`, cx - halfSpread - POLE_WIDTH/2, l.y0, cz - POLE_DEPTH/2, POLE_WIDTH, height, POLE_DEPTH, uv, true);
      addSubBox(`${prefix}_stile_R`, cx + halfSpread - POLE_WIDTH/2, l.y0, cz - POLE_DEPTH/2, POLE_WIDTH, height, POLE_DEPTH, uv, true);
    }

    const rungCount = Math.floor(height / RUNG_SPACING);
    for (let r = 1; r <= rungCount; r++) {
      const ry = l.y0 + r * RUNG_SPACING;
      if (ry >= l.y1 - RUNG_SPACING * 0.3) break;
      if (isThinX) {
        const rungLen = halfSpread * 2 + POLE_WIDTH;
        addSubBox(`${prefix}_rung_${r}`, cx - RUNG_DEPTH/2, ry - RUNG_HEIGHT/2, cz - halfSpread - POLE_WIDTH/2, RUNG_DEPTH, RUNG_HEIGHT, rungLen, uv, true);
      } else {
        const rungLen = halfSpread * 2 + POLE_WIDTH;
        addSubBox(`${prefix}_rung_${r}`, cx - halfSpread - POLE_WIDTH/2, ry - RUNG_HEIGHT/2, cz - RUNG_DEPTH/2, rungLen, RUNG_HEIGHT, RUNG_DEPTH, uv, true);
      }
    }
  }

  const conn = data.connections || {};
  const ladderUV = getUV(ladderIdx);

  for (let i = 0; i < (conn.ladders || []).length; i++) {
    addLadderMesh(`ladder_${i}`, conn.ladders[i], ladderUV);
  }
  for (let i = 0; i < (conn.groundLadders || []).length; i++) {
    addLadderMesh(`ground_ladder_${i}`, conn.groundLadders[i], ladderUV);
  }
  for (let i = 0; i < (conn.orangeLadders || []).length; i++) {
    if (conn.orangeLadders[i].bad) continue;
    addLadderMesh(`orange_ladder_${i}`, conn.orangeLadders[i], ladderUV);
  }
  for (let i = 0; i < (conn.interiorLadders || []).length; i++) {
    addLadderMesh(`interior_ladder_${i}`, conn.interiorLadders[i], ladderUV);
  }

  // Ladder platforms
  for (let i = 0; i < (conn.ladderPlatforms || []).length; i++) {
    const p = conn.ladderPlatforms[i];
    addSubBox(`ladder_platform_${i}`, p.x, p.y, p.z, p.w, 0.2, p.d, getUV(walkwayIdx), true);
  }

  // Write OBJ
  const objPath = path.join(outputDir, `${baseName}.obj`);
  await writeFile(objPath, objLines.join('\n'));

  return objPath;
}

export function getObjOutputPath(config) {
  const baseName = `mordheim_map_${config.seed}`;
  return { dir: config.outputDir, baseName };
}
