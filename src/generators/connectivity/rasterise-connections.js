import { CELL, STAGE } from '../collision/matrix.js';
import { CONNECTIVITY } from '../../config.js';

// ─── Type assignment ──────────────────────────────────────────────────────────

function assignType(conn, rng) {
  // cy > 0 means the slab is above ground (ground slab sits at cy = -slabThickness = -1)
  const elevated = conn.from.cells[0].cy > 0;
  if (!elevated || conn.length < CONNECTIVITY.bridgeMinLength) return 'walkway';
  const isLong = conn.length >= CONNECTIVITY.bridgeLongThreshold;
  const chance = isLong ? CONNECTIVITY.bridgeLongChance : CONNECTIVITY.bridgeChance;
  if (!rng.chance(chance)) return 'walkway';

  const variants = isLong ? CONNECTIVITY.bridgeVariantsLong : CONNECTIVITY.bridgeVariants;
  const roll = rng.random() * 100;
  let cum = 0;
  for (const [name, pct] of Object.entries(variants)) {
    cum += pct;
    if (roll < cum) return `bridge_${name}`;
  }
  return 'walkway';
}

// ─── Cell enumeration ─────────────────────────────────────────────────────────

function enumerateCells(conn) {
  const { from, to, axis } = conn;
  const cy = from.cells[0].cy;
  const cells = [];

  if (axis === 'NS') {
    const cx0 = from.cells[0].cx;
    const cx1 = from.cells[1].cx;
    const czMin = Math.min(from.cells[0].cz, to.cells[0].cz);
    const czMax = Math.max(from.cells[0].cz, to.cells[0].cz);
    for (let cz = czMin; cz <= czMax; cz++) {
      cells.push({ cx: cx0, cy, cz });
      cells.push({ cx: cx1, cy, cz });
    }
  } else {
    const cz0 = from.cells[0].cz;
    const cz1 = from.cells[1].cz;
    const cxMin = Math.min(from.cells[0].cx, to.cells[0].cx);
    const cxMax = Math.max(from.cells[0].cx, to.cells[0].cx);
    for (let cx = cxMin; cx <= cxMax; cx++) {
      cells.push({ cx, cy, cz: cz0 });
      cells.push({ cx, cy, cz: cz1 });
    }
  }

  return cells;
}

// ─── Segment splitting ────────────────────────────────────────────────────────

function isCrossingSlice(axis, cy, t, w0, w1, crossingKeys) {
  return axis === 'NS'
    ? crossingKeys.has(`${w0},${cy},${t}`) || crossingKeys.has(`${w1},${cy},${t}`)
    : crossingKeys.has(`${t},${cy},${w0}`) || crossingKeys.has(`${t},${cy},${w1}`);
}

function buildSegmentRect(conn, matrix, tMin, tMax) {
  const cs = matrix.cellSize;
  const { from, axis } = conn;
  const cy = from.cells[0].cy;

  if (axis === 'NS') {
    const minCx = Math.min(from.cells[0].cx, from.cells[1].cx);
    const wp = matrix.cellToWorld(minCx, cy, tMin);
    return { x: wp.x, y: from.y, z: wp.z, w: 2 * cs, d: (tMax - tMin + 1) * cs };
  } else {
    const minCz = Math.min(from.cells[0].cz, from.cells[1].cz);
    const wp = matrix.cellToWorld(tMin, cy, minCz);
    return { x: wp.x, y: from.y, z: wp.z, w: (tMax - tMin + 1) * cs, d: 2 * cs };
  }
}

