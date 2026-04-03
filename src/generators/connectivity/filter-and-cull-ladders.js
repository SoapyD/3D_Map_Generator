/**
 * Filter and cull all ladder types, apply proximity and overlap culling.
 */
import { CONNECTIVITY, DELETIONS } from '../../config.js';
import { isClose } from './is-close.js';
import { filterOrangeOverlaps } from './filter-orange-overlaps.js';
import { proximityCullIndices } from './proximity-cull-indices.js';
import { cullAndFilterCyan } from './cull-and-filter-cyan.js';

export function filterAndCullLadders(ctx, ladderSets, culledWalkways) {
  const { data, config, rng } = ctx;
  const { tierHeight } = config;
  const { ladders, filteredGroundLadders, orangeLadders, interiorLadders } = ladderSets;
  const PROXIMITY = CONNECTIVITY.proximity;

  const filteredOrangeLadders = filterOrangeOverlaps(orangeLadders, culledWalkways, filteredGroundLadders);
  const culledGroundLadders = DELETIONS.redLadderCull
    ? (rng.shuffle(filteredGroundLadders), filteredGroundLadders.slice(0, Math.max(1, Math.ceil(filteredGroundLadders.length * CONNECTIVITY.ladderCullRatio))))
    : filteredGroundLadders;
  const culledOrangeLadders = DELETIONS.orangeLadderCull
    ? (rng.shuffle(filteredOrangeLadders), filteredOrangeLadders.slice(0, Math.max(1, Math.ceil(filteredOrangeLadders.length * CONNECTIVITY.ladderCullRatio))))
    : filteredOrangeLadders;

  // Yellow ladders vs red + orange proximity (external-only comparison)
  let finalYellow;
  if (DELETIONS.yellowLadderProximityCull) {
    const allRedOrange = [...culledGroundLadders, ...culledOrangeLadders];
    const yellowDropSet = new Set();
    for (let i = 0; i < ladders.length; i++) {
      if (yellowDropSet.has(i)) continue;
      for (const other of allRedOrange) {
        if (Math.abs(ladders[i].y0 - other.y0) > 0.5) continue;
        if (isClose(ladders[i], other, PROXIMITY)) {
          yellowDropSet.add(i);
          break;
        }
      }
    }
    finalYellow = ladders.filter((_, i) => !yellowDropSet.has(i));
  } else {
    finalYellow = ladders;
  }

  // Red ladders: self + vs orange proximity
  let finalRed;
  if (DELETIONS.redLadderProximityCull) {
    const redDropSet = proximityCullIndices(culledGroundLadders, culledOrangeLadders, PROXIMITY);
    finalRed = culledGroundLadders.filter((_, i) => !redDropSet.has(i));
  } else {
    finalRed = culledGroundLadders;
  }

  // Orange ladders: self-only proximity
  let finalOrange;
  if (DELETIONS.orangeLadderProximityCull) {
    const orangeDropSet = proximityCullIndices(culledOrangeLadders, null, PROXIMITY);
    finalOrange = culledOrangeLadders.filter((_, i) => !orangeDropSet.has(i));
  } else {
    finalOrange = culledOrangeLadders;
  }

  // Post-process: flag orange ladders that don't have floor at their top tier
  for (const ol of finalOrange) {
    const endTier = Math.round(ol.y1 / tierHeight);
    const fd = data.floors.find((f) => f.tier === endTier);
    const hasFloor = fd && fd.sections.some((s) =>
      ol.x < s.x + s.w + 1 && ol.x + ol.w > s.x - 1 &&
      ol.z < s.z + s.d + 1 && ol.z + ol.d > s.z - 1
    );
    if (!hasFloor) ol.bad = true;
  }

  const finalInterior = cullAndFilterCyan(interiorLadders, finalOrange, rng, CONNECTIVITY);

  return { finalYellow, finalRed, finalOrange, finalInterior };
}
