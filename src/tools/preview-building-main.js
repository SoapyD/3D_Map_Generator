/**
 * Building Preview Tool
 *
 * Generates a single building in isolation and exports GLB + OBJ.
 * Useful for testing building types, shapes, and features.
 *
 * Usage:
 *   node src/tools/preview-building-main.js --type small --seed 42
 *   node src/tools/preview-building-main.js --type tower --seed 7
 *   node src/tools/preview-building-main.js --type small --shape corner --seed 100
 *   node src/tools/preview-building-main.js --type large --interior-walls --seed 55
 */

import { createRng } from '../core/rng.js';
import { parsePreviewArgs } from './parse-preview-args.js';
import { buildBuildingsList } from './preview-building-shapes.js';
import { runPipelineAndExport } from './preview-building-export.js';

async function main() {
  const args = parsePreviewArgs(process.argv);
  const rng = createRng(args.seed);

  console.log(`Preview building: type=${args.type}, shape=${args.shape}, seed=${args.seed}, tiers=${args.tiers}`);

  const buildingsList = buildBuildingsList(args, rng);

  // Log building parts for composite shapes
  if (buildingsList.length > 1) {
    for (const b of buildingsList) {
      console.log(`  Part: ${b.w.toFixed(1)} x ${b.d.toFixed(1)} at (${b.x.toFixed(1)}, ${b.z.toFixed(1)}), maxTier: ${b.maxTier}`);
    }
  } else if (buildingsList.length === 1) {
    const b = buildingsList[0];
    console.log(`  Size: ${b.w.toFixed(1)} x ${b.d.toFixed(1)}, maxTier: ${b.maxTier}${b.interiorWalls ? ', interior walls' : ''}`);
  }

  const config = {
    seed: args.seed,
    mapWidth: 0,
    mapDepth: 0,
    tiers: args.tiers,
    tierHeight: 3,
    slabThickness: 0.5,
    wallThickness: 0.25,
    streetWidth: 1,
    damageLevel: 0.5,
    textureSet: args.textureSet,
    debug: args.debug,
    outputDir: 'output',
  };

  await runPipelineAndExport(buildingsList, args, config);
}

export { main };

main().catch(console.error);
