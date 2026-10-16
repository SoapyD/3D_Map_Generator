/**
 * --preview-map entry: skips generation, preloads a fixture and starts the unified preview server.
 */

import { LOADED_MAP, PREVIEW } from '../../config.js';
import { createMapState } from './map-state.js';
import { createPreviewServer } from '../preview-routes.js';

/** Unified server with no generated run (run routes answer 404 JSON). */
export function createMapPreviewServer(state, mode = PREVIEW.modes.previewMap, textureSet) {
  return createPreviewServer({ mode, glbPath: null, mapState: state, framesPath: null, textureSet });
}

export async function startMapPreview(fixturePath, textureSet, port = LOADED_MAP.port) {
  const mapState = createMapState();
  const result = await mapState.loadFile(fixturePath);
  if (!result.ok) console.error(`Fixture problems:\n  ${result.errors.join('\n  ')}`);
  const server = createMapPreviewServer(mapState, undefined, textureSet);
  server.listen(port, () => {
    console.log(`Preview: http://localhost:${port}/?textures=${textureSet}`);
  });
  return server;
}
