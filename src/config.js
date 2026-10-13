/**
 * Centralised configuration — all tuneable parameters in one place.
 */

import { profileDefaults } from './profiles/profile-defaults.js';

// --- Global grid ---
export const GLOBAL_GRID = {
  bbd: 4,         // Base Building Dimension in inches (2x2 footprint + 1 skirt each side)
  cellSize: 1,    // collision matrix cell size in inches
  streetWidth: 4, // exactly 1 BBD — hardcoded for alignment
};

// --- CLI defaults ---
export const DEFAULTS = {
  seed: Date.now() % 100000, // time-derived when --seed is omitted; keeps Math.random() out of the codebase
  mapWidth: 48,       // inches
  mapDepth: 48,       // inches
  tiers: 4,           // number of elevated tiers (+ base tier 0)
  tierHeight: 3,      // floor-surface to floor-surface pitch per tier (inches); clear headroom = tierHeight - FLOOR_SLAB.thickness
  slabThickness: 1,   // collision-matrix cell reserved for a slab (inches) — NOT the rendered slab thickness (see FLOOR_SLAB)
  // wallThickness: 0.25,  // _old_system: wall slab thickness
  streetWidth: GLOBAL_GRID.streetWidth, // derived from GLOBAL_GRID — do not change independently
  damageLevel: 0.5,   // ruin level 0–1, controls floor quadrant removal escalation
  // maxSightline: 24,     // _old_system: max unbroken line of sight (inches)
  filterStrategy: 'longestAndShortest', // one of: longestAndShortest, longest, shortest, random
  filterN: 2,             // max connections kept per building per tier (each end for longestAndShortest)
  textureSet: 'base',
  flatLadders: true,  // true = flat front-facing quads, false = 3D boxes (single source of truth)
  preview: false,
  previewMap: null,   // --preview-map FIXTURE: textured preview of a frozen withering-map fixture (skips generation)
  visualize: false,
  debug: false,
  debugConnectivity: false, // --debug-connectivity: write connectivity debug JSON
  debugMatrix: false,       // --debug-matrix: serialise collision-matrix write history
  obj: false,         // --obj: also write the legacy OBJ + atlas PNG + collision OBJ (DEPRECATED, kept for consumers pinned to v0.2.0)
  splitTiers: false,  // --split-tiers: DEPRECATED per-tier OBJ + collider + manifest (legacy TTS elevator/reveal, v0.2.0 consumers)
  outputDir: 'output',
  allRivers: false,   // treat every street corridor as a river
  profile: null,      // --profile NAME: swap in a named config profile (see src/profiles/)
};

// --- Buildings --- (_old_system only)
// export const BUILDING = { ... };  // see _old_system/config.js

// --- Loaded-map texture preview (--preview-map) ---
export const LOADED_MAP = {
  port: 3010,
  textureSets: ['base', 'loaded'],
  fixtureFormats: ['withering-map/1', 'withering-map/2'],
  legacyLevelHeight: 4,        // /1 fixtures record no pitch (mirrors Withering LEGACY_LEVEL_HEIGHT)
  legacyFloorThickness: 1,     // /1 fixtures record no slab thickness (mirrors Withering LEGACY_FLOOR_THICKNESS)
  maxUploadBytes: 64 * 1024 * 1024,
  fallbackColor: '#ff00ff',    // page recolour for meshes whose texture fell back
  camera: {
    moveSpeed: 20,             // WASD/QE fly speed, inches per second
    fastMultiplier: 3,         // held Shift
  },
};

// --- Unified preview server (--preview, alias --visualize, and --preview-map) ---
export const PREVIEW = {
  port: LOADED_MAP.port,
  defaultMode: 'run',
  // 'run' = generated map (--preview / --visualize, frames always recorded); 'preview-map' = fixture only, no generation.
  modes: { run: 'run', previewMap: 'preview-map' },
  // Tab order; `needs` is what must exist for the tab to be enabled ('run' = generated map with recorded frames).
  // viewer.html stays routable at /model.html but is not a tab.
  tabs: [
    { id: 'loaded-map', label: 'Loaded map', path: '/loaded-map.html', needs: null, disabledReason: '' },
    { id: 'visualizer', label: 'Visualizer', path: '/visualizer.html', needs: 'run', disabledReason: 'Needs a generated map: run with --preview instead of --preview-map.' },
  ],
  initialTab: { run: 'loaded-map', 'preview-map': 'loaded-map' },
  storageKey: 'previewTab',
  noRunMessage: 'No generated run in this mode (started with --preview-map). Run with --preview.',
  noVisualizeMessage: 'Visualizer frames unavailable (no generated run). Start with --preview.',
  noFixtureMessage: 'Load a fixture with --preview-map or the file picker.',
};

