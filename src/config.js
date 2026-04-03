/**
 * Centralised configuration — all tuneable parameters in one place.
 */

// --- CLI defaults ---
const DEFAULTS = {
  seed: Math.floor(Math.random() * 100000),
  mapWidth: 48,       // inches
  mapDepth: 48,       // inches
  tiers: 4,           // number of elevated tiers (+ base tier 0)
  tierHeight: 3,      // vertical spacing between tiers (inches)
  slabThickness: 0.5, // thickness of floor slabs (inches)
  wallThickness: 0.25,// thickness of wall slabs (inches)
  streetWidth: 3.5,   // minimum street width (inches)
  damageLevel: 0.5,   // 0-1, how ruined the buildings are
  maxSightline: 24,   // max unbroken line of sight (inches)
  textureSet: 'base',
  preview: false,
  debug: false,
  obj: false,
  outputDir: 'output',
};

// --- Buildings ---
export const BUILDING = {
  footprints: {
    small:  { min: 4, max: 7 },
    medium: { min: 7, max: 12 },
    large:  { min: 11, max: 18 },
  },
  heights: {
    short:  { tierMin: 2, tierMax: 2 },
    medium: { tierMin: 2, tierMax: 3 },
    tall:   { tierMin: 3, tierMax: 4 },
  },
  tower: { min: 2, max: 3 }, // tower footprint range
  gap: 0.5,                // minimum gap between buildings (inches)
  cellSizeMultiplier: 1.5,// grid cell = avg small footprint × this
  deleteRatio: 0.20,       // fraction of small buildings randomly deleted
  towerChance: 0.3,        // chance of a tower replacing a small building in placement
  maxTowers: 2,            // maximum towers per map
  pyramidRoofChance: 0.5,  // chance a tower gets a pyramid roof
  // Building shapes by size category
  // Small shapes: used for small buildings (single cell or quadrant-based)
  smallShapes: {
    full:     { removed: [], weight: 0.4 },       // all 4 quadrants present (rectangle)
    corner0:  { removed: [3], weight: 0.075 },    // missing SE
    corner1:  { removed: [2], weight: 0.075 },    // missing SW
    corner2:  { removed: [1], weight: 0.075 },    // missing NE
    corner3:  { removed: [0], weight: 0.075 },    // missing NW
    diagA:    { removed: [1, 2], weight: 0.05 },  // missing NE + SW (diagonal)
    diagB:    { removed: [0, 3], weight: 0.05 },  // missing NW + SE (diagonal)
    uSmallN:  { weight: 0.02 },   // small U, gap at middle-right (tower-sized cells)
    uSmallS:  { weight: 0.02 },   // small U, gap at middle-left
    uSmallE:  { weight: 0.02 },   // small U, gap at bottom-middle (rotated)
    uSmallW:  { weight: 0.02 },   // small U, gap at top-middle (rotated)
  },
  // Medium shapes: used for medium buildings (multi-segment composites)
  mediumShapes: {
    full:      { weight: 0.4 },    // standard rectangle
    lShapeSW:  { weight: 0.075 },  // L-shape, elbow at SW
    lShapeSE:  { weight: 0.075 },  // L-shape, elbow at SE
    lShapeNW:  { weight: 0.075 },  // L-shape, elbow at NW
    lShapeNE:  { weight: 0.075 },  // L-shape, elbow at NE
    uNarrowN:  { weight: 0.05 },   // narrow U, indent top-right
    uNarrowS:  { weight: 0.05 },   // narrow U, indent bottom-right
    uNarrowE:  { weight: 0.05 },   // narrow U, indent right-middle (rotated)
    uNarrowW:  { weight: 0.05 },   // narrow U, indent left-middle (rotated)
  },
  // Large shapes: used for large buildings (wide composites)
  largeShapes: {
    full:     { weight: 0.5 },     // standard rectangle
    uShapeN:  { weight: 0.125 },   // wide U, open top
    uShapeS:  { weight: 0.125 },   // wide U, open bottom
    uShapeE:  { weight: 0.125 },   // wide U, open right
    uShapeW:  { weight: 0.125 },   // wide U, open left
  },
};

