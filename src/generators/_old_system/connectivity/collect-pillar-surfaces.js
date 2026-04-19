export function collectPillarSurfaces(data, tierHeight, slabThickness) {
  const surfaces = [];
  for (const fd of data.floors) {
    if (fd.tier === 0) continue;
    const surfaceY = fd.tier * tierHeight + slabThickness;
    for (const s of fd.sections) {
      surfaces.push({ x: s.x, z: s.z, w: s.w, d: s.d, y: surfaceY });
    }
  }
  if (data.roofs) {
    for (const r of data.roofs) {
      const s = r.section || r.building;
      if (!s) continue;
      const roofY = r.tier * tierHeight + slabThickness;
      surfaces.push({ x: s.x, z: s.z, w: s.w, d: s.d, y: roofY });
    }
  }
  return surfaces;
}
