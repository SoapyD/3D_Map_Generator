import { CELL } from '../collision/matrix.js';
import { processBuildingFloors } from './process-building-floors.js';
import { labelFloorCells } from './label-floor-cells.js';

/**
 * Stage 3: Floor Plate Generation
 *
 * Runs the full damage-escalation pass for every building (all tiers).
 * Interior slabs (all but the topmost) are written as CELL.FLOOR and stored
 * in data.floors. The topmost slab per building is stored in data.roofSlabs
 * and passed through to the Roofs stage — it is NOT written here.
 */
export function generateFloors(data, config, rng, matrix) {
  const { slabThickness } = config;
  const floors = [];
  const roofSlabs = [];

  for (let bi = 0; bi < data.buildings.length; bi++) {
    const building = data.buildings[bi];
    const allLevels = processBuildingFloors(building, bi, config, rng);

    for (const level of allLevels) {
      if (level.floorIndex === building.maxTier - 1) {
        roofSlabs.push(level);
      } else {
        for (const rect of level.rects) {
          matrix.fillBox(rect.x, level.yCollisionLevel, rect.z, rect.w, slabThickness, rect.d, CELL.FLOOR);
        }
        floors.push(level);
      }
    }
  }

  const floorData = { ...data, floors, roofSlabs };
  labelFloorCells(floorData, matrix);
  return floorData;
}
