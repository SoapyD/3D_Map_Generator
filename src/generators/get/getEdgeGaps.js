/**
 * Find gaps along one edge of a section where no adjacent section covers it.
 * Returns array of {start, end} intervals in the run axis.
 */
export function getEdgeGaps(section, side, allSections) {
  const margin = 0.1;
  let runMin, runMax;

  if (side === 'north' || side === 'south') {
    runMin = section.x;
    runMax = section.x + section.w;
  } else {
    runMin = section.z;
    runMax = section.z + section.d;
  }

  // Collect coverage intervals from adjacent sections
  const covered = [];
  for (const other of allSections) {
    if (other === section) continue;
    let adjacent = false;
    let covMin, covMax;

    if (side === 'north') {
      adjacent = Math.abs(other.z + other.d - section.z) < margin &&
                 other.x < section.x + section.w + margin && other.x + other.w > section.x - margin;
      covMin = Math.max(section.x, other.x);
      covMax = Math.min(section.x + section.w, other.x + other.w);
    } else if (side === 'south') {
      adjacent = Math.abs(other.z - (section.z + section.d)) < margin &&
                 other.x < section.x + section.w + margin && other.x + other.w > section.x - margin;
      covMin = Math.max(section.x, other.x);
      covMax = Math.min(section.x + section.w, other.x + other.w);
    } else if (side === 'west') {
      adjacent = Math.abs(other.x + other.w - section.x) < margin &&
                 other.z < section.z + section.d + margin && other.z + other.d > section.z - margin;
      covMin = Math.max(section.z, other.z);
      covMax = Math.min(section.z + section.d, other.z + other.d);
    } else { // east
      adjacent = Math.abs(other.x - (section.x + section.w)) < margin &&
                 other.z < section.z + section.d + margin && other.z + other.d > section.z - margin;
      covMin = Math.max(section.z, other.z);
      covMax = Math.min(section.z + section.d, other.z + other.d);
    }

    if (adjacent && covMax > covMin) {
      covered.push({ start: covMin, end: covMax });
    }
  }

  // Sort and merge
  covered.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const c of covered) {
    if (merged.length > 0 && c.start <= merged[merged.length - 1].end + margin) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, c.end);
    } else {
      merged.push({ ...c });
    }
  }

  // Find gaps (uncovered intervals)
  const gaps = [];
  let cursor = runMin;
  for (const c of merged) {
    if (c.start > cursor + margin) {
      gaps.push({ start: cursor, end: c.start });
    }
    cursor = Math.max(cursor, c.end);
  }
  if (cursor < runMax - margin) {
    gaps.push({ start: cursor, end: runMax });
  }

  return gaps;
}
