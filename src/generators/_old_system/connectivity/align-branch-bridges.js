export function alignBranchBridges(bridges) {
  for (const branch of bridges) {
    if (!branch.branch || !branch.parentRef) continue;
    const parent = bridges.find(b => !b.branch && b.textureId === branch.textureId);
    if (!parent) continue;

    if (branch.axis === 'x' && parent.axis !== 'x') {
      const parentEdgeW = parent.x;
      const parentEdgeE = parent.x + parent.w;
      if (branch.x < parentEdgeE && branch.x + branch.w > parentEdgeW) {
        if (branch.x >= parentEdgeW && branch.x < parentEdgeE) {
          const oldStart = branch.x;
          branch.x = parentEdgeE;
          branch.w -= (branch.x - oldStart);
        }
        if (branch.x + branch.w > parentEdgeW && branch.x + branch.w <= parentEdgeE) {
          branch.w = parentEdgeW - branch.x;
        }
      }
    } else if (branch.axis === 'z' && parent.axis !== 'z') {
      const parentEdgeN = parent.z;
      const parentEdgeS = parent.z + parent.d;
      if (branch.z < parentEdgeS && branch.z + branch.d > parentEdgeN) {
        if (branch.z >= parentEdgeN && branch.z < parentEdgeS) {
          const oldStart = branch.z;
          branch.z = parentEdgeS;
          branch.d -= (branch.z - oldStart);
        }
        if (branch.z + branch.d > parentEdgeN && branch.z + branch.d <= parentEdgeS) {
          branch.d = parentEdgeN - branch.z;
        }
      }
    }
  }
}
