/**
 * Branching walkways: T-junctions off forced connections to nearby buildings.
 */

import { CONNECTIVITY } from '../config.js';
import { findBuildingIndex } from './connectivity-utils.js';

/**
 * Generate branching walkways (T-junctions) off forced connections to nearby buildings.
 * For each forced walkway, scan perpendicular for building floors at the same tier.
 * Creates a perpendicular branch segment + junction platform at the intersection.
 */
export function generateBranches(data, allWalkways, config) {
  const { tierHeight } = config;
  const buildings = data.buildings;
  const floors = data.floors;
  const minLen = CONNECTIVITY.branchMinLength || 3;
  const maxLen = CONNECTIVITY.branchMaxLength || 14;
  const maxBranches = CONNECTIVITY.branchMaxPerMap || 2;


  const forcedWalkways = allWalkways.filter(w => w.forced);
  if (forcedWalkways.length === 0) return { branches: [], junctionPlatforms: [] };

  const candidates = [];

  for (const fw of forcedWalkways) {
    const fwTier = Math.round(fw.y / tierHeight);
    const tierFloors = floors.find(f => f.tier === fwTier);
    if (!tierFloors) continue;

    // Collect all sections at this tier (floors + roofs)
    const allSections = [...tierFloors.sections];
    if (data.roofs) {
      for (const r of data.roofs) {
        if (r.tier === fwTier && r.section) allSections.push(r.section);
      }
    }

    // Find which buildings the forced walkway connects (so we don't branch back to them)
    const connectedBIs = new Set();
    for (const s of allSections) {
      const bi = findBuildingIndex(s, buildings);
      if (bi < 0) continue;
      if (fw.axis === 'x') {
        // Start/end buildings: floor edge near walkway start or end X
        if (Math.abs(s.x + s.w - fw.x) < 0.5 || Math.abs(s.x - (fw.x + fw.w)) < 0.5) {
          connectedBIs.add(bi);
        }
      } else {
        if (Math.abs(s.z + s.d - fw.z) < 0.5 || Math.abs(s.z - (fw.z + fw.d)) < 0.5) {
          connectedBIs.add(bi);
        }
      }
    }

    // Scan perpendicular: for each section not connected to this walkway,
    // check if it's reachable perpendicular from anywhere along the walkway
    const branchAxis = fw.axis === 'x' ? 'z' : 'x';
    const WALKWAY_WIDTH = CONNECTIVITY.walkwayWidth;

    for (const s of allSections) {
      const bi = findBuildingIndex(s, buildings);
      if (bi < 0 || connectedBIs.has(bi)) continue;

      if (branchAxis === 'z') {
        // Branch runs along Z; need section whose X range overlaps the walkway's X span
        const overlapMin = Math.max(s.x, fw.x);
        const overlapMax = Math.min(s.x + s.w, fw.x + fw.w);
        if (overlapMax - overlapMin < WALKWAY_WIDTH) continue;

        const fwEdgeN = fw.z;
        const fwEdgeS = fw.z + fw.d;
        // Try both directions
        for (const dir of [-1, 1]) {
          let dist;
          if (dir > 0) {
            dist = s.z - fwEdgeS; // section is south of walkway
          } else {
            dist = fwEdgeN - (s.z + s.d); // section is north of walkway
          }
          if (dist < minLen || dist > maxLen) continue;

          // Anchor X: centre of the overlap between walkway and section X ranges
          const anchorX = (overlapMin + overlapMax) / 2;
          const clampedX = Math.max(s.x + WALKWAY_WIDTH / 2, Math.min(anchorX, s.x + s.w - WALKWAY_WIDTH / 2));

          let startZ, endZ;
          if (dir > 0) { startZ = fwEdgeS; endZ = s.z; }
          else { startZ = s.z + s.d; endZ = fwEdgeN; }
          if (endZ <= startZ) continue;

          const branch = {
            type: 'walkway', x: clampedX - WALKWAY_WIDTH / 2, z: startZ,
            w: WALKWAY_WIDTH, d: endZ - startZ, y: fw.y, axis: 'z', forced: true, branch: true, parentRef: fw,
          };

          candidates.push({ branch, length: dist, parent: fw });
        }
      } else {
        // Branch runs along X; need section whose Z range overlaps the walkway's Z span
        const overlapMin = Math.max(s.z, fw.z);
        const overlapMax = Math.min(s.z + s.d, fw.z + fw.d);
        if (overlapMax - overlapMin < WALKWAY_WIDTH) continue;

        const fwEdgeW = fw.x;
        const fwEdgeE = fw.x + fw.w;
        for (const dir of [-1, 1]) {
          let dist;
          if (dir > 0) {
            dist = s.x - fwEdgeE; // section is east
          } else {
            dist = fwEdgeW - (s.x + s.w); // section is west
          }
          if (dist < minLen || dist > maxLen) continue;

          const anchorZ = (overlapMin + overlapMax) / 2;
          const clampedZ = Math.max(s.z + WALKWAY_WIDTH / 2, Math.min(anchorZ, s.z + s.d - WALKWAY_WIDTH / 2));

          let startX, endX;
          if (dir > 0) { startX = fwEdgeE; endX = s.x; }
          else { startX = s.x + s.w; endX = fwEdgeW; }
          if (endX <= startX) continue;

          const branch = {
            type: 'walkway', x: startX, z: clampedZ - WALKWAY_WIDTH / 2,
            w: endX - startX, d: WALKWAY_WIDTH, y: fw.y, axis: 'x', forced: true, branch: true, parentRef: fw,
          };

          candidates.push({ branch, length: dist, parent: fw });
        }
      }
    }
  }

  // Filter: remove branches that pass through floors or overlap existing walkways
  const valid = candidates.filter(c => {
    const b = c.branch;
    const bTier = Math.round(b.y / tierHeight);
    const tierFloors = floors.find(f => f.tier === bTier);
    const sectionsAtTier = tierFloors ? [...tierFloors.sections] : [];
    if (data.roofs) {
      for (const r of data.roofs) {
        if (r.tier === bTier && r.section) sectionsAtTier.push(r.section);
      }
    }
    // Check passthrough
    for (const s of sectionsAtTier) {
      const overlapX = Math.min(b.x + b.w, s.x + s.w) - Math.max(b.x, s.x);
      const overlapZ = Math.min(b.z + b.d, s.z + s.d) - Math.max(b.z, s.z);
      if (b.axis === 'x' && overlapX > 1 && overlapZ > 0) return false;
      if (b.axis === 'z' && overlapZ > 1 && overlapX > 0) return false;
    }
    // Check overlap with existing walkways (skip the parent forced walkway)
    for (const ew of allWalkways) {
      if (ew === c.parent) continue;
      if (Math.abs(ew.y - b.y) > 0.5) continue;
      if (b.x < ew.x + ew.w + 0.5 && b.x + b.w > ew.x - 0.5 &&
          b.z < ew.z + ew.d + 0.5 && b.z + b.d > ew.z - 0.5) return false;
    }
    return true;
  });

  // Keep the longest branches, up to max
  valid.sort((a, b) => b.length - a.length);
  const kept = valid.slice(0, maxBranches);

  const branches = kept.map(c => c.branch);

  if (branches.length > 0) console.log('  Branching walkways: ' + branches.length);
  return { branches };
}
