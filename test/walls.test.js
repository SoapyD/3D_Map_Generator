import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/core/rng.js';
import { generateGrid } from '../src/generators/grid.js';
import { generateBuildings } from '../src/generators/buildings.js';
import { generateFloors } from '../src/generators/floors.js';
import { generateWalls } from '../src/generators/walls.js';

const baseConfig = {
  mapWidth: 48, mapDepth: 48, streetWidth: 3.5,
  tiers: 4, tierHeight: 6, slabThickness: 0.5,
  wallThickness: 0.25, damageLevel: 0.5,
};

function getPipelineData(seed = 42) {
  const rng = createRng(seed);
  const grid = generateGrid(baseConfig, rng);
  const buildings = generateBuildings(grid, baseConfig, rng);
  const floors = generateFloors(buildings, baseConfig, rng);
  return generateWalls(floors, baseConfig, rng);
}

describe('Wall Generator', () => {
  it('produces wall segments', () => {
    const data = getPipelineData();
    assert.ok(data.walls.length > 0);
  });

  it('all walls have positive dimensions', () => {
    const data = getPipelineData();
    for (const w of data.walls) {
      assert.ok(w.length > 0, `Wall length ${w.length} must be positive`);
      assert.ok(w.height > 0, `Wall height ${w.height} must be positive`);
      assert.ok(w.thickness > 0, `Wall thickness ${w.thickness} must be positive`);
    }
  });

  it('all walls have correct thickness', () => {
    const data = getPipelineData();
    for (const w of data.walls) {
      assert.equal(w.thickness, baseConfig.wallThickness);
    }
  });

  it('wall heights do not exceed tier height', () => {
    const data = getPipelineData();
    const maxH = baseConfig.tierHeight - baseConfig.slabThickness;
    for (const w of data.walls) {
      assert.ok(w.height <= maxH + 0.01, `Wall height ${w.height} exceeds max ${maxH}`);
    }
  });

  it('walls are axis-aligned (x or z)', () => {
    const data = getPipelineData();
    for (const w of data.walls) {
      assert.ok(w.axis === 'x' || w.axis === 'z');
    }
  });

  it('walls are within map bounds', () => {
    const data = getPipelineData();
    for (const w of data.walls) {
      const endX = w.axis === 'x' ? w.x + w.length : w.x + w.thickness;
      const endZ = w.axis === 'z' ? w.z + w.length : w.z + w.thickness;
      assert.ok(w.x >= -0.5, `Wall x=${w.x} out of bounds`);
      assert.ok(w.z >= -0.5, `Wall z=${w.z} out of bounds`);
      assert.ok(endX <= baseConfig.mapWidth + 0.5, `Wall extends past map width: ${endX}`);
      assert.ok(endZ <= baseConfig.mapDepth + 0.5, `Wall extends past map depth: ${endZ}`);
    }
  });

  it('every upper floor section has at least 2 wall edges below it', () => {
    // For each floor section at tier 1+, check that walls exist on at least
    // 2 different edges of the section at the tier below
    for (const seed of [1, 42, 999]) {
      const data = getPipelineData(seed);

      for (let t = 1; t < data.floors.length; t++) {
        const floorData = data.floors[t];
        const tierBelow = floorData.tier - 1;
        const baseY = tierBelow * baseConfig.tierHeight + baseConfig.slabThickness;

        for (const section of floorData.sections) {
          // Find walls at the tier below that are on edges of this section
          const edgeLabels = new Set();
          for (const wall of data.walls) {
            if (Math.abs(wall.baseY - baseY) > 1) continue; // wrong tier

            // Check if this wall runs along an edge of the section
            if (isWallOnEdge(wall, section, baseConfig.wallThickness)) {
              edgeLabels.add(classifyEdge(wall, section, baseConfig.wallThickness));
            }
          }

          // Floor section might be from a building whose maxTier == tierBelow+1,
          // meaning tierBelow is the top for that building — skip if no building reaches above
          const hasAbove = data.buildings.some(
            (b) => b.maxTier > tierBelow &&
              section.x >= b.x - 0.5 && section.z >= b.z - 0.5 &&
              section.x + section.w <= b.x + b.w + 0.5 &&
              section.z + section.d <= b.z + b.d + 0.5,
          );
          if (!hasAbove) continue;

          assert.ok(edgeLabels.size >= 2,
            `seed ${seed} tier ${floorData.tier} section (${section.x.toFixed(1)},${section.z.toFixed(1)}) ` +
            `only has ${edgeLabels.size} wall edge(s): [${[...edgeLabels]}]`);
        }
      }
    }
  });

  it('passes through previous pipeline data', () => {
    const data = getPipelineData();
    assert.ok(Array.isArray(data.blocks));
    assert.ok(Array.isArray(data.buildings));
    assert.ok(Array.isArray(data.floors));
    assert.ok(Array.isArray(data.streets));
  });

  it('is deterministic with the same seed', () => {
    const d1 = getPipelineData(123);
    const d2 = getPipelineData(123);
    assert.equal(d1.walls.length, d2.walls.length);
    for (let i = 0; i < d1.walls.length; i++) {
      assert.deepStrictEqual(d1.walls[i], d2.walls[i]);
    }
  });
});

// Helper: check if a wall runs along one of the 4 edges of a section
function isWallOnEdge(wall, section, thickness) {
  const margin = 1.5;
  if (wall.axis === 'x') {
    // Runs along X — could be north or south edge
    const overlapX = Math.min(wall.x + wall.length, section.x + section.w) - Math.max(wall.x, section.x);
    if (overlapX < wall.length * 0.2) return false;
    if (Math.abs(wall.z - section.z) < margin) return true; // north
    if (Math.abs(wall.z - (section.z + section.d - thickness)) < margin) return true; // south
  } else {
    const overlapZ = Math.min(wall.z + wall.length, section.z + section.d) - Math.max(wall.z, section.z);
    if (overlapZ < wall.length * 0.2) return false;
    if (Math.abs(wall.x - section.x) < margin) return true; // west
    if (Math.abs(wall.x - (section.x + section.w - thickness)) < margin) return true; // east
  }
  return false;
}

// Helper: classify which edge a wall is on
function classifyEdge(wall, section, thickness) {
  if (wall.axis === 'x') {
    return Math.abs(wall.z - section.z) < Math.abs(wall.z - (section.z + section.d - thickness))
      ? 'north' : 'south';
  }
  return Math.abs(wall.x - section.x) < Math.abs(wall.x - (section.x + section.w - thickness))
    ? 'west' : 'east';
}
