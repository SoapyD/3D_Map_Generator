/**
 * Unified preview entry for generated runs (--preview, alias --visualize).
 * Serves the tabbed shell plus the Loaded map and Visualizer pages (viewer.html stays at /model.html) from one server.
 */

import path from 'path';
import { readFile } from 'fs/promises';
import { PREVIEW } from '../config.js';
import { createMapState } from './loaded-map/map-state.js';
import { createPreviewServer } from './preview-routes.js';
import { buildRunFixture } from './run-fixture.js';

async function preloadRun(mapState, glbPath, config) {
  if (!config) return;
  try {
    const geometry = JSON.parse(await readFile(glbPath.replace(/\.glb$/, '_geometry.json'), 'utf-8'));
    const fixture = buildRunFixture(geometry, config);
    if (fixture) mapState.load(JSON.stringify(fixture));
  } catch {
    // Loaded map tab stays on its "load a fixture" message.
  }
}

export async function startPreview(glbPath, port = PREVIEW.port, mode = PREVIEW.defaultMode, config = null) {
  const mapState = createMapState();
  await preloadRun(mapState, glbPath, config);
  const framesDir = config?.outputDir ?? path.join(process.cwd(), 'output');
  const framesPath = path.join(framesDir, 'debug_frames.json');
  const server = createPreviewServer({ mode, glbPath, mapState, framesPath, textureSet: config?.textureSet });
  server.listen(port, () => console.log(`Preview: http://localhost:${port}`));
  return server;
}
