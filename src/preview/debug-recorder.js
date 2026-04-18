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
  1: '#5588cc', // Grid
  2: '#44bb88', // Buildings
  3: '#ccaa33', // Floors
  4: '#cc5533', // Walls
  5: '#aa44cc', // Connectivity
  6: '#33bbcc', // Cover
};

const STAGE_NAMES = {
  1: 'Grid',
  2: 'Buildings',
  3: 'Floors',
  4: 'Walls',
  5: 'Connectivity',
  6: 'Cover',
};

export function createRecorder(seed, config) {
  const stages = [];

  function capture(stageIndex, pipelineData) {
    const color = STAGE_COLORS[stageIndex];
    const elements = stageToElements(stageIndex, pipelineData, color, config);
    stages.push({ stage: stageIndex, name: STAGE_NAMES[stageIndex], elements });
  }

  function serialize() {
    const { mapWidth, mapDepth, tiers, tierHeight } = config;
    return JSON.stringify({ seed, config: { mapWidth, mapDepth, tiers, tierHeight }, stages }, null, 2);
  }

  return { capture, serialize };
}

// --- Per-stage element breakdown ---
// Each element is { label, rects } representing one sub-frame's new geometry.

function stageToElements(stageIndex, data, color, config) {
  switch (stageIndex) {
    case 1: return gridElements(data, color, config);
    case 2: return buildingElements(data, color, config);
    case 3: return floorElements(data, color, config);
    case 4: return wallElements(data, color);
    case 5: return connectivityElements(data, color, config);
    case 6: return coverElements(data, color);
    default: return [];
  }
}

function gridElements(data, color, config) {
  const total = data.blocks.length;
  const elements = data.blocks.map((b, i) => ({
    label: `Grid — block ${i + 1}/${total}`,
    rects: [box('block', b.x, 0, b.z, b.w, 0.05, b.d, color)],
  }));
  const streetRects = deriveStreetRects(data.blocks, config.mapWidth, config.mapDepth);
  if (streetRects.length > 0) {
    elements.push({
      label: `Grid — streets (${streetRects.length})`,
      rects: streetRects.map(s => box('street', s.x, 0, s.z, s.w, 0.05, s.d, '#2244aa')),
    });
  }
  return elements;
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
    const h = b.maxTier * config.tierHeight;
    elements.push({
      label: `Buildings — ${i + 1}/${all.length}`,
      rects: [box('building', b.x, 0, b.z, b.w, h, b.d, color)],
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
  // Group by building: one element per building (all its floor sections across all tiers).
  // Tier 0 (base) is a single element first.
  const elements = [];
  const base = data.floors.find(f => f.tier === 0);
  if (base) {
    elements.push({
      label: `Floors — tier 0 (base)`,
      rects: base.sections.map(s => box('floor', s.x, 0, s.z, s.w, config.slabThickness, s.d, '#444455')),
    });
  }
  // Collect upper-tier sections per building via position matching
  const buildings = data.buildings;
  for (let bi = 0; bi < buildings.length; bi++) {
    const b = buildings[bi];
    const rects = [];
    for (const f of data.floors) {
      if (f.tier === 0) continue;
      const y = f.tier * config.tierHeight;
      for (const s of f.sections) {
        if (s.x >= b.x - 0.1 && s.z >= b.z - 0.1 && s.x + s.w <= b.x + b.w + 0.1 && s.z + s.d <= b.z + b.d + 0.1) {
          rects.push(box('floor', s.x, y, s.z, s.w, config.slabThickness, s.d, color));
        }
      }
    }
    if (rects.length > 0) {
      elements.push({ label: `Floors — building ${bi + 1}/${buildings.length}`, rects });
    }
  }
  return elements;
}

function wallElements(data, color) {
  const total = data.walls.length;
  return data.walls.map((w, i) => {
    const ww = w.axis === 'x' ? w.length : w.thickness;
    const wd = w.axis === 'x' ? w.thickness : w.length;
    return {
      label: `Walls — ${i + 1}/${total}`,
      rects: [box('wall', w.x, w.baseY, w.z, ww, w.height, wd, color)],
    };
  });
}

function connectivityElements(data, color, config) {
  const elements = [];
  const c = data.connections;

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
