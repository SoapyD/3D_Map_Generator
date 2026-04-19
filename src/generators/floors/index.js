import { CELL } from '../collision/matrix.js';
import { processBuildingFloors } from './process-building-floors.js';

/**
 * Stage 3: Floor Plate Generation
 *
 * Generates one floor slab per tier for each building shell.
 * Slabs are written into the collision matrix as CELL.FLOOR.
 * Quadrant removal escalates upward to produce the ruined aesthetic.
 */
export function generateFloors(data, config, rng, matrix) {
  const { slabThickness } = config;
  const floors = [];

  for (let bi = 0; bi < data.buildings.length; bi++) {
    const building = data.buildings[bi];
    const buildingFloors = processBuildingFloors(building, bi, config, rng);

    for (const floor of buildingFloors) {
      // Write slab cells into collision matrix
      for (const rect of floor.rects) {
        matrix.fillBox(
          rect.x,
          floor.yCollisionLevel,
          rect.z,
          rect.w,
          slabThickness,
          rect.d,
          CELL.FLOOR,
        );
      }
      floors.push(floor);
    }
  }

  return { ...data, floors };
}
