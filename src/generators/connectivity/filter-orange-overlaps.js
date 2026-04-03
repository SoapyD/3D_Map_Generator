import { DELETIONS } from '../../config.js';

export function filterOrangeOverlaps(orangeLadders, culledWalkways, filteredGroundLadders) {
  return orangeLadders.filter((ol) => {
    if (DELETIONS.orangeLadderWalkwayOverlap) {
      for (const w of culledWalkways) {
        if (ol.x < w.x + w.w && ol.x + ol.w > w.x &&
            ol.z < w.z + w.d && ol.z + ol.d > w.z) return false;
      }
    }
    if (DELETIONS.orangeLadderRedOverlap) {
      for (const gl of filteredGroundLadders) {
        if (ol.x < gl.x + gl.w && ol.x + ol.w > gl.x &&
            ol.z < gl.z + gl.d && ol.z + ol.d > gl.z) return false;
      }
    }
    return true;
  });
}
