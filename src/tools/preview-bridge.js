/**
 * Bridge Preview — generates standalone bridge variants for review.
 *
 * Usage:
 *   node src/tools/preview-bridge.js --variant low --seed 42
 *   node src/tools/preview-bridge.js --variant battlement --seed 42
 */

import { mkdir } from 'fs/promises';
import { createRng } from '../core/rng.js';
import { CONNECTIVITY, GEOMETRY } from '../config.js';
import { buildTexturePools, pickFromPool } from '../generators/textures.js';
import { createFloorSlab, createSlab } from '../core/geometry.js';
import * as THREE from 'three';
import { exportToGlb } from '../export/glb-exporter.js';

const args = { variant: 'low', seed: 42, textureSet: 'loaded', length: 8 };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--variant' && process.argv[i+1]) args.variant = process.argv[++i];
  else if (a === '--seed' && process.argv[i+1]) args.seed = parseInt(process.argv[++i]);
  else if (a === '--texture-set' && process.argv[i+1]) args.textureSet = process.argv[++i];
  else if (a === '--length' && process.argv[i+1]) args.length = parseFloat(process.argv[++i]);
}

const rng = createRng(args.seed);
const pools = buildTexturePools(args.textureSet);

const bw = CONNECTIVITY.bridgeWidth;
const bThick = CONNECTIVITY.bridgeThickness;
const wallH = CONNECTIVITY.bridgeWallHeight;
const wallT = CONNECTIVITY.bridgeWallThickness;
const len = args.length;
const y = 3; // tier 1 height

const scene = new THREE.Scene();

// Bridge slab
const slabMat = pickFromPool(pools.landmark_walls, 0);
const slab = createFloorSlab({ x: 0, z: 0, w: len, d: bw }, y, bThick, slabMat, { rotateUV: true });
slab.name = 'bridge_slab';
scene.add(slab);

// Side walls
const wallMat = pickFromPool(pools.landmark_walls, 1);
const wallY = y + bThick;

// Left wall (z=0 side)
const wallL = createSlab(len / 2, wallY + wallH / 2, wallT / 2, len, wallH, wallT, wallMat);
wallL.name = 'bridge_wall_L';
scene.add(wallL);

// Right wall (z=bw side)
const wallR = createSlab(len / 2, wallY + wallH / 2, bw - wallT / 2, len, wallH, wallT, wallMat);
wallR.name = 'bridge_wall_R';
scene.add(wallR);

// Battlement sections
if (args.variant === 'battlement') {
  const battH = CONNECTIVITY.bridgeBattlementHeight - wallH;
  const spacing = CONNECTIVITY.bridgeBattlementSpacing;
  const gap = CONNECTIVITY.bridgeBattlementGap;
  const pillarW = spacing - gap;
  const battY = wallY + wallH;

  for (let pos = 0; pos < len - pillarW; pos += spacing) {
    const pL = createSlab(pos + pillarW / 2, battY + battH / 2, wallT / 2, pillarW, battH, wallT, wallMat);
    pL.name = `bridge_batt_L_${Math.round(pos)}`;
    scene.add(pL);
    const pR = createSlab(pos + pillarW / 2, battY + battH / 2, bw - wallT / 2, pillarW, battH, wallT, wallMat);
    pR.name = `bridge_batt_R_${Math.round(pos)}`;
    scene.add(pR);
  }
}

await mkdir('output', { recursive: true });
const baseName = `preview_bridge_${args.variant}_${args.seed}`;
const glbPath = `output/${baseName}.glb`;
await exportToGlb(scene, glbPath);

console.log(`Bridge preview: variant=${args.variant}, length=${len}", width=${bw}"`);
console.log(`  GLB: ${glbPath}`);
