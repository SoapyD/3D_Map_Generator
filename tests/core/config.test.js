import { describe, it, expect } from 'vitest';
import { parseArgs, DEFAULTS, GLOBAL_GRID, WALL, FLOOR, CONNECTIVITY, STREETS, GRID, GEOMETRY, LADDERS } from '../../src/config.js';

describe('parseArgs', () => {
  it('returns default config with no args', () => {
    const config = parseArgs(['node', 'index.js']);
    expect(config.mapWidth).toBe(48);
    expect(config.mapDepth).toBe(48);
    expect(config.tiers).toBe(4);
    expect(config.tierHeight).toBe(3);
    expect(config.slabThickness).toBe(1);
    expect(config.damageLevel).toBe(0.5);
    expect(config.streetWidth).toBe(GLOBAL_GRID.streetWidth);
    expect(config.preview).toBe(false);
    expect(config.debug).toBe(false);
    expect(config.obj).toBeUndefined();
  });

  it('parses --seed', () => {
    const config = parseArgs(['node', 'index.js', '--seed', '42']);
    expect(config.seed).toBe(42);
  });

  it('parses --tiers', () => {
    const config = parseArgs(['node', 'index.js', '--tiers', '6']);
    expect(config.tiers).toBe(6);
  });

  it('parses --size WxD', () => {
    const config = parseArgs(['node', 'index.js', '--size', '24x36']);
    expect(config.mapWidth).toBe(24);
    expect(config.mapDepth).toBe(36);
  });

  it('parses --size with single number (square map)', () => {
    const config = parseArgs(['node', 'index.js', '--size', '30']);
    expect(config.mapWidth).toBe(30);
    expect(config.mapDepth).toBe(30);
  });

  it('parses --preview flag', () => {
    const config = parseArgs(['node', 'index.js', '--preview']);
    expect(config.preview).toBe(true);
  });

  it('parses --debug flag', () => {
    const config = parseArgs(['node', 'index.js', '--debug']);
    expect(config.debug).toBe(true);
  });

  it('parses --tier-height with kebab-case', () => {
    const config = parseArgs(['node', 'index.js', '--tier-height', '5']);
    expect(config.tierHeight).toBe(5);
  });

  it('parses multiple args together', () => {
    const config = parseArgs(['node', 'index.js', '--seed', '99', '--tiers', '3', '--size', '36x36', '--preview']);
    expect(config.seed).toBe(99);
    expect(config.tiers).toBe(3);
    expect(config.mapWidth).toBe(36);
    expect(config.mapDepth).toBe(36);
    expect(config.preview).toBe(true);
  });

  it('parses --damage-level', () => {
    const config = parseArgs(['node', 'index.js', '--damage-level', '0.8']);
    expect(config.damageLevel).toBe(0.8);
  });

  it('parses string values for textureSet', () => {
    const config = parseArgs(['node', 'index.js', '--texture-set', 'dark']);
    expect(config.textureSet).toBe('dark');
  });

  it('ignores unknown --key value args', () => {
    const config = parseArgs(['node', 'index.js', '--unknown-key', 'foo']);
    expect(config).not.toHaveProperty('unknownKey');
    // Other defaults should still be intact
    expect(config.mapWidth).toBe(48);
  });

  it('ignores a trailing -- flag with no value left in argv', () => {
    const config = parseArgs(['node', 'index.js', '--seed']);
    // --seed has no following value, so it falls into the startsWith('--') branch
    // but i+1 < argv.length is false, so it is skipped
    expect(config.seed).toEqual(expect.any(Number));
  });
});

describe('exported config constants', () => {
  it('DEFAULTS.seed is a finite integer (time-derived)', () => {
    expect(Number.isInteger(DEFAULTS.seed)).toBe(true);
  });

  it('GLOBAL_GRID street width is exactly one BBD', () => {
    expect(GLOBAL_GRID.streetWidth).toBe(GLOBAL_GRID.bbd);
  });

  it('GRID minBlockSize is two BBD', () => {
    expect(GRID.minBlockSize).toBe(2 * GLOBAL_GRID.bbd);
  });

  it('WALL removal ratios are within (0, 1] and min <= max', () => {
    for (const row of [0, 1, 2]) {
      const max = WALL[`externalRow${row}RemovalRatio`];
      const min = WALL[`externalRow${row}RemovalMin`];
      expect(max).toBeGreaterThan(0);
      expect(max).toBeLessThanOrEqual(1);
      expect(min).toBeGreaterThanOrEqual(0);
      expect(min).toBeLessThanOrEqual(max);
    }
    expect(WALL.blobMin).toBeLessThanOrEqual(WALL.blobMax);
  });

  it('FLOOR escalation chances are probabilities', () => {
    for (const key of ['tier1EscalateChance', 'tier2EscalateChance', 'tier3EscalateChance']) {
      expect(FLOOR[key]).toBeGreaterThan(0);
      expect(FLOOR[key]).toBeLessThanOrEqual(1);
    }
  });

  it('CONNECTIVITY bridge variant chances each sum to 100', () => {
    const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
    expect(sum(CONNECTIVITY.bridgeVariants)).toBe(100);
    expect(sum(CONNECTIVITY.bridgeVariantsLong)).toBe(100);
  });

  it('STREETS riverWeights sum to 1', () => {
    const total = STREETS.riverWeights.reduce((s, r) => s + r.p, 0);
    expect(total).toBeCloseTo(1);
  });

  it('LADDERS fullHeightCullChance is a probability', () => {
    expect(LADDERS.fullHeightCullChance).toBeGreaterThanOrEqual(0);
    expect(LADDERS.fullHeightCullChance).toBeLessThanOrEqual(1);
  });

  it('GEOMETRY thicknesses are positive', () => {
    for (const key of ['walkwayThickness', 'riverThickness', 'streetThickness', 'pavementThickness']) {
      expect(GEOMETRY[key]).toBeGreaterThan(0);
    }
  });
});
