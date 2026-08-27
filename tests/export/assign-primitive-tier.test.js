import { describe, it, expect } from 'vitest';
import { tierOf, tierCount, primBaseY, primTopY } from '../../src/export/assign-primitive-tier.js';

// Defaults: levelHeight = tierHeight + slabThickness = 4. Floor i slab at y = i*4 - 1, walls at y = i*4.
const config = { tiers: 4, tierHeight: 3, slabThickness: 1 };

describe('tierCount', () => {
  it('is config.tiers + 1 (floor indices 0..tiers)', () => {
    expect(tierCount(config)).toBe(5);
    expect(tierCount({ ...config, tiers: 6 })).toBe(7);
  });
});

describe('tierOf — floors (authoritative name parse)', () => {
  it('reads the tier from floor_f{n}_ regardless of Y', () => {
    expect(tierOf({ name: 'floor_f0_10_20', y: -1 }, config)).toBe(0);
    expect(tierOf({ name: 'floor_f3_10_20', y: 999 }, config)).toBe(3);
  });
  it('clamps an out-of-range floor index into [0, tiers]', () => {
    expect(tierOf({ name: 'floor_f9_0_0', y: 0 }, config)).toBe(4);
  });
  it('applies to floor edge primitives too (same name)', () => {
    expect(tierOf({ name: 'floor_f2_5_5', y: 7 }, config)).toBe(2);
  });
});

describe('tierOf — ground-anchored terrain → tier 0', () => {
  it.each([
    'street_0', 'street_scatter_3', 'river_0_1', 'river_bank_2',
    'skirt_N', 'border_S', 'deleted_4', 'pavement_7', 'building_footprint_0',
  ])('%s → 0', (name) => {
    expect(tierOf({ name, y: -0.5 }, config)).toBe(0);
  });
});

describe('tierOf — cross-tier connectors → lower/base tier (floor-band)', () => {
  it('pillar spanning ground→bridge lands on tier 0', () => {
    expect(tierOf({ name: 'pillar_0', y: 0 }, config)).toBe(0);
  });
  it('walkway at a tier-2 floor top bands to 2', () => {
    expect(tierOf({ name: 'walkway_1', y: 8 }, config)).toBe(2);
  });
  it('bridge deck + its wall/battlement sub-meshes share the deck tier', () => {
    expect(tierOf({ name: 'bridge_3', y: 8 }, config)).toBe(2);
    expect(tierOf({ name: 'bridge_3_wallL', y: 8 }, config)).toBe(2);
    expect(tierOf({ name: 'bridge_3_batt0_left', y: 8 }, config)).toBe(2);
  });
  it('matches every ladder name form via the "ladder" substring, using y0 as base', () => {
    expect(tierOf({ name: 'ladder_0', y0: 8, y1: 12 }, config)).toBe(2);
    expect(tierOf({ name: 'ground_ladder_2', y0: 0, y1: 4 }, config)).toBe(0);
    expect(tierOf({ name: 'orange_ladder_1', y0: 4, y1: 8 }, config)).toBe(1);
    expect(tierOf({ name: 'interior_ladder_0', y0: 4, y1: 8 }, config)).toBe(1);
    expect(tierOf({ name: 'ladder_path_1_0_0', y0: 8, y1: 12 }, config)).toBe(2);
    expect(tierOf({ name: 'ladder_platform_0', y: 8 }, config)).toBe(2);
    expect(tierOf({ name: 'junction_platform_0', y: 4 }, config)).toBe(1);
  });
});

describe('tierOf — everything else (walls, roofs, rooftop cover) → round-band', () => {
  it('bands walls by their Y (tier i wall at y = i*4)', () => {
    expect(tierOf({ name: 'wall_0', y: 0 }, config)).toBe(0);
    expect(tierOf({ name: 'wall_5', y: 4 }, config)).toBe(1);
    expect(tierOf({ name: 'wall_9', y: 8 }, config)).toBe(2);
  });
  it('bands roofs by Y', () => {
    expect(tierOf({ name: 'roof_2_0', y: 7 }, config)).toBe(2);
  });
  it('distinguishes interior_cover_ (banded) from interior_ladder_ (connector)', () => {
    // rooftop cover on tier 2 — must NOT be treated as a connector.
    expect(tierOf({ name: 'interior_cover_0', y: 7 }, config)).toBe(2);
  });
  it('clamps extreme Y into [0, tiers]', () => {
    expect(tierOf({ name: 'wall_x', y: 9999 }, config)).toBe(4);
    expect(tierOf({ name: 'wall_x', y: -9999 }, config)).toBe(0);
  });
});

describe('Y helpers', () => {
  it('primBaseY/primTopY read y/h, fall back to y0/y1', () => {
    expect(primBaseY({ y: 5, h: 2 })).toBe(5);
    expect(primTopY({ y: 5, h: 2 })).toBe(7);
    expect(primBaseY({ y0: 8, y1: 12 })).toBe(8);
    expect(primTopY({ y0: 8, y1: 12 })).toBe(12);
    expect(primBaseY({})).toBe(0);
  });
});
