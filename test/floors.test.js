import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { generateGrid } from '../src/generators/grid.js';
import { generateBuildings } from '../src/generators/buildings.js';
import { generateFloors } from '../src/generators/floors.js';

const baseConfig = {
  mapWidth: 48, mapDepth: 48, streetWidth: 3.5,
  tiers: 4, tierHeight: 6, slabThickness: 0.5, damageLevel: 0.5,
};

function getFloors(seed = 42) {
  const rng = createRng(seed);
  const grid = generateGrid(baseConfig, rng);
  const buildings = generateBuildings(grid, baseConfig, rng);
  return generateFloors(buildings, baseConfig, rng);
}

describe('Floor Generator', () => {
  it('produces tiers 0 through N', () => {
    const data = getFloors();
    assert.equal(data.floors.length, baseConfig.tiers + 1);
    for (let i = 0; i <= baseConfig.tiers; i++) {
      assert.equal(data.floors[i].tier, i);
    }
  });

  it('tier 0 is the full map base', () => {
    const data = getFloors();
    const base = data.floors[0];
    assert.equal(base.sections.length, 1);
    assert.equal(base.sections[0].x, 0);
    assert.equal(base.sections[0].z, 0);
    assert.equal(base.sections[0].w, baseConfig.mapWidth);
    assert.equal(base.sections[0].d, baseConfig.mapDepth);
  });

  it('upper tier sections are within building footprints', () => {
    const data = getFloors();
    for (let tier = 1; tier <= baseConfig.tiers; tier++) {
      const floorSections = data.floors[tier].sections;
      for (const section of floorSections) {
        // Each section should be within at least one building
        const inBuilding = data.buildings.some(
          (b) =>
            section.x >= b.x - 0.01 &&
            section.z >= b.z - 0.01 &&
            section.x + section.w <= b.x + b.w + 0.01 &&
            section.z + section.d <= b.z + b.d + 0.01,
        );
        assert.ok(inBuilding, `Section at (${section.x}, ${section.z}) not within any building`);
      }
    }
  });

  it('higher tiers have fewer or equal sections than lower tiers', () => {
    const data = getFloors();
    // Total floor area should generally decrease with tier
    for (let t = 2; t <= baseConfig.tiers; t++) {
      const areaAbove = data.floors[t].sections.reduce((sum, s) => sum + s.w * s.d, 0);
      const areaBelow = data.floors[t - 1].sections.reduce((sum, s) => sum + s.w * s.d, 0);
      // Allow some variance but upper tiers shouldn't be larger
      assert.ok(areaAbove <= areaBelow * 1.1,
        `Tier ${t} area (${areaAbove}) should not exceed tier ${t - 1} (${areaBelow})`);
    }
  });

  it('all sections have minimum walkable size', () => {
    const data = getFloors();
    for (const floor of data.floors) {
      if (floor.tier === 0) continue; // base is full map
      for (const s of floor.sections) {
        assert.ok(s.w >= 2, `Section width ${s.w} below minimum`);
        assert.ok(s.d >= 2, `Section depth ${s.d} below minimum`);
      }
    }
  });
});
