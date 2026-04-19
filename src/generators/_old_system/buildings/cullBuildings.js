import { BUILDING, DELETIONS } from '../../config.js';

export function cullBuildings(surviving, placedBig, displacedByBig, rng) {
  // Remove overlapping small buildings (complex shapes can overflow cell boundaries)
  const noOverlap = [];
  for (let i = 0; i < surviving.length; i++) {
    const a = surviving[i];
    let dominated = false;
    for (let j = 0; j < surviving.length; j++) {
      if (i === j) continue;
      if (a.textureGroup !== undefined && a.textureGroup === surviving[j].textureGroup) continue;
      const b = surviving[j];
      if (a.x < b.x + b.w && a.x + a.w > b.x &&
          a.z < b.z + b.d && a.z + a.d > b.z) {
        if (i > j) { dominated = true; break; }
      }
    }
    if (!dominated) noOverlap.push(a);
  }
  const displacedByOverlap = surviving.filter(b => !noOverlap.includes(b));

  // Delete 15% of remaining small buildings — track deleted positions for cover placement
  let culled, randomlyDeleted;
  if (DELETIONS.buildingRandomCull) {
    const deleteRatio = BUILDING.deleteRatio;
    rng.shuffle(noOverlap);
    const keepCount = Math.ceil(noOverlap.length * (1 - deleteRatio));
    culled = noOverlap.slice(0, keepCount);
    randomlyDeleted = noOverlap.slice(keepCount);
  } else {
    culled = noOverlap;
    randomlyDeleted = [];
  }

  // All deleted buildings = displaced by big + overlap + randomly culled
  const deletedBuildings = [...displacedByBig, ...displacedByOverlap, ...randomlyDeleted];

  return { finalBuildings: culled, deletedBuildings };
}
