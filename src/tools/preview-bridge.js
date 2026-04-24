/**
 * Bridge Preview — generates standalone bridge variants for review.
 *
 * Usage:
 *   node src/tools/preview-bridge.js --variant low --length 8
 *   node src/tools/preview-bridge.js --variant battlement --length 8
 */

import { mkdir } from 'fs/promises';
import { CONNECTIVITY } from '../config.js';
import { buildBridgePrimitives } from '../generators/geometry/build-bridge-primitives.js';
import { buildPrimitiveMesh } from '../generators/scene/build-primitive-mesh.js';
import * as THREE from 'three';
import { exportToGlb } from '../export/glb-exporter.js';

const args = { variant: 'low', length: 8 };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--variant' && process.argv[i+1]) args.variant = process.argv[++i];
  else if (a === '--length' && process.argv[i+1]) args.length = parseFloat(process.argv[++i]);
}

// Build a fake bridge entry matching the format buildBridgePrimitives expects.
// WE axis: w = length, d = 2 (2 cells wide), y = tier1 anchor Y (cell floor at 4, anchor at 4.75).
const bridgeY = 4.75;  // from.y for a tier-1 anchor
const fakeBridge = {
  connectionType: `bridge_${args.variant}`,
  axis: 'WE',
  segments: [{
    isCrossing: false,
    worldRect: { x: 0, y: bridgeY, z: 0, w: args.length, d: 2 },
  }],
};

const primitives = buildBridgePrimitives([fakeBridge]);

const mat = new THREE.MeshLambertMaterial({ color: 0x888888, side: THREE.DoubleSide });
const getMaterial = () => mat;

const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

for (const prim of primitives) {
  const meshes = buildPrimitiveMesh(prim, getMaterial, {});
  for (const m of meshes) scene.add(m);
}

await mkdir('output', { recursive: true });
const glbPath = `output/preview_bridge_${args.variant}_${args.length}.glb`;
await exportToGlb(scene, glbPath);

const { bridgeThickness, bridgeWallHeight, bridgeBattlementPeriod, bridgeBattlementTallH } = CONNECTIVITY;
console.log(`Bridge preview: variant=${args.variant}, length=${args.length}"`);
console.log(`  slab thickness=${bridgeThickness}", wall height=${bridgeWallHeight}", battlement period=${bridgeBattlementPeriod} tallH=${bridgeBattlementTallH}"`);
console.log(`  GLB: ${glbPath}`);
console.log(`  primitives: ${primitives.length}`);
