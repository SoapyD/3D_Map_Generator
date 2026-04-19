import { FLOOR, BUILDING } from '../../config.js';
import { pickAdjacentToRemoved } from '../selectors/index.js';
import { quadrantsToSections } from './quadrants-to-sections.js';

export function processBuildingFloors(building, buildingIndex, data, config, rng) {
  const bq = { tiers: {} };
  const removed = new Set();
  let tier0Count = 0;
  const isTower = building.size === 'tower';
  const tierSections = [];
  const roofs = [];

  if (building.shape && BUILDING.smallShapes && BUILDING.smallShapes[building.shape]) {
    for (const q of BUILDING.smallShapes[building.shape].removed) removed.add(q);
  }

  const hasShape = building.shape && BUILDING.smallShapes && BUILDING.smallShapes[building.shape] && BUILDING.smallShapes[building.shape].removed.length > 0;
  for (let tier = 1; tier <= building.maxTier; tier++) {
    if (hasShape && tier === 1) {
      const present = new Set([0, 1, 2, 3].filter(q => !removed.has(q)));
      bq.tiers[tier] = present;
      const sections = quadrantsToSections(building, present);
      const isRoofTier = tier === building.maxTier;
      if (isRoofTier && building.pyramidRoof) {
        roofs.push({ type: 'pyramid', tier, building, buildingIndex });
      } else if (isRoofTier) {
        for (const s of sections) roofs.push({ type: 'flat', tier, section: s, buildingIndex });
      } else {
        tierSections.push({ tier, sections });
      }
      continue;
    }

    const removalCount = removed.size;
    if (removalCount === 0) {
      tier0Count++;
      if (!isTower && (tier0Count > FLOOR.maxTier0Floors || (tier > 1 && rng.chance(FLOOR.tier1EscalateChance)))) {
        const available = [0, 1, 2, 3].filter(q => !removed.has(q));
        removed.add(rng.pick(available));
      }
    } else if (removalCount === 1) {
      if (rng.chance(FLOOR.tier2EscalateChance)) {
        const adj = pickAdjacentToRemoved(removed, rng);
        if (adj !== null) removed.add(adj);
      }
    } else if (removalCount === 2) {
      if (rng.chance(FLOOR.tier3EscalateChance)) {
        const adj = pickAdjacentToRemoved(removed, rng);
        if (adj !== null) removed.add(adj);
      }
    }

    const present = new Set([0, 1, 2, 3].filter(q => !removed.has(q)));
    bq.tiers[tier] = present;
    const sections = quadrantsToSections(building, present);
    const isRoofTier = tier === building.maxTier;
    if (isRoofTier && building.pyramidRoof) {
      roofs.push({ type: 'pyramid', tier, building, buildingIndex });
    } else if (isRoofTier) {
      for (const s of sections) roofs.push({ type: 'flat', tier, section: s, buildingIndex });
    } else {
      tierSections.push({ tier, sections });
    }
  }

  return { bq, tierSections, roofs };
}
