import { describe, it, expect } from 'vitest';
import { getTabState } from '../../src/preview/tab-flags.js';
import { createPreviewServer } from '../../src/preview/preview-routes.js';
import { createMapState } from '../../src/preview/loaded-map/map-state.js';
import { buildRunFixture } from '../../src/preview/run-fixture.js';
import { runStages } from '../helpers/run-stages.js';
import { PREVIEW, parseArgs } from '../../src/config.js';

const enabledMap = (mode) => Object.fromEntries(getTabState(mode).tabs.map((t) => [t.id, t.enabled]));

describe('tab availability per mode', () => {
  it('run (--preview / --visualize): Loaded map and Visualizer on, Loaded map initial, no Model tab', () => {
    expect(enabledMap('run')).toEqual({ 'loaded-map': true, visualizer: true });
    expect(getTabState('run').initial).toBe('loaded-map');
    expect(getTabState('run').tabs.map((t) => t.label)).toEqual(['Loaded map', 'Visualizer']);
  });
  it('preview-map: Visualizer greyed out with a reason, Loaded map initial', () => {
    expect(enabledMap('preview-map')).toEqual({ 'loaded-map': true, visualizer: false });
    expect(getTabState('preview-map').tabs.find((t) => t.id === 'visualizer').reason).toMatch(/--preview/);
    expect(getTabState('preview-map').initial).toBe('loaded-map');
  });
});

describe('--preview / --visualize flags', () => {
  it('both turn on preview and frame recording', () => {
    for (const flag of ['--preview', '--visualize']) {
      const c = parseArgs(['node', 'x', flag]);
      expect(c.preview, flag).toBe(true);
      expect(c.visualize, flag).toBe(true);
    }
  });
});

async function withServer(ctx, fn) {
  const server = createPreviewServer({ mapState: createMapState(), glbPath: null, framesPath: null, ...ctx });
  await new Promise((r) => server.listen(0, r));
  try { await fn(`http://localhost:${server.address().port}`); } finally { server.close(); }
}

describe('unified preview server', () => {
  it('serves the shell at / and the embedded pages', async () => {
    await withServer({ mode: 'run' }, async (base) => {
      const root = await fetch(`${base}/`);
      expect(root.status).toBe(200);
      expect(await root.text()).toMatch(/id="tabs"/);
      for (const p of ['/model.html', '/viewer.html', '/visualizer.html', '/loaded-map.html']) {
        expect((await fetch(base + p)).status, p).toBe(200);
      }
      const tabs = await (await fetch(`${base}/tabs.json`)).json();
      expect(tabs.initial).toBe('loaded-map');
      expect(tabs.tabs.some((t) => t.id === 'model')).toBe(false);
    });
  });

  it('preview-map mode: run routes are 404 JSON, not crashes', async () => {
    await withServer({ mode: 'preview-map' }, async (base) => {
      for (const p of ['/model.glb', '/geometry.json', '/debug_frames.json', '/loaded-model.glb']) {
        const r = await fetch(base + p);
        expect(r.status, p).toBe(404);
        expect(r.headers.get('content-type')).toMatch(/json/);
        expect((await r.json()).ok).toBe(false);
      }
      expect((await fetch(`${base}/nope`)).status).toBe(404);
      expect((await (await fetch(`${base}/tabs.json`)).json()).initial).toBe('loaded-map');
    });
  });

  it('run mode: debug_frames is 404 JSON when no frames file was written', async () => {
    await withServer({ mode: 'run', framesPath: null }, async (base) => {
      const r = await fetch(`${base}/debug_frames.json`);
      expect(r.status).toBe(404);
      expect((await r.json()).error).toBe(PREVIEW.noVisualizeMessage);
    });
  });
});

describe('run fixture wrapper', () => {
  it('wraps a generated run so the Loaded map tab can decode it', () => {
    const { geometry, matrix, config } = runStages(42, { mapWidth: 24, mapDepth: 24 });
    const fx = buildRunFixture({ ...geometry, collisionMatrix: matrix.toDebugJSON() }, config);
    const state = createMapState();
    expect(state.load(JSON.stringify(fx))).toEqual({ ok: true, errors: [] });
    expect(buildRunFixture({ primitives: [] }, config)).toBeNull();
  });
});
