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
  gap: 0.5,                // minimum gap between buildings (inches)
  cellSizeMultiplier: 1.5,// grid cell = avg small footprint × this
  deleteRatio: 0.15,       // fraction of small buildings randomly deleted
};

// --- Walls ---
export const WALL = {
  quadSize: 1.5,           // inches per wall quadrant column
  upperRemovalRatio: 0.7,  // max fraction of upper row removed
  lowerRemovalRatio: 0.5,  // max fraction of lower row removed
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
  ladderWidth: 1.0,        // inches (half walkway width)
  ladderDepth: 0.5,        // inches
  ladderWallOffset: 0.3,   // offset from wall to prevent clashing
  maxWalkwayLength: 15,    // inches
  minWalkwayLength: 3,     // inches
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
};

// --- Cover ---
export const COVER = {
  thin: 1.5,               // standard cover dimension (inches)
  types: [
    { height: 1.5, chance: 0.8 },  // low wall
    { height: 3.0, chance: 0.1 },  // pillar
    { height: 6.0, chance: 0.1 },  // tall pillar
  ],
  maxTall: 3,              // max tall objects total
  rooftopChance: 0.5,      // chance per rooftop quadrant
  maxHeightUnderBuilding: 3.0, // cap for cover under big buildings
  // Interior cover
  interiorMaxMedium: 1,    // max objects per mid-floor for medium buildings
  interiorMaxLarge: 3,     // max objects per mid-floor for large buildings
};

// --- Geometry ---
export const GEOMETRY = {
  tileSize: 3,             // inches per texture repeat
};

// --- Deletion Toggles ---
// Set any to false to disable that deletion rule (useful for debugging)
export const DELETIONS = {
  // Buildings
  buildingRandomCull: true,        // delete 15% of small buildings randomly
  buildingDisplaceByLarge: true,   // delete small buildings overlapping large ones

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
