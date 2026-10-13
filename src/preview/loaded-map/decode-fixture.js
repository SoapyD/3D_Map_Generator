/**
 * Decode and validate a frozen map fixture. Mirrors Withering's loadMap
 * (games/withering/sim/src/map/load-map.ts) but REPORTS problems instead of throwing,
 * so the preview page can show them. Withering's TypeScript cannot be imported.
 */

import { LOADED_MAP } from '../../config.js';

function positiveNumber(v) {
  return typeof v === 'number' && v > 0;
}

function resolvePitch(fx, errors) {
  const legacy = fx.format === 'withering-map/1';
  const levelHeight = legacy ? LOADED_MAP.legacyLevelHeight : fx.opts?.levelHeight;
  const floorThickness = legacy ? LOADED_MAP.legacyFloorThickness : fx.opts?.floorThickness;
  if (!positiveNumber(floorThickness)) errors.push(`${fx.format} needs opts.floorThickness > 0, got ${floorThickness}`);
  if (!positiveNumber(levelHeight)) errors.push(`${fx.format} needs opts.levelHeight > 0, got ${levelHeight}`);
  return { levelHeight, floorThickness };
}

function checkCells(matrix, errors) {
  if (!matrix || typeof matrix.cellsBase64 !== 'string') {
    errors.push('matrix.cellsBase64 is missing');
    return;
  }
  const { W, D, maxY, belowGround, cellsBase64 } = matrix;
  const count = Buffer.from(cellsBase64, 'base64').length;
  const expected = W * D * (maxY + belowGround);
  if (count !== expected) errors.push(`${count} cells, expected ${expected}`);
}

/**
 * @param {object} fx parsed fixture JSON
 * @returns {{ ok: boolean, errors: string[], map: object|null }}
 */
export function decodeFixture(fx) {
  const errors = [];
  if (!fx || typeof fx !== 'object') return { ok: false, errors: ['fixture is not an object'], map: null };
  if (!LOADED_MAP.fixtureFormats.includes(fx.format)) {
    return { ok: false, errors: [`unsupported map format ${fx.format}`], map: null };
  }
  const { levelHeight, floorThickness } = resolvePitch(fx, errors);
  checkCells(fx.matrix, errors);
  if (!Array.isArray(fx.primitives)) errors.push('primitives is not an array');
  if (errors.length) return { ok: false, errors, map: null };
  const map = {
    format: fx.format,
    seed: fx.seed,
    generator: fx.generator ?? null,
    tiers: fx.opts?.tiers ?? null,
    levelHeight,
    floorThickness,
    primitives: fx.primitives,
  };
  return { ok: true, errors, map };
}
