/**
 * OBJ Exporter — subdivided geometry with texture atlas.
 *
 * Consumes geometry primitives from the handover (geometry-builder.js).
 * Only handles HOW to render OBJ (subdivision, atlas UVs, vertex writing).
 *
 * Subdivides meshes into 3" segments for proper UV tiling within atlas tiles.
 * Generates edges only where visible (adjacency-aware).
 * Ladders exported as flat stiles + rungs or 3D boxes.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import { PNG } from 'pngjs';
import path from 'path';
import { GEOMETRY } from '../config.js';

const SEG_SIZE = 3;
const SEGS_PER_TILE = GEOMETRY.objAtlasTileSize / GEOMETRY.objSegmentPixelSize;
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
 * Export geometry primitives to OBJ + texture atlas.
 */
export async function exportToObj(geometry, config, outputDir, baseName) {
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
  const roofPool = loadTexPool(packDir, 'roofs');
  const roofTextures = roofPool.length > 0 ? roofPool : floorTextures;

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

  // Pre-register base textures
  const baseIdx = addTexture('base', baseTextures[0] || wallTextures[0]);

  // Scan primitives to discover all needed textures and register them
  const textureKeyToIdx = new Map();

  function ensureTexture(textureKey) {
    if (textureKeyToIdx.has(textureKey)) return textureKeyToIdx.get(textureKey);

    const parts = textureKey.split(':');
    let idx;

    if (parts[0] === 'floor') {
      if (parts[1] === 'base') {
        idx = baseIdx;
      } else {
        // floor:building:N
        const ti = parseInt(parts[2], 10);
        const fTex = floorTextures[Math.abs(ti) % floorTextures.length];
        idx = addTexture(`floor_${Math.abs(ti) % floorTextures.length}`, fTex);
      }
    } else if (parts[0] === 'wall') {
      const ti = parseInt(parts[2], 10);
      if (parts[1] === 'landmark') {
        const pool = landmarkTextures.length > 0 ? landmarkTextures : wallTextures;
        const tex = pool[Math.abs(ti) % pool.length];
        idx = addTexture(`landmark_${Math.abs(ti) % pool.length}`, tex);
      } else {
        const tex = wallTextures[Math.abs(ti) % wallTextures.length];
        idx = addTexture(`wall_${Math.abs(ti) % wallTextures.length}`, tex);
      }
    } else if (parts[0] === 'walkway') {
      const ti = parseInt(parts[1], 10);
      const tex = walkwayTextures[Math.abs(ti) % walkwayTextures.length];
      idx = addTexture(`walkway_${Math.abs(ti) % walkwayTextures.length}`, tex);
    } else if (parts[0] === 'roof') {
      const ti = parseInt(parts[1], 10);
      const tex = roofTextures[Math.abs(ti) % roofTextures.length];
      idx = addTexture(`roof_${Math.abs(ti) % roofTextures.length}`, tex);
    } else if (parts[0] === 'object') {
      const ti = parseInt(parts[1], 10);
      const tex = objectTextures.length > 0 ? objectTextures[Math.abs(ti) % objectTextures.length] : wallTextures[0];
      idx = addTexture(`object_${Math.abs(ti) % (objectTextures.length || 1)}`, tex);
    } else if (parts[0] === 'courtyard') {
      idx = addTexture('courtyard_0', courtyardTextures[0]);
    } else if (parts[0] === 'ladder') {
      const ti = parseInt(parts[1], 10);
      const tex = ladderTextures[Math.abs(ti) % ladderTextures.length];
      idx = addTexture(`ladder_${Math.abs(ti) % ladderTextures.length}`, tex);
    } else {
      idx = baseIdx;
    }

    textureKeyToIdx.set(textureKey, idx);
    return idx;
  }

  // Pre-register all textures from primitives
  for (const prim of geometry.primitives) {
    ensureTexture(prim.textureKey);
  }

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

  function resolveUV(textureKey) {
    return getUV(ensureTexture(textureKey));
  }

  // --- OBJ export with subdivision ---
  const objLines = [];
  let vertOff = 1, uvOff = 1, normOff = 1;

  objLines.push('# Mordheim Map Generator - subdivided');
  objLines.push('');

  function addSubBox(name, x0, y0, z0, sizeX, sizeY, sizeZ, uv, showEdges = false, rotateUV = false, thinAxis = null) {
    // thinAxis override: 'x' = wall facing X, 'z' = wall facing Z, null = auto-detect
    const isFloor = thinAxis ? false : sizeY < 1;
    const isColumn = !thinAxis && sizeX < 1 && sizeZ < 1;
    const isWallX = thinAxis === 'x' || (!thinAxis && sizeX < 1 && sizeZ >= 1);
    const isWallZ = thinAxis === 'z' || (!thinAxis && sizeZ < 1 && sizeX >= 1);

    const tileW = uv.uMax - uv.uMin;
    const tileH = uv.vMax - uv.vMin;
    const uvStep = tileW / SEGS_PER_TILE;
    const uvStepV = tileH / SEGS_PER_TILE;

    const fract = (v) => v - Math.floor(v);
    const [hu0, hu1] = GEOMETRY.uvHashU;
    const [hv0, hv1, hv2] = GEOMETRY.uvHashV;
    const hashU = fract(x0 * hu0 + z0 * hu1) * SEGS_PER_TILE;
    const hashV = fract(x0 * hv0 + z0 * hv1 + y0 * hv2) * SEGS_PER_TILE;
    const baseSegU = Math.floor(hashU);
    const baseSegV = Math.floor(hashV);

    if (isColumn) {
      // Column (thin in both X and Z) — emit both wall pairs for full coverage
      addSubBox(name + '_zf', x0, y0, z0, sizeX, sizeY, sizeZ, uv, false, rotateUV, 'z');
      addSubBox(name + '_xf', x0, y0, z0, sizeX, sizeY, sizeZ, uv, false, rotateUV, 'x');
      return;
    }

    if (isFloor || (!isWallX && !isWallZ)) {
      // Horizontal slab — subdivide XZ
      const segsX = Math.max(1, Math.ceil((rotateUV ? sizeZ : sizeX) / SEG_SIZE));
      const segsZ = Math.max(1, Math.ceil((rotateUV ? sizeX : sizeZ) / SEG_SIZE));
      const stepX = sizeX / segsX;
      const stepZ = sizeZ / segsZ;

      objLines.push(`o ${name}`);
      // Top/bottom face vertices
      const voTop = vertOff;
      for (let sz = 0; sz <= segsZ; sz++) {
        for (let sx = 0; sx <= segsX; sx++) {
          objLines.push(`v ${(x0 + sx * stepX).toFixed(6)} ${(y0 + sizeY).toFixed(6)} ${(z0 + sz * stepZ).toFixed(6)}`);
        }
      }
      vertOff += (segsX + 1) * (segsZ + 1);

      const voBot = vertOff;
      for (let sz = 0; sz <= segsZ; sz++) {
        for (let sx = 0; sx <= segsX; sx++) {
          objLines.push(`v ${(x0 + sx * stepX).toFixed(6)} ${y0.toFixed(6)} ${(z0 + sz * stepZ).toFixed(6)}`);
        }
      }
      vertOff += (segsX + 1) * (segsZ + 1);

      objLines.push('vn 0 1 0');
      objLines.push('vn 0 -1 0');
      const noTop = normOff, noBot = normOff + 1;
      normOff += 2;

      const gridW = segsX + 1;
      for (let sz = 0; sz < segsZ; sz++) {
        for (let sx = 0; sx < segsX; sx++) {
          const uOff = ((sx + baseSegU) % SEGS_PER_TILE) * uvStep, vOff = ((sz + baseSegV) % SEGS_PER_TILE) * uvStepV;

          // Top face
          const uo = uvOff;
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          uvOff += 4;

          const v00 = voTop + sz * gridW + sx;
          const v10 = v00 + 1;
          const v01 = v00 + gridW;
          const v11 = v01 + 1;
          objLines.push(`f ${v01}/${uo+3}/${noTop} ${v11}/${uo+2}/${noTop} ${v10}/${uo+1}/${noTop}`);
          objLines.push(`f ${v01}/${uo+3}/${noTop} ${v10}/${uo+1}/${noTop} ${v00}/${uo}/${noTop}`);

          // Bottom face
          const uob = uvOff;
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          uvOff += 4;

          const b00 = voBot + sz * gridW + sx;
          const b10 = b00 + 1;
          const b01 = b00 + gridW;
          const b11 = b01 + 1;
          objLines.push(`f ${b00}/${uob}/${noBot} ${b10}/${uob+1}/${noBot} ${b11}/${uob+2}/${noBot}`);
          objLines.push(`f ${b00}/${uob}/${noBot} ${b11}/${uob+2}/${noBot} ${b01}/${uob+3}/${noBot}`);
        }
      }

      // Edge faces
      if (showEdges) {
        const x1 = x0 + sizeX, y1 = y0 + sizeY, z1 = z0 + sizeZ;
        const cu = ((uv.uMin + uv.uMax) / 2).toFixed(6);
        const cv = ((uv.vMin + uv.vMax) / 2).toFixed(6);

        function addEdgeFace(v0, v1, v2, v3, nx, ny, nz) {
          const vo = vertOff;
          for (const v of [v0,v1,v2,v3]) objLines.push(`v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}`);
          objLines.push(`vt ${uv.uMin.toFixed(6)} ${uv.vMin.toFixed(6)}`);
          objLines.push(`vt ${uv.uMax.toFixed(6)} ${uv.vMin.toFixed(6)}`);
          objLines.push(`vt ${uv.uMax.toFixed(6)} ${uv.vMax.toFixed(6)}`);
          objLines.push(`vt ${uv.uMin.toFixed(6)} ${uv.vMax.toFixed(6)}`);
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
    } else if (isWallZ) {
      // Thin along Z — wall facing -Z/+Z
      const segsL = Math.max(1, Math.ceil(sizeX / SEG_SIZE));
      const segsH = Math.max(1, Math.ceil(sizeY / SEG_SIZE));
      const stepL = sizeX / segsL;
      const stepH = sizeY / segsH;

      objLines.push(`o ${name}`);

      const gridW = segsL + 1;
      const gridH = segsH + 1;

      const voFront = vertOff;
      for (let gh = 0; gh < gridH; gh++)
        for (let gl = 0; gl < gridW; gl++)
          objLines.push(`v ${(x0 + gl * stepL).toFixed(6)} ${(y0 + gh * stepH).toFixed(6)} ${z0.toFixed(6)}`);
      vertOff += gridW * gridH;

      const voBack = vertOff;
      const z1 = z0 + sizeZ;
      for (let gh = 0; gh < gridH; gh++)
        for (let gl = 0; gl < gridW; gl++)
          objLines.push(`v ${(x0 + gl * stepL).toFixed(6)} ${(y0 + gh * stepH).toFixed(6)} ${z1.toFixed(6)}`);
      vertOff += gridW * gridH;

      objLines.push('vn 0 0 -1');
      objLines.push('vn 0 0 1');
      const noFront = normOff, noBack = normOff + 1;
      normOff += 2;

      for (let sl = 0; sl < segsL; sl++) {
        for (let sh = 0; sh < segsH; sh++) {
          const uOff = ((sl + baseSegU) % SEGS_PER_TILE) * uvStep;
          const vOff = ((sh + baseSegV) % SEGS_PER_TILE) * uvStepV;

          const uo = uvOff;
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          uvOff += 4;

          const f00 = voFront + sh * gridW + sl, f10 = f00 + 1, f01 = f00 + gridW, f11 = f01 + 1;
          objLines.push(`f ${f00}/${uo}/${noFront} ${f01}/${uo+3}/${noFront} ${f11}/${uo+2}/${noFront}`);
          objLines.push(`f ${f00}/${uo}/${noFront} ${f11}/${uo+2}/${noFront} ${f10}/${uo+1}/${noFront}`);

          const uob = uvOff;
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          uvOff += 4;

          const b00 = voBack + sh * gridW + sl, b10 = b00 + 1, b01 = b00 + gridW, b11 = b01 + 1;
          objLines.push(`f ${b00}/${uob}/${noBack} ${b10}/${uob+1}/${noBack} ${b11}/${uob+2}/${noBack}`);
          objLines.push(`f ${b00}/${uob}/${noBack} ${b11}/${uob+2}/${noBack} ${b01}/${uob+3}/${noBack}`);
        }
      }

      if (showEdges) {
        const y1 = y0 + sizeY;
        const cu = ((uv.uMin + uv.uMax) / 2).toFixed(6);
        const cv = ((uv.vMin + uv.vMax) / 2).toFixed(6);
        function addEdgeFace(v0, v1, v2, v3, nx, ny, nz) {
          const vo = vertOff;
          for (const v of [v0,v1,v2,v3]) objLines.push(`v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}`);
          objLines.push(`vt ${uv.uMin.toFixed(6)} ${uv.vMin.toFixed(6)}`);
          objLines.push(`vt ${uv.uMax.toFixed(6)} ${uv.vMin.toFixed(6)}`);
          objLines.push(`vt ${uv.uMax.toFixed(6)} ${uv.vMax.toFixed(6)}`);
          objLines.push(`vt ${uv.uMin.toFixed(6)} ${uv.vMax.toFixed(6)}`);
          objLines.push(`vn ${nx} ${ny} ${nz}`);
          objLines.push(`vn ${-nx} ${-ny} ${-nz}`);
          const uo = uvOff, no = normOff;
          objLines.push(`f ${vo}/${uo}/${no} ${vo+1}/${uo+1}/${no} ${vo+2}/${uo+2}/${no}`);
          objLines.push(`f ${vo}/${uo}/${no} ${vo+2}/${uo+2}/${no} ${vo+3}/${uo+3}/${no}`);
          objLines.push(`f ${vo+2}/${uo+2}/${no+1} ${vo+1}/${uo+1}/${no+1} ${vo}/${uo}/${no+1}`);
          objLines.push(`f ${vo+3}/${uo+3}/${no+1} ${vo+2}/${uo+2}/${no+1} ${vo}/${uo}/${no+1}`);
          vertOff += 4; uvOff += 4; normOff += 2;
        }
        addEdgeFace([x0,y0+sizeY,z0],[x0+sizeX,y0+sizeY,z0],[x0+sizeX,y0+sizeY,z1],[x0,y0+sizeY,z1], 0,1,0);
        addEdgeFace([x0,y0,z1],[x0+sizeX,y0,z1],[x0+sizeX,y0,z0],[x0,y0,z0], 0,-1,0);
        addEdgeFace([x0,y0,z1],[x0,y0,z0],[x0,y1,z0],[x0,y1,z1], -1,0,0);
        addEdgeFace([x0+sizeX,y0,z0],[x0+sizeX,y0,z1],[x0+sizeX,y1,z1],[x0+sizeX,y1,z0], 1,0,0);
      }
    } else if (isWallX) {
      // Thin along X — wall facing -X/+X
      const segsL = Math.max(1, Math.ceil(sizeZ / SEG_SIZE));
      const segsH = Math.max(1, Math.ceil(sizeY / SEG_SIZE));
      const stepL = sizeZ / segsL;
      const stepH = sizeY / segsH;

      objLines.push(`o ${name}`);

      const gridW = segsL + 1;
      const gridH = segsH + 1;

      const voFront = vertOff;
      for (let gh = 0; gh < gridH; gh++)
        for (let gl = 0; gl < gridW; gl++)
          objLines.push(`v ${x0.toFixed(6)} ${(y0 + gh * stepH).toFixed(6)} ${(z0 + gl * stepL).toFixed(6)}`);
      vertOff += gridW * gridH;

      const voBack = vertOff;
      const x1 = x0 + sizeX;
      for (let gh = 0; gh < gridH; gh++)
        for (let gl = 0; gl < gridW; gl++)
          objLines.push(`v ${x1.toFixed(6)} ${(y0 + gh * stepH).toFixed(6)} ${(z0 + gl * stepL).toFixed(6)}`);
      vertOff += gridW * gridH;

      objLines.push('vn -1 0 0');
      objLines.push('vn 1 0 0');
      const noFront = normOff, noBack = normOff + 1;
      normOff += 2;

      for (let sl = 0; sl < segsL; sl++) {
        for (let sh = 0; sh < segsH; sh++) {
          const uOff = ((sl + baseSegU) % SEGS_PER_TILE) * uvStep;
          const vOff = ((sh + baseSegV) % SEGS_PER_TILE) * uvStepV;

          const uo = uvOff;
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          uvOff += 4;

          const f00 = voFront + sh * gridW + sl, f10 = f00 + 1, f01 = f00 + gridW, f11 = f01 + 1;
          objLines.push(`f ${f00}/${uo}/${noFront} ${f10}/${uo+1}/${noFront} ${f11}/${uo+2}/${noFront}`);
          objLines.push(`f ${f00}/${uo}/${noFront} ${f11}/${uo+2}/${noFront} ${f01}/${uo+3}/${noFront}`);

          const uob = uvOff;
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          uvOff += 4;

          const b00 = voBack + sh * gridW + sl, b10 = b00 + 1, b01 = b00 + gridW, b11 = b01 + 1;
          objLines.push(`f ${b00}/${uob}/${noBack} ${b01}/${uob+3}/${noBack} ${b11}/${uob+2}/${noBack}`);
          objLines.push(`f ${b00}/${uob}/${noBack} ${b11}/${uob+2}/${noBack} ${b10}/${uob+1}/${noBack}`);
        }
      }

      if (showEdges) {
        const y1 = y0 + sizeY;
        const cu = ((uv.uMin + uv.uMax) / 2).toFixed(6);
        const cv = ((uv.vMin + uv.vMax) / 2).toFixed(6);
        function addEdgeFace(v0, v1, v2, v3, nx, ny, nz) {
          const vo = vertOff;
          for (const v of [v0,v1,v2,v3]) objLines.push(`v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}`);
          objLines.push(`vt ${uv.uMin.toFixed(6)} ${uv.vMin.toFixed(6)}`);
          objLines.push(`vt ${uv.uMax.toFixed(6)} ${uv.vMin.toFixed(6)}`);
          objLines.push(`vt ${uv.uMax.toFixed(6)} ${uv.vMax.toFixed(6)}`);
          objLines.push(`vt ${uv.uMin.toFixed(6)} ${uv.vMax.toFixed(6)}`);
          objLines.push(`vn ${nx} ${ny} ${nz}`);
          objLines.push(`vn ${-nx} ${-ny} ${-nz}`);
          const uo = uvOff, no = normOff;
          objLines.push(`f ${vo}/${uo}/${no} ${vo+1}/${uo+1}/${no} ${vo+2}/${uo+2}/${no}`);
          objLines.push(`f ${vo}/${uo}/${no} ${vo+2}/${uo+2}/${no} ${vo+3}/${uo+3}/${no}`);
          objLines.push(`f ${vo+2}/${uo+2}/${no+1} ${vo+1}/${uo+1}/${no+1} ${vo}/${uo}/${no+1}`);
          objLines.push(`f ${vo+3}/${uo+3}/${no+1} ${vo+2}/${uo+2}/${no+1} ${vo}/${uo}/${no+1}`);
          vertOff += 4; uvOff += 4; normOff += 2;
        }
        addEdgeFace([x0,y1,z0],[x0+sizeX,y1,z0],[x0+sizeX,y1,z0+sizeZ],[x0,y1,z0+sizeZ], 0,1,0);
        addEdgeFace([x0,y0,z0+sizeZ],[x0+sizeX,y0,z0+sizeZ],[x0+sizeX,y0,z0],[x0,y0,z0], 0,-1,0);
        addEdgeFace([x0+sizeX,y0,z0],[x0,y0,z0],[x0,y1,z0],[x0+sizeX,y1,z0], 0,0,-1);
        addEdgeFace([x0,y0,z0+sizeZ],[x0+sizeX,y0,z0+sizeZ],[x0+sizeX,y1,z0+sizeZ],[x0,y1,z0+sizeZ], 0,0,1);
      }
    }

    objLines.push('');
  }

  // Full perimeter edge faces for a freestanding flat object
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

  // Shared-vertex flat surface
  function addSharedFlat(name, x0, y0, z0, sizeX, sizeY, sizeZ, uv, emitBottom = true, rotateUV = false, simpleBottom = false, emitTop = true) {
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

    // Top grid
    const gridW = segsX + 1;
    const voTop = vertOff;
    for (let gz = 0; gz <= segsZ; gz++) {
      for (let gx = 0; gx <= segsX; gx++) {
        objLines.push(`v ${(x0 + gx * stepX).toFixed(6)} ${yTop.toFixed(6)} ${(z0 + gz * stepZ).toFixed(6)}`);
      }
    }
    vertOff += gridW * (segsZ + 1);

    // Bottom grid
    const voBot = vertOff;
    for (let gz = 0; gz <= segsZ; gz++) {
      for (let gx = 0; gx <= segsX; gx++) {
        objLines.push(`v ${(x0 + gx * stepX).toFixed(6)} ${y0.toFixed(6)} ${(z0 + gz * stepZ).toFixed(6)}`);
      }
    }
    vertOff += gridW * (segsZ + 1);

    // Normals
    objLines.push('vn 0 1 0');
    objLines.push('vn 0 -1 0');
    const noTop = normOff, noBot = normOff + 1;
    normOff += 2;

    // Emit tiles
    for (let sz = 0; sz < segsZ; sz++) {
      for (let sx = 0; sx < segsX; sx++) {
        let rsx = sx, rsz = sz;
        if (rotateUV) { rsx = sz; rsz = sx; }

        const uOff = ((rsx + baseSegU) % SEGS_PER_TILE) * uvStep;
        const vOff = ((rsz + baseSegV) % SEGS_PER_TILE) * uvStepV;

        // Top face
        if (emitTop) {
          const uo = uvOff;
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          uvOff += 4;

          const v00 = voTop + sz * gridW + sx;
          const v10 = v00 + 1;
          const v01 = v00 + gridW;
          const v11 = v01 + 1;
          objLines.push(`f ${v01}/${uo+3}/${noTop} ${v11}/${uo+2}/${noTop} ${v10}/${uo+1}/${noTop}`);
          objLines.push(`f ${v01}/${uo+3}/${noTop} ${v10}/${uo+1}/${noTop} ${v00}/${uo}/${noTop}`);
        }

        // Bottom face
        if (emitBottom) {
          if (simpleBottom) {
            // Simple bottom — single flat quad (no per-tile UVs)
            if (sx === 0 && sz === 0) {
              const cu = ((uv.uMin + uv.uMax) / 2).toFixed(6);
              const cv = ((uv.vMin + uv.vMax) / 2).toFixed(6);
              const b0 = voBot, b1 = voBot + segsX, b2 = voBot + segsZ * gridW + segsX, b3 = voBot + segsZ * gridW;
              const uo = uvOff;
              objLines.push(`vt ${uv.uMin.toFixed(6)} ${uv.vMin.toFixed(6)}`);
          objLines.push(`vt ${uv.uMax.toFixed(6)} ${uv.vMin.toFixed(6)}`);
          objLines.push(`vt ${uv.uMax.toFixed(6)} ${uv.vMax.toFixed(6)}`);
          objLines.push(`vt ${uv.uMin.toFixed(6)} ${uv.vMax.toFixed(6)}`);
              uvOff += 4;
              objLines.push(`f ${b0}/${uo}/${noBot} ${b1}/${uo+1}/${noBot} ${b2}/${uo+2}/${noBot}`);
              objLines.push(`f ${b0}/${uo}/${noBot} ${b2}/${uo+2}/${noBot} ${b3}/${uo+3}/${noBot}`);
            }
          } else {
            const uob = uvOff;
            objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
            objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
            objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
            objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
            uvOff += 4;

            const b00 = voBot + sz * gridW + sx;
            const b10 = b00 + 1;
            const b01 = b00 + gridW;
            const b11 = b01 + 1;
            objLines.push(`f ${b00}/${uob}/${noBot} ${b10}/${uob+1}/${noBot} ${b11}/${uob+2}/${noBot}`);
            objLines.push(`f ${b00}/${uob}/${noBot} ${b11}/${uob+2}/${noBot} ${b01}/${uob+3}/${noBot}`);
          }
        }
      }
    }

    objLines.push('');
  }

  // Shared-vertex wall
  function addSharedWall(name, x0, y0, z0, sizeX, sizeY, sizeZ, uv) {
    const isWallZ = sizeZ < 1;
    const isWallX = sizeX < 1;

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
      const voFront = vertOff;
      for (let gh = 0; gh < gridH; gh++)
        for (let gl = 0; gl < gridW; gl++)
          objLines.push(`v ${(x0 + gl * stepL).toFixed(6)} ${(y0 + gh * stepH).toFixed(6)} ${z0.toFixed(6)}`);
      vertOff += gridW * gridH;

      const voBack = vertOff;
      const z1 = z0 + sizeZ;
      for (let gh = 0; gh < gridH; gh++)
        for (let gl = 0; gl < gridW; gl++)
          objLines.push(`v ${(x0 + gl * stepL).toFixed(6)} ${(y0 + gh * stepH).toFixed(6)} ${z1.toFixed(6)}`);
      vertOff += gridW * gridH;

      objLines.push('vn 0 0 -1');
      objLines.push('vn 0 0 1');
      const noFront = normOff, noBack = normOff + 1;
      normOff += 2;

      for (let sl = 0; sl < segsL; sl++) {
        for (let sh = 0; sh < segsH; sh++) {
          const uOff = ((sl + baseSegU) % SEGS_PER_TILE) * uvStep;
          const vOff = ((sh + baseSegV) % SEGS_PER_TILE) * uvStepV;

          const uo = uvOff;
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          uvOff += 4;

          const f00 = voFront + sh * gridW + sl, f10 = f00 + 1, f01 = f00 + gridW, f11 = f01 + 1;
          objLines.push(`f ${f00}/${uo}/${noFront} ${f01}/${uo+3}/${noFront} ${f11}/${uo+2}/${noFront}`);
          objLines.push(`f ${f00}/${uo}/${noFront} ${f11}/${uo+2}/${noFront} ${f10}/${uo+1}/${noFront}`);

          const uob = uvOff;
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          uvOff += 4;

          const b00 = voBack + sh * gridW + sl, b10 = b00 + 1, b01 = b00 + gridW, b11 = b01 + 1;
          objLines.push(`f ${b00}/${uob}/${noBack} ${b10}/${uob+1}/${noBack} ${b11}/${uob+2}/${noBack}`);
          objLines.push(`f ${b00}/${uob}/${noBack} ${b11}/${uob+2}/${noBack} ${b01}/${uob+3}/${noBack}`);
        }
      }
    } else if (isWallX) {
      const voFront = vertOff;
      for (let gh = 0; gh < gridH; gh++)
        for (let gl = 0; gl < gridW; gl++)
          objLines.push(`v ${x0.toFixed(6)} ${(y0 + gh * stepH).toFixed(6)} ${(z0 + gl * stepL).toFixed(6)}`);
      vertOff += gridW * gridH;

      const voBack = vertOff;
      const x1 = x0 + sizeX;
      for (let gh = 0; gh < gridH; gh++)
        for (let gl = 0; gl < gridW; gl++)
          objLines.push(`v ${x1.toFixed(6)} ${(y0 + gh * stepH).toFixed(6)} ${(z0 + gl * stepL).toFixed(6)}`);
      vertOff += gridW * gridH;

      objLines.push('vn -1 0 0');
      objLines.push('vn 1 0 0');
      const noFront = normOff, noBack = normOff + 1;
      normOff += 2;

      for (let sl = 0; sl < segsL; sl++) {
        for (let sh = 0; sh < segsH; sh++) {
          const uOff = ((sl + baseSegU) % SEGS_PER_TILE) * uvStep;
          const vOff = ((sh + baseSegV) % SEGS_PER_TILE) * uvStepV;

          const uo = uvOff;
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          uvOff += 4;

          const f00 = voFront + sh * gridW + sl, f10 = f00 + 1, f01 = f00 + gridW, f11 = f01 + 1;
          objLines.push(`f ${f00}/${uo}/${noFront} ${f10}/${uo+1}/${noFront} ${f11}/${uo+2}/${noFront}`);
          objLines.push(`f ${f00}/${uo}/${noFront} ${f11}/${uo+2}/${noFront} ${f01}/${uo+3}/${noFront}`);

          const uob = uvOff;
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff+uvStep).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          objLines.push(`vt ${(uv.uMin+uOff).toFixed(6)} ${(uv.vMin+vOff+uvStepV).toFixed(6)}`);
          uvOff += 4;

          const b00 = voBack + sh * gridW + sl, b10 = b00 + 1, b01 = b00 + gridW, b11 = b01 + 1;
          objLines.push(`f ${b00}/${uob}/${noBack} ${b01}/${uob+3}/${noBack} ${b11}/${uob+2}/${noBack}`);
          objLines.push(`f ${b00}/${uob}/${noBack} ${b11}/${uob+2}/${noBack} ${b10}/${uob+1}/${noBack}`);
        }
      }
    }

    objLines.push('');
  }

  // Wall edge coverage check (for wall-type primitives)
  function wallEdgeCovered(wallPrim, side, allWallPrims) {
    const margin = 0.5;
    let edgeX, edgeZ;
    if (wallPrim.axis === 'x') {
      edgeX = side === 'start' ? wallPrim.x : wallPrim.x + wallPrim.w;
      edgeZ = wallPrim.z;
    } else {
      edgeX = wallPrim.x;
      edgeZ = side === 'start' ? wallPrim.z : wallPrim.z + wallPrim.d;
    }

    for (const other of allWallPrims) {
      if (other === wallPrim) continue;
      if (Math.abs(wallPrim.y - other.y) > 0.5) continue;
      if (edgeX >= other.x - margin && edgeX <= other.x + other.w + margin &&
          edgeZ >= other.z - margin && edgeZ <= other.z + other.d + margin) {
        return true;
      }
    }
    return false;
  }

  // Floor edge faces (adjacency-aware)
  function addFloorEdgesFromGaps(x0, y0, z0, w, h, d, edgeGaps, uv) {
    const x1 = x0 + w, y1 = y0 + h, z1 = z0 + d;
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

    if (edgeGaps.north) {
      for (const gap of edgeGaps.north)
        addEdge([gap.start,y0,z0],[gap.end,y0,z0],[gap.end,y1,z0],[gap.start,y1,z0], 0,0,-1);
    }
    if (edgeGaps.south) {
      for (const gap of edgeGaps.south)
        addEdge([gap.end,y0,z1],[gap.start,y0,z1],[gap.start,y1,z1],[gap.end,y1,z1], 0,0,1);
    }
    if (edgeGaps.west) {
      for (const gap of edgeGaps.west)
        addEdge([x0,y0,gap.end],[x0,y0,gap.start],[x0,y1,gap.start],[x0,y1,gap.end], -1,0,0);
    }
    if (edgeGaps.east) {
      for (const gap of edgeGaps.east)
        addEdge([x1,y0,gap.start],[x1,y0,gap.end],[x1,y1,gap.end],[x1,y1,gap.start], 1,0,0);
    }
  }

  // Vertical quad (double-sided) for flat ladders
  function addVerticalQuad(name, v0, v1, v2, v3, nx, ny, nz, uv) {
    const vo = vertOff;
    objLines.push(`o ${name}`);
    for (const v of [v0,v1,v2,v3]) objLines.push(`v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}`);
    objLines.push(`vt ${uv.uMin.toFixed(6)} ${uv.vMin.toFixed(6)}`);
    objLines.push(`vt ${uv.uMax.toFixed(6)} ${uv.vMin.toFixed(6)}`);
    objLines.push(`vt ${uv.uMax.toFixed(6)} ${uv.vMax.toFixed(6)}`);
    objLines.push(`vt ${uv.uMin.toFixed(6)} ${uv.vMax.toFixed(6)}`);
    objLines.push(`vn ${nx} ${ny} ${nz}`);
    objLines.push(`vn ${-nx} ${-ny} ${-nz}`);
    const uo = uvOff, no = normOff;
    objLines.push(`f ${vo}/${uo}/${no} ${vo+1}/${uo+1}/${no} ${vo+2}/${uo+2}/${no}`);
    objLines.push(`f ${vo}/${uo}/${no} ${vo+2}/${uo+2}/${no} ${vo+3}/${uo+3}/${no}`);
    objLines.push(`f ${vo+2}/${uo+2}/${no+1} ${vo+1}/${uo+1}/${no+1} ${vo}/${uo}/${no+1}`);
    objLines.push(`f ${vo+3}/${uo+3}/${no+1} ${vo+2}/${uo+2}/${no+1} ${vo}/${uo}/${no+1}`);
    vertOff += 4; uvOff += 4; normOff += 2;
  }

  // 3D ladder box
  function addLadderBox(name, bx, by, bz, bw, bh, bd, uv) {
    const vo = vertOff;
    const x1 = bx + bw, y1 = by + bh, z1 = bz + bd;
    const uMin = uv.uMin.toFixed(6), uMax = uv.uMax.toFixed(6);
    const vMin = uv.vMin.toFixed(6), vMax = uv.vMax.toFixed(6);
    objLines.push(`o ${name}`);
    objLines.push(`v ${bx.toFixed(6)} ${by.toFixed(6)} ${bz.toFixed(6)}`);
    objLines.push(`v ${x1.toFixed(6)} ${by.toFixed(6)} ${bz.toFixed(6)}`);
    objLines.push(`v ${x1.toFixed(6)} ${by.toFixed(6)} ${z1.toFixed(6)}`);
    objLines.push(`v ${bx.toFixed(6)} ${by.toFixed(6)} ${z1.toFixed(6)}`);
    objLines.push(`v ${bx.toFixed(6)} ${y1.toFixed(6)} ${bz.toFixed(6)}`);
    objLines.push(`v ${x1.toFixed(6)} ${y1.toFixed(6)} ${bz.toFixed(6)}`);
    objLines.push(`v ${x1.toFixed(6)} ${y1.toFixed(6)} ${z1.toFixed(6)}`);
    objLines.push(`v ${bx.toFixed(6)} ${y1.toFixed(6)} ${z1.toFixed(6)}`);
    for (let i = 0; i < 6; i++) {
      objLines.push(`vt ${uMin} ${vMin}`);
      objLines.push(`vt ${uMax} ${vMin}`);
      objLines.push(`vt ${uMax} ${vMax}`);
      objLines.push(`vt ${uMin} ${vMax}`);
    }
    objLines.push('vn 0 -1 0'); objLines.push('vn 0 1 0');
    objLines.push('vn 0 0 -1'); objLines.push('vn 0 0 1');
    objLines.push('vn -1 0 0'); objLines.push('vn 1 0 0');
    const u = uvOff, n = normOff;
    objLines.push(`f ${vo}/${u}/${n} ${vo+1}/${u+1}/${n} ${vo+2}/${u+2}/${n}`);
    objLines.push(`f ${vo}/${u}/${n} ${vo+2}/${u+2}/${n} ${vo+3}/${u+3}/${n}`);
    objLines.push(`f ${vo+6}/${u+6}/${n+1} ${vo+5}/${u+5}/${n+1} ${vo+4}/${u+4}/${n+1}`);
    objLines.push(`f ${vo+7}/${u+7}/${n+1} ${vo+6}/${u+6}/${n+1} ${vo+4}/${u+4}/${n+1}`);
    objLines.push(`f ${vo}/${u+8}/${n+2} ${vo+4}/${u+11}/${n+2} ${vo+5}/${u+10}/${n+2}`);
    objLines.push(`f ${vo}/${u+8}/${n+2} ${vo+5}/${u+10}/${n+2} ${vo+1}/${u+9}/${n+2}`);
    objLines.push(`f ${vo+2}/${u+12}/${n+3} ${vo+6}/${u+14}/${n+3} ${vo+7}/${u+15}/${n+3}`);
    objLines.push(`f ${vo+2}/${u+12}/${n+3} ${vo+7}/${u+15}/${n+3} ${vo+3}/${u+13}/${n+3}`);
    objLines.push(`f ${vo+3}/${u+16}/${n+4} ${vo+7}/${u+19}/${n+4} ${vo+4}/${u+18}/${n+4}`);
    objLines.push(`f ${vo+3}/${u+16}/${n+4} ${vo+4}/${u+18}/${n+4} ${vo}/${u+17}/${n+4}`);
    objLines.push(`f ${vo+1}/${u+20}/${n+5} ${vo+5}/${u+23}/${n+5} ${vo+6}/${u+22}/${n+5}`);
    objLines.push(`f ${vo+1}/${u+20}/${n+5} ${vo+6}/${u+22}/${n+5} ${vo+2}/${u+21}/${n+5}`);
    vertOff += 8; uvOff += 24; normOff += 6;
  }

  // Emit OBJ ladder from primitive placement data
  function emitLadder(prim, uv) {
    const height = prim.y1 - prim.y0;
    if (height <= 0) return;

    const isThinX = prim.isThinX;
    const ladderWidth = isThinX ? prim.d : prim.w;
    const cx = prim.x + prim.w / 2;
    const cz = prim.z + prim.d / 2;
    const halfSpread = (ladderWidth / 2) - POLE_WIDTH / 2 - RUNG_INSET;
    const flat = GEOMETRY.flatLadders;

    if (flat) {
      const FLAT_OFFSET = 0.15;
      const offsetDir = prim.wallOffsetDir;

      if (isThinX) {
        const fx = cx + FLAT_OFFSET * offsetDir;
        const lz = cz - halfSpread - POLE_WIDTH/2;
        const rz = cz + halfSpread - POLE_WIDTH/2;
        addVerticalQuad(`${prim.name}_stile_L`,
          [fx, prim.y0, lz], [fx, prim.y0, lz + POLE_WIDTH], [fx, prim.y0 + height, lz + POLE_WIDTH], [fx, prim.y0 + height, lz],
          1, 0, 0, uv);
        addVerticalQuad(`${prim.name}_stile_R`,
          [fx, prim.y0, rz], [fx, prim.y0, rz + POLE_WIDTH], [fx, prim.y0 + height, rz + POLE_WIDTH], [fx, prim.y0 + height, rz],
          1, 0, 0, uv);
        const rungCount = Math.floor(height / RUNG_SPACING);
        for (let r = 1; r <= rungCount; r++) {
          const ry = prim.y0 + r * RUNG_SPACING;
          if (ry >= prim.y1 - RUNG_SPACING * 0.3) break;
          const rungLen = halfSpread * 2 + POLE_WIDTH;
          addVerticalQuad(`${prim.name}_rung_${r}`,
            [fx, ry - RUNG_HEIGHT/2, lz], [fx, ry - RUNG_HEIGHT/2, lz + rungLen],
            [fx, ry + RUNG_HEIGHT/2, lz + rungLen], [fx, ry + RUNG_HEIGHT/2, lz],
            1, 0, 0, uv);
        }
      } else {
        const fz = cz + FLAT_OFFSET * offsetDir;
        const lx = cx - halfSpread - POLE_WIDTH/2;
        const rx = cx + halfSpread - POLE_WIDTH/2;
        addVerticalQuad(`${prim.name}_stile_L`,
          [lx, prim.y0, fz], [lx + POLE_WIDTH, prim.y0, fz], [lx + POLE_WIDTH, prim.y0 + height, fz], [lx, prim.y0 + height, fz],
          0, 0, 1, uv);
        addVerticalQuad(`${prim.name}_stile_R`,
          [rx, prim.y0, fz], [rx + POLE_WIDTH, prim.y0, fz], [rx + POLE_WIDTH, prim.y0 + height, fz], [rx, prim.y0 + height, fz],
          0, 0, 1, uv);
        const rungCount = Math.floor(height / RUNG_SPACING);
        for (let r = 1; r <= rungCount; r++) {
          const ry = prim.y0 + r * RUNG_SPACING;
          if (ry >= prim.y1 - RUNG_SPACING * 0.3) break;
          const rungLen = halfSpread * 2 + POLE_WIDTH;
          addVerticalQuad(`${prim.name}_rung_${r}`,
            [lx, ry - RUNG_HEIGHT/2, fz], [lx + rungLen, ry - RUNG_HEIGHT/2, fz],
            [lx + rungLen, ry + RUNG_HEIGHT/2, fz], [lx, ry + RUNG_HEIGHT/2, fz],
            0, 0, 1, uv);
        }
      }
    } else {
      // 3D box mode
      if (isThinX) {
        addLadderBox(`${prim.name}_stile_L`, cx - POLE_DEPTH/2, prim.y0, cz - halfSpread - POLE_WIDTH/2, POLE_DEPTH, height, POLE_WIDTH, uv);
        addLadderBox(`${prim.name}_stile_R`, cx - POLE_DEPTH/2, prim.y0, cz + halfSpread - POLE_WIDTH/2, POLE_DEPTH, height, POLE_WIDTH, uv);
      } else {
        addLadderBox(`${prim.name}_stile_L`, cx - halfSpread - POLE_WIDTH/2, prim.y0, cz - POLE_DEPTH/2, POLE_WIDTH, height, POLE_DEPTH, uv);
        addLadderBox(`${prim.name}_stile_R`, cx + halfSpread - POLE_WIDTH/2, prim.y0, cz - POLE_DEPTH/2, POLE_WIDTH, height, POLE_DEPTH, uv);
      }

      const rungCount = Math.floor(height / RUNG_SPACING);
      for (let r = 1; r <= rungCount; r++) {
        const ry = prim.y0 + r * RUNG_SPACING;
        if (ry >= prim.y1 - RUNG_SPACING * 0.3) break;
        const rungLen = halfSpread * 2 + POLE_WIDTH;
        if (isThinX) {
          addLadderBox(`${prim.name}_rung_${r}`, cx - RUNG_DEPTH/2, ry - RUNG_HEIGHT/2, cz - halfSpread - POLE_WIDTH/2, RUNG_DEPTH, RUNG_HEIGHT, rungLen, uv);
        } else {
          addLadderBox(`${prim.name}_rung_${r}`, cx - halfSpread - POLE_WIDTH/2, ry - RUNG_HEIGHT/2, cz - RUNG_DEPTH/2, rungLen, RUNG_HEIGHT, RUNG_DEPTH, uv);
        }
      }
    }
  }

  // Collect wall primitives for edge coverage checks
  const wallPrims = geometry.primitives.filter(p => p.type === 'wall');

  // --- Emit primitives ---
  for (const prim of geometry.primitives) {
    const uv = resolveUV(prim.textureKey);

    switch (prim.type) {
      case 'slab': {
        if (prim.shared) {
          addSharedFlat(prim.name, prim.x, prim.y, prim.z, prim.w, prim.h, prim.d, uv,
            prim.emitBottom, prim.rotateUV, prim.simpleBottom, prim.emitTop);
        } else {
          addSubBox(prim.name, prim.x, prim.y, prim.z, prim.w, prim.h, prim.d, uv, true, prim.rotateUV, prim.thinAxis || null);
        }
        break;
      }

      case 'wall': {
        addSharedWall(prim.name, prim.x, prim.y, prim.z, prim.w, prim.h, prim.d, uv);

        // Wall edge faces
        const cu = ((uv.uMin + uv.uMax) / 2).toFixed(6);
        const cv = ((uv.vMin + uv.vMax) / 2).toFixed(6);

        function addWallEdge(v0, v1, v2, v3, nx, ny, nz) {
          const vo = vertOff;
          for (const v of [v0,v1,v2,v3]) objLines.push(`v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}`);
          objLines.push(`vt ${uv.uMin.toFixed(6)} ${uv.vMin.toFixed(6)}`);
          objLines.push(`vt ${uv.uMax.toFixed(6)} ${uv.vMin.toFixed(6)}`);
          objLines.push(`vt ${uv.uMax.toFixed(6)} ${uv.vMax.toFixed(6)}`);
          objLines.push(`vt ${uv.uMin.toFixed(6)} ${uv.vMax.toFixed(6)}`);
          objLines.push(`vn ${nx} ${ny} ${nz}`);
          objLines.push(`vn ${-nx} ${-ny} ${-nz}`);
          const uo = uvOff, no = normOff;
          objLines.push(`f ${vo}/${uo}/${no} ${vo+1}/${uo+1}/${no} ${vo+2}/${uo+2}/${no}`);
          objLines.push(`f ${vo}/${uo}/${no} ${vo+2}/${uo+2}/${no} ${vo+3}/${uo+3}/${no}`);
          objLines.push(`f ${vo+2}/${uo+2}/${no+1} ${vo+1}/${uo+1}/${no+1} ${vo}/${uo}/${no+1}`);
          objLines.push(`f ${vo+3}/${uo+3}/${no+1} ${vo+2}/${uo+2}/${no+1} ${vo}/${uo}/${no+1}`);
          vertOff += 4; uvOff += 4; normOff += 2;
        }

        const x0 = prim.x, z0 = prim.z;
        const x1 = x0 + prim.w, z1 = z0 + prim.d;
        const y0 = prim.y, y1 = y0 + prim.h;

        // Top + bottom always visible
        addWallEdge([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1], 0,1,0);
        addWallEdge([x0,y0,z1],[x1,y0,z1],[x1,y0,z0],[x0,y0,z0], 0,-1,0);

        // Side edges only if not covered by adjacent wall
        if (prim.axis === 'x') {
          if (!wallEdgeCovered(prim, 'start', wallPrims))
            addWallEdge([x0,y0,z1],[x0,y0,z0],[x0,y1,z0],[x0,y1,z1], -1,0,0);
          if (!wallEdgeCovered(prim, 'end', wallPrims))
            addWallEdge([x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0], 1,0,0);
        } else {
          if (!wallEdgeCovered(prim, 'start', wallPrims))
            addWallEdge([x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0], 0,0,-1);
          if (!wallEdgeCovered(prim, 'end', wallPrims))
            addWallEdge([x1,y0,z1],[x0,y0,z1],[x0,y1,z1],[x1,y1,z1], 0,0,1);
        }
        break;
      }

      case 'edges': {
        if (prim.edgeGaps) {
          addFloorEdgesFromGaps(prim.x, prim.y, prim.z, prim.w, prim.h, prim.d, prim.edgeGaps, uv);
        } else {
          addPerimeterEdges(prim.x, prim.y, prim.z, prim.w, prim.h, prim.d, uv);
        }
        break;
      }

      case 'quad': {
        // Pyramid roof triangular faces
        const verts = prim.verts;
        const cu = ((uv.uMin + uv.uMax) / 2).toFixed(6);
        const cv = ((uv.vMin + uv.vMax) / 2).toFixed(6);

        objLines.push(`o ${prim.name}`);
        const vo = vertOff;
        for (const v of verts) objLines.push(`v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}`);
        for (let i = 0; i < verts.length; i++) objLines.push(`vt ${cu} ${cv}`);

        // Compute face normal from first 3 verts
        const ax = verts[1][0] - verts[0][0], ay = verts[1][1] - verts[0][1], az = verts[1][2] - verts[0][2];
        const bx = verts[2][0] - verts[0][0], by = verts[2][1] - verts[0][1], bz = verts[2][2] - verts[0][2];
        const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
        objLines.push(`vn ${(nx/len).toFixed(6)} ${(ny/len).toFixed(6)} ${(nz/len).toFixed(6)}`);

        const uo = uvOff, no = normOff;
        objLines.push(`f ${vo}/${uo}/${no} ${vo+1}/${uo+1}/${no} ${vo+2}/${uo+2}/${no}`);
        vertOff += verts.length;
        uvOff += verts.length;
        normOff++;
        objLines.push('');
        break;
      }

      case 'ceiling': {
        // Downward-facing flat — emit via addSharedFlat with emitTop=false, emitBottom=true
        addSharedFlat(prim.name, prim.x, prim.y, prim.z, prim.w, prim.h || config.slabThickness, prim.d, uv, true, false, false, false);
        break;
      }

      case 'ladder': {
        emitLadder(prim, uv);
        break;
      }
    }
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
