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
 * Append an invisible "bounds cage" to an OBJ string: three collinear vertices at the global box's
 * min corner, max corner, and their midpoint, joined by one zero-area (degenerate) face. The face
 * never rasterises (zero area) and adds no collision surface (collinear), but the two corner vertices
 * force the mesh's bounding box to span the whole map. Giving every tier the same cage makes all tiers
 * share an identical bounding box, so TTS (which centres a Custom_Model on its bounds) places them
 * identically and the world-baked geometry aligns with no per-tier repositioning.
 * @param {number[]} gMin [x,y,z] global min corner
 * @param {number[]} gMax [x,y,z] global max corner
 */
export function appendBoundsCage(objString, gMin, gMax) {
  const vCount = (objString.match(/^v /gm) || []).length;
  const mid = [(gMin[0] + gMax[0]) / 2, (gMin[1] + gMax[1]) / 2, (gMin[2] + gMax[2]) / 2];
  const a = vCount + 1, b = vCount + 2, c = vCount + 3;
  const f = (n) => n.toFixed(6);
  return objString.replace(/\n*$/, '') + '\n' + [
    '# bounds cage — invisible zero-area face forcing identical bounds across all tiers (TTS alignment)',
    `v ${f(gMin[0])} ${f(gMin[1])} ${f(gMin[2])}`,
    `v ${f(gMax[0])} ${f(gMax[1])} ${f(gMax[2])}`,
    `v ${f(mid[0])} ${f(mid[1])} ${f(mid[2])}`,
    `f ${a} ${b} ${c}`,
    '',
  ].join('\n');
}

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

  // Global (whole-map) world-space bounds. Every per-tier OBJ + collider gets an invisible "bounds
  // cage" spanning this box, so all tiers share an IDENTICAL bounding box. TTS anchors a Custom_Model
  // by its bounds centre, so identical bounds mean every tier is placed identically and the
  // world-baked geometry lines up with no per-tier realignment (see appendBoundsCage).
  const gMin = [Infinity, Infinity, Infinity];
  const gMax = [-Infinity, -Infinity, -Infinity];
  for (const p of geometry.primitives) {
    gMin[0] = Math.min(gMin[0], p.x); gMax[0] = Math.max(gMax[0], p.x + (p.w || 0));
    gMin[2] = Math.min(gMin[2], p.z); gMax[2] = Math.max(gMax[2], p.z + (p.d || 0));
    gMin[1] = Math.min(gMin[1], primBaseY(p)); gMax[1] = Math.max(gMax[1], primTopY(p));
  }
  const gCenter = [(gMin[0] + gMax[0]) / 2, (gMin[1] + gMax[1]) / 2, (gMin[2] + gMax[2]) / 2];

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

    const obj = appendBoundsCage(emitPrimitivesToObj(prims, config, atlasCtx, wallPrims), gMin, gMax);
    const { objString: rawCollision, count } = buildCollisionObj(subset);
    const collisionObj = count > 0 ? appendBoundsCage(rawCollision, gMin, gMax) : null;

    const objFile = `${baseName}_tier${t}.obj`;
    const colFile = count > 0 ? `${baseName}_tier${t}_collision.obj` : null;

    tiers.push({ tier: t, obj, collisionObj });
    // Bounds reported are the SHARED global box (every tier's real mesh bounds after caging), so a
    // loader that aligns by manifest centre applies a zero shift — the cage already aligns them.
    manifestTiers.push({
      tier: t, obj: objFile, collision: colFile,
      primitiveCount: prims.length,
      xMin: gMin[0], xMax: gMax[0], yMin: gMin[1], yMax: gMax[1], zMin: gMin[2], zMax: gMax[2],
      center: [...gCenter],
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
