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

        const nN = matrix.getCell(cx,     cy, cz - 1);
        const nS = matrix.getCell(cx,     cy, cz + 1);
        const nE = matrix.getCell(cx + 1, cy, cz);
        const nW = matrix.getCell(cx - 1, cy, cz);

        const expN = !isTyped(nN);
        const expS = !isTyped(nS);
        const expE = !isTyped(nE);
        const expW = !isTyped(nW);

        const label = resolve(cx, cy, cz, expN, expS, expE, expW, nN, nS, nE, nW);
        if (label !== null) matrix.setCellType(cx, cy, cz, label);
      }
    }
  }
}
