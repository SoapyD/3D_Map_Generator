import { writeFileSync } from 'fs';
import { emitAnchors } from './emit-anchors.js';
import { pairAnchors } from './pair-anchors.js';
import { filterCandidates } from './filter-candidates.js';
import { rasteriseConnections } from './rasterise-connections.js';
import { CELL, STAGE } from '../collision/matrix.js';

// Step 7b-i — vectors pointing FROM anchor cell BACK TO its trigger (floor-edge) cell
const TO_TRIGGER = { N: [0, 1], S: [0, -1], E: [-1, 0], W: [1, 0] };
const DOOR_HEIGHT = 3; // cells = full room height

function stampDoors(survivors, matrix) {
  const cs = matrix.cellSize;
  const doors = [];
  const seen = new Set();

  for (const conn of survivors) {
    for (const anchor of [conn.from, conn.to]) {
      const [dx, dz] = TO_TRIGGER[anchor.direction];
      const cy = anchor.cells[0].cy;

      const tc0 = { cx: anchor.cells[0].cx + dx, cz: anchor.cells[0].cz + dz };
      const tc1 = { cx: anchor.cells[1].cx + dx, cz: anchor.cells[1].cz + dz };

      // Deduplicate — two connections from the same anchor produce the same door
      const key = `${tc0.cx},${cy},${tc0.cz}|${tc1.cx},${cy},${tc1.cz}`;
      if (seen.has(key)) continue;
      seen.add(key);

      matrix.setWriteContext(STAGE.CONNECTIVITY, doors.length);
      for (const tc of [tc0, tc1]) {
        for (let dy = 1; dy <= DOOR_HEIGHT; dy++) {
          matrix.setCell(tc.cx, cy + dy, tc.cz, CELL.DOOR);
        }
      }

      // World-space rect for debug rendering (2 wide × 3 tall)
      const minCx = Math.min(tc0.cx, tc1.cx);
      const minCz = Math.min(tc0.cz, tc1.cz);
      const maxCx = Math.max(tc0.cx, tc1.cx) + 1;
      const maxCz = Math.max(tc0.cz, tc1.cz) + 1;
      const wp = matrix.cellToWorld(minCx, cy + 1, minCz);
      doors.push({
        anchorId: anchor.id,
        direction: anchor.direction,
        x: wp.x, y: wp.y, z: wp.z,
        w: (maxCx - minCx) * cs,
        h: DOOR_HEIGHT * cs,
        d: (maxCz - minCz) * cs,
      });
    }
  }
  return doors;
}

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

  const doors = stampDoors(survivors, matrix);

  const dataWithSurvivors = {
    ...data,
    connections: { anchors, triggerCells, candidates: survivors, doors },
  };
  const { walkways, crossings } = rasteriseConnections(dataWithSurvivors, matrix, rng);

  return {
    ...data,
    connections: {
      anchors,
      triggerCells,
      candidates: survivors,
      doors,
      walkways,
      crossings,
    },
  };
}
