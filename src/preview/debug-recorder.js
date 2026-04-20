/**
 * Captures pipeline stage data as per-element rect arrays for the visualizer.
 *
 * Output format — compact, no duplication across frames:
 *   { seed, config, stages: [ { stage, name, elements: [ { label, rects } ] } ] }
 *
 * The viewer reconstructs what to show for any frame index by accumulating
 * prior stages (dimmed) + current stage elements up to the current one.
 * No Three.js dependency.
 */

const STAGE_COLORS = {
  1: '#5588cc', // Foundation
  2: '#2244aa', // Streets
  3: '#44bb88', // Buildings
  4: '#ccaa33', // Floors
  5: '#88aaff', // Roofs
  6: '#cc5533', // Walls
  7: '#aa44cc', // Connectivity
  8: '#33bbcc', // Cover
};

const STAGE_NAMES = {
  1: 'Foundation',
  2: 'Streets',
  3: 'Buildings',
  4: 'Floors',
  5: 'Roofs',
  6: 'Walls',
  7: 'Connectivity',
  8: 'Cover',
};

export function createRecorder(seed, config) {
  const stages = [];

  function capture(stageIndex, pipelineData) {
    const color = STAGE_COLORS[stageIndex];
    const elements = stageToElements(stageIndex, pipelineData, color, config);
    stages.push({ stage: stageIndex, name: STAGE_NAMES[stageIndex], elements });
  }

  function serialize() {
    const { mapWidth, mapDepth, tiers, tierHeight, slabThickness } = config;
    return JSON.stringify({ seed, config: { mapWidth, mapDepth, tiers, tierHeight, slabThickness }, stages }, null, 2);
  }

  return { capture, serialize };
}

// --- Per-stage element breakdown ---
// Each element is { label, rects } representing one sub-frame's new geometry.

function stageToElements(stageIndex, data, color, config) {
  switch (stageIndex) {
    case 1: return foundationElements(data, color, config);
    case 2: return streetElements(data, color, config);
    case 3: return buildingElements(data, color, config);
    case 4: return floorElements(data, color, config);
    case 5: return roofElements(data, color, config);
    case 6: return wallElements(data);
    case 7: return connectivityElements(data, color, config);
    case 8: return coverElements(data, color);
    default: return [];
  }
}

function foundationElements(data, color, config) {
  const total = data.blocks.length;
  return data.blocks.map((b, i) => ({
    label: `Foundation — block ${i + 1}/${total}`,
    rects: [box('block', b.x, 0, b.z, b.w, 0.05, b.d, color)],
  }));
}

function streetElements(data, color, config) {
  const rects = deriveStreetRects(data.blocks, config.mapWidth, config.mapDepth);
  const total = rects.length;
  return rects.map((s, i) => ({
    label: `Streets — ${i + 1}/${total}`,
    rects: [box('street', s.x, 0, s.z, s.w, 0.05, s.d, color)],
  }));
}

// Build street rects by sweeping all block edge coordinates.
// Each cell between consecutive edge lines is checked against block coverage —
// cells not covered by any block are streets. Results are perfectly aligned
// with block boundaries because the grid is derived from them directly.
function deriveStreetRects(blocks, mapWidth, mapDepth) {
  const xs = new Set([0, mapWidth]);
  const zs = new Set([0, mapDepth]);
  for (const b of blocks) {
    xs.add(b.x);       xs.add(b.x + b.w);
    zs.add(b.z);       zs.add(b.z + b.d);
  }
  const sortedX = [...xs].sort((a, b) => a - b);
  const sortedZ = [...zs].sort((a, b) => a - b);

  const streets = [];
  for (let i = 0; i < sortedX.length - 1; i++) {
    for (let j = 0; j < sortedZ.length - 1; j++) {
      const x0 = sortedX[i],     x1 = sortedX[i + 1];
      const z0 = sortedZ[j],     z1 = sortedZ[j + 1];
      const cx = (x0 + x1) / 2,  cz = (z0 + z1) / 2;
      const inBlock = blocks.some(b => cx > b.x && cx < b.x + b.w && cz > b.z && cz < b.z + b.d);
      if (!inBlock) streets.push({ x: x0, z: z0, w: x1 - x0, d: z1 - z0 });
    }
  }
  return streets;
}

