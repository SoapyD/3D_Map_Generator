/**
 * 3D Map Generator — CLI Entry Point
 *
 * Usage: node src/index.js --seed 42 --tiers 4 --size 48x48
 */

import { mkdir } from 'fs/promises';
import { parseArgs } from './config.js';
import { createRng } from './core/rng.js';
import { generateGrid } from './generators/grid.js';
import { generateBuildings } from './generators/buildings.js';
import { generateFloors } from './generators/floors.js';
import { generateWalls } from './generators/walls.js';
import { generateConnectivity } from './generators/connectivity.js';
import { buildScene } from './generators/scene-builder.js';
import { exportToGlb, getOutputPath } from './export/glb-exporter.js';

async function main() {
  const config = parseArgs(process.argv);
  const rng = createRng(config.seed);

  console.log(`Generating map with seed ${config.seed}...`);
  console.log(`  Size: ${config.mapWidth}x${config.mapDepth} inches`);
  console.log(`  Tiers: ${config.tiers} (+ base)`);
  console.log(`  Tier height: ${config.tierHeight} inches`);
  console.log(`  Damage level: ${config.damageLevel}`);

  // Stage 1: Grid partitioning
  console.log('\n[1/6] Generating city grid...');
  const gridData = generateGrid(config, rng);
  console.log(`  ${gridData.blocks.length} city blocks`);

  // Stage 2: Building footprints
  console.log('[2/6] Placing buildings...');
  const buildingData = generateBuildings(gridData, config, rng);
  console.log(`  ${buildingData.buildings.length} buildings`);

  // Stage 3: Floor plates
  console.log('[3/6] Generating floor plates...');
  const floorData = generateFloors(buildingData, config, rng);
  for (const f of floorData.floors) {
    console.log(`  Tier ${f.tier}: ${f.sections.length} sections`);
  }

  // Stage 4: Walls
  console.log('[4/6] Generating walls...');
  const wallData = generateWalls(floorData, config, rng);
  console.log(`  ${wallData.walls.length} wall segments`);

  // Stage 5: Connectivity
  console.log('[5/6] Connecting levels...');
  const connData = generateConnectivity(wallData, config, rng);
  const c = connData.connections;
  console.log(`  ${c.ladders.length} ladders, ${c.walkways.length} walkways`);

  // Build 3D scene
  console.log('[6/6] Building scene and exporting...');
  const scene = buildScene(connData, config);

  // Export
  await mkdir(config.outputDir, { recursive: true });
  const outputPath = getOutputPath(config);
  await exportToGlb(scene, outputPath);

  console.log(`\nDone! Output: ${outputPath}`);

  if (config.preview) {
    console.log('\nStarting preview server...');
    const { startPreview } = await import('./preview/server.js');
    startPreview(outputPath);
  }
}

main().catch((err) => {
  console.error('Generation failed:', err);
  process.exit(1);
});
