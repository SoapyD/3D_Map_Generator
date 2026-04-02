/**
 * Check if any building segment overlaps with any building in a check list.
 * Skips members of the same texture group or group marker.
 */
export function overlapsAny(segments, checkAgainst) {
  for (const seg of segments) {
    for (const other of checkAgainst) {
      // Skip members of the same texture group
      if (seg.textureGroup !== undefined && seg.textureGroup === other.textureGroup) continue;
      if (seg._groupMarker && seg._groupMarker === other._groupMarker) continue;
      if (seg.x < other.x + other.w && seg.x + seg.w > other.x &&
          seg.z < other.z + other.d && seg.z + seg.d > other.z) {
        return true;
      }
    }
  }
  return false;
}
