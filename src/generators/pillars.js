/**
 * Pillar support generation for walkways and bridges.
 */

import { CONNECTIVITY } from '../config.js';

/**
 * Generate pillar supports underneath long walkways and bridges.
 * Pillars extend from just below the walkway down to ground (y=0) or a flush floor/roof.
 * Skipped if they partially overlap a floor/roof, or overlap another walkway/bridge.
 */
export function generatePillars(walkways, bridges, data, config) {
  const pillarW = CONNECTIVITY.pillarWidth || 0.5;
  const spacing = CONNECTIVITY.pillarSpacing || 6;
  const inset = CONNECTIVITY.pillarEdgeInset || 1.0;
  const minHeight = CONNECTIVITY.pillarMinHeight || 1.0;
  const minLen = CONNECTIVITY.pillarMinWalkwayLength || 8;
  const { tierHeight, slabThickness } = config;

  const allConnections = [...walkways, ...bridges];
  const pillars = [];

  // Collect all floor/roof surfaces with their Y positions
  const surfaces = [];
  for (const fd of data.floors) {
    if (fd.tier === 0) continue; // ground floor — pillar default bottom
    const surfaceY = fd.tier * tierHeight + slabThickness;
    for (const s of fd.sections) {
      surfaces.push({ x: s.x, z: s.z, w: s.w, d: s.d, y: surfaceY });
    }
  }
  if (data.roofs) {
    for (const r of data.roofs) {
      const s = r.section || r.building;
      if (!s) continue;
      const roofY = r.tier * tierHeight + slabThickness;
      surfaces.push({ x: s.x, z: s.z, w: s.w, d: s.d, y: roofY });
    }
  }

  for (const source of allConnections) {
    const runAxis = source.axis;
    const runLen = runAxis === 'x' ? source.w : source.d;
    if (runLen < minLen) continue;

    const runStart = (runAxis === 'x' ? source.x : source.z) + inset;
    const runEnd = (runAxis === 'x' ? source.x + source.w : source.z + source.d) - inset;
    const crossCentre = runAxis === 'x'
      ? source.z + source.d / 2
      : source.x + source.w / 2;

    const usableLen = runEnd - runStart;
    if (usableLen <= 0) continue;

    const numPillars = Math.max(1, Math.ceil(usableLen / spacing));
    const step = usableLen / numPillars;

    for (let i = 0; i <= numPillars; i++) {
      const pos = runStart + i * step;
      const eps = 0.01;

      // Build pillar rect
      const pr = runAxis === 'x'
        ? { x: pos - pillarW / 2, z: crossCentre - pillarW / 2, w: pillarW, d: pillarW }
        : { x: crossCentre - pillarW / 2, z: pos - pillarW / 2, w: pillarW, d: pillarW };

      // Rule 2: skip if overlaps any other walkway/bridge
      let blocked = false;
      for (const conn of allConnections) {
        if (conn === source) continue;
        if (Math.abs(conn.y - source.y) > 0.5 && conn.y > source.y) continue; // above walkway, ignore
        if (pr.x < conn.x + conn.w && pr.x + pr.w > conn.x &&
            pr.z < conn.z + conn.d && pr.z + pr.d > conn.z) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      // Rule 1: check floors/roofs below the walkway
      const topY = source.y;
      let bottomY = 0; // default: ground

      let skip = false;
      for (const surf of surfaces) {
        if (surf.y >= topY - eps) continue; // at or above walkway
        if (surf.y <= eps) continue;         // ground level

        const overlapsXZ = pr.x < surf.x + surf.w && pr.x + pr.w > surf.x &&
                           pr.z < surf.z + surf.d && pr.z + pr.d > surf.z;
        if (!overlapsXZ) continue;

        // Check if floor fully contains pillar footprint
        const fullyContains = surf.x <= pr.x + eps && surf.z <= pr.z + eps &&
                              surf.x + surf.w >= pr.x + pr.w - eps &&
                              surf.z + surf.d >= pr.z + pr.d - eps;

        if (fullyContains) {
          // Flush — pillar stops here (keep the highest valid surface)
          if (surf.y > bottomY) bottomY = surf.y;
        } else {
          // Partial overlap — skip this pillar entirely
          skip = true;
          break;
        }
      }
      if (skip) continue;

      const height = topY - bottomY;
      if (height < minHeight) continue;

      pillars.push({
        x: pr.x, z: pr.z, w: pr.w, d: pr.d,
        y: bottomY,
        height,
        textureId: source.textureId,
        isBridge: source.type === 'bridge',
      });
    }
  }

  if (pillars.length > 0) console.log('  Pillar supports: ' + pillars.length);
  return pillars;
}
