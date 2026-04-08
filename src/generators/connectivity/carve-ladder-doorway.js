/**
 * At the top exit of a ladder, delete every wall quadrant segment that blocks
 * the way onto the floor above.
 *
 * Approach:
 *  1. Derive exit tier from the ladder's top height (y1).
 *  2. Collect all wall segments that belong to that tier using a simple integer
 *     band check on baseY — this catches both upper and lower quadrant rows
 *     without any slab-offset arithmetic.
 *  3. Filter to walls on the correct axis and flush with the exit face.
 *  4. Filter to wall segments whose extent overlaps the ladder's width in XZ.
 *  5. Delete those segments outright — each segment is already one quadrant.
 *
 * @param {object} ladder  - { x, z, w, d, y1, platformDir }
 * @param {object} state   - { walls: object[], config }
 */
export function carveLadderDoorway(ladder, state) {
  const { walls, config } = state;
  const { tierHeight, wallThickness } = config;

  // Step 1 — which tier does this ladder exit onto?
  const exitTier = Math.round(ladder.y1 / tierHeight);

  // Step 2/3 — derive the exit face geometry from platformDir
  let wallAxis, flushCoord, gapMin, gapMax;
  if (ladder.platformDir === 'north') {
    wallAxis = 'x';
    flushCoord = ladder.z + ladder.d;
    gapMin = ladder.x;
    gapMax = ladder.x + ladder.w;
  } else if (ladder.platformDir === 'south') {
    wallAxis = 'x';
    flushCoord = ladder.z;
    gapMin = ladder.x;
    gapMax = ladder.x + ladder.w;
  } else if (ladder.platformDir === 'east') {
    wallAxis = 'z';
    flushCoord = ladder.x;
    gapMin = ladder.z;
    gapMax = ladder.z + ladder.d;
  } else {
    // west
    wallAxis = 'z';
    flushCoord = ladder.x + ladder.w;
    gapMin = ladder.z;
    gapMax = ladder.z + ladder.d;
  }

  const tolerance = wallThickness + 0.5;

  // Iterate in reverse so splice indices stay valid
  for (let wi = walls.length - 1; wi >= 0; wi--) {
    const wall = walls[wi];

    // Step 2 — tier check: both lower and upper quadrant rows at exitTier fall
    // inside the same integer band [exitTier * tierHeight, (exitTier+1) * tierHeight)
    if (Math.floor(wall.baseY / tierHeight) !== exitTier) continue;

    // Step 3a — axis filter
    if (wall.axis !== wallAxis) continue;

    // Step 3b — position filter: wall must be flush with the exit face
    const wallPos = wallAxis === 'x' ? wall.z : wall.x;
    const wallFar = wallPos + wallThickness;
    if (Math.abs(wallPos - flushCoord) > tolerance &&
        Math.abs(wallFar - flushCoord) > tolerance) continue;

    // Step 4 — XZ width overlap: does this quadrant segment overlap the ladder?
    const wallStart = wallAxis === 'x' ? wall.x : wall.z;
    const wallEnd = wallStart + wall.length;
    if (wallEnd <= gapMin || wallStart >= gapMax) continue;

    // Step 5 — delete this quadrant segment
    walls.splice(wi, 1);
  }
}
