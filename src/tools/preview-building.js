/**
 * Building Preview Tool
 *
 * Generates a single building in isolation and exports GLB + OBJ.
 * Useful for testing building types, shapes, and features.
 *
 * Usage:
 *   node src/tools/preview-building.js --type small --seed 42
 *   node src/tools/preview-building.js --type tower --seed 7
 *   node src/tools/preview-building.js --type small --shape corner --seed 100
 *   node src/tools/preview-building.js --type large --interior-walls --seed 55
 */

import { mkdir } from 'fs/promises';
import { createRng } from '../core/rng.js';
import { BUILDING, FLOOR, WALL, CONNECTIVITY, GEOMETRY, LADDER_DISPLAY } from '../config.js';
import { generateFloors } from '../generators/floors.js';
import { generateWalls } from '../generators/walls.js';
import { generateConnectivity } from '../generators/connectivity.js';
import { buildScene } from '../generators/scene-builder.js';
import { exportToGlb } from '../export/glb-exporter.js';
import { exportToObj, getObjOutputPath } from '../export/obj-exporter.js';

function parsePreviewArgs(argv) {
  const args = {
    type: 'small',
    shape: 'full',
    seed: 42,
    tiers: 4,
    interiorWalls: false,
    textureSet: 'base',
    debug: false,
    format: 'both',  // 'glb', 'obj', 'both'
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--type' && argv[i + 1]) args.type = argv[++i];
    else if (arg === '--shape' && argv[i + 1]) args.shape = argv[++i];
    else if (arg === '--seed' && argv[i + 1]) args.seed = parseInt(argv[++i]);
    else if (arg === '--tiers' && argv[i + 1]) args.tiers = parseInt(argv[++i]);
    else if (arg === '--interior-walls') args.interiorWalls = true;
    else if (arg === '--format' && argv[i + 1]) args.format = argv[++i];
    else if (arg === '--glb') args.format = 'glb';
    else if (arg === '--obj') args.format = 'obj';
    else if (arg === '--texture-set' && argv[i + 1]) args.textureSet = argv[++i];
    else if (arg === '--debug') args.debug = true;
  }

  return args;
}

function createBuilding(type, shape, tiers, rng) {
  const fp = BUILDING.footprints[type] || BUILDING.footprints.small;

  let w, d, maxTier, size;

  switch (type) {
    case 'tower': {
      const tFp = BUILDING.footprints.tower || { min: 2, max: 3 };
      w = rng.float(tFp.min, tFp.max);
      d = rng.float(tFp.min, tFp.max);
      maxTier = tiers;
      size = 'tower';
      break;
    }
    case 'large':
      w = rng.float(fp.min, fp.max);
      d = rng.float(fp.min, fp.max);
      maxTier = rng.int(3, Math.min(5, tiers));
      size = 'large';
      break;
    case 'medium':
      w = rng.float(fp.min, fp.max);
      d = rng.float(fp.min, fp.max);
      maxTier = rng.int(2, Math.min(4, tiers));
      size = 'medium';
      break;
    default: // small
      w = rng.float(fp.min, fp.max);
      d = rng.float(fp.min, fp.max);
      const heightKey = rng.pick(['short', 'medium', 'tall']);
      const height = BUILDING.heights[heightKey];
      maxTier = rng.int(Math.min(height.tierMin, tiers), Math.min(height.tierMax, tiers));
      size = 'small';
      break;
  }

  // Centre the building with some margin
  const margin = 2;
  const x = margin;
  const z = margin;

  const pyramidRoof = (size === 'tower') && rng.chance(BUILDING.pyramidRoofChance);

  // Determine shape — use specified shape or pick randomly for small buildings
  let buildingShape = 'full';
  if (size === 'small') {
    if (shape !== 'full' && BUILDING.shapes && BUILDING.shapes[shape]) {
      buildingShape = shape;
    } else if (shape === 'random') {
      // Pick a random non-full shape
      const shapeNames = Object.keys(BUILDING.shapes).filter(s => s !== 'full');
      buildingShape = rng.pick(shapeNames);
    } else {
      buildingShape = shape;
    }
  }

  return { x, z, w, d, maxTier, size, height: 'tall', blockIndex: 0, pyramidRoof, shape: buildingShape, interiorWalls: undefined };
}

