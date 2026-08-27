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
 * Append an invisible "bounds cage" to an OBJ string: three collinear vertices at the given box's
 * min corner, max corner, and their midpoint, joined by one zero-area (degenerate) face. The face
 * never rasterises (zero area) and adds no collision surface (collinear), but the two corner vertices
 * force the mesh's bounding box to span that box. Callers pass the global XZ footprint but the tier's
 * OWN height, so every tier gets an identical XZ box (TTS centres a Custom_Model on its bounds, so
 * uniform XZ → tiers auto-align horizontally) with a real per-tier height (normal-sized selection box;
 * placed units rest on the real floor). Vertical stacking comes from the loader's manifest offset.
 * @param {number[]} boxMin [x,y,z] min corner of the box to enclose
 * @param {number[]} boxMax [x,y,z] max corner
 */
export function appendBoundsCage(objString, boxMin, boxMax) {
  const gMin = boxMin, gMax = boxMax;
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

  // Global (whole-map) XZ footprint. Every per-tier OBJ + collider gets an invisible "footprint cage"
  // spanning this footprint in X/Z but only the tier's OWN height in Y. That gives every tier an
  // identical XZ bounding box (so TTS — which centres a Custom_Model on its bounds — places them
  // identically and they auto-align horizontally, like the bordered ground floor does) while keeping a
  // real per-tier height (so the selection box isn't a whole-map block and placed units rest on the
  // real floor, not a whole-map ceiling). Vertical stacking comes from the loader's per-tier manifest
  // offset. (Global Y is tracked only to report an accurate whole-map extent if ever needed.)
  const gMin = [Infinity, Infinity, Infinity];
  const gMax = [-Infinity, -Infinity, -Infinity];
  for (const p of geometry.primitives) {
    gMin[0] = Math.min(gMin[0], p.x); gMax[0] = Math.max(gMax[0], p.x + (p.w || 0));
    gMin[2] = Math.min(gMin[2], p.z); gMax[2] = Math.max(gMax[2], p.z + (p.d || 0));
    gMin[1] = Math.min(gMin[1], primBaseY(p)); gMax[1] = Math.max(gMax[1], primTopY(p));
  }

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

    // This tier's own vertical extent — the cage spans the global XZ footprint but only this height,
    // so the tier's bounding box is full-footprint in X/Z and real-height in Y.
    let tierYMin = Infinity, tierYMax = -Infinity;
    for (const p of prims) {
      tierYMin = Math.min(tierYMin, primBaseY(p));
      tierYMax = Math.max(tierYMax, primTopY(p));
    }
    const cageMin = [gMin[0], tierYMin, gMin[2]];
    const cageMax = [gMax[0], tierYMax, gMax[2]];

    const obj = appendBoundsCage(emitPrimitivesToObj(prims, config, atlasCtx, wallPrims), cageMin, cageMax);
    // Collider is deliberately NOT caged: it's real box-per-surface geometry only. The cage's
    // degenerate corner-to-corner triangle sits on Unity's collision-cooking threshold and would
    // intermittently cook into an invisible collision sliver across the floor (units hitting phantom
    // walls that "come and go"). Alignment needs only the VISUAL mesh's bounds (above), so the collider
    // stays clean.
    const { objString: rawCollision, count } = buildCollisionObj(subset);
    const collisionObj = count > 0 ? rawCollision : null;

    const objFile = `${baseName}_tier${t}.obj`;
    const colFile = count > 0 ? `${baseName}_tier${t}_collision.obj` : null;

    tiers.push({ tier: t, obj, collisionObj });
    // XZ bounds/centre are the SHARED global footprint (uniform → tiers auto-align horizontally); Y is
    // this tier's own extent, so the loader's manifest-centre offset stacks the tiers vertically.
    manifestTiers.push({
      tier: t, obj: objFile, collision: colFile,
      primitiveCount: prims.length,
      xMin: gMin[0], xMax: gMax[0], yMin: tierYMin, yMax: tierYMax, zMin: gMin[2], zMax: gMax[2],
      center: [(gMin[0] + gMax[0]) / 2, (tierYMin + tierYMax) / 2, (gMin[2] + gMax[2]) / 2],
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
