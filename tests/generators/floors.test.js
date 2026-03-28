import { describe, it, expect } from 'vitest';
import { generateFloors } from '../../src/generators/floors.js';
import { generateBuildings } from '../../src/generators/buildings.js';
import { generateGrid } from '../../src/generators/grid.js';
import { createRng } from '../../src/core/rng.js';

const baseConfig = {
  mapWidth: 48,
  mapDepth: 48,
  streetWidth: 3.5,
  tiers: 4,
  tierHeight: 3,
  slabThickness: 0.5,
};

function runPipeline() {
  const rng = createRng(42);
  const gridData = generateGrid(baseConfig, rng);
  const buildingData = generateBuildings(gridData, baseConfig, rng);
  return { result: generateFloors(buildingData, baseConfig, rng), rng };
}

describe('generateFloors', () => {
  it('returns floors array with entries for each tier', () => {
    const { result } = runPipeline();
    expect(Array.isArray(result.floors)).toBe(true);
    // Tier 0 through tiers (5 entries for 4 tiers)
    expect(result.floors.length).toBe(baseConfig.tiers + 1);
  });

  it('tier 0 is the full map', () => {
    const { result } = runPipeline();
    const tier0 = result.floors.find(f => f.tier === 0);
    expect(tier0.sections.length).toBe(1);
    expect(tier0.sections[0].x).toBe(0);
    expect(tier0.sections[0].z).toBe(0);
    expect(tier0.sections[0].w).toBe(baseConfig.mapWidth);
    expect(tier0.sections[0].d).toBe(baseConfig.mapDepth);
  });

  it('sections have positive dimensions', () => {
    const { result } = runPipeline();
    for (const floor of result.floors) {
      for (const section of floor.sections) {
        expect(section.w).toBeGreaterThan(0);
        expect(section.d).toBeGreaterThan(0);
      }
    }
  });

  it('sections are within building footprints', () => {
    const { result } = runPipeline();
    for (let tier = 1; tier <= baseConfig.tiers; tier++) {
      const floor = result.floors.find(f => f.tier === tier);
      for (const section of floor.sections) {
        // Each section should overlap with at least one building
        const matchesBuilding = result.buildings.some(b =>
          section.x >= b.x - 0.01 && section.z >= b.z - 0.01 &&
          section.x + section.w <= b.x + b.w + 0.01 &&
          section.z + section.d <= b.z + b.d + 0.01
        );
        expect(matchesBuilding).toBe(true);
      }
    }
  });

  it('higher tiers have fewer or equal sections', () => {
    const { result } = runPipeline();
    // Generally: higher tiers have fewer sections due to shorter buildings
    const tier1 = result.floors.find(f => f.tier === 1).sections.length;
    const tierMax = result.floors.find(f => f.tier === baseConfig.tiers).sections.length;
    expect(tierMax).toBeLessThanOrEqual(tier1);
  });

  it('returns building quadrant data', () => {
    const { result } = runPipeline();
    expect(result).toHaveProperty('buildingQuadrants');
    expect(Array.isArray(result.buildingQuadrants)).toBe(true);
    expect(result.buildingQuadrants.length).toBe(result.buildings.length);
  });

  it('quadrant damage escalates upward', () => {
    const { result } = runPipeline();
    for (const bq of result.buildingQuadrants) {
      let prevRemoved = 0;
      for (const tier of Object.keys(bq.tiers).map(Number).sort((a, b) => a - b)) {
        const present = bq.tiers[tier];
        const removed = 4 - present.size;
        // Damage should never decrease going up
        expect(removed).toBeGreaterThanOrEqual(prevRemoved);
        prevRemoved = removed;
      }
    }
  });

  it('is deterministic', () => {
    const a = runPipeline().result;
    const b = runPipeline().result;
    expect(a.floors.length).toBe(b.floors.length);
    for (let i = 0; i < a.floors.length; i++) {
      expect(a.floors[i].sections.length).toBe(b.floors[i].sections.length);
    }
  });

  it('merges right column (quadrants 1+3) when left column not available', () => {
    // Lines 131-133: the right column merge path.
    // We need quadrants {1,3} present (no 0 or 2), so top/bottom row merges don't trigger.
    // This happens naturally when quadrant 0 is removed at tier 1, then 2 at tier 2.
    // We scan across many seeds to find the pattern.
    let foundRightCol = false;
    for (let seed = 0; seed < 100 && !foundRightCol; seed++) {
      const rng = createRng(seed);
      const gridData = generateGrid(baseConfig, rng);
      const buildingData = generateBuildings(gridData, baseConfig, rng);
      const result = generateFloors(buildingData, baseConfig, rng);

      for (const bq of result.buildingQuadrants) {
        for (const tier of Object.keys(bq.tiers).map(Number)) {
          const present = bq.tiers[tier];
          // Right column: has 1 and 3, but not (0 and 1) and not (2 and 3)
          if (present.has(1) && present.has(3) && !present.has(0) && !present.has(2)) {
            foundRightCol = true;
            break;
          }
        }
      }
    }
    expect(foundRightCol).toBe(true);
  });
});
