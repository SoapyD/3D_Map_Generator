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
  tierHeight: 3,      // vertical spacing between tiers (inches)
  slabThickness: 0.5, // thickness of floor slabs (inches)
  // wallThickness: 0.25,  // _old_system: wall slab thickness
  streetWidth: GLOBAL_GRID.streetWidth, // derived from GLOBAL_GRID — do not change independently
  // damageLevel: 0.5,     // _old_system: ruin level 0–1
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

// --- Walls --- (_old_system only)
// export const WALL = { ... };  // see _old_system/config.js

// --- Floors --- (_old_system only)
// export const FLOOR = { ... };  // see _old_system/config.js

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
