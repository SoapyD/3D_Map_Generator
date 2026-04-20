export function extractStreets(blocks, mapWidth, mapDepth, streetWidth) {
  // Streets are the negative space between blocks.
  // For simplicity, compute as the full map minus block coverage,
  // sampled on a coarse grid.
  const streets = [];
  const step = streetWidth;

  for (let x = 0; x < mapWidth; x += step) {
    for (let z = 0; z < mapDepth; z += step) {
      const inBlock = blocks.some(
        (b) => x >= b.x && x < b.x + b.w && z >= b.z && z < b.z + b.d,
      );
      if (!inBlock) {
        streets.push({ x, z, w: step, d: step });
      }
    }
  }

  return streets;
}
