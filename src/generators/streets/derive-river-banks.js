/**
 * Phase 3b — derive bank edges from foundation block faces adjacent to river rects.
 *
 * A bank is a vertical surface running from Y=0 down to Y=-riverDepth, sitting
 * flush against a foundation block face that borders a river rect.
 *
 * Each bank record:
 *   { x, z, length, axis: 'NS'|'WE', facing: 'N'|'S'|'E'|'W', bottomY, topY }
 */
export function deriveRiverBanks(riverRects, blocks, riverDepth) {
  const banks = [];

  for (const rect of riverRects) {
    for (const block of blocks) {
      // River rect west of block → bank on block's west face
      if (rect.x + rect.w === block.x) {
        const zStart = Math.max(rect.z, block.z);
        const zEnd   = Math.min(rect.z + rect.d, block.z + block.d);
        if (zEnd > zStart) banks.push({ x: block.x, z: zStart, length: zEnd - zStart, axis: 'NS', facing: 'W', bottomY: -riverDepth, topY: 0 });
      }

      // River rect east of block → bank on block's east face
      if (block.x + block.w === rect.x) {
        const zStart = Math.max(rect.z, block.z);
        const zEnd   = Math.min(rect.z + rect.d, block.z + block.d);
        if (zEnd > zStart) banks.push({ x: block.x + block.w, z: zStart, length: zEnd - zStart, axis: 'NS', facing: 'E', bottomY: -riverDepth, topY: 0 });
      }

      // River rect north of block (+Z) → bank on block's south face
      if (block.z + block.d === rect.z) {
        const xStart = Math.max(rect.x, block.x);
        const xEnd   = Math.min(rect.x + rect.w, block.x + block.w);
        if (xEnd > xStart) banks.push({ x: xStart, z: block.z + block.d, length: xEnd - xStart, axis: 'WE', facing: 'S', bottomY: -riverDepth, topY: 0 });
      }

      // River rect south of block (-Z) → bank on block's north face
      if (rect.z + rect.d === block.z) {
        const xStart = Math.max(rect.x, block.x);
        const xEnd   = Math.min(rect.x + rect.w, block.x + block.w);
        if (xEnd > xStart) banks.push({ x: xStart, z: block.z, length: xEnd - xStart, axis: 'WE', facing: 'N', bottomY: -riverDepth, topY: 0 });
      }
    }
  }

  return banks;
}
