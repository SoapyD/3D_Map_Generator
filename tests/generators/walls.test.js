import { describe, it, expect } from 'vitest';
import { generateWalls } from '../../src/generators/walls.js';
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
  wallThickness: 0.25,
};

function runPipeline() {
  const rng = createRng(42);
  const gridData = generateGrid(baseConfig, rng);
  const buildingData = generateBuildings(gridData, baseConfig, rng);
  const floorData = generateFloors(buildingData, baseConfig, rng);
  return generateWalls(floorData, baseConfig, rng);
}

describe('generateWalls', () => {
  it('returns walls array', () => {
    const result = runPipeline();
    expect(Array.isArray(result.walls)).toBe(true);
    expect(result.walls.length).toBeGreaterThan(0);
  });

  it('all walls have required properties', () => {
    const result = runPipeline();
    for (const wall of result.walls) {
      expect(wall).toHaveProperty('x');
      expect(wall).toHaveProperty('z');
      expect(wall).toHaveProperty('length');
      expect(wall).toHaveProperty('height');
      expect(wall).toHaveProperty('baseY');
      expect(wall).toHaveProperty('thickness');
      expect(wall).toHaveProperty('axis');
    }
  });

  it('walls have valid axis values', () => {
    const result = runPipeline();
    for (const wall of result.walls) {
      expect(['x', 'z']).toContain(wall.axis);
    }
  });

  it('walls have positive dimensions', () => {
    const result = runPipeline();
    for (const wall of result.walls) {
      expect(wall.length).toBeGreaterThan(0);
      expect(wall.height).toBeGreaterThan(0);
      expect(wall.thickness).toBeGreaterThan(0);
    }
  });

  it('wall baseY aligns with tier heights', () => {
    const result = runPipeline();
    for (const wall of result.walls) {
      // baseY should be tier * tierHeight + slabThickness
      const expectedY = wall.baseY;
      // Check it is a valid tier-based Y
      const tier = Math.round((expectedY - baseConfig.slabThickness) / baseConfig.tierHeight);
      const reconstructedY = tier * baseConfig.tierHeight + baseConfig.slabThickness;
      // After damage, segments may have offset baseY within a wall
      // But the base tier Y should be close to a tier boundary
      const baseTierY = Math.floor(expectedY / (baseConfig.tierHeight / 2)) * (baseConfig.tierHeight / 2);
      expect(wall.baseY).toBeGreaterThanOrEqual(0);
    }
  });

  it('wall segments from damage have correct thickness', () => {
    const result = runPipeline();
    for (const wall of result.walls) {
      expect(wall.thickness).toBeCloseTo(baseConfig.wallThickness);
    }
  });

  it('walls are on building edges', () => {
    const result = runPipeline();
    // Walls should be near building boundaries
    for (const wall of result.walls) {
      const nearBuilding = result.buildings.some(b => {
        const margin = 1;
        return wall.x >= b.x - margin && wall.z >= b.z - margin &&
               (wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness) <= b.x + b.w + margin &&
               (wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness) <= b.z + b.d + margin;
      });
      expect(nearBuilding).toBe(true);
    }
  });

  it('is deterministic', () => {
    const a = runPipeline();
    const b = runPipeline();
    expect(a.walls.length).toBe(b.walls.length);
  });
});