function buildingElements(data, color, config) {
  const elements = [];
  const all = data.buildings;
  for (let i = 0; i < all.length; i++) {
    const b = all[i];
    const levelHeight = config.tierHeight + config.slabThickness;
    // Shell starts at Y=-slabThickness; height stops below roof slab so it protrudes above
    const h = (b.maxTier - 1) * levelHeight;
    elements.push({
      label: `Buildings — ${i + 1}/${all.length}`,
      rects: [box('building', b.x, -config.slabThickness, b.z, b.w, h, b.d, color)],
    });
  }
  for (const b of (data.deletedBuildings || [])) {
    elements.push({
      label: `Buildings — deleted footprint`,
      rects: [box('deleted', b.x, 0, b.z, b.w, 0.1, b.d, '#555555')],
    });
  }
  return elements;
}

function floorElements(data, color, config) {
  // One element per building — all its floor plates across all levels.
  const byBuilding = new Map();
  for (const f of data.floors) {
    if (!byBuilding.has(f.buildingIndex)) byBuilding.set(f.buildingIndex, []);
    for (const r of f.rects) {
      byBuilding.get(f.buildingIndex).push(
        box('floor', r.x, f.yCollisionLevel, r.z, r.w, config.slabThickness, r.d, color)
      );
    }
  }
  const total = byBuilding.size;
  let i = 0;
  const elements = [];
  for (const [bi, rects] of byBuilding) {
    elements.push({ label: `Floors — building ${++i}/${total}`, rects });
  }
  return elements;
}

function roofElements(data, color, config) {
  const total = data.roofs.length;
  return data.roofs.map((r, i) => ({
    label: `Roofs — building ${i + 1}/${total}`,
    rects: r.rects.map(rect => box('roof', rect.x, r.yCollisionLevel, rect.z, rect.w, config.slabThickness, rect.d, color)),
  }));
}

const WALL_DIR_COLORS = { N: '#4488ff', S: '#ff8844', E: '#44ff88', W: '#ff44cc' };

function wallElements(data) {
  const total = data.walls.length;
  return data.walls.map((w, i) => ({
    label: `Walls — ${w.direction} ${i + 1}/${total}`,
    rects: [box('wall', w.x, w.y, w.z, w.w, w.h, w.d, WALL_DIR_COLORS[w.direction] ?? '#aaaaaa')],
    // rects: [{ ...box('wall', ...), wallLabel: `${w.direction}${i}` }],  // re-enable for wall ID debug
  }));
}

function connectivityElements(data, color, config) {
  const elements = [];
  const c = data.connections;

  const allTriggers = c.triggerCells || [];
  for (const t of allTriggers) {
    elements.push({
      label: `Connectivity — trigger ${t.id} faces:${t.faces} (${t.cx},${t.cz})`,
      rects: [{ ...box('trigger', t.x, t.y, t.z, t.w, 0.05, t.d, '#ffee44'), label: `${t.id}` }],
    });
  }

  const allAnchors = c.anchors || [];
  for (const a of allAnchors) {
    elements.push({
      label: `Connectivity — anchor ${a.direction} (${a.cells[0].cx},${a.cells[0].cz})`,
      rects: [box('anchor', a.x, a.y, a.z, a.w, 0.1, a.d, '#ff44aa')],
    });
  }

  const walkways = [...(c.walkways || []), ...(c.bridges || [])];
  const totalW = walkways.length;
  for (let i = 0; i < walkways.length; i++) {
    const w = walkways[i];
    const isBridge = w.type === 'bridge' || w.bridgeWalls;
    elements.push({
      label: `Connectivity — ${isBridge ? 'bridge' : 'walkway'} ${i + 1}/${totalW}`,
      rects: [box(isBridge ? 'bridge' : 'walkway', w.x, w.y, w.z, w.w, isBridge ? 0.5 : 0.3, w.d, isBridge ? '#7733aa' : color)],
    });
  }

  const allLadders = [
    ...(c.ladders || []),
    ...(c.groundLadders || []),
    ...(c.orangeLadders || []),
    ...(c.interiorLadders || []),
  ];
  const totalL = allLadders.length;
  for (let i = 0; i < allLadders.length; i++) {
    const l = allLadders[i];
    const y0 = l.y0 ?? 0;
    const y1 = l.y1 ?? config.tierHeight;
    elements.push({
      label: `Connectivity — ladder ${i + 1}/${totalL}`,
      rects: [box('ladder', l.x, y0, l.z, l.w, y1 - y0, l.d, '#ffdd44')],
    });
  }
  return elements;
}

function coverElements(data, color) {
  const all = [
    ...(data.cover || []),
    ...(data.interiorCover || []),
    ...(data.streetScatter || []),
  ];
  const total = all.length;
  return all.map((c, i) => ({
    label: `Cover — ${i + 1}/${total}`,
    rects: [box('cover', c.x, c.y, c.z, c.w, c.height, c.d, color)],
  }));
}

function box(type, x, y, z, w, h, d, color, opacity = 1) {
  return { type, x, y, z, w, h, d, color, opacity };
}
