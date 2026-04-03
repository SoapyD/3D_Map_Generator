import { findBuildingIndex } from './find-building-index.js';

export function collectTierSectionsAndConnected(data, fw, tierHeight) {
  const buildings = data.buildings;
  const floors = data.floors;
  const fwTier = Math.round(fw.y / tierHeight);
  const tierFloors = floors.find(f => f.tier === fwTier);
  if (!tierFloors) return null;

  const allSections = [...tierFloors.sections];
  if (data.roofs) {
    for (const r of data.roofs) {
      if (r.tier === fwTier && r.section) allSections.push(r.section);
    }
  }

  const connectedBIs = new Set();
  for (const s of allSections) {
    const bi = findBuildingIndex(s, buildings);
    if (bi < 0) continue;
    if (fw.axis === 'x') {
      if (Math.abs(s.x + s.w - fw.x) < 0.5 || Math.abs(s.x - (fw.x + fw.w)) < 0.5) {
        connectedBIs.add(bi);
      }
    } else {
      if (Math.abs(s.z + s.d - fw.z) < 0.5 || Math.abs(s.z - (fw.z + fw.d)) < 0.5) {
        connectedBIs.add(bi);
      }
    }
  }

  return { allSections, connectedBIs };
}