// --- Walls ---
export const WALL = {
  quadSize: 1.5,           // inches per wall quadrant column
  externalUpperRemovalRatio: 0.7,  // max fraction of upper row removed (external)
  externalLowerRemovalRatio: 0.5,  // max fraction of lower row removed (external)
  internalUpperRemovalRatio: 0.6,  // max fraction of upper row removed (internal)
  internalLowerRemovalRatio: 0.3, // max fraction of lower row removed (internal)
  // Interior walls (medium/large buildings, mid-floors)
  interiorWallChance: { medium: 0.75, large: 1.0 }, // chance per eligible floor
  interiorWallVariants: {
    centreNS:  { weight: 0.175 }, // wall from north edge midpoint toward centre
    centreEW:  { weight: 0.175 }, // wall from west edge midpoint toward centre
    centreSN:  { weight: 0.175 }, // wall from south edge midpoint toward centre
    centreWE:  { weight: 0.175 }, // wall from east edge midpoint toward centre
    cross:     { weight: 0.3 },   // cross shape in centre
  },
};

// --- Floors ---
export const FLOOR = {
  minWalkable: 2,          // minimum walkable area dimension (inches)
  maxTier0Floors: 2,       // max floors at removal tier 0 (fully intact)
  tier1EscalateChance: 0.5,
  tier2EscalateChance: 0.6,
  tier3EscalateChance: 0.5,
};

// --- Connectivity ---
export const CONNECTIVITY = {
  walkwayWidth: 2.0,       // inches
  walkwayThickness: 0.3,   // inches
  // Bridges — upgraded walkways at tier 2+
  bridgeChance: 0.4,       // chance a tier 2+ walkway becomes a bridge
  bridgeWidth: 3.0,        // inches (wider than walkway)
  bridgeThickness: 0.5,    // inches (thicker than walkway)
  bridgeWallHeight: 0.75,  // low wall height on both sides
  bridgeWallThickness: 0.25,
  bridgeBattlementHeight: 1.5, // tall section height for battlement variant
  bridgeBattlementSpacing: 2.25, // spacing between tall sections
  bridgeBattlementGap: 1.5,    // gap width between tall sections
  bridgeVariants: {
    low:        { weight: 0.5 },  // continuous low walls
    battlement: { weight: 0.5 },  // low walls + spaced tall sections
  },
  ladderWidth: 1.0,        // inches (half walkway width)
  ladderDepth: 0.5,        // inches
  ladderWallOffset: 0.3,   // offset from wall to prevent clashing
  maxWalkwayLength: 24,    // inches (half map width)
  minWalkwayLength: 3,     // inches
  // Forced connections (gap detection)
  forcedMinGap: 6,         // minimum gap size in inches to force a connection
  forcedMaxCount: [3, 6],   // [min, max] longest forced connections kept per map
  forcedDiagTolerance: 4,  // max offset in cells to still connect diagonally
  // Branching walkways (T-junctions off forced connections)
  branchMaxPerMap: 2,       // max branch walkways per map
  branchMinLength: 3,       // min branch length in inches
  branchMaxLength: 14,      // max branch length in inches
  walkwayKeepRatio: 0.6,   // fraction of walkways kept per tier
  ladderCullRatio: 0.6,    // fraction of red/orange ladders kept
  proximity: 3,            // minimum distance between same-type connectors
  mapBoundaryMargin: 2,    // keep ladders away from map edge (inches)
  // Orange ladder spawn chances per tier
  orangeSpawnChance: { ground: 0.10, tier1: 0.20, tier2Plus: 0.30 },
  orangeMinSpan: 2,        // minimum tiers an orange ladder must span
  // Ground ladder wall check margin
  wallCheckMargin: 0.3,
  // Cyan (interior) ladder cull ratio
  cyanLadderCullRatio: 0.4,
  // Distance for ladder-top near walkway check
  ladderTopWalkwayDist: 2,
  // Pillar supports for long walkways/bridges
  pillarWidth: 0.5,          // pillar cross-section (inches)
  pillarSpacing: 6,          // max distance between pillars along walkway
  pillarEdgeInset: 1.0,      // inset from walkway ends to first pillar
  pillarMinWalkwayLength: 8, // min walkway length to get pillars
  pillarMinHeight: 1.0,      // don't generate pillars shorter than this
};

