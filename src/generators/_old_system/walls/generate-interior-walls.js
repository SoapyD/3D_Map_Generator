import { WALL } from '../../config.js';
import { applyWallDamage } from './apply-wall-damage.js';
import { pickInteriorVariant } from '../selectors/index.js';

export function generateInteriorWalls(data, config, rng) {
  const { tierHeight, wallThickness, slabThickness } = config;
  const interiorWalls = [];

  for (let bi = 0; bi < data.buildings.length; bi++) {
    const building = data.buildings[bi];
    if (building.size !== 'medium' && building.size !== 'large') continue;
    const bq = data.buildingQuadrants[bi];
    const forceInterior = building.interiorWalls === true;
    if (building.interiorWalls === false) continue;
    const chance = forceInterior ? 1.0 : (WALL.interiorWallChance[building.size] || 0);

    for (let tier = 1; tier < building.maxTier; tier++) {
      if (!rng.chance(chance)) continue;
      const aboveQuadrants = bq.tiers[tier + 1];
      if (!aboveQuadrants || aboveQuadrants.size < 2) continue;

      const baseY = tier * tierHeight + slabThickness;
      const wallHeight = tierHeight - slabThickness;
      const { x, z, w, d } = building;
      const mx = x + w / 2;
      const mz = z + d / 2;
      const variant = pickInteriorVariant(rng);

      const defs = [];
      const doorGap = WALL.quadSize;
      if (variant === 'cross') {
        defs.push({ x: mx - wallThickness / 2, z: z + d / 4, length: d / 2, height: wallHeight, baseY, thickness: wallThickness, axis: 'z' });
        defs.push({ x: x + w / 4, z: mz - wallThickness / 2, length: w / 2, height: wallHeight, baseY, thickness: wallThickness, axis: 'x' });
      } else if (variant === 'centreNS') {
        const fullLen = d / 2;
        const segLen = (fullLen - doorGap) / 2;
        const startZ = z;
        defs.push({ x: mx - wallThickness / 2, z: startZ, length: segLen, height: wallHeight, baseY, thickness: wallThickness, axis: 'z' });
        defs.push({ x: mx - wallThickness / 2, z: startZ + segLen + doorGap, length: segLen, height: wallHeight, baseY, thickness: wallThickness, axis: 'z' });
      } else if (variant === 'centreSN') {
        const fullLen = d / 2;
        const segLen = (fullLen - doorGap) / 2;
        const startZ = mz;
        defs.push({ x: mx - wallThickness / 2, z: startZ, length: segLen, height: wallHeight, baseY, thickness: wallThickness, axis: 'z' });
        defs.push({ x: mx - wallThickness / 2, z: startZ + segLen + doorGap, length: segLen, height: wallHeight, baseY, thickness: wallThickness, axis: 'z' });
      } else if (variant === 'centreEW') {
        const fullLen = w / 2;
        const segLen = (fullLen - doorGap) / 2;
        const startX = x;
        defs.push({ x: startX, z: mz - wallThickness / 2, length: segLen, height: wallHeight, baseY, thickness: wallThickness, axis: 'x' });
        defs.push({ x: startX + segLen + doorGap, z: mz - wallThickness / 2, length: segLen, height: wallHeight, baseY, thickness: wallThickness, axis: 'x' });
      } else if (variant === 'centreWE') {
        const fullLen = w / 2;
        const segLen = (fullLen - doorGap) / 2;
        const startX = mx;
        defs.push({ x: startX, z: mz - wallThickness / 2, length: segLen, height: wallHeight, baseY, thickness: wallThickness, axis: 'x' });
        defs.push({ x: startX + segLen + doorGap, z: mz - wallThickness / 2, length: segLen, height: wallHeight, baseY, thickness: wallThickness, axis: 'x' });
      }

      for (const def of defs) interiorWalls.push(...applyWallDamage(def, rng, 'internal'));
    }
  }

  return interiorWalls;
}
