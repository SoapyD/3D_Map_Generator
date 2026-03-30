/**
 * Stage 2: Building Footprint Generation
 *
 * Creates a haphazard mix of large, medium, and small ruins.
 * Targets ~70% coverage of the available block area.
 * Buildings vary significantly in size and are packed densely.
 *
 * Output: Array of buildings { x, z, w, d, maxTier, size, blockIndex }
 */

import { BUILDING, DELETIONS } from '../config.js';
import { placeBigLayout } from './building-layouts.js';

const FOOTPRINTS = BUILDING.footprints;
const HEIGHTS = BUILDING.heights;
const BUILDING_GAP = BUILDING.gap;

/**
 * Pick a building shape using weighted random selection for a given size category.
 */
export function pickShape(rng, sizeCategory = 'small') {
  const shapeMap = {
    small: BUILDING.smallShapes,
    medium: BUILDING.mediumShapes,
    large: BUILDING.largeShapes,
  };
  const shapes = shapeMap[sizeCategory] || BUILDING.smallShapes;
  if (!shapes) return 'full';

  const entries = Object.entries(shapes);
  const totalWeight = entries.reduce((sum, [, s]) => sum + s.weight, 0);
  const roll = rng.random() * totalWeight;
  let cumulative = 0;
  for (const [name, s] of entries) {
    cumulative += s.weight;
    if (roll < cumulative) return name;
  }
  return 'full';
}

/**
 * @param {{ blocks: Array<{x,z,w,d}> }} gridData
 * @param {object} config
 * @param {object} rng
 * @returns {{ buildings: Array, blocks: Array, streets: Array }}
 */
