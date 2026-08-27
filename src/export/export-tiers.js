/**
 * Per-tier split export — groups the world-baked geometry primitives by tier and produces one
 * OBJ + one simplified collider OBJ per non-empty tier, plus a manifest, all sharing a SINGLE
 * texture atlas PNG. Because geometry is world-baked, every per-tier file carries absolute
 * coordinates and self-aligns when all tiers are spawned at the same origin in Tabletop Simulator.
 *
 * Reuses the existing OBJ atlas/emitter (build-obj-and-atlas.js) and collider builder
 * (collision-buffer.js) — no geometry logic is duplicated here.
 */

import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { buildObjAtlas, emitPrimitivesToObj } from './obj-geometry/build-obj-and-atlas.js';
import { buildCollisionObj } from './collision-buffer.js';
import { tierOf, tierCount, primBaseY, primTopY } from './assign-primitive-tier.js';

/**
 * Partition primitives into per-tier geometry objects. Total + disjoint: every primitive lands
 * in exactly one tier, so the union of buckets equals the whole primitive list.
 * @returns {Map<number, { version: number, primitives: object[] }>} keyed 0..config.tiers
 */
export function groupPrimitivesByTier(geometry, config) {
  const groups = new Map();
  for (let t = 0; t < tierCount(config); t++) {
    groups.set(t, { version: geometry.version, primitives: [] });
  }
  for (const prim of geometry.primitives) {
    const t = tierOf(prim, config);
    groups.get(t).primitives.push(prim);
  }
  return groups;
}

/**
 * Build all per-tier buffers in memory. Builds the atlas ONCE over the full geometry and reuses
 * it for every tier's OBJ, so all tiers reference the same diffuse PNG.
 * @param {string} [baseName] used only for the filenames recorded in the manifest
 * @returns {{ manifest: object, atlasPngBuffer: Buffer,
 *            tiers: Array<{ tier: number, obj: string|null, collisionObj: string|null }> }}
 */
export function buildTierBuffers(geometry, config, baseName = `mordheim_map_${config.seed}`) {
  const atlasCtx = buildObjAtlas(geometry, config);
  const wallPrims = geometry.primitives.filter(p => p.type === 'wall');
  const groups = groupPrimitivesByTier(geometry, config);
  const levelHeight = config.tierHeight + config.slabThickness;

  const tiers = [];
  const manifestTiers = [];

  for (let t = 0; t < tierCount(config); t++) {
    const subset = groups.get(t);
    const prims = subset.primitives;

    if (prims.length === 0) {
      tiers.push({ tier: t, obj: null, collisionObj: null });
      manifestTiers.push({
        tier: t, obj: null, collision: null,
        primitiveCount: 0,
        xMin: null, xMax: null, yMin: null, yMax: null, zMin: null, zMax: null, center: null,
        empty: true,
      });
      continue;
    }

    const obj = emitPrimitivesToObj(prims, config, atlasCtx, wallPrims);
    const { objString: collisionObj, count } = buildCollisionObj(subset);

    // Full world-space bounds of this tier's geometry. The XZ centre lets a TTS loader realign the
    // separately-imported tier objects (TTS anchors a Custom_Model by its bounds centre, not the OBJ
    // origin, so each tier must be repositioned by its centre offset to restore world alignment).
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity, zMin = Infinity, zMax = -Infinity;
    for (const p of prims) {
      xMin = Math.min(xMin, p.x); xMax = Math.max(xMax, p.x + (p.w || 0));
      zMin = Math.min(zMin, p.z); zMax = Math.max(zMax, p.z + (p.d || 0));
      yMin = Math.min(yMin, primBaseY(p)); yMax = Math.max(yMax, primTopY(p));
    }
    const center = [(xMin + xMax) / 2, (yMin + yMax) / 2, (zMin + zMax) / 2];

    const objFile = `${baseName}_tier${t}.obj`;
    const colFile = count > 0 ? `${baseName}_tier${t}_collision.obj` : null;

    tiers.push({ tier: t, obj, collisionObj: count > 0 ? collisionObj : null });
    manifestTiers.push({
      tier: t, obj: objFile, collision: colFile,
      primitiveCount: prims.length,
      xMin, xMax, yMin, yMax, zMin, zMax, center,
      empty: false,
    });
  }

  const manifest = {
    version: 1,
    seed: config.seed,
    tierCount: tierCount(config),
    levelHeight,
    tierHeight: config.tierHeight,
    slabThickness: config.slabThickness,
    units: 'inches',
    tiers: manifestTiers,
  };

  return { manifest, atlasPngBuffer: atlasCtx.atlasPngBuffer, tiers };
}

/**
 * File sink: write per-tier OBJ + collider files, the shared atlas PNG, and the manifest JSON.
 * @returns {Promise<object>} the manifest that was written.
 */
export async function exportTiers(geometry, config, outputDir, baseName) {
  const { manifest, atlasPngBuffer, tiers } = buildTierBuffers(geometry, config, baseName);

  await mkdir(outputDir, { recursive: true });
  // Shared diffuse atlas — one PNG for every tier. Same file the combined OBJ export writes.
  await writeFile(path.join(outputDir, `${baseName}.png`), atlasPngBuffer);

  for (const t of tiers) {
    if (t.obj === null) continue;
    await writeFile(path.join(outputDir, `${baseName}_tier${t.tier}.obj`), t.obj);
    if (t.collisionObj !== null) {
      await writeFile(path.join(outputDir, `${baseName}_tier${t.tier}_collision.obj`), t.collisionObj);
    }
  }

  await writeFile(
    path.join(outputDir, `${baseName}_tiers.json`),
    JSON.stringify(manifest, null, 2),
  );

  return manifest;
}
