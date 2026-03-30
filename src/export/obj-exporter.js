/**
 * OBJ Exporter — texture atlas + primitive dispatch.
 *
 * Consumes geometry primitives from the handover (geometry-builder.js).
 * Delegates geometry emission to obj-geometry.js and obj-special.js.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import { PNG } from 'pngjs';
import path from 'path';
import { GEOMETRY } from '../config.js';
import { addSubBox, addPerimeterEdges, addSharedFlat } from './obj-geometry.js';
import { addSharedWall, wallEdgeCovered, addFloorEdgesFromGaps, emitLadder } from './obj-special.js';

const TILE_SIZE = GEOMETRY.objAtlasTileSize;
const PADDING = GEOMETRY.objAtlasPadding;
const PADDED_TILE = TILE_SIZE + PADDING * 2;

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

  const baseIdx = addTexture('base', baseTextures[0] || wallTextures[0]);

  const textureKeyToIdx = new Map();

  function ensureTexture(textureKey) {
    if (textureKeyToIdx.has(textureKey)) return textureKeyToIdx.get(textureKey);

    const parts = textureKey.split(':');
    let idx;

    if (parts[0] === 'floor') {
      if (parts[1] === 'base') {
        idx = baseIdx;
      } else {
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

  // --- OBJ state (shared across all geometry helpers) ---
  const state = { objLines: [], vertOff: 1, uvOff: 1, normOff: 1 };

  state.objLines.push('# Mordheim Map Generator - subdivided');
  state.objLines.push('');

  // Collect wall primitives for edge coverage checks
  const wallPrims = geometry.primitives.filter(p => p.type === 'wall');

  // --- Emit primitives ---
  for (const prim of geometry.primitives) {
    const uv = resolveUV(prim.textureKey);

    switch (prim.type) {
      case 'slab': {
        if (prim.shared) {
          addSharedFlat(state, prim.name, prim.x, prim.y, prim.z, prim.w, prim.h, prim.d, uv,
            prim.emitBottom, prim.rotateUV, prim.simpleBottom, prim.emitTop);
        } else {
          addSubBox(state, prim.name, prim.x, prim.y, prim.z, prim.w, prim.h, prim.d, uv, true, prim.rotateUV, prim.thinAxis || null);
        }
        break;
      }

      case 'wall': {
        addSharedWall(state, prim.name, prim.x, prim.y, prim.z, prim.w, prim.h, prim.d, uv);

        // Wall edge faces
        function addWallEdge(v0, v1, v2, v3, nx, ny, nz) {
          const vo = state.vertOff;
          for (const v of [v0,v1,v2,v3]) state.objLines.push(`v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}`);
          state.objLines.push(`vt ${uv.uMin.toFixed(6)} ${uv.vMin.toFixed(6)}`);
          state.objLines.push(`vt ${uv.uMax.toFixed(6)} ${uv.vMin.toFixed(6)}`);
          state.objLines.push(`vt ${uv.uMax.toFixed(6)} ${uv.vMax.toFixed(6)}`);
          state.objLines.push(`vt ${uv.uMin.toFixed(6)} ${uv.vMax.toFixed(6)}`);
          state.objLines.push(`vn ${nx} ${ny} ${nz}`);
          state.objLines.push(`vn ${-nx} ${-ny} ${-nz}`);
          const uo = state.uvOff, no = state.normOff;
          state.objLines.push(`f ${vo}/${uo}/${no} ${vo+1}/${uo+1}/${no} ${vo+2}/${uo+2}/${no}`);
          state.objLines.push(`f ${vo}/${uo}/${no} ${vo+2}/${uo+2}/${no} ${vo+3}/${uo+3}/${no}`);
          state.objLines.push(`f ${vo+2}/${uo+2}/${no+1} ${vo+1}/${uo+1}/${no+1} ${vo}/${uo}/${no+1}`);
          state.objLines.push(`f ${vo+3}/${uo+3}/${no+1} ${vo+2}/${uo+2}/${no+1} ${vo}/${uo}/${no+1}`);
          state.vertOff += 4; state.uvOff += 4; state.normOff += 2;
        }

        const x0 = prim.x, z0 = prim.z;
        const x1 = x0 + prim.w, z1 = z0 + prim.d;
        const y0 = prim.y, y1 = y0 + prim.h;

        addWallEdge([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1], 0,1,0);
        addWallEdge([x0,y0,z1],[x1,y0,z1],[x1,y0,z0],[x0,y0,z0], 0,-1,0);

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
          addFloorEdgesFromGaps(state, prim.x, prim.y, prim.z, prim.w, prim.h, prim.d, prim.edgeGaps, uv);
        } else {
          addPerimeterEdges(state, prim.x, prim.y, prim.z, prim.w, prim.h, prim.d, uv);
        }
        break;
      }

      case 'quad': {
        const verts = prim.verts;
        const cu = ((uv.uMin + uv.uMax) / 2).toFixed(6);
        const cv = ((uv.vMin + uv.vMax) / 2).toFixed(6);

        state.objLines.push(`o ${prim.name}`);
        const vo = state.vertOff;
        for (const v of verts) state.objLines.push(`v ${v[0].toFixed(6)} ${v[1].toFixed(6)} ${v[2].toFixed(6)}`);
        for (let i = 0; i < verts.length; i++) state.objLines.push(`vt ${cu} ${cv}`);

        const ax = verts[1][0] - verts[0][0], ay = verts[1][1] - verts[0][1], az = verts[1][2] - verts[0][2];
        const bx = verts[2][0] - verts[0][0], by = verts[2][1] - verts[0][1], bz = verts[2][2] - verts[0][2];
        const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        const len = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
        state.objLines.push(`vn ${(nx/len).toFixed(6)} ${(ny/len).toFixed(6)} ${(nz/len).toFixed(6)}`);

        const uo = state.uvOff, no = state.normOff;
        state.objLines.push(`f ${vo}/${uo}/${no} ${vo+1}/${uo+1}/${no} ${vo+2}/${uo+2}/${no}`);
        state.vertOff += verts.length;
        state.uvOff += verts.length;
        state.normOff++;
        state.objLines.push('');
        break;
      }

      case 'ceiling': {
        addSharedFlat(state, prim.name, prim.x, prim.y, prim.z, prim.w, prim.h || config.slabThickness, prim.d, uv, true, false, false, false);
        break;
      }

      case 'ladder': {
        emitLadder(state, prim, uv);
        break;
      }
    }
  }

  // Write OBJ
  const objPath = path.join(outputDir, `${baseName}.obj`);
  await writeFile(objPath, state.objLines.join('\n'));

  return objPath;
}

export function getObjOutputPath(config) {
  const baseName = `mordheim_map_${config.seed}`;
  return { dir: config.outputDir, baseName };
}