export function generateBuildings(gridData, config, rng) {
  const { tiers } = config;
  const buildings = [];

  // Use the average small footprint size to determine grid count
  const avgSize = (FOOTPRINTS.small.min + FOOTPRINTS.small.max) / 2;
  const minCellSize = avgSize * BUILDING.cellSizeMultiplier;

  // Figure out how many fit, then stretch the cell size to fill the map
  const cols = Math.floor(config.mapWidth / minCellSize);
  const rows = Math.floor(config.mapDepth / minCellSize);
  const cellW = config.mapWidth / cols;
  const cellD = config.mapDepth / rows;

  let towerCount = 0;
  const maxTowers = BUILDING.maxTowers || Infinity;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellX = col * cellW;
      const cellZ = row * cellD;

      // Chance to place a tower instead of a small building
      if (towerCount < maxTowers && BUILDING.towerChance && rng.chance(BUILDING.towerChance)) {
        const tFp = FOOTPRINTS.tower || { min: 2, max: 3 };
        const w = rng.float(tFp.min, tFp.max);
        const d = rng.float(tFp.min, tFp.max);
        const x = cellX + (cellW - w) / 2;
        const z = cellZ + (cellD - d) / 2;
        const pyramidRoof = rng.chance(BUILDING.pyramidRoofChance);
        buildings.push({ x, z, w, d, maxTier: tiers, size: 'tower', height: 'tall', blockIndex: 0, pyramidRoof });
        towerCount++;
      } else {
        // Standard small building
        const w = rng.float(FOOTPRINTS.small.min, FOOTPRINTS.small.max);
        const d = rng.float(FOOTPRINTS.small.min, FOOTPRINTS.small.max);
        const x = cellX + (cellW - w) / 2;
        const z = cellZ + (cellD - d) / 2;

        const heightKey = rng.pick(['short', 'medium', 'tall']);
        const height = HEIGHTS[heightKey];
        const maxTier = rng.int(Math.min(height.tierMin, tiers), Math.min(height.tierMax, tiers));

        // Pick a building shape
        const shape = pickShape(rng);

        if (shape === 'diagA' || shape === 'diagB') {
          // Diagonal: two independent single-quadrant buildings
          const groupId = buildings.length; // all parts share this texture group
          const hw = w / 2;
          const hd = d / 2;
          const hk2 = rng.pick(['short', 'medium', 'tall']);
          const h2 = HEIGHTS[hk2];
          const mt2 = rng.int(Math.min(h2.tierMin, tiers), Math.min(h2.tierMax, tiers));

          if (shape === 'diagA') {
            buildings.push({ x, z, w: hw, d: hd, maxTier, size: 'small', height: heightKey, blockIndex: 0, shape: 'full', textureGroup: groupId });
            buildings.push({ x: x + hw, z: z + hd, w: hw, d: hd, maxTier: mt2, size: 'small', height: hk2, blockIndex: 0, shape: 'full', textureGroup: groupId });
          } else {
            buildings.push({ x: x + hw, z, w: hw, d: hd, maxTier, size: 'small', height: heightKey, blockIndex: 0, shape: 'full', textureGroup: groupId });
            buildings.push({ x, z: z + hd, w: hw, d: hd, maxTier: mt2, size: 'small', height: hk2, blockIndex: 0, shape: 'full', textureGroup: groupId });
          }
        } else if (shape.startsWith('lShape')) {
          // L-shape: 3 segments long × 2 segments wide, 4 of 6 cells filled
          const groupId = buildings.length;
          const segW = rng.float(FOOTPRINTS.small.min, FOOTPRINTS.small.max);
          const segD = rng.float(FOOTPRINTS.small.min, FOOTPRINTS.small.max);

          // The strip is 1 segment wide × 3 segments deep
          // The extension is 1 segment wide × 1 segment deep, adjacent to one end
          let strip, ext, stripSuppress, extSuppress;
          if (shape === 'lShapeSW') {
            // #.
            // #.
            // ##
            strip = { x, z, w: segW, d: segD * 3 };
            ext   = { x: x + segW, z: z + segD * 2, w: segW, d: segD };
            // Strip suppresses east wall in the zone where ext meets it
            stripSuppress = [{ edge: 'east', zMin: ext.z, zMax: ext.z + ext.d }];
            extSuppress = [{ edge: 'west' }];
          } else if (shape === 'lShapeSE') {
            // .#
            // .#
            // ##
            strip = { x: x + segW, z, w: segW, d: segD * 3 };
            ext   = { x, z: z + segD * 2, w: segW, d: segD };
            stripSuppress = [{ edge: 'west', zMin: ext.z, zMax: ext.z + ext.d }];
            extSuppress = [{ edge: 'east' }];
          } else if (shape === 'lShapeNW') {
            // ##
            // #.
            // #.
            strip = { x, z, w: segW, d: segD * 3 };
            ext   = { x: x + segW, z, w: segW, d: segD };
            stripSuppress = [{ edge: 'east', zMin: ext.z, zMax: ext.z + ext.d }];
            extSuppress = [{ edge: 'west' }];
          } else { // lShapeNE
            // ##
            // .#
            // .#
            strip = { x: x + segW, z, w: segW, d: segD * 3 };
            ext   = { x, z, w: segW, d: segD };
            stripSuppress = [{ edge: 'west', zMin: ext.z, zMax: ext.z + ext.d }];
            extSuppress = [{ edge: 'east' }];
          }

          buildings.push({ x: strip.x, z: strip.z, w: strip.w, d: strip.d, maxTier, size: 'small', height: heightKey, blockIndex: 0, shape: 'full', suppressEdges: stripSuppress, textureGroup: groupId });
          buildings.push({ x: ext.x, z: ext.z, w: ext.w, d: ext.d, maxTier, size: 'small', height: heightKey, blockIndex: 0, shape: 'full', suppressEdges: extSuppress, textureGroup: groupId });
        } else if (shape.startsWith('uShape')) {
          // U-shape: 3×2 grid, two columns + connecting bar
          const segW = rng.float(FOOTPRINTS.small.min, FOOTPRINTS.small.max);
          const segD = rng.float(FOOTPRINTS.small.min, FOOTPRINTS.small.max);

          // Three parts: left column, right column, connecting bar
          // The open side has no bar
          let left, right, bar, leftSup, rightSup, barSup;
          if (shape === 'uShapeN') {
            // #.#    open top
            // #.#
            // ###
            left  = { x, z, w: segW, d: segD * 3 };
            right = { x: x + segW * 2, z, w: segW, d: segD * 3 };
            bar   = { x: x + segW, z: z + segD * 2, w: segW, d: segD };
            leftSup  = [{ edge: 'east', zMin: bar.z, zMax: bar.z + bar.d }];
            rightSup = [{ edge: 'west', zMin: bar.z, zMax: bar.z + bar.d }];
            barSup   = [{ edge: 'west' }, { edge: 'east' }];
          } else if (shape === 'uShapeS') {
            // ###    open bottom
            // #.#
            // #.#
            left  = { x, z, w: segW, d: segD * 3 };
            right = { x: x + segW * 2, z, w: segW, d: segD * 3 };
            bar   = { x: x + segW, z, w: segW, d: segD };
            leftSup  = [{ edge: 'east', zMin: bar.z, zMax: bar.z + bar.d }];
            rightSup = [{ edge: 'west', zMin: bar.z, zMax: bar.z + bar.d }];
            barSup   = [{ edge: 'west' }, { edge: 'east' }];
          } else if (shape === 'uShapeE') {
            // ##.    open right (rotated: rows are horizontal)
            // ###
            // ##.
            left  = { x, z, w: segW * 3, d: segD };              // top row
            right = { x, z: z + segD * 2, w: segW * 3, d: segD }; // bottom row
            bar   = { x, z: z + segD, w: segW, d: segD };         // left connecting bar
            leftSup  = [{ edge: 'south', xMin: bar.x, xMax: bar.x + bar.w }];
            rightSup = [{ edge: 'north', xMin: bar.x, xMax: bar.x + bar.w }];
            barSup   = [{ edge: 'north' }, { edge: 'south' }];
          } else { // uShapeW
            // .##    open left (rotated: rows are horizontal)
            // ###
            // .##
            left  = { x, z, w: segW * 3, d: segD };              // top row
            right = { x, z: z + segD * 2, w: segW * 3, d: segD }; // bottom row
            bar   = { x: x + segW * 2, z: z + segD, w: segW, d: segD }; // right connecting bar
            leftSup  = [{ edge: 'south', xMin: bar.x, xMax: bar.x + bar.w }];
            rightSup = [{ edge: 'north', xMin: bar.x, xMax: bar.x + bar.w }];
            barSup   = [{ edge: 'north' }, { edge: 'south' }];
          }

          const groupId = buildings.length;
          buildings.push({ x: left.x, z: left.z, w: left.w, d: left.d, maxTier, size: 'small', height: heightKey, blockIndex: 0, shape: 'full', suppressEdges: leftSup, textureGroup: groupId });
          buildings.push({ x: right.x, z: right.z, w: right.w, d: right.d, maxTier, size: 'small', height: heightKey, blockIndex: 0, shape: 'full', suppressEdges: rightSup, textureGroup: groupId });
          buildings.push({ x: bar.x, z: bar.z, w: bar.w, d: bar.d, maxTier, size: 'small', height: heightKey, blockIndex: 0, shape: 'full', suppressEdges: barSup, textureGroup: groupId });
        } else if (shape.startsWith('uNarrow')) {
          // Narrow U-shape: 2×3 grid, full column + top stub + bottom stub, indent on one side
          const groupId = buildings.length;
          const segW = rng.float(FOOTPRINTS.small.min, FOOTPRINTS.small.max);
          const segD = rng.float(FOOTPRINTS.small.min, FOOTPRINTS.small.max);
          const bProps = { maxTier, size: 'small', height: heightKey, blockIndex: 0, shape: 'full', textureGroup: groupId };

          let col, top, bot, colSup, topSup, botSup;
          if (shape === 'uNarrowN') {
            // ##    full left column + top-right + bottom-right, gap at middle-right
            // #.
            // ##
            col = { x, z, w: segW, d: segD * 3 };
            top = { x: x + segW, z, w: segW, d: segD };
            bot = { x: x + segW, z: z + segD * 2, w: segW, d: segD };
            colSup = [{ edge: 'east', zMin: top.z, zMax: top.z + top.d }, { edge: 'east', zMin: bot.z, zMax: bot.z + bot.d }];
            topSup = [{ edge: 'west' }];
            botSup = [{ edge: 'west' }];
          } else if (shape === 'uNarrowS') {
            // ##    full right column + top-left + bottom-left, gap at middle-left
            // .#
            // ##
            col = { x: x + segW, z, w: segW, d: segD * 3 };
            top = { x, z, w: segW, d: segD };
            bot = { x, z: z + segD * 2, w: segW, d: segD };
            colSup = [{ edge: 'west', zMin: top.z, zMax: top.z + top.d }, { edge: 'west', zMin: bot.z, zMax: bot.z + bot.d }];
            topSup = [{ edge: 'east' }];
            botSup = [{ edge: 'east' }];
          } else if (shape === 'uNarrowE') {
            // ###   full top row + left-bottom + right-bottom, gap at middle-bottom (rotated)
            // #.#
            col = { x, z, w: segW * 3, d: segD };
            top = { x, z: z + segD, w: segW, d: segD };
            bot = { x: x + segW * 2, z: z + segD, w: segW, d: segD };
            colSup = [{ edge: 'south', xMin: top.x, xMax: top.x + top.w }, { edge: 'south', xMin: bot.x, xMax: bot.x + bot.w }];
            topSup = [{ edge: 'north' }];
            botSup = [{ edge: 'north' }];
          } else { // uNarrowW
            // #.#   full bottom row + left-top + right-top, gap at middle-top (rotated)
            // ###
            col = { x, z: z + segD, w: segW * 3, d: segD };
            top = { x, z, w: segW, d: segD };
            bot = { x: x + segW * 2, z, w: segW, d: segD };
            colSup = [{ edge: 'north', xMin: top.x, xMax: top.x + top.w }, { edge: 'north', xMin: bot.x, xMax: bot.x + bot.w }];
            topSup = [{ edge: 'south' }];
            botSup = [{ edge: 'south' }];
          }

          buildings.push({ x: col.x, z: col.z, w: col.w, d: col.d, ...bProps, suppressEdges: colSup });
          buildings.push({ x: top.x, z: top.z, w: top.w, d: top.d, ...bProps, suppressEdges: topSup });
          buildings.push({ x: bot.x, z: bot.z, w: bot.w, d: bot.d, ...bProps, suppressEdges: botSup });
        } else if (shape.startsWith('uSmall')) {
          // Small U: 2×3 grid, each cell is tower-sized, 5 of 6 filled
          const groupId = buildings.length;
          const tFp = FOOTPRINTS.tower || { min: 2, max: 3 };
          const segW = rng.float(tFp.min, tFp.max);
          const segD = rng.float(tFp.min, tFp.max);
          const bProps = { maxTier, size: 'small', height: heightKey, blockIndex: 0, shape: 'full', textureGroup: groupId };

          // Grid positions (row, col) -> { x, z, w: segW, d: segD }
          // Gap position determines which cell is empty
          const cells = [];
          let gapR, gapC; // row, col of the gap
          if (shape === 'uSmallN') { gapR = 1; gapC = 1; }      // ##  #.  ##
          else if (shape === 'uSmallS') { gapR = 1; gapC = 0; }  // ##  .#  ##
          else if (shape === 'uSmallE') { gapR = 2; gapC = 1; }  // ###  #.#  (3×2, gap bottom-middle)
          else { gapR = 0; gapC = 1; }                            // #.#  ###  (3×2, gap top-middle)

          const isRotated = shape === 'uSmallE' || shape === 'uSmallW';
          const cols = isRotated ? 3 : 2;
          const rows = isRotated ? 2 : 3;

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (r === gapR && c === gapC) continue;
              const cx = x + c * segW;
              const cz = z + r * segD;

              // Suppress edges facing adjacent filled cells
              const sup = [];
              // Check each neighbor
              if (r > 0 && !(r - 1 === gapR && c === gapC)) sup.push({ edge: 'north' });
              if (r < rows - 1 && !(r + 1 === gapR && c === gapC)) sup.push({ edge: 'south' });
              if (c > 0 && !(r === gapR && c - 1 === gapC)) sup.push({ edge: 'west' });
              if (c < cols - 1 && !(r === gapR && c + 1 === gapC)) sup.push({ edge: 'east' });

              cells.push({ x: cx, z: cz, w: segW, d: segD, suppressEdges: sup });
            }
          }

          for (const cell of cells) {
            buildings.push({ x: cell.x, z: cell.z, w: cell.w, d: cell.d, ...bProps, suppressEdges: cell.suppressEdges });
          }
        } else {
          buildings.push({ x, z, w, d, maxTier, size: 'small', height: heightKey, blockIndex: 0, shape });
        }
      }
    }
  }

  // Pick a layout for larger buildings
  const layout = rng.int(0, 4);
  const bigBuildings = placeBigLayout(layout, config, tiers, rng);

  // Remove small buildings that touch any big building — track them
  const surviving = [];
  const displacedByBig = [];
  if (DELETIONS.buildingDisplaceByLarge) {
    for (const b of buildings) {
      let displaced = false;
      for (const big of bigBuildings) {
        if (b.x < big.x + big.w + BUILDING_GAP && b.x + b.w > big.x - BUILDING_GAP &&
            b.z < big.z + big.d + BUILDING_GAP && b.z + b.d > big.z - BUILDING_GAP) {
          displaced = true;
          break;
        }
      }
      if (displaced) displacedByBig.push(b);
      else surviving.push(b);
    }
  } else {
    surviving.push(...buildings);
  }

  // Delete 15% of remaining small buildings — track deleted positions for cover placement
  let culled, randomlyDeleted;
  if (DELETIONS.buildingRandomCull) {
    const deleteRatio = BUILDING.deleteRatio;
    rng.shuffle(surviving);
    const keepCount = Math.ceil(surviving.length * (1 - deleteRatio));
    culled = surviving.slice(0, keepCount);
    randomlyDeleted = surviving.slice(keepCount);
  } else {
    culled = surviving;
    randomlyDeleted = [];
  }

  // All deleted buildings = displaced by big + randomly culled
  const deletedBuildings = [...displacedByBig, ...randomlyDeleted];

  return { ...gridData, buildings: [...bigBuildings, ...culled], deletedBuildings };
}
