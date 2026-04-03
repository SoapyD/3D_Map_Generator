/**
 * Stage 5: Connectivity — ensures all elevated floor sections are reachable.
 */
import { DELETIONS } from '../../config.js';
import { detectGapsAndConnect } from '../gap-detection/index.js';
import { generateBranches } from './branching.js';
import { generatePillars } from './pillars.js';
import { generateWalkways } from './generate-walkways.js';
import { proximityCullWalkways } from './proximity-cull-walkways.js';
import { generateYellowLadders } from './generate-yellow-ladders.js';
import { generateGroundLadders } from './generate-ground-ladders.js';
import { generateOrangeLadders } from './generate-orange-ladders.js';
import { generateInteriorLadders } from './generate-interior-ladders.js';
import { filterAndCullLadders } from './filter-and-cull-ladders.js';
import { postFilterLadders } from './post-filter-ladders.js';
import { generateTowerLadders } from './generate-tower-ladders.js';
import { generateLadderPlatforms } from './generate-ladder-platforms.js';
import { upgradeToBridges } from './upgrade-to-bridges.js';

export function generateConnectivity(data, config, rng) {
  const { tierHeight } = config;
  const ctx = { data, config, rng };

  const { culledWalkways } = generateWalkways(ctx);

  const ladders = generateYellowLadders(ctx, culledWalkways);
  const filteredGroundLadders = generateGroundLadders(ctx, culledWalkways);
  const orangeLadders = generateOrangeLadders(ctx);
  const interiorLadders = generateInteriorLadders(ctx);

  let ladderResults = filterAndCullLadders(ctx,
    { ladders, filteredGroundLadders, orangeLadders, interiorLadders },
    culledWalkways
  );

  let finalWalkways = proximityCullWalkways(culledWalkways);

  ladderResults = postFilterLadders(ladderResults, finalWalkways);
  const { survivingYellow, finalOrange, finalInterior } = ladderResults;
  let { finalRed } = ladderResults;

  finalRed = generateTowerLadders(ctx, { survivingYellow, finalRed, finalOrange, finalInterior });

  const gapWalkways = detectGapsAndConnect(data, finalWalkways, [], config, rng);
  finalWalkways.push(...gapWalkways);

  const { branches } = generateBranches(data, finalWalkways, config);
  finalWalkways.push(...branches);

  const { bridges, remainingWalkways } = upgradeToBridges(finalWalkways, tierHeight, rng);

  const filteredPlatforms = generateLadderPlatforms(ctx,
    { survivingYellow, finalRed, finalOrange, finalInterior },
    finalWalkways, tierHeight
  );

  const pillars = DELETIONS.pillarGeneration
    ? generatePillars(remainingWalkways, bridges, data, config)
    : [];

  const connections = { ladders: survivingYellow, walkways: remainingWalkways, bridges, groundLadders: finalRed, orangeLadders: finalOrange, interiorLadders: finalInterior, ladderPlatforms: filteredPlatforms, pillars };
  return { ...data, connections };
}
