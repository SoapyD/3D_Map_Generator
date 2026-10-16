import { resolveKey } from './resolve-key.js';

function classify(resolved, pools) {
  const pool = pools[resolved.pool];
  if (Number.isNaN(resolved.index)) return { status: 'bad-index', file: null, slot: null };
  const slot = Math.abs(resolved.index) % pool.length;
  const mat = pool[slot];
  if (mat._fallbackReason) return { status: mat._fallbackReason, file: null, slot };
  return { status: resolved.unknown ? 'unknown-key' : 'ok', file: mat._fileName ?? null, slot };
}

/** Report row for one key. status: ok | unknown-key | pool-empty | file-missing | bad-index. */
export function reportKey(textureKey, pools) {
  const resolved = resolveKey(textureKey);
  const { status, file, slot } = classify(resolved, pools);
  return { key: textureKey, pool: resolved.pool, index: slot, file, status };
}
