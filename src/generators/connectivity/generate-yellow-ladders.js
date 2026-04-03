/**
 * Generate yellow ladders for blocked walkways.
 */

import { buildYellowLadderAtEndpoint } from './generate-yellow-ladders-helpers.js';

/**
 * Generate yellow ladders for blocked walkways.
 * @param {object} ctx - { data, config }
 * @param {object[]} culledWalkways
 * @returns {object[]} ladders
 */
export function generateYellowLadders(ctx, culledWalkways) {
  const { data, config } = ctx;
  const ladders = [];

  for (let wi = 0; wi < culledWalkways.length; wi++) {
    const w = culledWalkways[wi];
    if (!w.blocked) continue;

    for (const endpoint of ['start', 'end']) {
      const ladder = buildYellowLadderAtEndpoint(w, endpoint, data, config);
      if (ladder) ladders.push(ladder);
    }
  }

  return ladders;
}
