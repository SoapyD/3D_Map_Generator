/**
 * OBJ Exporter — texture atlas + primitive dispatch.
 *
 * Consumes geometry primitives from the handover (geometry-builder.js).
 * Delegates geometry emission to individual obj-geometry modules.
 */

import { writeFile, mkdir } from 'fs/promises';
import { PNG } from 'pngjs';
import path from 'path';
import { addSubBox } from './add-sub-box.js';
import { addSharedFlat } from './add-shared-flat.js';
import { addPerimeterEdges } from './add-perimeter-edges.js';
import { addSharedWall } from './add-shared-wall.js';
import { wallEdgeCovered } from './wall-edge-covered.js';
import { addFloorEdgesFromGaps } from './add-floor-edges-from-gaps.js';
import { emitLadder } from './emit-ladder.js';
import { loadTexPool } from './load-tex-pool.js';
import { createAtlasState } from './create-atlas-state.js';
import { addTexture } from './add-texture.js';
import { ensureTexture } from './ensure-texture.js';
import { buildAtlasImage } from './build-atlas-image.js';
import { resolveUV } from './resolve-uv.js';

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
  const riverPool = loadTexPool(packDir, 'rivers');
  const riverTextures = riverPool.length > 0 ? riverPool : baseTextures;
  const riverBankPool = loadTexPool(packDir, 'river_banks');
  const riverBankTextures = riverBankPool.length > 0 ? riverBankPool : wallTextures;
  const streetPool = loadTexPool(packDir, 'streets');
  const streetTextures = streetPool.length > 0 ? streetPool : baseTextures;
  const pavementPool = loadTexPool(packDir, 'pavements');
  const pavementTextures = pavementPool.length > 0 ? pavementPool : baseTextures;

  // Build atlas: collect unique textures needed
  const atlasState = createAtlasState();

  atlasState.baseIdx = addTexture(atlasState, 'base', baseTextures[0] || wallTextures[0]);

  const texturePools = {
    baseIdx: atlasState.baseIdx,
    wallTextures, landmarkTextures, floorTextures,
    walkwayTextures, objectTextures, courtyardTextures, ladderTextures, roofTextures,
    riverTextures, riverBankTextures, streetTextures, pavementTextures,
  };

  // Pre-register all textures from primitives
  for (const prim of geometry.primitives) {
    ensureTexture(atlasState, prim.textureKey, texturePools);
  }

  // Build atlas image with padding border
  const { atlas, gridSz, atlasSize } = buildAtlasImage(atlasState);

  await mkdir(outputDir, { recursive: true });
  const atlasPath = path.join(outputDir, `${baseName}.png`);
  await writeFile(atlasPath, PNG.sync.write(atlas));

  // --- OBJ state (shared across all geometry helpers) ---
  const state = { objLines: [], vertOff: 1, uvOff: 1, normOff: 1 };

  state.objLines.push('# Mordheim Map Generator - subdivided');
  state.objLines.push('');

  // Collect wall primitives for edge coverage checks
  const wallPrims = geometry.primitives.filter(p => p.type === 'wall');

  // --- Emit primitives ---
  for (const prim of geometry.primitives) {
    const uv = resolveUV(atlasState, prim.textureKey, texturePools, gridSz, atlasSize);

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
