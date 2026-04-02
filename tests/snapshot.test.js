import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng.js';
import { generateGrid } from '../src/generators/grid.js';
import { generateBuildings } from '../src/generators/buildings.js';
import { generateFloors } from '../src/generators/floors.js';
import { generateWalls } from '../src/generators/walls.js';
import { generateConnectivity } from '../src/generators/connectivity-main.js';
import { generateCover } from '../src/generators/cover.js';

const baseConfig = {
  mapWidth: 48,
  mapDepth: 48,
  streetWidth: 3.5,
  tiers: 4,
  tierHeight: 3,
  slabThickness: 0.5,
  wallThickness: 0.25,
};

function runFullPipeline(seed) {
  const rng = createRng(seed);
  const gridData = generateGrid(baseConfig, rng);
  const buildingData = generateBuildings(gridData, baseConfig, rng);
  const floorData = generateFloors(buildingData, baseConfig, rng);
  const wallData = generateWalls(floorData, baseConfig, rng);
  const connData = generateConnectivity(wallData, baseConfig, rng);
  const coverData = generateCover(connData, baseConfig, rng);
  return coverData;
}

function countObjects(data) {
  const allLadders = [
    ...data.connections.ladders,
    ...data.connections.groundLadders,
    ...data.connections.orangeLadders,
    ...data.connections.interiorLadders,
  ];
  return {
    blocks: data.blocks.length,
    buildings: data.buildings.length,
    floors: data.floors.map(f => f.sections.length),
    walls: data.walls.length,
    walkways: data.connections.walkways.length,
    ladders: allLadders.length,
    ladderPlatforms: data.connections.ladderPlatforms.length,
    cover: data.cover.length,
    interiorCover: data.interiorCover.length,
    streetScatter: data.streetScatter.length,
  };
}

describe('Snapshot regression — seed 42', () => {
  const data = runFullPipeline(42);
  const counts = countObjects(data);

  it('is fully deterministic across runs', () => {
    const data2 = runFullPipeline(42);
    const counts2 = countObjects(data2);
    expect(counts).toEqual(counts2);
  });

  it('block count is locked', () => {
    expect(counts.blocks).toMatchInlineSnapshot(`9`);
  });

  it('building count is locked', () => {
    expect(counts.buildings).toMatchInlineSnapshot(`17`);
  });

  it('wall count is locked', () => {
    expect(counts.walls).toMatchInlineSnapshot(`248`);
  });

  it('walkway count is locked', () => {
    expect(counts.walkways).toMatchInlineSnapshot(`10`);
  });

  it('cover count is locked', () => {
    expect(counts.cover).toMatchInlineSnapshot(`11`);
  });

  it('street scatter count is locked', () => {
    expect(counts.streetScatter).toMatchInlineSnapshot(`20`);
  });

  it('floor sections per tier are locked', () => {
    expect(counts.floors).toMatchInlineSnapshot(`
      [
        1,
        30,
        23,
        16,
        0,
      ]
    `);
  });
});

describe('Snapshot regression — seed 100', () => {
  const data = runFullPipeline(100);
  const counts = countObjects(data);

  it('is fully deterministic across runs', () => {
    const data2 = runFullPipeline(100);
    const counts2 = countObjects(data2);
    expect(counts).toEqual(counts2);
  });

  it('block count is locked', () => {
    expect(counts.blocks).toMatchInlineSnapshot(`8`);
  });

  it('building count is locked', () => {
    expect(counts.buildings).toMatchInlineSnapshot(`16`);
  });

  it('wall count is locked', () => {
    expect(counts.walls).toMatchInlineSnapshot(`197`);
  });

  it('walkway count is locked', () => {
    expect(counts.walkways).toMatchInlineSnapshot(`194`);
  });

  it('cover count is locked', () => {
    expect(counts.cover).toMatchInlineSnapshot(`12`);
  });

  it('street scatter count is locked', () => {
    expect(counts.streetScatter).toMatchInlineSnapshot(`10`);
  });

  it('floor sections per tier are locked', () => {
    expect(counts.floors).toMatchInlineSnapshot(`20`);
  });
});
