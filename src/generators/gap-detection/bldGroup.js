// Resolve building index to its group (textureGroup or own index)
export function bldGroup(bi, buildings) {
  if (bi < 0 || bi >= buildings.length) return bi;
  const tg = buildings[bi].textureGroup;
  return tg !== undefined ? tg : bi;
}
