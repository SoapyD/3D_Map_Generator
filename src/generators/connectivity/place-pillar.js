export function placePillar(pos, runAxis, pillarW, crossCentre, source, allConnections, surfaces, minHeight) {
  const eps = 0.01;

  const pr = runAxis === 'x'
    ? { x: pos - pillarW / 2, z: crossCentre - pillarW / 2, w: pillarW, d: pillarW }
    : { x: crossCentre - pillarW / 2, z: pos - pillarW / 2, w: pillarW, d: pillarW };

  for (const conn of allConnections) {
    if (conn === source) continue;
    if (Math.abs(conn.y - source.y) > 0.5 && conn.y > source.y) continue;
    if (pr.x < conn.x + conn.w && pr.x + pr.w > conn.x &&
        pr.z < conn.z + conn.d && pr.z + pr.d > conn.z) {
      return null;
    }
  }

  const topY = source.y;
  let bottomY = 0;

  for (const surf of surfaces) {
    if (surf.y >= topY - eps) continue;
    if (surf.y <= eps) continue;

    const overlapsXZ = pr.x < surf.x + surf.w && pr.x + pr.w > surf.x &&
                       pr.z < surf.z + surf.d && pr.z + pr.d > surf.z;
    if (!overlapsXZ) continue;

    const fullyContains = surf.x <= pr.x + eps && surf.z <= pr.z + eps &&
                          surf.x + surf.w >= pr.x + pr.w - eps &&
                          surf.z + surf.d >= pr.z + pr.d - eps;

    if (fullyContains) {
      if (surf.y > bottomY) bottomY = surf.y;
    } else {
      return null;
    }
  }

  const height = topY - bottomY;
  if (height < minHeight) return null;

  return {
    x: pr.x, z: pr.z, w: pr.w, d: pr.d,
    y: bottomY,
    height,
    textureId: source.textureId,
    isBridge: source.type === 'bridge',
  };
}
