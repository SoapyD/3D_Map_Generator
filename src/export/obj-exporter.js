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
const PADDING = GEOMETRY.objAtlasPadding;
const PADDED_TILE = TILE_SIZE + PADDING * 2;

// Ladder dimensions
const POLE_WIDTH = GEOMETRY.ladderPoleWidth;
const POLE_DEPTH = GEOMETRY.ladderPoleDepth;
const RUNG_HEIGHT = GEOMETRY.ladderRungHeight;
const RUNG_DEPTH = GEOMETRY.ladderRungDepth;
const RUNG_SPACING = GEOMETRY.ladderRungSpacing;
const RUNG_INSET = GEOMETRY.ladderRungInset;

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
  const walkwayPool = loadTexPool(packDir, 'walkways');
  const walkwayTextures = walkwayPool.length > 0 ? walkwayPool : floorTextures;
  const objectTextures = loadTexPool(packDir, 'objects');
  const courtyardPool = loadTexPool(packDir, 'courtyards');
  const courtyardTextures = courtyardPool.length > 0 ? courtyardPool : baseTextures;
  const ladderPool = loadTexPool(packDir, 'ladders');
  const ladderTextures = ladderPool.length > 0 ? ladderPool : wallTextures;

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
    const [hu0, hu1] = GEOMETRY.uvHashU;
    const [hv0, hv1, hv2] = GEOMETRY.uvHashV;
    const hashU = fract(x0 * hu0 + z0 * hu1) * SEGS_PER_TILE;
    const hashV = fract(x0 * hv0 + z0 * hv1 + y0 * hv2) * SEGS_PER_TILE;
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

  // Full perimeter edge faces for a freestanding flat object (cover, scatter, etc.)
  function addPerimeterEdges(x0, y0, z0, sizeX, sizeY, sizeZ, uv) {
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

    addEdgeFace([x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0], 0,0,-1);
    addEdgeFace([x1,y0,z1],[x0,y0,z1],[x0,y1,z1],[x1,y1,z1], 0,0,1);
    addEdgeFace([x0,y0,z1],[x0,y0,z0],[x0,y1,z0],[x0,y1,z1], -1,0,0);
    addEdgeFace([x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0], 1,0,0);
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

  // Shared-vertex flat surface: grid of position verts, per-tile UVs via separate indices
  // emitBottom: whether to emit the bottom face (skip for ground/courtyards)
  function addSharedFlat(name, x0, y0, z0, sizeX, sizeY, sizeZ, uv, emitBottom = true, rotateUV = false, simpleBottom = false) {
    const segsX = Math.max(1, Math.ceil(sizeX / SEG_SIZE));
    const segsZ = Math.max(1, Math.ceil(sizeZ / SEG_SIZE));
    const stepX = sizeX / segsX;
    const stepZ = sizeZ / segsZ;

    const tileW = uv.uMax - uv.uMin;
    const tileH = uv.vMax - uv.vMin;
    const uvStep = tileW / SEGS_PER_TILE;
    const uvStepV = tileH / SEGS_PER_TILE;

    const fract = (v) => v - Math.floor(v);
    const [hu0, hu1] = GEOMETRY.uvHashU;
    const [hv0, hv1, hv2] = GEOMETRY.uvHashV;
    const baseSegU = Math.floor(fract(x0 * hu0 + z0 * hu1) * SEGS_PER_TILE);
    const baseSegV = Math.floor(fract(x0 * hv0 + z0 * hv1 + y0 * hv2) * SEGS_PER_TILE);

    const yTop = y0 + sizeY;

    objLines.push(`o ${name}`);

    // Emit grid of position verts for top face: (segsX+1) * (segsZ+1)
    const voTop = vertOff;
    for (let gz = 0; gz <= segsZ; gz++) {
      for (let gx = 0; gx <= segsX; gx++) {
        objLines.push(`v ${(x0 + gx * stepX).toFixed(6)} ${yTop.toFixed(6)} ${(z0 + gz * stepZ).toFixed(6)}`);
      }
    }
    const topGridW = segsX + 1;
    vertOff += topGridW * (segsZ + 1);

    // Emit bottom face verts (if needed)
    let voBot = -1;
    let botGridW = 0;
    let botSimple = false;
    if (emitBottom) {
      voBot = vertOff;
      if (simpleBottom) {
        // Single quad — 4 corner verts, no subdivision
        objLines.push(`v ${x0.toFixed(6)} ${y0.toFixed(6)} ${z0.toFixed(6)}`);
        objLines.push(`v ${(x0+sizeX).toFixed(6)} ${y0.toFixed(6)} ${z0.toFixed(6)}`);
        objLines.push(`v ${(x0+sizeX).toFixed(6)} ${y0.toFixed(6)} ${(z0+sizeZ).toFixed(6)}`);
        objLines.push(`v ${x0.toFixed(6)} ${y0.toFixed(6)} ${(z0+sizeZ).toFixed(6)}`);
        vertOff += 4;
        botSimple = true;
      } else {
        for (let gz = 0; gz <= segsZ; gz++) {
          for (let gx = 0; gx <= segsX; gx++) {
            objLines.push(`v ${(x0 + gx * stepX).toFixed(6)} ${y0.toFixed(6)} ${(z0 + gz * stepZ).toFixed(6)}`);
          }
        }
        botGridW = topGridW;
        vertOff += botGridW * (segsZ + 1);
      }
    }

    // Normals
    objLines.push(`vn 0 1 0`);
    const noTop = normOff;
    normOff += 1;
    let noBot = -1;
    if (emitBottom) {
      objLines.push(`vn 0 -1 0`);
      noBot = normOff;
      normOff += 1;
    }

    // Emit per-tile faces with their own UVs, referencing grid positions
    for (let sx = 0; sx < segsX; sx++) {
      for (let sz = 0; sz < segsZ; sz++) {
        const uOff = ((sx + baseSegU) % SEGS_PER_TILE) * uvStep;
        const vOff = ((sz + baseSegV) % SEGS_PER_TILE) * uvStepV;

        // Grid vertex indices for this tile's 4 corners (top face)
        const v00 = voTop + sz * topGridW + sx;
        const v10 = v00 + 1;
        const v01 = v00 + topGridW;
        const v11 = v01 + 1;

        // Top face UVs
        const uo = uvOff;
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
        uvOff += 4;

        // Top face: v00=SW, v10=SE, v11=NE, v01=NW
        objLines.push(`f ${v00}/${uo}/${noTop} ${v01}/${uo+3}/${noTop} ${v11}/${uo+2}/${noTop}`);
        objLines.push(`f ${v00}/${uo}/${noTop} ${v11}/${uo+2}/${noTop} ${v10}/${uo+1}/${noTop}`);

        // Bottom face (per-tile, skip if simple bottom)
        if (emitBottom && !botSimple) {
          const b00 = voBot + sz * botGridW + sx;
          const b10 = b00 + 1;
          const b01 = b00 + botGridW;
          const b11 = b01 + 1;

          const uob = uvOff;
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
          uvOff += 4;
          objLines.push(`f ${b00}/${uob}/${noBot} ${b10}/${uob+1}/${noBot} ${b11}/${uob+2}/${noBot}`);
          objLines.push(`f ${b00}/${uob}/${noBot} ${b11}/${uob+2}/${noBot} ${b01}/${uob+3}/${noBot}`);
        }
      }
    }

    // Simple bottom: single quad emitted once after tile loop
    if (emitBottom && botSimple) {
      const cu = ((uv.uMin + uv.uMax) / 2).toFixed(6);
      const cv = ((uv.vMin + uv.vMax) / 2).toFixed(6);
      const uob = uvOff;
      for (let i = 0; i < 4; i++) objLines.push(`vt ${cu} ${cv}`);
      uvOff += 4;
      objLines.push(`f ${voBot}/${uob}/${noBot} ${voBot+1}/${uob+1}/${noBot} ${voBot+2}/${uob+2}/${noBot}`);
      objLines.push(`f ${voBot}/${uob}/${noBot} ${voBot+2}/${uob+2}/${noBot} ${voBot+3}/${uob+3}/${noBot}`);
    }

    objLines.push('');
  }

  // Shared-vertex wall: takes (x0, y0, z0, sizeX, sizeY, sizeZ) like addSubBox
  // Detects thin axis to determine orientation — same logic as addSubBox
  function addSharedWall(name, x0, y0, z0, sizeX, sizeY, sizeZ, uv) {
    const isWallZ = sizeZ < 1; // thin along Z = faces -Z/+Z
    const isWallX = sizeX < 1; // thin along X = faces -X/+X

    // Length axis and segments
    const lenAxis = isWallZ ? sizeX : sizeZ;
    const segsL = Math.max(1, Math.ceil(lenAxis / SEG_SIZE));
    const segsH = Math.max(1, Math.ceil(sizeY / SEG_SIZE));
    const stepL = lenAxis / segsL;
    const stepH = sizeY / segsH;

    const tileW = uv.uMax - uv.uMin;
    const tileH = uv.vMax - uv.vMin;
    const uvStep = tileW / SEGS_PER_TILE;
    const uvStepV = tileH / SEGS_PER_TILE;

    const fract = (v) => v - Math.floor(v);
    const [hu0, hu1] = GEOMETRY.uvHashU;
    const [hv0, hv1, hv2] = GEOMETRY.uvHashV;
    const baseSegU = Math.floor(fract(x0 * hu0 + z0 * hu1) * SEGS_PER_TILE);
    const baseSegV = Math.floor(fract(x0 * hv0 + z0 * hv1 + y0 * hv2) * SEGS_PER_TILE);

    objLines.push(`o ${name}`);

    const gridW = segsL + 1;
    const gridH = segsH + 1;

    if (isWallZ) {
      // Thin along Z: front face at z0, back face at z0+sizeZ
      // Grid runs along X (length) and Y (height)
      const voFront = vertOff;
      for (let gh = 0; gh < gridH; gh++) {
        for (let gl = 0; gl < gridW; gl++) {
          objLines.push(`v ${(x0 + gl * stepL).toFixed(6)} ${(y0 + gh * stepH).toFixed(6)} ${z0.toFixed(6)}`);
        }
      }
      vertOff += gridW * gridH;

      const voBack = vertOff;
      const z1 = z0 + sizeZ;
      for (let gh = 0; gh < gridH; gh++) {
        for (let gl = 0; gl < gridW; gl++) {
          objLines.push(`v ${(x0 + gl * stepL).toFixed(6)} ${(y0 + gh * stepH).toFixed(6)} ${z1.toFixed(6)}`);
        }
      }
      vertOff += gridW * gridH;

      objLines.push(`vn 0 0 -1`);
      objLines.push(`vn 0 0 1`);
      const noFront = normOff, noBack = normOff + 1;
      normOff += 2;

      for (let sl = 0; sl < segsL; sl++) {
        for (let sh = 0; sh < segsH; sh++) {
          const uOff = ((sl + baseSegU) % SEGS_PER_TILE) * uvStep;
          const vOff = ((sh + baseSegV) % SEGS_PER_TILE) * uvStepV;

          // Front face (-Z): winding matches addSubBox wallZ front
          const uo = uvOff;
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          uvOff += 4;

          // Grid: gl=length, gh=height. f00=(sl,sh), f10=(sl+1,sh), f01=(sl,sh+1), f11=(sl+1,sh+1)
          const f00 = voFront + sh * gridW + sl;
          const f10 = f00 + 1;
          const f01 = f00 + gridW;
          const f11 = f01 + 1;
          // addSubBox wallZ front: f ${vo}/${uo}/${no} ${vo+3}/${uo+3}/${no} ${vo+2}/${uo+2}/${no}
          // vo+0=BL, vo+1=BR, vo+2=TR, vo+3=TL → f00=BL, f10=BR, f11=TR, f01=TL
          objLines.push(`f ${f00}/${uo}/${noFront} ${f01}/${uo+3}/${noFront} ${f11}/${uo+2}/${noFront}`);
          objLines.push(`f ${f00}/${uo}/${noFront} ${f11}/${uo+2}/${noFront} ${f10}/${uo+1}/${noFront}`);

          // Back face (+Z): winding matches addSubBox wallZ back
          const uob = uvOff;
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          uvOff += 4;

          const b00 = voBack + sh * gridW + sl;
          const b10 = b00 + 1;
          const b01 = b00 + gridW;
          const b11 = b01 + 1;
          // addSubBox wallZ back: f ${vo+4}/${uo+4}/${no+1} ${vo+5}/${uo+5}/${no+1} ${vo+6}/${uo+6}/${no+1}
          // vo+4=BL, vo+5=BR, vo+6=TR, vo+7=TL → b00=BL, b10=BR, b11=TR, b01=TL
          objLines.push(`f ${b00}/${uob}/${noBack} ${b10}/${uob+1}/${noBack} ${b11}/${uob+2}/${noBack}`);
          objLines.push(`f ${b00}/${uob}/${noBack} ${b11}/${uob+2}/${noBack} ${b01}/${uob+3}/${noBack}`);
        }
      }
    } else if (isWallX) {
      // Thin along X: front face at x0, back face at x0+sizeX
      // Grid runs along Z (length) and Y (height)
      const voFront = vertOff;
      for (let gh = 0; gh < gridH; gh++) {
        for (let gl = 0; gl < gridW; gl++) {
          objLines.push(`v ${x0.toFixed(6)} ${(y0 + gh * stepH).toFixed(6)} ${(z0 + gl * stepL).toFixed(6)}`);
        }
      }
      vertOff += gridW * gridH;

      const voBack = vertOff;
      const x1 = x0 + sizeX;
      for (let gh = 0; gh < gridH; gh++) {
        for (let gl = 0; gl < gridW; gl++) {
          objLines.push(`v ${x1.toFixed(6)} ${(y0 + gh * stepH).toFixed(6)} ${(z0 + gl * stepL).toFixed(6)}`);
        }
      }
      vertOff += gridW * gridH;

      objLines.push(`vn -1 0 0`);
      objLines.push(`vn 1 0 0`);
      const noFront = normOff, noBack = normOff + 1;
      normOff += 2;

      for (let sl = 0; sl < segsL; sl++) {
        for (let sh = 0; sh < segsH; sh++) {
          const uOff = ((sl + baseSegU) % SEGS_PER_TILE) * uvStep;
          const vOff = ((sh + baseSegV) % SEGS_PER_TILE) * uvStepV;

          // Front face (-X): winding matches addSubBox wallX front
          const uo = uvOff;
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          uvOff += 4;

          // Grid: gl=Z-length, gh=height. f00=(sl,sh), etc.
          const f00 = voFront + sh * gridW + sl;
          const f10 = f00 + 1;
          const f01 = f00 + gridW;
          const f11 = f01 + 1;
          // addSubBox wallX front: f ${vo}/${uo}/${no} ${vo+1}/${uo+1}/${no} ${vo+2}/${uo+2}/${no}
          // vo+0=(z,y), vo+1=(z+,y), vo+2=(z+,y+), vo+3=(z,y+) → f00=BL, f10=BR, f11=TR, f01=TL
          objLines.push(`f ${f00}/${uo}/${noFront} ${f10}/${uo+1}/${noFront} ${f11}/${uo+2}/${noFront}`);
          objLines.push(`f ${f00}/${uo}/${noFront} ${f11}/${uo+2}/${noFront} ${f01}/${uo+3}/${noFront}`);

          // Back face (+X): winding matches addSubBox wallX back
          const uob = uvOff;
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          uvOff += 4;

          const b00 = voBack + sh * gridW + sl;
          const b10 = b00 + 1;
          const b01 = b00 + gridW;
          const b11 = b01 + 1;
          // addSubBox wallX back: f ${vo+4}/${uo+4}/${no+1} ${vo+7}/${uo+7}/${no+1} ${vo+6}/${uo+6}/${no+1}
          // Reversed winding: b00=BL, b01=TL, b10=BR, b11=TR
          objLines.push(`f ${b00}/${uob}/${noBack} ${b01}/${uob+3}/${noBack} ${b11}/${uob+2}/${noBack}`);
          objLines.push(`f ${b00}/${uob}/${noBack} ${b11}/${uob+2}/${noBack} ${b10}/${uob+1}/${noBack}`);
        }
      }
    }

    objLines.push('');
  }

  // --- Export geometry ---

  // Base floor (shared verts, top only — bottom sits on nothing)
  const floorData = data.floors || [];
  if (floorData.length > 0 && floorData[0].sections.length > 0) {
    const baseFloor = floorData[0].sections[0];
    addSharedFlat('base_floor', baseFloor.x, 0, baseFloor.z, baseFloor.w, config.slabThickness, baseFloor.d, getUV(baseIdx), true, false, true);
    // Base floor edges (still needed for the visible thickness around the perimeter)
    addFloorEdges(baseFloor, 0, config.slabThickness, [baseFloor], getUV(baseIdx));
  }

  // Building floors (tier 1+) — shared verts, top + bottom (players look up)
  for (let t = 1; t < floorData.length; t++) {
    const tier = floorData[t];
    for (const section of tier.sections) {
      const bi = findBuilding(section);
      const texIdx = bi >= 0 ? buildingFloorIdx[bi] : baseIdx;
      addSharedFlat(`floor_t${tier.tier}_${Math.round(section.x)}_${Math.round(section.z)}`,
        section.x, tier.tier * config.tierHeight, section.z,
        section.w, config.slabThickness, section.d, getUV(texIdx), true);
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
    addSharedWall(`wall_${i}`, wall.x, wall.baseY, wall.z, wx, wall.height, wz, getUV(texIdx));

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
    addSharedFlat(`walkway_${i}`, w.x, w.y, w.z, w.w, GEOMETRY.walkwayThickness, w.d, getUV(walkwayIdx), true, w.w > w.d);
    addPerimeterEdges(w.x, w.y, w.z, w.w, GEOMETRY.walkwayThickness, w.d, getUV(walkwayIdx));
  }

  // Cover
  const cover = data.cover || [];
  for (let i = 0; i < cover.length; i++) {
    const c = cover[i];
    addSharedFlat(`cover_${i}`, c.x, c.y, c.z, c.w, c.height, c.d, getUV(objectIdx), false);
    addPerimeterEdges(c.x, c.y, c.z, c.w, c.height, c.d, getUV(objectIdx));
  }

  // Interior cover
  const interiorCover = data.interiorCover || [];
  for (let i = 0; i < interiorCover.length; i++) {
    const c = interiorCover[i];
    addSharedFlat(`interior_cover_${i}`, c.x, c.y, c.z, c.w, c.height, c.d, getUV(objectIdx), false);
    addPerimeterEdges(c.x, c.y, c.z, c.w, c.height, c.d, getUV(objectIdx));
  }

  // Deleted footprints (courtyards)
  const deletedFootprints = data.deletedFootprints || [];
  for (let i = 0; i < deletedFootprints.length; i++) {
    const df = deletedFootprints[i];
    addSharedFlat(`deleted_${i}`, df.x, GEOMETRY.courtyardY, df.z, df.w, GEOMETRY.courtyardThickness, df.d, getUV(courtyardIdx), false);
    addPerimeterEdges(df.x, GEOMETRY.courtyardY, df.z, df.w, GEOMETRY.courtyardThickness, df.d, getUV(courtyardIdx));
  }

  // Street scatter
  const streetScatter = data.streetScatter || [];
  for (let i = 0; i < streetScatter.length; i++) {
    const c = streetScatter[i];
    addSharedFlat(`street_scatter_${i}`, c.x, c.y, c.z, c.w, c.height, c.d, getUV(objectIdx), false);
    addPerimeterEdges(c.x, c.y, c.z, c.w, c.height, c.d, getUV(objectIdx));
  }

  // Flat ladder meshes
  // Emit a double-sided vertical quad (4 verts, front + back faces)
  function addVerticalQuad(name, v0, v1, v2, v3, nx, ny, nz, uv) {
    const cu = ((uv.uMin + uv.uMax) / 2).toFixed(6);
    const cv = ((uv.vMin + uv.vMax) / 2).toFixed(6);
    const vo = vertOff;
    objLines.push(`o ${name}`);
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

  function addLadderMesh(prefix, l, uv) {
    const height = l.y1 - l.y0;
    if (height <= 0) return;

    const isThinX = l.w < l.d;
    const ladderWidth = isThinX ? l.d : l.w;
    const cx = l.x + l.w / 2;
    const cz = l.z + l.d / 2;
    const halfSpread = (ladderWidth / 2) - POLE_WIDTH / 2 - RUNG_INSET;
    const flat = GEOMETRY.flatLadders;

    if (flat) {
      // Flat mode: front-facing quads, offset forward to avoid z-fighting with wall behind
      // Determine offset direction: away from nearest wall on the thin axis
      const FLAT_OFFSET = 0.15;
      let offsetDir = 1;
      // Find the nearest wall along the ladder's thin axis to determine which side the wall is on
      let nearestWallDist = Infinity;
      for (const wall of walls) {
        const wx1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
        const wz1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
        // Check if wall overlaps ladder on the non-thin axes
        if (isThinX) {
          // Thin along X — check walls that overlap in Z and Y
          if (cz >= wall.z - 0.5 && cz <= wz1 + 0.5) {
            // Wall centre along X
            const wallCx = (wall.x + wx1) / 2;
            const dist = Math.abs(wallCx - cx);
            if (dist < nearestWallDist) {
              nearestWallDist = dist;
              offsetDir = (cx >= wallCx) ? 1 : -1; // offset away from wall
            }
          }
        } else {
          // Thin along Z — check walls that overlap in X and Y
          if (cx >= wall.x - 0.5 && cx <= wx1 + 0.5) {
            const wallCz = (wall.z + wz1) / 2;
            const dist = Math.abs(wallCz - cz);
            if (dist < nearestWallDist) {
              nearestWallDist = dist;
              offsetDir = (cz >= wallCz) ? 1 : -1; // offset away from wall
            }
          }
        }
      }

      if (isThinX) {
        const fx = cx + FLAT_OFFSET * offsetDir;
        const lz = cz - halfSpread - POLE_WIDTH/2;
        const rz = cz + halfSpread - POLE_WIDTH/2;
        addVerticalQuad(`${prefix}_stile_L`,
          [fx, l.y0, lz], [fx, l.y0, lz + POLE_WIDTH], [fx, l.y0 + height, lz + POLE_WIDTH], [fx, l.y0 + height, lz],
          1, 0, 0, uv);
        addVerticalQuad(`${prefix}_stile_R`,
          [fx, l.y0, rz], [fx, l.y0, rz + POLE_WIDTH], [fx, l.y0 + height, rz + POLE_WIDTH], [fx, l.y0 + height, rz],
          1, 0, 0, uv);
        const rungCount = Math.floor(height / RUNG_SPACING);
        for (let r = 1; r <= rungCount; r++) {
          const ry = l.y0 + r * RUNG_SPACING;
          if (ry >= l.y1 - RUNG_SPACING * 0.3) break;
          const rungLen = halfSpread * 2 + POLE_WIDTH;
          addVerticalQuad(`${prefix}_rung_${r}`,
            [fx, ry - RUNG_HEIGHT/2, lz], [fx, ry - RUNG_HEIGHT/2, lz + rungLen],
            [fx, ry + RUNG_HEIGHT/2, lz + rungLen], [fx, ry + RUNG_HEIGHT/2, lz],
            1, 0, 0, uv);
        }
      } else {
        const fz = cz + FLAT_OFFSET * offsetDir;
        const lx = cx - halfSpread - POLE_WIDTH/2;
        const rx = cx + halfSpread - POLE_WIDTH/2;
        addVerticalQuad(`${prefix}_stile_L`,
          [lx, l.y0, fz], [lx + POLE_WIDTH, l.y0, fz], [lx + POLE_WIDTH, l.y0 + height, fz], [lx, l.y0 + height, fz],
          0, 0, 1, uv);
        addVerticalQuad(`${prefix}_stile_R`,
          [rx, l.y0, fz], [rx + POLE_WIDTH, l.y0, fz], [rx + POLE_WIDTH, l.y0 + height, fz], [rx, l.y0 + height, fz],
          0, 0, 1, uv);
        const rungCount = Math.floor(height / RUNG_SPACING);
        for (let r = 1; r <= rungCount; r++) {
          const ry = l.y0 + r * RUNG_SPACING;
          if (ry >= l.y1 - RUNG_SPACING * 0.3) break;
          const rungLen = halfSpread * 2 + POLE_WIDTH;
          addVerticalQuad(`${prefix}_rung_${r}`,
            [lx, ry - RUNG_HEIGHT/2, fz], [lx + rungLen, ry - RUNG_HEIGHT/2, fz],
            [lx + rungLen, ry + RUNG_HEIGHT/2, fz], [lx, ry + RUNG_HEIGHT/2, fz],
            0, 0, 1, uv);
        }
      }
    } else {
      // 3D mode: emit full 6-face boxes directly (bypasses addSubBox thin-axis detection)
      function addLadderBox(name, bx, by, bz, bw, bh, bd) {
        const cu = ((uv.uMin + uv.uMax) / 2).toFixed(6);
        const cv = ((uv.vMin + uv.vMax) / 2).toFixed(6);
        const vo = vertOff;
        const x1 = bx + bw, y1 = by + bh, z1 = bz + bd;
        objLines.push(`o ${name}`);
        // 8 corner verts
        objLines.push(`v ${bx.toFixed(6)} ${by.toFixed(6)} ${bz.toFixed(6)}`);  // 0: ---
        objLines.push(`v ${x1.toFixed(6)} ${by.toFixed(6)} ${bz.toFixed(6)}`);  // 1: +--
        objLines.push(`v ${x1.toFixed(6)} ${by.toFixed(6)} ${z1.toFixed(6)}`);  // 2: +-+
        objLines.push(`v ${bx.toFixed(6)} ${by.toFixed(6)} ${z1.toFixed(6)}`);  // 3: --+
        objLines.push(`v ${bx.toFixed(6)} ${y1.toFixed(6)} ${bz.toFixed(6)}`);  // 4: -+-
        objLines.push(`v ${x1.toFixed(6)} ${y1.toFixed(6)} ${bz.toFixed(6)}`);  // 5: ++-
        objLines.push(`v ${x1.toFixed(6)} ${y1.toFixed(6)} ${z1.toFixed(6)}`);  // 6: +++
        objLines.push(`v ${bx.toFixed(6)} ${y1.toFixed(6)} ${z1.toFixed(6)}`);  // 7: -++
        // 6 UVs (one per face, centre-point)
        for (let i = 0; i < 6; i++) objLines.push(`vt ${cu} ${cv}`);
        // 6 normals
        objLines.push('vn 0 -1 0'); objLines.push('vn 0 1 0');
        objLines.push('vn 0 0 -1'); objLines.push('vn 0 0 1');
        objLines.push('vn -1 0 0'); objLines.push('vn 1 0 0');
        const u = uvOff, n = normOff;
        // Bottom (-Y)
        objLines.push(`f ${vo}/${u}/${n} ${vo+1}/${u}/${n} ${vo+2}/${u}/${n}`);
        objLines.push(`f ${vo}/${u}/${n} ${vo+2}/${u}/${n} ${vo+3}/${u}/${n}`);
        // Top (+Y)
        objLines.push(`f ${vo+6}/${u+1}/${n+1} ${vo+5}/${u+1}/${n+1} ${vo+4}/${u+1}/${n+1}`);
        objLines.push(`f ${vo+7}/${u+1}/${n+1} ${vo+6}/${u+1}/${n+1} ${vo+4}/${u+1}/${n+1}`);
        // Front (-Z)
        objLines.push(`f ${vo}/${u+2}/${n+2} ${vo+4}/${u+2}/${n+2} ${vo+5}/${u+2}/${n+2}`);
        objLines.push(`f ${vo}/${u+2}/${n+2} ${vo+5}/${u+2}/${n+2} ${vo+1}/${u+2}/${n+2}`);
        // Back (+Z)
        objLines.push(`f ${vo+2}/${u+3}/${n+3} ${vo+6}/${u+3}/${n+3} ${vo+7}/${u+3}/${n+3}`);
        objLines.push(`f ${vo+2}/${u+3}/${n+3} ${vo+7}/${u+3}/${n+3} ${vo+3}/${u+3}/${n+3}`);
        // Left (-X)
        objLines.push(`f ${vo+3}/${u+4}/${n+4} ${vo+7}/${u+4}/${n+4} ${vo+4}/${u+4}/${n+4}`);
        objLines.push(`f ${vo+3}/${u+4}/${n+4} ${vo+4}/${u+4}/${n+4} ${vo}/${u+4}/${n+4}`);
        // Right (+X)
        objLines.push(`f ${vo+1}/${u+5}/${n+5} ${vo+5}/${u+5}/${n+5} ${vo+6}/${u+5}/${n+5}`);
        objLines.push(`f ${vo+1}/${u+5}/${n+5} ${vo+6}/${u+5}/${n+5} ${vo+2}/${u+5}/${n+5}`);
        vertOff += 8; uvOff += 6; normOff += 6;
      }

      if (isThinX) {
        addLadderBox(`${prefix}_stile_L`, cx - POLE_DEPTH/2, l.y0, cz - halfSpread - POLE_WIDTH/2, POLE_DEPTH, height, POLE_WIDTH);
        addLadderBox(`${prefix}_stile_R`, cx - POLE_DEPTH/2, l.y0, cz + halfSpread - POLE_WIDTH/2, POLE_DEPTH, height, POLE_WIDTH);
      } else {
        addLadderBox(`${prefix}_stile_L`, cx - halfSpread - POLE_WIDTH/2, l.y0, cz - POLE_DEPTH/2, POLE_WIDTH, height, POLE_DEPTH);
        addLadderBox(`${prefix}_stile_R`, cx + halfSpread - POLE_WIDTH/2, l.y0, cz - POLE_DEPTH/2, POLE_WIDTH, height, POLE_DEPTH);
      }

      const rungCount = Math.floor(height / RUNG_SPACING);
      for (let r = 1; r <= rungCount; r++) {
        const ry = l.y0 + r * RUNG_SPACING;
        if (ry >= l.y1 - RUNG_SPACING * 0.3) break;
        if (isThinX) {
          const rungLen = halfSpread * 2 + POLE_WIDTH;
          addLadderBox(`${prefix}_rung_${r}`, cx - RUNG_DEPTH/2, ry - RUNG_HEIGHT/2, cz - halfSpread - POLE_WIDTH/2, RUNG_DEPTH, RUNG_HEIGHT, rungLen);
        } else {
          const rungLen = halfSpread * 2 + POLE_WIDTH;
          addLadderBox(`${prefix}_rung_${r}`, cx - halfSpread - POLE_WIDTH/2, ry - RUNG_HEIGHT/2, cz - RUNG_DEPTH/2, rungLen, RUNG_HEIGHT, RUNG_DEPTH);
        }
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
    addSharedFlat(`ladder_platform_${i}`, p.x, p.y, p.z, p.w, GEOMETRY.platformThickness, p.d, getUV(walkwayIdx), true);
    addPerimeterEdges(p.x, p.y, p.z, p.w, GEOMETRY.platformThickness, p.d, getUV(walkwayIdx));
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