async function main() {
  const args = parsePreviewArgs(process.argv);
  const rng = createRng(args.seed);

  console.log(`Preview building: type=${args.type}, shape=${args.shape}, seed=${args.seed}, tiers=${args.tiers}`);

  // Create building(s) — diagonals produce two separate buildings
  const buildingsList = [];
  if (args.shape === 'diagA' || args.shape === 'diagB') {
    const base = createBuilding(args.type, 'full', args.tiers, rng);
    const hw = base.w / 2;
    const hd = base.d / 2;
    const hk2 = rng.pick(['short', 'medium', 'tall']);
    const h2 = BUILDING.heights[hk2];
    const mt2 = rng.int(Math.min(h2.tierMin, args.tiers), Math.min(h2.tierMax, args.tiers));

    if (args.shape === 'diagA') {
      buildingsList.push({ ...base, w: hw, d: hd, shape: 'full' });
      buildingsList.push({ x: base.x + hw, z: base.z + hd, w: hw, d: hd, maxTier: mt2, size: 'small', height: hk2, blockIndex: 0, shape: 'full', pyramidRoof: false });
    } else {
      buildingsList.push({ x: base.x + hw, z: base.z, w: hw, d: hd, maxTier: base.maxTier, size: 'small', height: base.height, blockIndex: 0, shape: 'full', pyramidRoof: false });
      buildingsList.push({ x: base.x, z: base.z + hd, w: hw, d: hd, maxTier: mt2, size: 'small', height: hk2, blockIndex: 0, shape: 'full', pyramidRoof: false });
    }
    console.log(`Preview building: type=${args.type}, shape=${args.shape}, seed=${args.seed}, tiers=${args.tiers}`);
    for (const b of buildingsList) {
      console.log(`  Part: ${b.w.toFixed(1)} x ${b.d.toFixed(1)} at (${b.x.toFixed(1)}, ${b.z.toFixed(1)}), maxTier: ${b.maxTier}`);
    }
  } else {
    const building = createBuilding(args.type, args.shape, args.tiers, rng);
    if (args.interiorWalls) building.interiorWalls = true;
    buildingsList.push(building);
    console.log(`Preview building: type=${args.type}, shape=${args.shape}, seed=${args.seed}, tiers=${args.tiers}`);
    console.log(`  Size: ${building.w.toFixed(1)} x ${building.d.toFixed(1)}, maxTier: ${building.maxTier}${building.interiorWalls ? ', interior walls' : ''}`);
  }

  // Map dimensions = encompass all buildings + margins
  let maxX = 0, maxZ = 0;
  for (const b of buildingsList) { maxX = Math.max(maxX, b.x + b.w); maxZ = Math.max(maxZ, b.z + b.d); }
  const mapW = maxX + 4;
  const mapD = maxZ + 4;

  const config = {
    seed: args.seed,
    mapWidth: mapW,
    mapDepth: mapD,
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

  // Build pipeline data for single building
  const gridData = {
    blocks: [{ x: 0, z: 0, w: mapW, d: mapD }],
    streets: [],
  };

  const buildingData = {
    ...gridData,
    buildings: buildingsList,
    deletedBuildings: [],
  };

  // Generate floors
  console.log('  Generating floors...');
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

  // Build scene and export
  console.log('  Exporting...');
  const scene = buildScene(coverData, config);

  await mkdir(config.outputDir, { recursive: true });

  const baseName = `preview_${args.type}_${args.shape}_${args.seed}`;
  const fmt = args.format;

  let glbPath, objPath, vertCount;

  if (fmt === 'glb' || fmt === 'both') {
    glbPath = `output/${baseName}.glb`;
    await exportToGlb(scene, glbPath);
  }

  if (fmt === 'obj' || fmt === 'both') {
    objPath = await exportToObj(coverData, config, config.outputDir, baseName);
    const { readFileSync } = await import('fs');
    const objContent = readFileSync(objPath, 'utf8');
    vertCount = (objContent.match(/^v /gm) || []).length;
  }

  console.log(`\nDone!`);
  if (glbPath) console.log(`  GLB: ${glbPath}`);
  if (objPath) console.log(`  OBJ: ${objPath}`);
  if (vertCount) console.log(`  Vertices: ${vertCount}`);
}

main().catch(console.error);
