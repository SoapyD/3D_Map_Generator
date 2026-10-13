import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { runStages, countPrims } from './helpers/run-stages.js';

/**
 * Regression guards: object counts and a collision-matrix hash for fixed seeds on the default config
 * (48x48, 4 tiers). If a count changes, generation changed. Review the change, then update.
 * Counts were last regenerated after the pipeline moved to the matrix-based stages
 * (foundations/buildings/floors/roofs/streets/connectivity/ladders/walls/cover/geometry).
 */

function countObjects(seed) {
  const r = runStages(seed);
  const segs = r.ladders.ladderPaths.flatMap(p => p.segments);
  return {
    blocks: r.grid.blocks.length,
    buildings: r.buildings.buildings.length,
    floors: r.floors.floors.length,
    roofs: r.roofs.roofs.length,
    walls: r.walls.walls.length,
    internalWalls: r.walls.internalWalls.length,
    walkways: r.connectivity.connections.walkways.length,
    pillars: r.connectivity.connections.pillars.length,
    ladderSegments: segs.length,
    cover: r.cover.cover.length,
    streetScatter: r.cover.streetScatter.length,
    primitives: r.geometry.primitives.length,
  };
}

/** SHA-256 of the collision matrix cells, the Withering client's contract; must not move unless generation does. */
function matrixHash(seed) {
  const { matrix } = runStages(seed);
  return createHash('sha256').update(Uint8Array.from(matrix.toDebugJSON().cells)).digest('hex');
}

describe.each([42, 100])('Snapshot regression - seed %i', (seed) => {
  it(`seed ${seed}: object counts are deterministic across fresh runs`, () => {
    const again = runStages(seed, { textureSet: 'base' }); // distinct cache key => fresh generation
    expect(runStages(seed)).not.toBe(again);
    const fresh = {
      blocks: again.grid.blocks.length,
      buildings: again.buildings.buildings.length,
      walls: again.walls.walls.length,
      cover: again.cover.cover.length,
      primitives: again.geometry.primitives.length,
    };
    const base = countObjects(seed);
    for (const key of Object.keys(fresh)) expect(fresh[key]).toBe(base[key]);
  });

  it(`seed ${seed}: collision matrix is identical across fresh runs`, () => {
    const again = runStages(seed, { textureSet: 'base' });
    const hash = createHash('sha256').update(Uint8Array.from(again.matrix.toDebugJSON().cells)).digest('hex');
    expect(hash).toBe(matrixHash(seed));
  });

  it(`seed ${seed}: geometry has at least one primitive of each core kind`, () => {
    const { geometry } = runStages(seed);
    expect(countPrims(geometry, 'floor_')).toBeGreaterThan(0);
    expect(countPrims(geometry, 'wall_')).toBeGreaterThan(0);
    expect(countPrims(geometry, 'cover_')).toBeGreaterThan(0);
    expect(countPrims(geometry, 'ladder_path_')).toBeGreaterThan(0);
  });
});

describe('Snapshot regression - seed 42', () => {
  it('seed 42 object counts are locked', () => {
    expect(countObjects(42)).toMatchInlineSnapshot(`
      {
        "blocks": 9,
        "buildings": 24,
        "cover": 34,
        "floors": 41,
        "internalWalls": 9,
        "ladderSegments": 29,
        "pillars": 20,
        "primitives": 802,
        "roofs": 24,
        "streetScatter": 14,
        "walkways": 20,
        "walls": 276,
      }
    `);
  });

  it('seed 42 collision matrix hash is locked', () => {
    expect(matrixHash(42)).toMatchInlineSnapshot(`"21e068c102d08532d72558fb145e27a772100e6398512703d0ef57af0e03f820"`);
  });
});

describe('Snapshot regression - seed 100', () => {
  it('seed 100 object counts are locked', () => {
    expect(countObjects(100)).toMatchInlineSnapshot(`
      {
        "blocks": 9,
        "buildings": 25,
        "cover": 29,
        "floors": 49,
        "internalWalls": 9,
        "ladderSegments": 31,
        "pillars": 6,
        "primitives": 810,
        "roofs": 25,
        "streetScatter": 17,
        "walkways": 22,
        "walls": 327,
      }
    `);
  });

  it('seed 100 collision matrix hash is locked', () => {
    expect(matrixHash(100)).toMatchInlineSnapshot(`"bba4456c8deb62fbc988221d8044ba1e999768789bf92ff2ce8a55e5c367828a"`);
  });
});
