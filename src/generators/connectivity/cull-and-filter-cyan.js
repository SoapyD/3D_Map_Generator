import { DELETIONS } from '../../config.js';
import { proximityCullIndices } from './proximity-cull-indices.js';

export function cullAndFilterCyan(interiorLadders, finalOrange, rng, CONNECTIVITY_CFG) {
  let culled = DELETIONS.cyanLadderCull
    ? (rng.shuffle(interiorLadders), interiorLadders.slice(0, Math.max(1, Math.ceil(interiorLadders.length * CONNECTIVITY_CFG.cyanLadderCullRatio))))
    : interiorLadders;

  if (DELETIONS.cyanLadderProximityCull) {
    const dropSet = proximityCullIndices(culled, null, CONNECTIVITY_CFG.proximity);
    culled = culled.filter((_, i) => !dropSet.has(i));
  }

  if (DELETIONS.cyanLadderOrangeOverlap) {
    culled = culled.filter((cl) => {
      for (const ol of finalOrange) {
        if (cl.x < ol.x + ol.w && cl.x + cl.w > ol.x &&
            cl.z < ol.z + ol.d && cl.z + cl.d > ol.z) return false;
      }
      return true;
    });
  }

  return culled;
}