// --- Walls ---
export const WALL = {
  wallThickness: 0.25,
  applySegmentCull: true,   // cull walls to at most 2 sides per building per floor
  applyWindows: true,        // cut window openings in wall segments
  applyBlobDamage: true,     // apply random blob damage to wall segments
  applyDoorCuts: true,       // skip cells marked CELL.DOOR during wall matrix writes
  quadSize: 1.5,                    // inches per damage column (Phase 2)
  externalRow2RemovalRatio: 0.4,    // Phase 2: max fraction of row 2 (top) removed on exterior walls
  externalRow2RemovalMin: 0.2,      // Phase 2: min fraction of row 2 removed on exterior walls
  externalRow1RemovalRatio: 0.3,    // Phase 2: max fraction of row 1 (mid) removed — cascades from row 2
  externalRow1RemovalMin: 0.1,      // Phase 2: min fraction of row 1 removed
  externalRow0RemovalRatio: 0.15,   // Phase 2: max fraction of row 0 (base) removed — cascades from row 1
  externalRow0RemovalMin: 0.0,      // Phase 2: min fraction of row 0 removed
  internalRow2RemovalRatio: 0.4,    // Phase 2: interior wall ratios
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

// --- Floor / roof slabs ---
// Each tier's floor is the very top of the tier below: the slab is rendered flush with the top of
// its 1" matrix cell (DEFAULTS.slabThickness) and is only this thick. Matches the wall thickness so
// a tier costs tierHeight of vertical space, not tierHeight + a full cell. See src/core/levels.js.
export const FLOOR_SLAB = {
  thickness: WALL.wallThickness,
  // Split-tier banding looks this far above a primitive's base Y when choosing its tier, so connectors
  // whose slab hangs below the floor surface (bridge decks are 0.5" thick) stay on the tier they serve.
  // Must be >= the thickest connector slab and < 1 (the next wall row up must not band to the tier above).
  bandLookahead: 0.5,
};

// --- Connectivity ---
export const CONNECTIVITY = {
  bridgeMinLength:     6,  // min connection length (cells) eligible to become a bridge
  bridgeLongThreshold: 12, // connections this length or longer use long-bridge chances
  // Max connection length as a fraction of the map's longer side (0.5 = half, 1 = the full map).
  // Applies to ordinary connections; river crossings use riverCrossingMaxLength.
  maxLengthMapFraction: 0.5,
  pillarMinLength:   8,    // min connection length (cells) to receive support pillars
  pillarSpacing:     6,    // cells between pillar pairs along travel axis
  pillarEdgeInset:   1,    // cells inset from each end before placing first pair
  pillarWidth:       0.25, // pillar footprint in inches
  // Direct percentage chances — must sum to 100
  bridgeVariants: {
    walkway:     60,
    low:         40,
    battlement:   0,
  },
  bridgeVariantsLong: {
    walkway:     10,
    low:         30,
    battlement:  60,
  },
  riverCrossingPeriod:     2,     // anchor spacing along bank edge (cells)
  riverCrossingMaxLength:  5,     // max ray-cast length for river crossing candidates
  riverCrossingSpacing:    3,     // min cells between a river crossing and any same-axis connection
  bridgeThickness:         FLOOR_SLAB.thickness, // deck thickness = floor slab thickness; top face flush with cell top
  bridgeWallHeight:        1,     // base wall height (inches, = 1 cell)
  bridgeWallThickness:     0.25,
  bridgeBattlementPeriod:  3,     // every N units a tall post appears
  bridgeBattlementTallH:   2,     // height of tall post (inches)
};

// --- Streets / Rivers ---
export const STREETS = {
  riverDepth: 3,   // cells below Y=0 occupied by river volume (must be <= BELOW_GROUND)
  // Weighted river mode selection — probabilities must sum to 1.
  // Override with --all-rivers flag to force all-rivers mode.
  riverWeights: [
    { mode: 'none', p: 0.600 },
    { mode: 'one',  p: 0.200 },
    { mode: 'two',  p: 0.125 },
    { mode: 'all',  p: 0.075 },
  ],
};

// --- Cover --- (_old_system only)
// export const COVER = { ... };  // see _old_system/config.js

// --- Buildings (treemap placement) ---
export const BUILDINGS = {
  largeChance:            0.4, // chance per block to attempt each of largeA and largeB
  mediumChance:           0.5, // chance per medium attempt
  mediumCellDivisor:      4,   // medium attempts per block = floor(bbdW * bbdD / this)
  ruinsHorizontalChance:  0.5, // ruins-medium: chance of trying -h before -v
  centerOutPatternChance: 0.5, // chance a block uses the centre-out spawn pattern (else top-left)
  // 'fill' packs every block with as many buildings as fit; 'single' places exactly one per block.
  mode: 'fill',
  singleSizes: ['small', 'medium', 'largeA', 'largeB'], // 'single' mode: sizes tried until one fits
  // 'single' mode try-order: 'random' shuffles singleSizes; 'largestFirst' tries the biggest footprint first
  // (ties broken randomly), so a small ruin is only used where nothing bigger fits.
  singleOrder: 'random',
  // Blocks left without any building. Count is rng.int(min, max), capped so at least one block is built.
  // { min: 0, max: 0 } disables this (and consumes no RNG, so default maps are unchanged).
  emptyBlocks: { min: 0, max: 0 },
};

// --- Cover ---
export const COVER = {
  // Chance that each group of that kind receives cover at all (1 = always, 0 = none).
  // At 1 no RNG is consumed, so default maps are unchanged.
  shellChance:  1, // interior floors of buildings
  roofChance:   1, // rooftops
  streetChance: 1, // street corridors
};

// --- Grid ---
export const GRID = {
  minBlockSize: 8,         // minimum block dimension in inches (2 × BBD)
  // Block layout strategy: 'random' picks one per map (50/50); 'centerFirst' always puts a block at the
  // centre and splits around it (reliably 4+ blocks even on small maps); 'bspTopLeft' splits from a corner.
  strategy: 'random',
};

// --- Deprecation notices (legacy TTS / OBJ paths, see docs/plans/CONVENTIONS_ALIGNMENT_PLAN_2026_10_13.md) ---
export const DEPRECATION = {
  planDoc: 'docs/plans/CONVENTIONS_ALIGNMENT_PLAN_2026_10_13.md',
  message: 'deprecated, kept only for consumers pinned to older versions (v0.2.0). Tabletop Simulator is no longer a target; use generateToBuffer (GLB) and the primitives + collision matrix.',
};

// --- Geometry ---
export const GEOMETRY = {
  glbTileSize: 3,            // GLB only: inches per texture repeat
  objAtlasTileSize: 256,     // OBJ atlas (legacy, deprecated OBJ export): pixels per tile
  objSegmentPixelSize: 128,  // OBJ atlas: pixels per 3" segment (256 = full tile, 128 = 2/tile, 64 = 4/tile)
  objAtlasPadding: 4,        // pixels of padding around each atlas tile
  // GLB texture offset, one per texture key (not per box, so adjacent boxes stay seamless): the key's
  // string hash (multiplier hashBase) scaled by scaleU / scaleV, fractional part.
  uvKeyOffset: { hashBase: 31, scaleU: 0.7123, scaleV: 0.5431 },
  // OBJ only: UV hash constants for the per-object tiling offset
  uvHashU: [0.7123, 0.3917],     // multipliers for U offset: x * [0] + z * [1]
  uvHashV: [0.5431, 0.9281, 0.1637], // multipliers for V offset: x * [0] + z * [1] + y * [2]
  // Primitive merge pass (end of buildGeometry): joins adjacent same-texture boxes into one (was for the old OBJ vertex cap; off by default).
  // A merged primitive keeps its first constituent's box as `uvOrigin` (read by the OBJ exporter only; the GLB uses world-space UVs).
  primitiveMerge: {
    enabled: false,                         // off: after the greedy rect cover (walls/pavements/floors) it removes 0% of primitives; kept for A/B tests
    types: ['wall', 'pavement', 'floor'],   // merge groups: wall_N, pavement_N, floor_fN_x_z slabs
    epsilon: 0.0001,                        // inches; edge-touch / equality tolerance
  },
  // OBJ ladder mesh dimensions
  ladderPoleWidth: 0.24,
  ladderPoleDepth: 0.24,
  ladderRungHeight: 0.18,
  ladderRungDepth: 0.18,
  ladderRungSpacing: 0.75,
  ladderRungInset: 0.05,
  // Courtyard slab
  courtyardY: 0.55,          // Y position of courtyard slab
  courtyardThickness: 0.1,   // thickness of courtyard slab
  // Platform
  platformSize: 2,           // ladder platform width/depth (inches)
  platformThickness: 0.2,    // ladder platform thickness (inches)
  walkwayThickness: 0.25,    // walkway slab thickness (inches)
  riverThickness:    0.25,   // river bed slab thickness
  riverBankThickness: 0.25,  // bank wall thickness
  streetThickness:   0.25,   // street surface slab thickness
  pavementThickness: 0.25,   // pavement slab thickness
  // Raised perimeter border wall (parapet), stacked on the outer retaining rim
  mapBorderHeight:    2,      // parapet height above ground, inches
  mapBorderThickness: 1,      // parapet wall thickness, inches (matches retaining rim)
  mapBorderInset:     0,      // cells the parapet is set inward from the map edge (0 = on the outermost cell); cuts roads before they run off the map
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

// --- Ladders ---
export const LADDERS = {
  mapEdgeClearance:     3,    // units from map edge — no ladders within this distance
  connectionClearance:  2,    // units (Chebyshev) from any WALKWAY/DOOR cell
  buildingClearance:    4,    // units from another building's SHELL cells along facing ray
  pathSpacing:          6,    // min world distance between ladders from different paths
  maxSideCount:         2,    // max ladders per facing direction per building
  fullHeightCullChance: 0.30, // chance to randomly trim a full-height ladder
  thickness:            0.25, // ladder strip thickness (inches), flush against the wall face
  pathMinSpacing:       3,    // min distance between ladders of extra paths on one building
  ruinsSmallChance:     0.4,  // chance a ruins-small building gets any ladders at all
  // Max ladder paths per building size (default 1 for unlisted sizes)
  pathQuota: {
    'ruins-small': 1, small: 1,
    medium: 2, 'ruins-medium-h': 2, 'ruins-medium-v': 2,
    largeA: 3, largeB: 3,
  },
};

// --- Deletion Toggles --- (_old_system only)
// export const DELETIONS = { ... };  // see _old_system/config.js

// --- CLI parser ---
export function parseArgs(argv) {
  // --profile is read first so its defaults form the base; explicit flags below still win.
  const profileIdx = argv.indexOf('--profile');
  const profileName = profileIdx >= 0 ? argv[profileIdx + 1] : null;
  const config = { ...DEFAULTS, ...profileDefaults(profileName) };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    // --preview implies frame recording (Visualizer tab); --visualize is an alias.
    if (arg === '--preview' || arg === '--visualize') {
      config.preview = true;
      config.visualize = true;
      continue;
    }

    if (arg === '--textures') {
      config.textureSet = argv[++i] ?? config.textureSet;
      continue;
    }

    if (arg === '--debug') {
      config.debug = true;
      continue;
    }

    if (arg === '--debug-connectivity') {
      config.debugConnectivity = true;
      continue;
    }

    if (arg === '--debug-matrix') {
      config.debugMatrix = true;
      continue;
    }

    if (arg === '--obj') { // legacy OBJ + atlas + collision OBJ, deprecated; off by default
      config.obj = true;
      continue;
    }

    if (arg === '--split-tiers') { // deprecated: warns once when used (see src/index.js)
      config.splitTiers = true;
      continue;
    }

    if (arg === '--all-rivers') {
      config.allRivers = true;
      continue;
    }

    if (arg === '--3d-ladders') {
      config.flatLadders = false;
      continue;
    }

    if (arg === '--flat-ladders') {
      config.flatLadders = true;
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
