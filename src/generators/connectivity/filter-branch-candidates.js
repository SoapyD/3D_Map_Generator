export function filterBranchCandidates(candidates, data, allWalkways, tierHeight) {
  const floors = data.floors;

  return candidates.filter(c => {
    const b = c.branch;
    const bTier = Math.round(b.y / tierHeight);
    const tierFloors = floors.find(f => f.tier === bTier);
    const sectionsAtTier = tierFloors ? [...tierFloors.sections] : [];
    if (data.roofs) {
      for (const r of data.roofs) {
        if (r.tier === bTier && r.section) sectionsAtTier.push(r.section);
      }
    }
    // Check passthrough
    for (const s of sectionsAtTier) {
      const overlapX = Math.min(b.x + b.w, s.x + s.w) - Math.max(b.x, s.x);
      const overlapZ = Math.min(b.z + b.d, s.z + s.d) - Math.max(b.z, s.z);
      if (b.axis === 'x' && overlapX > 1 && overlapZ > 0) return false;
      if (b.axis === 'z' && overlapZ > 1 && overlapX > 0) return false;
    }
    // Check overlap with existing walkways (skip the parent forced walkway)
    for (const ew of allWalkways) {
      if (ew === c.parent) continue;
      if (Math.abs(ew.y - b.y) > 0.5) continue;
      if (b.x < ew.x + ew.w + 0.5 && b.x + b.w > ew.x - 0.5 &&
          b.z < ew.z + ew.d + 0.5 && b.z + b.d > ew.z - 0.5) return false;
    }
    return true;
  });
}
