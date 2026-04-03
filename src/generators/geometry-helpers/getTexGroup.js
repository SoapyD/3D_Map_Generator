/**
 * Get texture group index for a building (composite parts share textures).
 */
export function getTexGroup(bi, buildings) {
  if (bi < 0 || bi >= buildings.length) return bi;
  const b = buildings[bi];
  return b.textureGroup !== undefined ? b.textureGroup : bi;
}
