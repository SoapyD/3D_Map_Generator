import { writeFileSync } from 'fs';
import { emitAnchors } from './emit-anchors.js';
import { pairAnchors } from './pair-anchors.js';
import { filterCandidates } from './filter-candidates.js';

export function generateConnectivity(data, config, rng, matrix) {
  const { anchors, triggerCells } = emitAnchors(data, matrix, config);
  const candidates = pairAnchors(anchors, matrix, config);

  // Step 6a — vertical stacking detection
  // Two candidates are stacked if: same axis, same perpendicular coordinate,
  // and their spans along the travel direction overlap (even partially).
  const lanes = new Map();
  for (const c of candidates) {
    const r = c.debugRect;
    const perp = c.axis === 'WE' ? r.z : r.x;
    const laneKey = `${c.axis}|${perp}`;
    if (!lanes.has(laneKey)) lanes.set(laneKey, []);
    lanes.get(laneKey).push(c);
  }

  let stackIdx = 0;
  for (const lane of lanes.values()) {
    if (lane.length < 2) continue;

    // Union-find — use const arrow to guarantee correct closure over this iteration's parent
    const parent = lane.map((_, i) => i);
    const find = (i) => {
      while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
      return i;
    };
    for (let i = 0; i < lane.length; i++) {
      for (let j = i + 1; j < lane.length; j++) {
        const ri = lane[i].debugRect, rj = lane[j].debugRect;
        const overlaps = lane[i].axis === 'WE'
          ? ri.x < rj.x + rj.w && rj.x < ri.x + ri.w
          : ri.z < rj.z + rj.d && rj.z < ri.z + ri.d;
        if (overlaps) { const pi = find(i); parent[pi] = find(j); }
      }
    }

    const components = new Map();
    for (let i = 0; i < lane.length; i++) {
      const root = find(i);
      if (!components.has(root)) components.set(root, []);
      components.get(root).push(lane[i]);
    }
    for (const component of components.values()) {
      if (component.length >= 2) {
        const id = `stack_${stackIdx++}`;
        const span = c => c.axis === 'WE' ? c.debugRect.w : c.debugRect.d;
        const maxLen = Math.max(...component.map(span));
        const longestGroup = component.filter(c => span(c) === maxLen);
        const survivor = longestGroup[Math.floor(rng.random() * longestGroup.length)];
        console.log(`[stack] ${id} size=${component.length} maxLen=${maxLen} longestGroup=${longestGroup.length}`);
        for (const c of component) {
          c.stackGroupId = id;
          const culled = c !== survivor;
          if (culled) c.stackCulled = true;
          console.log(`  [${culled ? 'CULLED' : 'SURVIV'}] ${c.from.id}→${c.to.id} span=${span(c)}`);
        }
      }
    }
  }

  // Mark anchors whose every connection was culled
  const survivingAnchorIds = new Set(
    candidates.filter(c => !c.stackCulled).flatMap(c => [c.from.id, c.to.id])
  );
  for (const c of candidates) {
    if (c.stackCulled) {
      if (!survivingAnchorIds.has(c.from.id)) c.from.stackCulled = true;
      if (!survivingAnchorIds.has(c.to.id)) c.to.stackCulled = true;
    }
  }

  const activeCandidates = candidates.filter(c => !c.stackCulled);

  // Steps 6b–6e — per-tier filter pass
  const { survivors, culled: filterCulled } = filterCandidates(activeCandidates, config, rng);

  // Mark anchors whose every remaining connection was filter-culled
  const survivorAnchorIds = new Set(survivors.flatMap(c => [c.from.id, c.to.id]));
  for (const c of filterCulled) {
    if (!survivorAnchorIds.has(c.from.id)) c.from.filterCulled = true;
    if (!survivorAnchorIds.has(c.to.id))   c.to.filterCulled   = true;
  }

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
      candidates: survivors,
      walkways: [],
    },
  };
}
