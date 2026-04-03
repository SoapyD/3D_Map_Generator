import * as THREE from 'three';
import { createSlab } from '../../core/geometry-misc.js';
import { createLadderMesh } from '../../core/create-ladder-mesh.js';
import { LADDER_DISPLAY } from '../../config.js';
import { buildCeilingMesh } from './build-ceiling-mesh.js';

export function buildPrimitiveMesh(prim, getMaterial, ladderOpts) {
  const meshes = [];

  switch (prim.type) {
    case 'slab': {
      const mat = getMaterial(prim);
      const mesh = createSlab(
        prim.x + prim.w / 2, prim.y + prim.h / 2, prim.z + prim.d / 2,
        prim.w, prim.h, prim.d, mat, { rotateUV: prim.rotateUV || false },
      );
      mesh.name = prim.name;
      meshes.push(mesh);
      break;
    }

    case 'wall': {
      const mat = getMaterial(prim);
      const mesh = createSlab(
        prim.x + prim.w / 2, prim.y + prim.h / 2, prim.z + prim.d / 2,
        prim.w, prim.h, prim.d, mat,
      );
      mesh.name = prim.name;
      meshes.push(mesh);
      break;
    }

    case 'quad': {
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
      meshes.push(mesh);
      break;
    }

    case 'ceiling': {
      meshes.push(buildCeilingMesh(prim, getMaterial(prim)));
      break;
    }

    case 'ladder': {
      const mat = getMaterial(prim);
      if (LADDER_DISPLAY.showBoxLadders) {
        const height = prim.y1 - prim.y0;
        const box = createSlab(
          prim.x + prim.w / 2, prim.y0 + height / 2, prim.z + prim.d / 2,
          prim.w, height, prim.d, mat,
        );
        box.name = prim.name + '_box';
        meshes.push(box);
      }
      if (LADDER_DISPLAY.showMeshLadders) {
        const ladderData = { x: prim.x, z: prim.z, w: prim.w, d: prim.d, y0: prim.y0, y1: prim.y1 };
        const mesh = createLadderMesh(ladderData, mat, ladderOpts);
        if (mesh) { mesh.name = prim.name; meshes.push(mesh); }
      }
      break;
    }

    case 'edges':
      break;
  }

  return meshes;
}
