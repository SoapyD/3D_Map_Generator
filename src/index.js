/**
 * 3D Map Generator — CLI Entry Point
 *
 * Usage: node src/index.js --seed 42 --tiers 4 --size 48x48
 */

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { parseArgs } from './config.js';
import { createRng } from './core/rng.js';
import { generateGrid } from './generators/foundations/grid.js';
import { generateBuildings } from './generators/buildings/index.js';
import { createCollisionMatrix } from './generators/collision/matrix.js';
// import { generateFloors } from './generators/_old_system/floors/index.js';       // stage 3 — floor plates from building quadrants
// import { generateWalls } from './generators/_old_system/walls/index.js';          // stage 4 — exterior/interior walls
// import { generateConnectivity } from './generators/_old_system/connectivity/generate-connectivity.js'; // stage 5 — walkways, ladders, pillars
// import { generateCover } from './generators/_old_system/cover/index.js';          // stage 6 — scatter cover pieces
import { buildGeometry } from './generators/geometry/index.js';
import { buildScene } from './generators/scene/index.js';
import { exportToGlb, getOutputPath } from './export/glb-exporter.js';
import { exportToObj } from './export/obj-geometry/export-to-obj.js';
import { getObjOutputPath } from './export/obj-geometry/get-obj-output-path.js';
import { exportCollisionObj } from './export/collision-exporter.js';

async function main() {
  const config = parseArgs(process.argv);
  const rng = createRng(config.seed);

  let recorder = null;
  if (config.visualize) {
    const { createRecorder } = await import('./preview/debug-recorder.js');
    recorder = createRecorder(config.seed, config);
  }

  console.log(`Generating map with seed ${config.seed}...`);
  console.log(`  Size: ${config.mapWidth}x${config.mapDepth} inches`);
  console.log(`  Tiers: ${config.tiers} (+ base)`);
  console.log(`  Tier height: ${config.tierHeight} inches`);
  console.log(`  Damage level: ${config.damageLevel}`);

  // Stage 1: Grid partitioning
  console.log('\n[1/2] Generating city grid...');
  const gridData = generateGrid(config, rng);
  console.log(`  ${gridData.blocks.length} city blocks`);
  recorder?.capture(1, gridData);
  recorder?.capture(2, gridData);

  const matrix = createCollisionMatrix(gridData.activeArea, config.tiers, config.tierHeight);

  // Stage 2: Building shells
  console.log('[2/2] Placing buildings...');
  const buildingData = generateBuildings(gridData, config, rng, matrix);
  console.log(`  ${buildingData.buildings.length} buildings`);
  recorder?.capture(3, buildingData);

  const geometry = buildGeometry(buildingData, config);

  // Export
  await mkdir(config.outputDir, { recursive: true });

  if (recorder) {
    await writeFile(`${config.outputDir}/debug_frames.json`, recorder.serialize());
    console.log(`  Visualizer frames written to ${config.outputDir}/debug_frames.json`);
  }
  const { dir, baseName } = getObjOutputPath(config);

  // Write handover file — embed collision matrix for viewer grid toggle
  const geometryWithMatrix = { ...geometry, collisionMatrix: matrix.toDebugJSON() };
  const geometryPath = path.join(dir, `${baseName}_geometry.json`);
  await writeFile(geometryPath, JSON.stringify(geometryWithMatrix));

  console.log('Building scene and exporting...');
  const scene = buildScene(geometry, config);

  // Always export both GLB and OBJ with texture atlas
  const outputPath = getOutputPath(config);
  await exportToGlb(scene, outputPath);

  const objPath = await exportToObj(geometry, config, dir, baseName);
  const collisionPath = await exportCollisionObj(geometry, dir, baseName);

  console.log(`\nDone!`);
  console.log(`  GLB: ${outputPath}`);
  console.log(`  OBJ: ${objPath}`);
  console.log(`  Texture: ${path.join(dir, baseName + '.png')}`);
  console.log(`  Collision: ${collisionPath}`);
  console.log(`  Geometry: ${geometryPath}`);

  if (config.preview) {
    console.log('\nStarting preview server...');
    const { startPreview } = await import('./preview/server.js');
    startPreview(outputPath, 3010, config.visualize ? 'visualize' : 'preview');
  }
}

main().catch((err) => {
  console.error('Generation failed:', err);
  process.exit(1);
});
