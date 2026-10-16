import { reportKey } from '../../src/preview/loaded-map/report-key.js';
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { existsSync, readFileSync } from 'fs';
import { runStages } from '../helpers/run-stages.js';
import { buildTexturePools } from '../../src/generators/scene/buildTexturePools.js';
import { resolveTexturedMaterial } from '../../src/generators/scene/resolve-textured-material.js';
import { decodeFixture } from '../../src/preview/loaded-map/decode-fixture.js';
import { buildTextureReport } from '../../src/preview/loaded-map/texture-report.js';
import { createMapState } from '../../src/preview/loaded-map/map-state.js';
import { createMapPreviewServer } from '../../src/preview/loaded-map/map-preview-server.js';

const WITHERING_FIXTURE = 'D:/programming/Node/Game_Template/games/withering/sim/data/fixtures/36x36-seed3.json';

function syntheticFixture() {
  const { geometry, matrix, config } = runStages(42, { mapWidth: 24, mapDepth: 24 });
  const m = matrix.toDebugJSON();
  return {
    format: 'withering-map/2',
    generator: { rev: 'test', dirty: false, version: 'x' },
    seed: 42,
    opts: { mapWidth: 24, mapDepth: 24, tiers: config.tiers, levelHeight: config.tierHeight, floorThickness: 0.25 },
    matrix: { ...m, cellsBase64: Buffer.from(Uint8Array.from(m.cells)).toString('base64'), cells: undefined },
    primitives: geometry.primitives,
  };
}

const fixtures = [['synthetic', syntheticFixture()]];
if (existsSync(WITHERING_FIXTURE)) fixtures.push(['withering 36x36-seed3', JSON.parse(readFileSync(WITHERING_FIXTURE, 'utf-8'))]);

describe('decodeFixture', () => {
  it.each(fixtures)('accepts %s', (_, fx) => {
    const r = decodeFixture(fx);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.map.primitives.length).toBe(fx.primitives.length);
  });

  it('reports errors instead of throwing', () => {
    const fx = fixtures[0][1];
    expect(decodeFixture(null).ok).toBe(false);
    expect(decodeFixture({ ...fx, format: 'nope/9' }).errors[0]).toMatch(/unsupported map format/);
    expect(decodeFixture({ ...fx, opts: { ...fx.opts, levelHeight: 0 } }).errors.join()).toMatch(/levelHeight/);
    expect(decodeFixture({ ...fx, opts: { ...fx.opts, floorThickness: undefined } }).errors.join()).toMatch(/floorThickness/);
    expect(decodeFixture({ ...fx, matrix: { ...fx.matrix, maxY: fx.matrix.maxY + 1 } }).errors.join()).toMatch(/cells, expected/);
    expect(decodeFixture({ ...fx, primitives: null }).ok).toBe(false);
  });

  it('gives /1 fixtures the legacy pitch and thickness', () => {
    const fx = { ...fixtures[0][1], format: 'withering-map/1', opts: {} };
    const r = decodeFixture(fx);
    expect(r.ok).toBe(true);
    expect(r.map.levelHeight).toBe(4);
    expect(r.map.floorThickness).toBe(1);
  });
});

describe('texture report', () => {
  const pools = buildTexturePools('base');

  it.each(fixtures)('agrees with resolveTexturedMaterial on every key of %s', (_, fx) => {
    const keys = new Set(fx.primitives.filter((p) => p.type !== 'edges').map((p) => p.textureKey));
    expect(keys.size).toBeGreaterThan(0);
    for (const key of keys) {
      const row = reportKey(key, pools);
      expect(Number.isInteger(row.index), key).toBe(true);
      expect(pools[row.pool][row.index], key).toBe(resolveTexturedMaterial(key, pools));
    }
  });

  it('agrees on a hand-written key table', () => {
    const keys = ['floor:base:0', 'floor:building:7', 'wall:standard:13', 'wall:landmark:5', 'walkway:5', 'roof:3', 'object:5',
      'courtyard', 'ladder:0', 'river', 'river:2', 'river_bank', 'street:1', 'pavement:0', 'map_skirt', 'map_border', 'wall:standard:-3'];
    for (const key of keys) {
      const row = reportKey(key, pools);
      expect(pools[row.pool][row.index], key).toBe(resolveTexturedMaterial(key, pools));
    }
  });

  it('flags unknown keys as walls[0] fallback', () => {
    const row = reportKey('mystery:3', pools);
    expect(row).toMatchObject({ pool: 'walls', index: 0, status: 'unknown-key' });
    expect(pools.walls[0]).toBe(resolveTexturedMaterial('mystery:3', pools));
  });

  it('flags empty pools as grey fallback', () => {
    const emptyPools = { ...pools, floors: [new THREE.MeshStandardMaterial()] };
    emptyPools.floors[0]._fallbackReason = 'pool-empty';
    expect(reportKey('floor:building:2', emptyPools).status).toBe('pool-empty');
  });

  it('flags a keyed pool with no texture directory as file-missing', () => {
    const report = buildTextureReport([{ type: 'slab', name: 'a', textureKey: 'floor:building:0' }], 'no_such_pack');
    expect(report.rows[0].status).toBe('file-missing');
    expect(report.fallbackCount).toBe(1);
  });

  it('flags a missing index and skips edges primitives', () => {
    expect(reportKey('walkway', pools).status).toBe('bad-index');
    const report = buildTextureReport([
      { type: 'edges', name: 'e', textureKey: 'floor:building:0' },
      { type: 'slab', name: 's', textureKey: 'floor:building:0' },
    ], 'base');
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({ count: 1, names: ['s'], status: 'ok' });
  });

  it('reports real texture files for real keys', () => {
    expect(reportKey('pavement:0', pools).file).toMatch(/\.png$/);
  });
});

describe('map preview state and routes', () => {
  it('serves a GLB and a report for a loaded fixture, and rejects bad input', async () => {
    const state = createMapState();
    expect((await state.glb('base'))).toBeNull();
    expect(state.load('{ not json').ok).toBe(false);
    expect(state.load(JSON.stringify(fixtures[0][1])).ok).toBe(true);

    const glb = await state.glb('base');
    expect(glb.subarray(0, 4).toString('latin1')).toBe('glTF');
    const rep = state.report('../evil'); // falls back to the first whitelisted set
    expect(rep.ok).toBe(true);
    expect(rep.textureSet).toBe('base');
    expect(rep.rows.every((r) => typeof r.status === 'string')).toBe(true);

    const server = createMapPreviewServer(state);
    await new Promise((r) => server.listen(0, r));
    const base = `http://localhost:${server.address().port}`;
    try {
      const bytes = Buffer.from(await (await fetch(`${base}/loaded-model.glb?textures=loaded`)).arrayBuffer());
      expect(bytes.subarray(0, 4).toString('latin1')).toBe('glTF');
      expect((await (await fetch(`${base}/texture-report.json`)).json()).ok).toBe(true);
      const posted = await (await fetch(`${base}/load-map`, { method: 'POST', body: '{"format":"x"}' })).json();
      expect(posted.ok).toBe(false);
      expect((await fetch(`${base}/loaded-model.glb`)).status).toBe(404);
      expect((await fetch(`${base}/`)).status).toBe(200);
    } finally {
      server.close();
    }
  });
});
