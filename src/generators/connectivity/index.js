import { writeFileSync } from 'fs';
import { emitAnchors } from './emit-anchors.js';
import { pairAnchors } from './pair-anchors.js';

export function generateConnectivity(data, config, rng, matrix) {
  const { anchors, triggerCells } = emitAnchors(data, matrix, config);
  const candidates = pairAnchors(anchors, matrix, config);

  if (config.debugConnectivity) {
    const dump = {
      anchors: anchors.map(a => ({
        id: a.id, direction: a.direction, buildingId: a.buildingId,
        cells: a.cells, tier: a.tier,
      })),
      candidates: candidates.map(c => ({
        from: c.from.id, to: c.to.id,
        fromBuildingId: c.fromBuildingId, toBuildingId: c.toBuildingId,
        axis: c.axis, length: c.length,
        debugRect: c.debugRect,
      })),
    };
    writeFileSync('debug_connectivity.json', JSON.stringify(dump, null, 2));
  }

  return {
    ...data,
    connections: {
      anchors,
      triggerCells,
      candidates,
      walkways: [],
    },
  };
}
