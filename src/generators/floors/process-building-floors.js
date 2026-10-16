import { FLOOR } from '../../config.js';
import { floorCellY, floorSurfaceY, floorGeomY } from '../../core/levels.js';
import { pickAdjacentToRemoved } from '../selectors/index.js';
import { quadrantsToSections } from './quadrants-to-sections.js';

/**
 * Generates floor plates for a single building shell.
 *
 * Produces one slab per tier; its matrix cell is floorCellY(floorIndex) (see src/core/levels.js).
 * Ground slab (i=0) sits at Y=-1; ground-floor walls therefore start at Y=0.
 * Quadrant removal escalates upward: higher floors lose more area, biased by damageLevel.
 */
export function processBuildingFloors(building, buildingIndex, config, rng) {
  const { damageLevel } = config;
  const removed = new Set();
  let intactCount = 0;
  const floors = [];

  const isRuins = building.size.startsWith('ruins');

  for (let i = 0; i < building.maxTier; i++) {
    if (!isRuins) {
      const removalCount = removed.size;

      if (removalCount === 0) {
        intactCount++;
        const overLimit = intactCount > FLOOR.maxIntactFloors;
        const chanceEscalate = i > 0 && rng.chance(FLOOR.tier1EscalateChance * damageLevel * 2);
        if (overLimit || chanceEscalate) {
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
    }

    const present = new Set([0, 1, 2, 3].filter(q => !removed.has(q)));
    let rects;
    if (isRuins) {
      rects = [{ x: building.x, z: building.z, w: building.w, d: building.d }];
    } else {
      rects = quadrantsToSections(building, present);
    }
    const yCollisionLevel = floorCellY(i, config);

    floors.push({
      buildingId: `b${buildingIndex}`,
      buildingIndex,
      floorIndex: i,
      yCollisionLevel,
      surfaceY: floorSurfaceY(i, config), // walking surface (top of the slab)
      geomY: floorGeomY(i, config),       // bottom face of the rendered (thin) slab
      rects,
      removedQuadrants: [...removed],
      materialKey: 'stone_floor',
    });
  }

  return floors;
}
