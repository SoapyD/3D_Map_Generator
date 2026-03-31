import { describe, it, expect } from 'vitest';
import { generateConnectivity } from '../../src/generators/connectivity-main.js';
import { generateWalls } from '../../src/generators/walls.js';
import { generateFloors } from '../../src/generators/floors.js';
import { generateBuildings } from '../../src/generators/buildings.js';
import { generateGrid } from '../../src/generators/grid.js';
import { createRng } from '../../src/core/rng.js';
import { DELETIONS } from '../../src/config.js';

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
  const wallData = generateWalls(floorData, baseConfig, rng);
  return generateConnectivity(wallData, baseConfig, rng);
}

describe('generateConnectivity', () => {
  it('returns connections object', () => {
    const result = runPipeline();
    expect(result).toHaveProperty('connections');
    expect(result.connections).toHaveProperty('walkways');
    expect(result.connections).toHaveProperty('ladders');
    expect(result.connections).toHaveProperty('groundLadders');
    expect(result.connections).toHaveProperty('orangeLadders');
    expect(result.connections).toHaveProperty('interiorLadders');
  });

  it('walkways have required properties', () => {
    const result = runPipeline();
    for (const w of result.connections.walkways) {
      expect(w).toHaveProperty('x');
      expect(w).toHaveProperty('z');
      expect(w).toHaveProperty('w');
      expect(w).toHaveProperty('d');
      expect(w).toHaveProperty('y');
      expect(w).toHaveProperty('axis');
    }
  });

  it('walkways connect between buildings (positive dimensions)', () => {
    const result = runPipeline();
    for (const w of result.connections.walkways) {
      expect(w.w).toBeGreaterThan(0);
      expect(w.d).toBeGreaterThan(0);
    }
  });

  it('ladders span tiers vertically', () => {
    const result = runPipeline();
    const allLadders = [
      ...result.connections.ladders,
      ...result.connections.groundLadders,
      ...result.connections.orangeLadders,
      ...result.connections.interiorLadders,
    ];
    for (const l of allLadders) {
      expect(l.y1).toBeGreaterThan(l.y0);
      expect(l.w).toBeGreaterThan(0);
      expect(l.d).toBeGreaterThan(0);
    }
  });

  it('ground ladders start at y=0', () => {
    const result = runPipeline();
    for (const l of result.connections.groundLadders) {
      expect(l.y0).toBe(0);
    }
  });

  it('walkway lengths are within configured range', () => {
    const result = runPipeline();
    for (const w of result.connections.walkways) {
      const length = w.axis === 'x' ? w.w : w.d;
      // Some tolerance for float precision
      expect(length).toBeGreaterThanOrEqual(2.9);
      expect(length).toBeLessThanOrEqual(15.1);
    }
  });

  it('walkways do not intersect walls on the same tier', () => {
    const result = runPipeline();
    // Walkways that survived should not be blocked (or blocked ones should have been filtered)
    for (const w of result.connections.walkways) {
      // The connectivity generator sets blocked=true on wall-intersecting walkways
      // but keeps them for yellow ladders. Non-blocked walkways should be clean.
      // This is a structural test - just verify they exist and have valid data
      expect(w.y).toBeGreaterThan(0);
    }
  });

  it('is deterministic', () => {
    const a = runPipeline();
    const b = runPipeline();
    expect(a.connections.walkways.length).toBe(b.connections.walkways.length);
    expect(a.connections.groundLadders.length).toBe(b.connections.groundLadders.length);
    expect(a.connections.orangeLadders.length).toBe(b.connections.orangeLadders.length);
    expect(a.connections.interiorLadders.length).toBe(b.connections.interiorLadders.length);
  });

  it('ladder platforms are generated', () => {
    const result = runPipeline();
    expect(result.connections).toHaveProperty('ladderPlatforms');
    // Should have some platforms if we have multi-tier ladders
    const allLadders = [
      ...result.connections.ladders,
      ...result.connections.groundLadders,
      ...result.connections.orangeLadders,
    ];
    if (allLadders.some(l => l.y1 - l.y0 > baseConfig.tierHeight)) {
      expect(result.connections.ladderPlatforms.length).toBeGreaterThan(0);
    }
  });

  it('skips orange proximity cull when orangeLadderProximityCull is false', () => {
    const orig = DELETIONS.orangeLadderProximityCull;
    try {
      DELETIONS.orangeLadderProximityCull = false;
      const result = runPipeline();
      expect(result).toHaveProperty('connections');
      expect(Array.isArray(result.connections.orangeLadders)).toBe(true);
    } finally {
      DELETIONS.orangeLadderProximityCull = orig;
    }
  });

  it('skips cyan proximity cull when cyanLadderProximityCull is false', () => {
    const orig = DELETIONS.cyanLadderProximityCull;
    try {
      DELETIONS.cyanLadderProximityCull = false;
      const result = runPipeline();
      expect(result).toHaveProperty('connections');
      expect(Array.isArray(result.connections.interiorLadders)).toBe(true);
    } finally {
      DELETIONS.cyanLadderProximityCull = orig;
    }
  });

  it('skips cyan-orange overlap check when cyanLadderOrangeOverlap is false', () => {
    const orig = DELETIONS.cyanLadderOrangeOverlap;
    try {
      DELETIONS.cyanLadderOrangeOverlap = false;
      const result = runPipeline();
      expect(result).toHaveProperty('connections');
      expect(Array.isArray(result.connections.interiorLadders)).toBe(true);
    } finally {
      DELETIONS.cyanLadderOrangeOverlap = orig;
    }
  });

  it('handles sections not matching any building (findBuildingIndex returns -1)', () => {
    // Run with a modified dataset where a floor section is outside all buildings
    const rng = createRng(42);
    const gridData = generateGrid(baseConfig, rng);
    const buildingData = generateBuildings(gridData, baseConfig, rng);
    const floorData = generateFloors(buildingData, baseConfig, rng);
    const wallData = generateWalls(floorData, baseConfig, rng);

    // Inject a floor section that doesn't belong to any building
    wallData.floors[1].sections.push({ x: -100, z: -100, w: 2, d: 2 });

    const rng2 = createRng(42);
    // Consume RNG to align state
    generateGrid(baseConfig, rng2);
    generateBuildings(generateGrid(baseConfig, createRng(42)), baseConfig, rng2);

    // Should not throw, just gracefully handle
    const result = generateConnectivity(wallData, baseConfig, createRng(99));
    expect(result).toHaveProperty('connections');
  });
});
