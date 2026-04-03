/**
 * Pipeline execution and export for the building preview tool.
 */

import { mkdir } from 'fs/promises';
import { generateFloors } from '../generators/floors/index.js';
import { generateWalls } from '../generators/walls/index.js';
import { generateConnectivity } from '../generators/connectivity/index.js';
import { buildGeometry } from '../generators/geometry/index.js';
import { buildScene } from '../generators/scene/index.js';
import { exportToGlb } from '../export/glb-exporter.js';
import { exportToObj } from '../export/obj-geometry/export-to-obj.js';

/**
 * Run the generation pipeline and export results.
 *
 * @param {object[]} buildingsList  Building descriptors
 * @param {object}   args           Parsed CLI args
 * @param {object}   config         Generation config
 */
export async function runPipelineAndExport(buildingsList, args, config) {
  // Map dimensions = encompass all buildings + margins
  let maxX = 0, maxZ = 0;
  for (const b of buildingsList) { maxX = Math.max(maxX, b.x + b.w); maxZ = Math.max(maxZ, b.z + b.d); }
  config.mapWidth = maxX + 4;
  config.mapDepth = maxZ + 4;

  // Build pipeline data for single building
  const gridData = {
    blocks: [{ x: 0, z: 0, w: config.mapWidth, d: config.mapDepth }],
    streets: [],
  };

  // Ensure all parts of a composite building share the same texture group
  for (const b of buildingsList) {
    if (b.textureGroup === undefined) b.textureGroup = 0;
  }

  const buildingData = {
    ...gridData,
    buildings: buildingsList,
    deletedBuildings: [],
  };

  // Generate floors
  console.log('  Generating floors...');
  const rng = (await import('../core/rng.js')).createRng(args.seed);
  const floorData = generateFloors(buildingData, config, rng);
  for (const f of floorData.floors) {
    if (f.sections.length > 0) console.log(`    Tier ${f.tier}: ${f.sections.length} sections`);
  }

  // Generate walls
  console.log('  Generating walls...');
  const wallData = generateWalls(floorData, config, rng);
  console.log(`    ${wallData.walls.length} wall segments`);

  // Run connectivity (generates tower ladders)
  console.log('  Generating connectivity...');
  const connData = generateConnectivity(wallData, config, rng);
  const conn = connData.connections;
  const ladderCount = conn.ladders.length + conn.groundLadders.length + conn.orangeLadders.length + conn.interiorLadders.length;
  if (ladderCount > 0) console.log(`    ${ladderCount} ladders`);

  // Minimal cover data
  const coverData = {
    ...connData,
    cover: [],
    interiorCover: [],
    deletedFootprints: [],
    streetScatter: [],
  };

  // Build geometry primitives and scene
  console.log('  Exporting...');
  const geometry = buildGeometry(coverData, config);
  const scene = buildScene(geometry, config);

  await mkdir(config.outputDir, { recursive: true });

  const baseName = `preview_${args.type}_${args.shape}_${args.seed}`;
  const fmt = args.format;

  let glbPath, objPath, vertCount;

  if (fmt === 'glb' || fmt === 'both') {
    glbPath = `output/${baseName}.glb`;
    await exportToGlb(scene, glbPath);
  }

  if (fmt === 'obj' || fmt === 'both') {
    objPath = await exportToObj(geometry, config, config.outputDir, baseName);
    const { readFileSync } = await import('fs');
    const objContent = readFileSync(objPath, 'utf8');
    vertCount = (objContent.match(/^v /gm) || []).length;
  }

  console.log(`\nDone!`);
  if (glbPath) console.log(`  GLB: ${glbPath}`);
  if (objPath) console.log(`  OBJ: ${objPath}`);
  if (vertCount) console.log(`  Vertices: ${vertCount}`);
}
