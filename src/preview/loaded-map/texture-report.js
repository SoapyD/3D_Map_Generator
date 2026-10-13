/**
 * Texture report: for every primitive textureKey, which pool and index it resolves to and
 * whether that is a real texture or a silent fallback (see report-key.js, resolve-key.js).
 */

import { buildTexturePools } from '../../generators/scene/index.js';
import { reportKey } from './report-key.js';

/** Rows grouped by textureKey with counts and primitive names (only primitives that draw a mesh). */
export function buildTextureReport(primitives, textureSet) {
  const pools = buildTexturePools(textureSet);
  const rows = new Map();
  for (const prim of primitives) {
    if (prim.type === 'edges') continue;
    const key = typeof prim.textureKey === 'string' ? prim.textureKey : '';
    if (!rows.has(key)) rows.set(key, { ...reportKey(key, pools), count: 0, names: [] });
    const row = rows.get(key);
    row.count++;
    row.names.push(prim.name);
  }
  const list = [...rows.values()].sort((a, b) => a.key.localeCompare(b.key));
  return { textureSet, rows: list, fallbackCount: list.filter((r) => r.status !== 'ok').length };
}
