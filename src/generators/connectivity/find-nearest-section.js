import { findBuildingIndex } from './find-building-index.js';

export function findNearestSection(edge, bi, floorData, buildings) {
  let bestSection = null;
  let bestDist = Infinity;
  for (const section of floorData.sections) {
    const sbi = findBuildingIndex(section, buildings);
    if (sbi === bi) continue;
    const nearX = Math.max(section.x, Math.min(edge.x, section.x + section.w));
    const nearZ = Math.max(section.z, Math.min(edge.z, section.z + section.d));
    const dist = Math.sqrt((edge.x - nearX) ** 2 + (edge.z - nearZ) ** 2);
    if (dist < bestDist) { bestDist = dist; bestSection = section; }
  }
  return { bestSection, bestDist };
}
