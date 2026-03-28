import { describe, it, expect } from 'vitest';
import { parseArgs, BUILDING, WALL, FLOOR, CONNECTIVITY, COVER, GEOMETRY, LADDER_DISPLAY, DELETIONS } from '../../src/config.js';

describe('parseArgs', () => {
  it('returns default config with no args', () => {
    const config = parseArgs(['node', 'index.js']);
    expect(config.mapWidth).toBe(48);
    expect(config.mapDepth).toBe(48);
    expect(config.tiers).toBe(4);
    expect(config.tierHeight).toBe(3);
    expect(config.slabThickness).toBe(0.5);
    expect(config.wallThickness).toBe(0.25);
    expect(config.preview).toBe(false);
    expect(config.debug).toBe(false);
    expect(config.obj).toBe(false);
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

  it('parses --obj flag', () => {
    const config = parseArgs(['node', 'index.js', '--obj']);
    expect(config.obj).toBe(true);
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
  it('BUILDING has valid footprint ranges', () => {
    expect(BUILDING.footprints.small.min).toBeLessThan(BUILDING.footprints.small.max);
    expect(BUILDING.footprints.medium.min).toBeLessThan(BUILDING.footprints.medium.max);
    expect(BUILDING.footprints.large.min).toBeLessThan(BUILDING.footprints.large.max);
  });

  it('WALL has valid ratios', () => {
    expect(WALL.upperRemovalRatio).toBeGreaterThan(0);
    expect(WALL.upperRemovalRatio).toBeLessThanOrEqual(1);
    expect(WALL.lowerRemovalRatio).toBeGreaterThan(0);
    expect(WALL.lowerRemovalRatio).toBeLessThanOrEqual(1);
  });

  it('COVER types have chances summing to 1', () => {
    const total = COVER.types.reduce((s, t) => s + t.chance, 0);
    expect(total).toBeCloseTo(1);
  });

  it('DELETIONS has boolean values', () => {
    for (const [key, value] of Object.entries(DELETIONS)) {
      expect(typeof value).toBe('boolean');
    }
  });
});
