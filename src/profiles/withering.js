/**
 * Profile: "withering" — small skirmish test ground for The Withering.
 *
 * `defaults` override DEFAULTS; `sections` deep-merge over the generation sections
 * of config.js for the duration of one run. See docs/architecture/profiles.md.
 */
export const WITHERING_PROFILE = {
  name: 'withering',
  defaults: {
    mapWidth: 32, // 24 and 28 also work, but 24 mostly fits only small buildings
    mapDepth: 32,
    tiers: 4, // ground + tier 1 + tier 2 + tier 3 (standing surfaces at 0", 4", 8", 12")
  },
  sections: {
    GRID: {
      strategy: 'bspTopLeft', // centre-first can give a single block on small maps
      minBlockSize: 4,        // 1 cell: many small blocks (the default 8 gives exactly 4 blocks at this size)
    },
    BUILDINGS: {
      mode: 'single',               // one building per block; blocks are split by roads
      singleSizes: ['small', 'medium', 'largeA', 'largeB', 'ruins-small'], // ruins-small fills the 1-cell blocks
      singleOrder: 'largestFirst', // biggest building that fits; ruins only where nothing else does
    },
    CONNECTIVITY: {
      maxLengthMapFraction: 1, // connections may span up to the full map (default 0.5 = half)
    },
    COVER: {
      shellChance: 0.5,
      roofChance: 0.5,
      streetChance: 0.5,
    },
    LADDERS: {
      pathQuota: {
        'ruins-small': 1, small: 1,
        medium: 1, 'ruins-medium-h': 1, 'ruins-medium-v': 1,
        largeA: 1, largeB: 1,
      },
    },
  },
};
