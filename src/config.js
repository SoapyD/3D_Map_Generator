/**
 * Centralised configuration — all tuneable parameters in one place.
 */

// --- Global grid ---
export const GLOBAL_GRID = {
  bbd: 4,         // Base Building Dimension in inches (2x2 footprint + 1 skirt each side)
  cellSize: 1,    // collision matrix cell size in inches
  streetWidth: 4, // exactly 1 BBD — hardcoded for alignment
};

// --- CLI defaults ---
export const DEFAULTS = {
  seed: Math.floor(Math.random() * 100000),
  mapWidth: 48,       // inches
  mapDepth: 48,       // inches
  tiers: 4,           // number of elevated tiers (+ base tier 0)
  tierHeight: 3,      // room height per tier (inches)
  slabThickness: 1,   // floor slab thickness (inches)
  // wallThickness: 0.25,  // _old_system: wall slab thickness
  streetWidth: GLOBAL_GRID.streetWidth, // derived from GLOBAL_GRID — do not change independently
  damageLevel: 0.5,   // ruin level 0–1, controls floor quadrant removal escalation
  // maxSightline: 24,     // _old_system: max unbroken line of sight (inches)
  textureSet: 'base',
  preview: false,
  visualize: false,
  debug: false,
  obj: false,
  outputDir: 'output',
};

// --- Buildings --- (_old_system only)
// export const BUILDING = { ... };  // see _old_system/config.js

// --- Walls ---
export const WALL = {
  wallThickness: 0.25,
  applySegmentCull: true,   // cull walls to at most 2 sides per building per floor
  applyWindows: true,        // cut window openings in wall segments
  applyBlobDamage: true,     // apply random blob damage to wall segments              // outer face flush with cell edge, body extends inward
  quadSize: 1.5,                    // inches per damage column (Phase 2)
  externalRow2RemovalRatio: 0.5,    // Phase 2: max fraction of row 2 (top) removed on exterior walls
  externalRow2RemovalMin: 0.2,      // Phase 2: min fraction of row 2 removed on exterior walls
  externalRow1RemovalRatio: 0.3,    // Phase 2: max fraction of row 1 (mid) removed — cascades from row 2
  externalRow1RemovalMin: 0.1,      // Phase 2: min fraction of row 1 removed
  externalRow0RemovalRatio: 0.2,    // Phase 2: max fraction of row 0 (base) removed — cascades from row 1
  externalRow0RemovalMin: 0.0,      // Phase 2: min fraction of row 0 removed
  internalRow2RemovalRatio: 0.6,    // Phase 2: interior wall ratios
  internalRow1RemovalRatio: 0.3,
  internalRow0RemovalRatio: 0.15,
  interiorWallChance: { medium: 0.75, largeA: 1.0, largeB: 1.0 }, // Phase 2
  blobMin: 1,  // minimum cells deleted per blob damage run
  blobMax: 4,  // maximum cells deleted per blob damage run
};

// --- Floors ---
export const FLOOR = {
  maxIntactFloors: 2,        // max consecutive fully-intact floors before escalating removal
  tier1EscalateChance: 0.5,  // chance to remove first quadrant (scaled by damageLevel)
  tier2EscalateChance: 0.6,  // chance to remove second adjacent quadrant
  tier3EscalateChance: 0.5,  // chance to remove third adjacent quadrant
};

// --- Connectivity --- (_old_system only)
// export const CONNECTIVITY = { ... };  // see _old_system/config.js

// --- Cover --- (_old_system only)
// export const COVER = { ... };  // see _old_system/config.js

// --- Grid ---
export const GRID = {
  minBlockSize: 8,         // minimum block dimension in inches (2 × BBD)
};

// --- Geometry ---
export const GEOMETRY = {
  glbTileSize: 3,            // GLB only: inches per texture repeat
  objAtlasTileSize: 256,     // OBJ atlas: pixels per tile
  objSegmentPixelSize: 128,  // OBJ atlas: pixels per 3" segment (256 = full tile, 128 = 2/tile, 64 = 4/tile)
  objAtlasPadding: 4,        // pixels of padding around each atlas tile
  // UV hash constants for per-object tiling offset (shared by GLB + OBJ)
  uvHashU: [0.7123, 0.3917],     // multipliers for U offset: x * [0] + z * [1]
  uvHashV: [0.5431, 0.9281, 0.1637], // multipliers for V offset: x * [0] + z * [1] + y * [2]
  // OBJ ladder mesh dimensions
  ladderPoleWidth: 0.24,
  ladderPoleDepth: 0.24,
  ladderRungHeight: 0.18,
  ladderRungDepth: 0.18,
  ladderRungSpacing: 0.75,
  ladderRungInset: 0.05,
  flatLadders: true,        // true = flat front-facing quads, false = 3D boxes
  // Courtyard slab
  courtyardY: 0.55,          // Y position of courtyard slab
  courtyardThickness: 0.1,   // thickness of courtyard slab
  // Platform
  platformSize: 2,           // ladder platform width/depth (inches)
  platformThickness: 0.2,    // ladder platform thickness (inches)
  walkwayThickness: 0.3,     // walkway slab thickness (inches)
};

// --- Ladder Display ---
export const LADDER_DISPLAY = {
  showBoxLadders: false,     // show the original box ladders (debug)
  showMeshLadders: true,     // show the detailed ladder meshes (poles + rungs)
  poleRadius: 0.1,           // radius of ladder poles (inches)
  rungRadius: 0.08,          // radius of rungs
  rungSpacing: 0.75,         // inches between rungs
  rungInset: 0.1,            // how far rungs sit inside the poles
};

// --- Deletion Toggles --- (_old_system only)
// export const DELETIONS = { ... };  // see _old_system/config.js

// --- CLI parser ---
export function parseArgs(argv) {
  const config = { ...DEFAULTS };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--preview') {
      config.preview = true;
      continue;
    }

    if (arg === '--visualize') {
      config.visualize = true;
      config.preview = true;
      continue;
    }

    if (arg === '--debug') {
      config.debug = true;
      continue;
    }

    if (arg === '--obj') {
      config.obj = true;
      continue;
    }

    if (arg.startsWith('--') && i + 1 < argv.length) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());

      if (key === 'size') {
        const parts = argv[++i].split('x');
        config.mapWidth = parseFloat(parts[0]);
        config.mapDepth = parseFloat(parts[1] || parts[0]);
      } else if (key in config) {
        const val = argv[++i];
        config[key] = typeof DEFAULTS[key] === 'number' ? parseFloat(val) : val;
      }
    }
  }

  return config;
}
