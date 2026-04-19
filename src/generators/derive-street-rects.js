/**
 * Derives precise street bounding rectangles from block edge coordinates.
 * Sweeps all block edges to build a grid of cells, then identifies cells
 * whose centre point falls outside every block — those are streets.
 * Results are perfectly aligned with block boundaries.
 */
export function deriveStreetRects(blocks, mapWidth, mapDepth) {
  const xs = new Set([0, mapWidth]);
  const zs = new Set([0, mapDepth]);
  for (const b of blocks) {
    xs.add(b.x);       xs.add(b.x + b.w);
    zs.add(b.z);       zs.add(b.z + b.d);
  }
  const sortedX = [...xs].sort((a, b) => a - b);
  const sortedZ = [...zs].sort((a, b) => a - b);

  const streets = [];
  for (let i = 0; i < sortedX.length - 1; i++) {
    for (let j = 0; j < sortedZ.length - 1; j++) {
      const x0 = sortedX[i],    x1 = sortedX[i + 1];
      const z0 = sortedZ[j],    z1 = sortedZ[j + 1];
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const inBlock = blocks.some(b => cx > b.x && cx < b.x + b.w && cz > b.z && cz < b.z + b.d);
      if (!inBlock) streets.push({ x: x0, z: z0, w: x1 - x0, d: z1 - z0 });
    }
  }
  return streets;
}
