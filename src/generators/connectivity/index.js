import { emitAnchors } from './emit-anchors.js';

export function generateConnectivity(data, config, rng, matrix) {
  const { anchors, triggerCells } = emitAnchors(data, matrix, config);

  return {
    ...data,
    connections: {
      anchors,
      triggerCells,
      walkways: [],
    },
  };
}
