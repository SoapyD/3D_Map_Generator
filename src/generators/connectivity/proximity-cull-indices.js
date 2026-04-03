import { isClose } from './is-close.js';

export function proximityCullIndices(items, others, proximity) {
  const dropSet = new Set();
  for (let i = 0; i < items.length; i++) {
    if (dropSet.has(i)) continue;
    for (let j = i + 1; j < items.length; j++) {
      if (dropSet.has(j)) continue;
      if (Math.abs(items[i].y0 - items[j].y0) > 0.5) continue;
      if (isClose(items[i], items[j], proximity)) dropSet.add(j);
    }
    if (others) {
      for (const o of others) {
        if (Math.abs(items[i].y0 - o.y0) > 0.5) continue;
        if (isClose(items[i], o, proximity)) { dropSet.add(i); break; }
      }
    }
  }
  return dropSet;
}
