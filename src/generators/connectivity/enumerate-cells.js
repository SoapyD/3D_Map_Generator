export function enumerateCells(conn) {
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
