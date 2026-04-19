/**
 * Generic cardinal-neighbour labelling pass.
 *
 * Scans every typed cell at each Y level, checks the four cardinal neighbours,
 * and calls `resolve(cx, cy, cz, expN, expS, expE, expW)`.
 * If resolve returns a non-null value it is written to the cell.
 *
 * @param {Set<number>} yLevels   - slab Y positions to scan
 * @param {object}      matrix    - collision matrix
 * @param {Function}    isTyped   - predicate: returns true for cells of this type
 * @param {Function}    resolve   - (cx, cy, cz, expN, expS, expE, expW) => label | null
 */
export function labelCells(yLevels, matrix, isTyped, resolve) {
  for (const cy of yLevels) {
    for (let cz = 0; cz < matrix.D; cz++) {
      for (let cx = 0; cx < matrix.W; cx++) {
        if (!isTyped(matrix.getCell(cx, cy, cz))) continue;

        const expN = !isTyped(matrix.getCell(cx,     cy, cz - 1));
        const expS = !isTyped(matrix.getCell(cx,     cy, cz + 1));
        const expE = !isTyped(matrix.getCell(cx + 1, cy, cz));
        const expW = !isTyped(matrix.getCell(cx - 1, cy, cz));

        const label = resolve(cx, cy, cz, expN, expS, expE, expW);
        if (label !== null) matrix.setCellType(cx, cy, cz, label);
      }
    }
  }
}
