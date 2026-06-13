/**
 * 3D Map Generator — CLI Entry Point
 *
 * Usage: node src/index.js --seed 42 --tiers 4 --size 48x48
 */

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { parseArgs } from './config.js';
import { createRng } from './core/rng.js';
import { runPipeline } from './pipeline.js';
import { BELOW_GROUND } from './generators/collision/matrix.js';
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

  // Full procedural pipeline (grid → … → geometry), shared with lib.js so the
  // CLI and the programmatic GLB never diverge. See src/pipeline.js.
  const { geometry, matrix } = runPipeline(config, rng, { recorder, log: true });

  // Export
  await mkdir(config.outputDir, { recursive: true });

  if (config.debugMatrix) {
    const { dir: mDir, baseName: mBase } = getObjOutputPath(config);
    const historyOut = [];
    const rawHistory = matrix.dumpHistory();
    const { cellSize: cs, W: mW, D: mD } = matrix;
    for (const [cellIndex, buf] of rawHistory) {
      const writes = [];
      for (let o = 0; o < buf.length; o += 5) {
        writes.push({
          prev: buf[o], next: buf[o + 1],
          stage: buf[o + 2],
          stageName: ['buildings','floors','floors-label','roofs','roofs-label','connectivity','walls-label','walls','walls-internal'][buf[o + 2]] ?? 'unknown',
          sourceIndex: buf[o + 3] | (buf[o + 4] << 8),
        });
      }
      if (writes.length < 2) continue; // skip single-write cells by default
      const cy_arr = Math.floor(cellIndex / (mW * mD));
      const rem    = cellIndex % (mW * mD);
      const cz     = Math.floor(rem / mW);
      const cx     = rem % mW;
      historyOut.push({ cx, cy: cy_arr - BELOW_GROUND, cz, writes });
    }
    const histPath = path.join(mDir, `${mBase}_matrix_history.json`);
    await writeFile(histPath, JSON.stringify({ cells: historyOut }, null, 2));
    console.log(`  Matrix history: ${histPath}`);
  }

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
