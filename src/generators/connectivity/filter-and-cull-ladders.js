/**
 * Filter and cull all ladder types, apply proximity and overlap culling.
 */

import { CONNECTIVITY, DELETIONS } from '../../config.js';
import { isClose } from './is-close.js';

/**
 * Filter and cull all ladder types, apply proximity and overlap culling.
 * @param {object} ctx - { data, config, rng }
 * @param {object} ladderSets - { ladders, filteredGroundLadders, orangeLadders, interiorLadders }
 * @param {object[]} culledWalkways
 * @returns {object} { finalYellow, finalRed, finalOrange, finalInterior }
 */
export function filterAndCullLadders(ctx, ladderSets, culledWalkways) {
  const { data, config, rng } = ctx;
  const { tierHeight } = config;
  const { ladders, filteredGroundLadders, orangeLadders, interiorLadders } = ladderSets;

  // Remove orange ladders that touch any walkway or red ladder
  const filteredOrangeLadders = orangeLadders.filter((ol) => {
    if (DELETIONS.orangeLadderWalkwayOverlap) {
      for (const w of culledWalkways) {
        if (ol.x < w.x + w.w && ol.x + ol.w > w.x &&
            ol.z < w.z + w.d && ol.z + ol.d > w.z) {
          return false;
        }
      }
    }
    if (DELETIONS.orangeLadderRedOverlap) {
      for (const gl of filteredGroundLadders) {
        if (ol.x < gl.x + gl.w && ol.x + ol.w > gl.x &&
            ol.z < gl.z + gl.d && ol.z + ol.d > gl.z) {
          return false;
        }
      }
    }
    return true;
  });

  // Cull red and orange ladders to 40% each
  const culledGroundLadders = DELETIONS.redLadderCull
    ? (rng.shuffle(filteredGroundLadders), filteredGroundLadders.slice(0, Math.max(1, Math.ceil(filteredGroundLadders.length * CONNECTIVITY.ladderCullRatio))))
    : filteredGroundLadders;

  const culledOrangeLadders = DELETIONS.orangeLadderCull
    ? (rng.shuffle(filteredOrangeLadders), filteredOrangeLadders.slice(0, Math.max(1, Math.ceil(filteredOrangeLadders.length * CONNECTIVITY.ladderCullRatio))))
    : filteredOrangeLadders;

  // Proximity culling — only delete if same tier start point
  const PROXIMITY = CONNECTIVITY.proximity;

  // Yellow ladders vs red + orange proximity
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

  // Red ladders vs red + orange proximity
  let finalRed;
  if (DELETIONS.redLadderProximityCull) {
    const redDropSet = new Set();
    for (let i = 0; i < culledGroundLadders.length; i++) {
      if (redDropSet.has(i)) continue;
      for (let j = i + 1; j < culledGroundLadders.length; j++) {
        if (redDropSet.has(j)) continue;
        if (Math.abs(culledGroundLadders[i].y0 - culledGroundLadders[j].y0) > 0.5) continue;
        if (isClose(culledGroundLadders[i], culledGroundLadders[j], PROXIMITY)) {
          redDropSet.add(j);
        }
      }
      for (const ol of culledOrangeLadders) {
        if (Math.abs(culledGroundLadders[i].y0 - ol.y0) > 0.5) continue;
        if (isClose(culledGroundLadders[i], ol, PROXIMITY)) {
          redDropSet.add(i);
          break;
        }
      }
    }
    finalRed = culledGroundLadders.filter((_, i) => !redDropSet.has(i));
  } else {
    finalRed = culledGroundLadders;
  }

  // Orange ladders vs other orange proximity
  let finalOrange;
  if (DELETIONS.orangeLadderProximityCull) {
    const orangeDropSet = new Set();
    for (let i = 0; i < culledOrangeLadders.length; i++) {
      if (orangeDropSet.has(i)) continue;
      for (let j = i + 1; j < culledOrangeLadders.length; j++) {
        if (orangeDropSet.has(j)) continue;
        if (Math.abs(culledOrangeLadders[i].y0 - culledOrangeLadders[j].y0) > 0.5) continue;
        if (isClose(culledOrangeLadders[i], culledOrangeLadders[j], PROXIMITY)) {
          orangeDropSet.add(j);
        }
      }
    }
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

  // Cyan (interior) ladder cull
  const culledInterior = DELETIONS.cyanLadderCull
    ? (rng.shuffle(interiorLadders), interiorLadders.slice(0, Math.max(1, Math.ceil(interiorLadders.length * CONNECTIVITY.cyanLadderCullRatio))))
    : interiorLadders;

  // Cyan ladder proximity cull (against other cyan, same start tier)
  let finalInterior;
  if (DELETIONS.cyanLadderProximityCull) {
    const cyanDropSet = new Set();
    for (let i = 0; i < culledInterior.length; i++) {
      if (cyanDropSet.has(i)) continue;
      for (let j = i + 1; j < culledInterior.length; j++) {
        if (cyanDropSet.has(j)) continue;
        if (Math.abs(culledInterior[i].y0 - culledInterior[j].y0) > 0.5) continue;
        if (isClose(culledInterior[i], culledInterior[j], PROXIMITY)) {
          cyanDropSet.add(j);
        }
      }
    }
    finalInterior = culledInterior.filter((_, i) => !cyanDropSet.has(i));
  } else {
    finalInterior = culledInterior;
  }

  // Remove cyan ladders that touch orange ladders
  if (DELETIONS.cyanLadderOrangeOverlap) {
    finalInterior = finalInterior.filter((cl) => {
      for (const ol of finalOrange) {
        if (cl.x < ol.x + ol.w && cl.x + cl.w > ol.x &&
            cl.z < ol.z + ol.d && cl.z + cl.d > ol.z) {
          return false;
        }
      }
      return true;
    });
  }

  return { finalYellow, finalRed, finalOrange, finalInterior };
}