function splitIntoSegments(conn, crossingKeys, matrix) {
  const { from, to, axis } = conn;
  const cy = from.cells[0].cy;

  let w0, w1, tMin, tMax;
  if (axis === 'NS') {
    w0 = from.cells[0].cx;  w1 = from.cells[1].cx;
    tMin = Math.min(from.cells[0].cz, to.cells[0].cz);
    tMax = Math.max(from.cells[0].cz, to.cells[0].cz);
  } else {
    w0 = from.cells[0].cz;  w1 = from.cells[1].cz;
    tMin = Math.min(from.cells[0].cx, to.cells[0].cx);
    tMax = Math.max(from.cells[0].cx, to.cells[0].cx);
  }

  const segments = [];
  let segStart = tMin;
  let segCrossing = isCrossingSlice(axis, cy, tMin, w0, w1, crossingKeys);

  for (let t = tMin + 1; t <= tMax + 1; t++) {
    const atEnd = t > tMax;
    const thisCrossing = atEnd ? null : isCrossingSlice(axis, cy, t, w0, w1, crossingKeys);

    if (atEnd || thisCrossing !== segCrossing) {
      const segEnd = t - 1;
      const cells = [];
      for (let st = segStart; st <= segEnd; st++) {
        if (axis === 'NS') {
          cells.push({ cx: w0, cy, cz: st });
          cells.push({ cx: w1, cy, cz: st });
        } else {
          cells.push({ cx: st, cy, cz: w0 });
          cells.push({ cx: st, cy, cz: w1 });
        }
      }
      segments.push({
        isCrossing: segCrossing,
        cells,
        worldRect: buildSegmentRect(conn, matrix, segStart, segEnd),
      });
      if (!atEnd) {
        segStart = t;
        segCrossing = thisCrossing;
      }
    }
  }

  return segments;
}

// ─── Walkway entry builder ────────────────────────────────────────────────────

function buildEntry(conn) {
  return {
    id: conn.id,
    connectionType: conn.connectionType,
    axis: conn.axis,
    fromBuildingId: conn.fromBuildingId,
    toBuildingId:   conn.toBuildingId,
    tier:           conn.from.cells[0].cy,
    hasCrossing:    !!conn.hasCrossing,
    segments:       conn.segments,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function rasteriseConnections(data, matrix, rng) {
  const survivors = data.connections.candidates;

  // 1. Assign types
  for (const conn of survivors) {
    conn.connectionType = assignType(conn, rng);
  }

  // 2. Enumerate span cells
  for (const conn of survivors) {
    conn.spanCells = enumerateCells(conn);
  }

  // 3. Detect crossings via pre-enumeration
  const cellOwners = new Map();
  for (const conn of survivors) {
    for (const cell of conn.spanCells) {
      const key = `${cell.cx},${cell.cy},${cell.cz}`;
      if (!cellOwners.has(key)) cellOwners.set(key, []);
      cellOwners.get(key).push(conn);
    }
  }

  const crossingKeys = new Set();
  const crossings = [];

  for (const [key, owners] of cellOwners) {
    if (owners.length >= 2) {
      crossingKeys.add(key);
      const [cx, cy, cz] = key.split(',').map(Number);
      crossings.push({ cx, cy, cz, connectionIds: owners.map(c => c.id) });
      for (const conn of owners) conn.hasCrossing = true;
    }
  }

  if (crossings.length > 0) {
    console.log(`  Crossings detected: ${crossings.length} cells`);
  }

  // 4. Build segments
  for (const conn of survivors) {
    if (!conn.hasCrossing) {
      const { from, to, axis } = conn;
      const tMin = axis === 'NS'
        ? Math.min(from.cells[0].cz, to.cells[0].cz)
        : Math.min(from.cells[0].cx, to.cells[0].cx);
      const tMax = axis === 'NS'
        ? Math.max(from.cells[0].cz, to.cells[0].cz)
        : Math.max(from.cells[0].cx, to.cells[0].cx);
      conn.segments = [{
        isCrossing: false,
        cells: conn.spanCells,
        worldRect: buildSegmentRect(conn, matrix, tMin, tMax),
      }];
    } else {
      conn.segments = splitIntoSegments(conn, crossingKeys, matrix);
    }
  }

  // 5a. Pass A — write non-crossing connections
  const walkways = [];
  for (const conn of survivors) {
    if (conn.hasCrossing) continue;
    matrix.setWriteContext(STAGE.WALKWAYS, walkways.length);
    for (const cell of conn.spanCells) {
      matrix.setCell(cell.cx, cell.cy, cell.cz, CELL.WALKWAY);
    }
    walkways.push(buildEntry(conn));
  }

  // 5b. Pass B — write crossing connections
  for (const conn of survivors) {
    if (!conn.hasCrossing) continue;
    matrix.setWriteContext(STAGE.WALKWAYS, walkways.length);
    for (const seg of conn.segments) {
      const cellValue = seg.isCrossing ? CELL.WALKWAY_CROSSING : CELL.WALKWAY;
      for (const cell of seg.cells) {
        matrix.setCell(cell.cx, cell.cy, cell.cz, cellValue);
      }
    }
    walkways.push(buildEntry(conn));
  }

  return { walkways, crossings };
}