// --- Cover ---
export const COVER = {
  thin: 1.5,               // standard cover dimension (inches)
  types: [
    { height: 0.75, chance: 0.75 }, // low rubble/debris
    { height: 1.5, chance: 0.25 },  // low wall
  ],
  rooftopChance: 0.5,      // chance per rooftop quadrant
  placementPadding: 0.25,  // edge inset for placing cover within quadrants (inches)
  groundCoverY: 0.65,      // Y position for ground-level cover (on top of courtyard slab)
  courtyardExpansion: 0.75, // how far courtyards extend beyond deleted footprint per side (inches)
  // Interior cover
  interiorMaxMedium: 1,    // max objects per mid-floor for medium buildings
  interiorMaxLarge: 3,     // max objects per mid-floor for large buildings
  interiorShortChance: 0.75, // chance of 0.75" height vs 1.5" for interior cover
  // Street scatter
  streetScatterTarget: 20, // target number of street scatter objects
  streetScatterAttempts: 200, // max placement attempts for street scatter
};

// --- Grid ---
export const GRID = {
  minBlockSize: 10,        // minimum block dimension in inches
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

// --- Deletion Toggles ---
// Set any to false to disable that deletion rule (useful for debugging)
export const DELETIONS = {
  // Buildings
  buildingRandomCull: true,        // delete 15% of small buildings randomly
  buildingDisplaceByLarge: true,   // delete small buildings overlapping large ones
  courtyardWallCull: true,          // remove courtyards that intersect visible walls

  // Walkways
  walkwayWallCollision: true,      // drop walkways that hit walls on their tier
  walkwayBothEndsCheck: true,      // drop walkways where one end has no floor
  walkwayIntersectionStrip: true,  // drop walkways that overlap other walkways
  walkwayKeepRatioCull: true,      // cull walkways to keepRatio per tier
  walkwayProximityCull: true,      // drop walkways too close to other walkways

  // Yellow ladders (walkway-wall ladders)
  yellowLadderProximityCull: true, // drop yellow ladders too close to red/orange

  // Red ladders (ground)
  redLadderWalkwayOverlap: true,   // drop red ladders touching walkways
  redLadderCull: true,             // cull red ladders to ladderCullRatio
  redLadderProximityCull: true,    // drop red ladders too close to red/orange

  // Orange ladders (free-standing)
  orangeLadderWalkwayOverlap: true,// drop orange ladders touching walkways
  orangeLadderRedOverlap: true,    // drop orange ladders touching red ladders
  orangeLadderCull: true,          // cull orange ladders to ladderCullRatio
  orangeLadderProximityCull: true, // drop orange ladders too close to other orange

  // Cyan ladders (interior)
  cyanLadderCull: true,            // cull cyan ladders to cyanLadderCullRatio
  cyanLadderProximityCull: true,   // drop cyan ladders too close to other cyan
  cyanLadderOrangeOverlap: true,   // drop cyan ladders touching orange ladders
  cyanLadderTopNearWalkway: true,  // drop cyan ladders whose top is near a walkway
  orangeLadderTopNearWalkway: true,// drop orange ladders whose top is near a walkway

  // Pillars
  pillarGeneration: true,          // generate support pillars under walkways/bridges
};

// --- CLI parser ---
export function parseArgs(argv) {
  const config = { ...DEFAULTS };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--preview') {
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
