/**
 * Scene Builder — converts geometry primitives into a Three.js scene.
 *
 * Consumes the handover primitives produced by geometry-builder.js.
 * Only handles HOW to render (Three.js meshes, materials), not WHAT.
 */

import * as THREE from 'three';
import { createSlab } from '../core/geometry-misc.js';
import { createLadderMesh } from '../core/create-ladder-mesh.js';
import { createFloorSlab } from '../core/geometry-rects.js';
import { buildTexturePools } from './build-texture-pools.js';
import { resolveDebugMaterial } from './resolve-debug-material.js';
import { resolveTexturedMaterial } from './resolve-textured-material.js';
import { LADDER_DISPLAY, GEOMETRY } from '../config.js';

/**
 * Build a Three.js scene from geometry primitives.
 *
 * @param {{ version: number, primitives: object[] }} geometry - From buildGeometry()
 * @param {object} config - Generation config
 * @returns {THREE.Scene}
 */
export function buildScene(geometry, config) {
  const scene = new THREE.Scene();
  const debug = config.debug;

  let pools = null;
  if (!debug) {
    pools = buildTexturePools(config.textureSet || 'base');
  }

  function getMaterial(prim) {
    if (debug) return resolveDebugMaterial(prim.name);
    return resolveTexturedMaterial(prim.textureKey, pools);
  }


  const ladderOpts = {
    poleRadius: LADDER_DISPLAY.poleRadius,
    rungRadius: LADDER_DISPLAY.rungRadius,
    rungSpacing: LADDER_DISPLAY.rungSpacing,
    rungInset: LADDER_DISPLAY.rungInset,
  };

  for (const prim of geometry.primitives) {
    switch (prim.type) {
      case 'slab': {
        const mat = getMaterial(prim);
        const mesh = createSlab(
          prim.x + prim.w / 2,
          prim.y + prim.h / 2,
          prim.z + prim.d / 2,
          prim.w, prim.h, prim.d,
          mat,
          { rotateUV: prim.rotateUV || false },
        );
        mesh.name = prim.name;
        scene.add(mesh);
        break;
      }

      case 'wall': {
        const mat = getMaterial(prim);
        const mesh = createSlab(
          prim.x + prim.w / 2,
          prim.y + prim.h / 2,
          prim.z + prim.d / 2,
          prim.w, prim.h, prim.d,
          mat,
        );
        mesh.name = prim.name;
        scene.add(mesh);
        break;
      }

      case 'quad': {
        // Triangular faces (pyramid roofs)
        const mat = getMaterial(prim);
        const verts = prim.verts;
        const positions = new Float32Array(verts.length * 3);
        for (let i = 0; i < verts.length; i++) {
          positions[i * 3] = verts[i][0];
          positions[i * 3 + 1] = verts[i][1];
          positions[i * 3 + 2] = verts[i][2];
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = prim.name;
        scene.add(mesh);
        break;
      }

      case 'ceiling': {
        // Downward-facing flat quad
        const mat = getMaterial(prim);
        const positions = new Float32Array([
          prim.x, prim.y, prim.z,
          prim.x + prim.w, prim.y, prim.z,
          prim.x + prim.w, prim.y, prim.z + prim.d,
          prim.x, prim.y, prim.z,
          prim.x + prim.w, prim.y, prim.z + prim.d,
          prim.x, prim.y, prim.z + prim.d,
        ]);
        const normals = new Float32Array([
          0, -1, 0, 0, -1, 0, 0, -1, 0,
          0, -1, 0, 0, -1, 0, 0, -1, 0,
        ]);
        const uvs = new Float32Array([
          0, 0, 1, 0, 1, 1,
          0, 0, 1, 1, 0, 1,
        ]);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = prim.name;
        scene.add(mesh);
        break;
      }

      case 'ladder': {
        const mat = getMaterial(prim);

        // Box ladder (debug)
        if (LADDER_DISPLAY.showBoxLadders) {
          const height = prim.y1 - prim.y0;
          const box = createSlab(
            prim.x + prim.w / 2, prim.y0 + height / 2, prim.z + prim.d / 2,
            prim.w, height, prim.d, mat,
          );
          box.name = prim.name + '_box';
          scene.add(box);
        }

        // Mesh ladder (poles + rungs)
        if (LADDER_DISPLAY.showMeshLadders) {
          const ladderData = { x: prim.x, z: prim.z, w: prim.w, d: prim.d, y0: prim.y0, y1: prim.y1 };
          const mesh = createLadderMesh(ladderData, mat, ladderOpts);
          if (mesh) {
            mesh.name = prim.name;
            scene.add(mesh);
          }
        }
        break;
      }

      case 'edges':
        // GLB doesn't need explicit edge faces — BoxGeometry includes all faces
        break;
    }
  }

  return scene;
}
