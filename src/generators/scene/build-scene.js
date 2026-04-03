/**
 * Scene Builder — converts geometry primitives into a Three.js scene.
 *
 * Consumes the handover primitives produced by geometry-builder.js.
 * Only handles HOW to render (Three.js meshes, materials), not WHAT.
 */

import * as THREE from 'three';
import { buildTexturePools } from './buildTexturePools.js';
import { resolveDebugMaterial } from './resolve-debug-material.js';
import { resolveTexturedMaterial } from './resolve-textured-material.js';
import { LADDER_DISPLAY } from '../../config.js';
import { buildPrimitiveMesh } from './build-primitive-mesh.js';

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
    const meshes = buildPrimitiveMesh(prim, getMaterial, ladderOpts);
    for (const mesh of meshes) {
      scene.add(mesh);
    }
  }

  return scene;
}
