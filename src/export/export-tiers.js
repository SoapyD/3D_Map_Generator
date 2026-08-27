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
 * Append 4 small axis-aligned box COLLIDERS to a collider OBJ string, one at each corner of the global
 * map footprint, spanning the tier's own height. TTS aligns the separately-imported tiers by their
 * COLLIDER bounding box, so these posts give every tier an identical XZ footprint box (→ tiers line up)
 * with a real per-tier height. Unlike the degenerate `appendBoundsCage` triangle, these are real solid
 * boxes so Unity cooks them cleanly (no flickering "come-and-go" invisible wall). They sit at the very
 * map corners (in the skirt/border, off the play area) and are collider-only, so units never meet them.
 * @param {number[]} gMin [x,y,z] global min corner (X/Z used; tier Y is passed explicitly)
 * @param {number[]} gMax [x,y,z] global max corner
 */
export function appendCornerColliders(objString, gMin, gMax, tierYMin, tierYMax, size = 1) {
  const f = (n) => n.toFixed(6);
  let vo = (objString.match(/^v /gm) || []).length + 1;
  const lines = [''];
  const corners = [
    [gMin[0], gMin[2]],
    [gMax[0] - size, gMin[2]],
    [gMin[0], gMax[2] - size],
    [gMax[0] - size, gMax[2] - size],
  ];
  corners.forEach(([x0, z0], i) => {
    const x1 = x0 + size, z1 = z0 + size, y0 = tierYMin, y1 = tierYMax;
    lines.push(`o tier_corner_${i}`);
    lines.push(`v ${f(x0)} ${f(y0)} ${f(z0)}`); // 0 ---
    lines.push(`v ${f(x1)} ${f(y0)} ${f(z0)}`); // 1 +--
    lines.push(`v ${f(x1)} ${f(y0)} ${f(z1)}`); // 2 +-+
    lines.push(`v ${f(x0)} ${f(y0)} ${f(z1)}`); // 3 --+
    lines.push(`v ${f(x0)} ${f(y1)} ${f(z0)}`); // 4 -+-
    lines.push(`v ${f(x1)} ${f(y1)} ${f(z0)}`); // 5 ++-
    lines.push(`v ${f(x1)} ${f(y1)} ${f(z1)}`); // 6 +++
    lines.push(`v ${f(x0)} ${f(y1)} ${f(z1)}`); // 7 -++
    const v = vo;
    lines.push(`f ${v} ${v + 1} ${v + 2}`, `f ${v} ${v + 2} ${v + 3}`);         // bottom
    lines.push(`f ${v + 6} ${v + 5} ${v + 4}`, `f ${v + 7} ${v + 6} ${v + 4}`); // top
    lines.push(`f ${v} ${v + 4} ${v + 5}`, `f ${v} ${v + 5} ${v + 1}`);         // front
    lines.push(`f ${v + 2} ${v + 6} ${v + 7}`, `f ${v + 2} ${v + 7} ${v + 3}`); // back
    lines.push(`f ${v + 3} ${v + 7} ${v + 4}`, `f ${v + 3} ${v + 4} ${v}`);     // left
    lines.push(`f ${v + 1} ${v + 5} ${v + 6}`, `f ${v + 1} ${v + 6} ${v + 2}`); // right
    lines.push('');
    vo += 8;
  });
  return objString.replace(/\n*$/, '') + '\n' + lines.join('\n');
}

/**
 * Build 4 corner-post PRIMITIVES for a tier — one at each corner of the global map footprint, spanning
 * the tier's own height. Emitted into BOTH the visual OBJ (so they render) and the collider (the
 * `border_` name prefix is collidable), they give every tier an identical XZ footprint bounding box
 * (→ TTS aligns the tiers) with a real per-tier height, and are visible solid posts at the map corners.
 * Textured with `map_border` (already in the atlas from the perimeter parapet).
 */
export function cornerPostPrimitives(gMin, gMax, tierYMin, tierYMax, tier, size = 1) {
  const h = tierYMax - tierYMin;
  const corners = [
    [gMin[0], gMin[2]],
    [gMax[0] - size, gMin[2]],
    [gMin[0], gMax[2] - size],
    [gMax[0] - size, gMax[2] - size],
  ];
  return corners.map(([x, z], i) => ({
    type: 'slab',
    name: `border_corner_t${tier}_${i}`,
    x, y: tierYMin, z, w: size, h, d: size,
    textureKey: 'map_border',
    solid: true, shared: false,
  }));
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

    // This tier's own vertical extent — the corner posts span the global XZ footprint but only this
    // height, so the tier's bounding box is full-footprint in X/Z and real-height in Y.
    let tierYMin = Infinity, tierYMax = -Infinity;
    for (const p of prims) {
      tierYMin = Math.min(tierYMin, primBaseY(p));
      tierYMax = Math.max(tierYMax, primTopY(p));
    }

    // 4 visible corner posts at the map footprint corners (this tier's height). Emitted into BOTH the
    // visual OBJ and the collider, they give every tier an identical XZ footprint bounding box so TTS
    // aligns the tiers (it centres by the collider box) — with real solid geometry, so no flickering
    // degenerate-triangle collider. They sit at the map corners (skirt/border, off the play area).
    const cornerPrims = cornerPostPrimitives(gMin, gMax, tierYMin, tierYMax, t);
    const emitPrims = [...prims, ...cornerPrims];

    const obj = emitPrimitivesToObj(emitPrims, config, atlasCtx, wallPrims);
    const { objString: rawCollision, count } = buildCollisionObj({ version: subset.version, primitives: emitPrims });
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
