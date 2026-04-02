/**
 * Remove cyan and orange ladders whose top is near a walkway,
 * and remove yellow ladders whose parent walkway was deleted.
 */

import { CONNECTIVITY, DELETIONS } from '../../config.js';
import { isClose } from './is-close.js';

/**
 * Remove cyan and orange ladders whose top is near a walkway,
 * and remove yellow ladders whose parent walkway was deleted.
 * @param {object} ladderResults - { finalYellow, finalRed, finalOrange, finalInterior }
 * @param {object[]} finalWalkways
 * @returns {object} updated { survivingYellow, finalRed, finalOrange, finalInterior }
 */
export function postFilterLadders(ladderResults, finalWalkways) {
  let { finalYellow, finalRed, finalOrange, finalInterior } = ladderResults;

  // Remove cyan and orange ladders whose top is near a walkway
  const topDist = CONNECTIVITY.ladderTopWalkwayDist;
  if (DELETIONS.cyanLadderTopNearWalkway) {
    finalInterior = finalInterior.filter((l) => {
      for (const w of finalWalkways) {
        if (Math.abs(l.y1 - w.y) > 1) continue;
        if (isClose(l, w, topDist)) return false;
      }
      return true;
    });
  }
  if (DELETIONS.orangeLadderTopNearWalkway) {
    finalOrange = finalOrange.filter((l) => {
      for (const w of finalWalkways) {
        if (Math.abs(l.y1 - w.y) > 1) continue;
        if (isClose(l, w, topDist)) return false;
      }
      return true;
    });
  }

  // Remove yellow ladders whose parent walkway was deleted
  const survivingYellow = finalYellow.filter((l) =>
    finalWalkways.includes(l.parentWalkway)
  );

  return { survivingYellow, finalRed, finalOrange, finalInterior };
}
