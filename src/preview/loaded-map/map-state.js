/**
 * Holds the currently loaded fixture and builds its textured GLB and texture report.
 * Reuses the GLB path (buildScene -> buildGlbBuffer); no texturing or box code lives here.
 */

import { readFile } from 'fs/promises';
import { LOADED_MAP, PREVIEW } from '../../config.js';
import { buildScene } from '../../generators/scene/index.js';
import { buildGlbBuffer } from '../../export/glb-exporter.js';
import { decodeFixture } from './decode-fixture.js';
import { buildTextureReport } from './texture-report.js';

export function createMapState() {
  let decoded = { ok: false, errors: [PREVIEW.noFixtureMessage], map: null };
  const glbCache = new Map();

  function load(json) {
    glbCache.clear();
    try {
      decoded = decodeFixture(JSON.parse(json));
    } catch (err) {
      decoded = { ok: false, errors: [`not valid JSON: ${err.message}`], map: null };
    }
    return { ok: decoded.ok, errors: decoded.errors };
  }

  async function loadFile(filePath) {
    try {
      return load(await readFile(filePath, 'utf-8'));
    } catch (err) {
      decoded = { ok: false, errors: [`cannot read ${filePath}: ${err.message}`], map: null };
      return { ok: false, errors: decoded.errors };
    }
  }

  /** Whitelist so a query string can never pick an arbitrary asset folder. */
  function safeSet(textureSet) {
    return LOADED_MAP.textureSets.includes(textureSet) ? textureSet : LOADED_MAP.textureSets[0];
  }

  async function glb(textureSet) {
    if (!decoded.ok) return null;
    const set = safeSet(textureSet);
    if (!glbCache.has(set)) {
      const scene = buildScene({ version: 1, primitives: decoded.map.primitives }, { textureSet: set, debug: false });
      glbCache.set(set, await buildGlbBuffer(scene));
    }
    return glbCache.get(set);
  }

  function report(textureSet) {
    const set = safeSet(textureSet);
    if (!decoded.ok) return { ok: false, errors: decoded.errors, textureSets: LOADED_MAP.textureSets };
    const { primitives, ...meta } = decoded.map;
    return {
      ok: true, errors: [], meta, activeSet: set, textureSets: LOADED_MAP.textureSets,
      highlightColor: LOADED_MAP.fallbackColor, camera: LOADED_MAP.camera, ...buildTextureReport(primitives, set),
    };
  }

  return { load, loadFile, glb, report };
}
