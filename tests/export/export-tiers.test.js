import { describe, it, expect } from 'vitest';
import { groupPrimitivesByTier } from '../../src/export/export-tiers.js';

const config = { tiers: 4, tierHeight: 3, slabThickness: 1, seed: 1 };

// A small synthetic geometry spanning several tiers + ground + a connector.
const geometry = {
  version: 1,
  primitives: [
    { type: 'slab', name: 'floor_f0_0_0', y: -0.25, h: 0.25 },
    { type: 'edges', name: 'floor_f0_0_0', y: -0.25, h: 0.25 },
    { type: 'slab', name: 'floor_f2_0_0', y: 5.75, h: 0.25 },
    { type: 'wall', name: 'wall_0', y: 0, h: 1 },
    { type: 'wall', name: 'wall_1', y: 6, h: 1 },
    { type: 'slab', name: 'street_0', y: -0.5, h: 0.5 },
    { type: 'slab', name: 'river_bank_0', y: -0.5, h: 1 },
    { type: 'ladder', name: 'ground_ladder_0', y0: 0, y1: 3 },
    { type: 'ladder', name: 'ladder_1', y0: 6, y1: 9 },
    { type: 'slab', name: 'roof_0_0', y: 8.75, h: 0.25 },
  ],
};

describe('groupPrimitivesByTier', () => {
  const groups = groupPrimitivesByTier(geometry, config);

  it('creates a bucket for every tier 0..config.tiers', () => {
    expect([...groups.keys()].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
  });

  it('is a total, disjoint partition (union === whole, no duplicates)', () => {
    const all = [];
    for (const g of groups.values()) all.push(...g.primitives);
    expect(all.length).toBe(geometry.primitives.length);
    // every original primitive appears exactly once
    for (const prim of geometry.primitives) {
      const hits = all.filter(p => p === prim).length;
      expect(hits).toBe(1);
    }
  });

  it('routes primitives to the expected tiers', () => {
    const names = t => groups.get(t).primitives.map(p => p.name).sort();
    // tier 0: floor_f0 (slab+edges), wall_0 (y0→round 0), street, river bank, ground ladder
    expect(names(0)).toEqual(
      ['floor_f0_0_0', 'floor_f0_0_0', 'ground_ladder_0', 'river_bank_0', 'street_0', 'wall_0'],
    );
    expect(names(1)).toEqual([]);
    // tier 2: floor_f2 (name), wall_1 (y=6 → band 2), ladder_1 (y0=6 → floor 2)
    expect(names(2)).toEqual(['floor_f2_0_0', 'ladder_1', 'wall_1']);
    // tier 3: roof slab at y=8.75 → floor((8.75 + 0.25) / 3) = 3
    expect(names(3)).toEqual(['roof_0_0']);
    expect(groups.get(4).primitives).toEqual([]);
  });

  it('preserves geometry.version on each bucket', () => {
    expect(groups.get(0).version).toBe(1);
  });
});
