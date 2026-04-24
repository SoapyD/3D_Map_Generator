import { CELL, STAGE } from '../collision/matrix.js';
import { labelRoofCells } from './label-roof-cells.js';

/**
 * Stage 5: Roof Slab Generation
 *
 * Consumes data.roofSlabs (the topmost level per building, pre-computed with
 * quadrant damage by the Floors stage). Writes each rect as CELL.ROOF, then
 * runs the direction-labelling pass to produce ROOF_N/S/E/W on exposed edges.
 * roofSlabs is dropped from the output — downstream stages see only data.roofs.
 */
export function generateRoofs(data, config, matrix) {
  const { slabThickness } = config;
  const roofs = [];

  for (const slab of data.roofSlabs) {
    matrix.setWriteContext(STAGE.ROOFS, roofs.length);
    for (const rect of slab.rects) {
      matrix.fillBox(rect.x, slab.yCollisionLevel, rect.z, rect.w, slabThickness, rect.d, CELL.ROOF);
    }
    roofs.push({
      buildingId:    slab.buildingId,
      buildingIndex: slab.buildingIndex,
      yCollisionLevel: slab.yCollisionLevel,
      rects:         slab.rects,
      removedQuadrants: slab.removedQuadrants,
    });
  }

  const { roofSlabs, ...rest } = data;
  const roofData = { ...rest, roofs };
  labelRoofCells(roofData, matrix);
  return roofData;
}
