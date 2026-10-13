/**
 * Level maths barrel — single source of truth for vertical tier layout.
 * One function per file in ./levels/.
 *
 * slab cell: 1" matrix cell reserved for a slab; floor cell Y: matrix Y of a tier's slab cell;
 * floor surface: world Y of the walking surface; floor geom Y: world Y of the rendered slab's bottom face.
 */

export { slabCellHeight } from './levels/slabCellHeight.js';
export { floorThickness } from './levels/floorThickness.js';
export { levelHeight } from './levels/levelHeight.js';
export { floorCellY } from './levels/floorCellY.js';
export { floorSurfaceY } from './levels/floorSurfaceY.js';
export { floorGeomY } from './levels/floorGeomY.js';
export { floorIndexFromCy } from './levels/floorIndexFromCy.js';
export { tierIndexFromY } from './levels/tierIndexFromY.js';
export { wallBaseY } from './levels/wallBaseY.js';
export { nextFloorCellY } from './levels/nextFloorCellY.js';
export { wallMatrixRows } from './levels/wallMatrixRows.js';
export { wallGeomHeight } from './levels/wallGeomHeight.js';
export { shellHeight } from './levels/shellHeight.js';
export { matrixHeight } from './levels/matrixHeight.js';
