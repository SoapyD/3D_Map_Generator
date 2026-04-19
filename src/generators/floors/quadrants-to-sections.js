export function quadrantsToSections(building, present) {
  const mx = building.x + building.w / 2;
  const mz = building.z + building.d / 2;

  const quads = {
    0: { x: building.x, z: building.z, w: building.w / 2, d: building.d / 2 },
    1: { x: mx,         z: building.z, w: building.w / 2, d: building.d / 2 },
    2: { x: building.x, z: mz,         w: building.w / 2, d: building.d / 2 },
    3: { x: mx,         z: mz,         w: building.w / 2, d: building.d / 2 },
  };

  const sections = [];
  const used = new Set();

  // Merge adjacent pairs into larger rects where possible
  if (present.has(0) && present.has(1)) {
    sections.push({ x: building.x, z: building.z, w: building.w, d: building.d / 2 });
    used.add(0); used.add(1);
  }
  if (present.has(2) && present.has(3)) {
    sections.push({ x: building.x, z: mz, w: building.w, d: building.d / 2 });
    used.add(2); used.add(3);
  }
  if (present.has(0) && present.has(2) && !used.has(0) && !used.has(2)) {
    sections.push({ x: building.x, z: building.z, w: building.w / 2, d: building.d });
    used.add(0); used.add(2);
  }
  if (present.has(1) && present.has(3) && !used.has(1) && !used.has(3)) {
    sections.push({ x: mx, z: building.z, w: building.w / 2, d: building.d });
    used.add(1); used.add(3);
  }

  for (const q of present) {
    if (!used.has(q)) sections.push(quads[q]);
  }

  return sections;
}
