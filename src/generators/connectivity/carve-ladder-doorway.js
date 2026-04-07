/**
 * At the top exit of a ladder, carve a doorway-sized gap in the blocking wall.
 * Rather than deleting the whole wall segment, the overlapping portion is removed
 * and two remnants (left and right of the gap) are inserted in its place.
 *
 * @param {object} ladder  - { x, z, w, d, y1, platformDir }
 * @param {object} state   - { walls: object[], config }
 */
import { CONNECTIVITY } from '../../config.js';

export function carveLadderDoorway(ladder, state) {
  const { walls, config } = state;
  const { tierHeight, slabThickness, wallThickness } = config;
  const minRemnant = CONNECTIVITY.ladderDoorwayMinRemnant;

  // Y position of the exit wall (the wall sitting on the floor at y1)
  const exitTier = Math.round(ladder.y1 / tierHeight);
  const exitWallY = exitTier * tierHeight + slabThickness;

  // Derive wall axis, the coordinate flush with the exit face, and the gap span
  // from platformDir (the direction the player approaches the ladder from).
  let wallAxis, flushCoord, gapMin, gapMax;
  if (ladder.platformDir === 'north') {
    // Ladder is north of the building; exit wall is the north face (x-axis wall)
    wallAxis = 'x';
    flushCoord = ladder.z + ladder.d;  // inner (south) edge of ladder ≈ north face Z
    gapMin = ladder.x;
    gapMax = ladder.x + ladder.w;
  } else if (ladder.platformDir === 'south') {
    // Ladder is south of the building; exit wall is the south face (x-axis wall)
    wallAxis = 'x';
    flushCoord = ladder.z;             // inner (north) edge of ladder ≈ south face Z
    gapMin = ladder.x;
    gapMax = ladder.x + ladder.w;
  } else if (ladder.platformDir === 'east') {
    // Ladder is east of the building; exit wall is the east face (z-axis wall)
    wallAxis = 'z';
    flushCoord = ladder.x;             // inner (west) edge of ladder ≈ east face X
    gapMin = ladder.z;
    gapMax = ladder.z + ladder.d;
  } else {
    // west — ladder is west of the building; exit wall is the west face (z-axis wall)
    wallAxis = 'z';
    flushCoord = ladder.x + ladder.w;  // inner (east) edge of ladder ≈ west face X
    gapMin = ladder.z;
    gapMax = ladder.z + ladder.d;
  }

  const tolerance = wallThickness + 0.5;

  // Iterate in reverse so splice indices stay valid
  for (let wi = walls.length - 1; wi >= 0; wi--) {
    const wall = walls[wi];

    // Tier filter
    if (Math.abs(wall.baseY - exitWallY) > 0.5) continue;

    // Axis filter — only walls running perpendicular to travel direction
    if (wall.axis !== wallAxis) continue;

    // Position filter — wall must be flush with the exit face
    const wallPos = wallAxis === 'x' ? wall.z : wall.x;
    const wallFar = wallPos + wallThickness;
    if (Math.abs(wallPos - flushCoord) > tolerance &&
        Math.abs(wallFar - flushCoord) > tolerance) continue;

    // 1-D overlap of wall length against the ladder gap span
    const wallStart = wallAxis === 'x' ? wall.x : wall.z;
    const wallEnd = wallStart + wall.length;
    const overlapMin = Math.max(wallStart, gapMin);
    const overlapMax = Math.min(wallEnd, gapMax);
    if (overlapMax <= overlapMin) continue;

    // Build remnants — keep whatever is left of the wall on each side of the gap
    const remnants = [];

    const leftLength = overlapMin - wallStart;
    if (leftLength >= minRemnant) {
      remnants.push({ ...wall, length: leftLength });
    }

    const rightLength = wallEnd - overlapMax;
    if (rightLength >= minRemnant) {
      const right = { ...wall, length: rightLength };
      if (wallAxis === 'x') right.x = overlapMax;
      else right.z = overlapMax;
      remnants.push(right);
    }

    // Replace original with the two remnants (or nothing if both too short)
    walls.splice(wi, 1, ...remnants);
  }
}
