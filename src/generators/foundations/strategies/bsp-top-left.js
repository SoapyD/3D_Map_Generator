import { bspSplit } from '../bsp-split.js';
import { balanced } from '../split-strategies/balanced.js';

// Standard BSP — returns leaves in recursive tree order (top-left to bottom-right).
export function generateBspTopLeft(activeArea, rng, streetWidth, bbd) {
  const leaves = [];
  bspSplit(activeArea, rng, streetWidth, bbd, leaves, balanced);
  return leaves;
}
