/**
 * Collision mesh buffer core — builds the simplified TTS collider OBJ string in memory (no file
 * writes). The file-writing `exportCollisionObj` wraps this; the programmatic
 * `generateColliderToBuffer` returns the string directly.
 *
 * Each collidable surface becomes a single axis-aligned box (8 verts, 12 triangles) — deliberately
 * simpler than the visual OBJ (no subdivision, no UVs, no normals) so TTS physics stay cheap.
 * Excludes walls, ladders, ceilings, edges so units can move freely.
 */

const COLLIDABLE_PREFIXES = [
  'skirt_', 'river_', 'street_', 'pavement_', 'base_floor', 'floor_', 'roof_',
  'cover_', 'interior_cover_', 'street_scatter_', 'walkway_', 'bridge_', 'pillar_',
  'ladder_platform_', 'junction_platform_', 'deleted_',
];

/**
 * Build the collision OBJ string from geometry primitives.
 * @returns {{ objString: string, count: number }} `count` is the number of collidable surfaces emitted.
 */
export function buildCollisionObj(geometry) {
  const objLines = ['# Mordheim Collision Mesh', ''];
  let vo = 1;
  let count = 0;

  for (const prim of geometry.primitives) {
    if (prim.type !== 'slab') continue;
    if (!COLLIDABLE_PREFIXES.some(prefix => prim.name.startsWith(prefix))) continue;
    // Only the bridge deck is collidable — skip bridge walls and battlements.
    if (prim.name.includes('_wall_') || prim.name.includes('_batt_')) continue;

    const minX = prim.x, minY = prim.y, minZ = prim.z;
    const maxX = prim.x + prim.w, maxY = prim.y + prim.h, maxZ = prim.z + prim.d;

    objLines.push(`o ${prim.name}`);

    const v = vo;
    objLines.push(`v ${minX.toFixed(6)} ${minY.toFixed(6)} ${minZ.toFixed(6)}`); // 0: ---
    objLines.push(`v ${maxX.toFixed(6)} ${minY.toFixed(6)} ${minZ.toFixed(6)}`); // 1: +--
    objLines.push(`v ${maxX.toFixed(6)} ${minY.toFixed(6)} ${maxZ.toFixed(6)}`); // 2: +-+
    objLines.push(`v ${minX.toFixed(6)} ${minY.toFixed(6)} ${maxZ.toFixed(6)}`); // 3: --+
    objLines.push(`v ${minX.toFixed(6)} ${maxY.toFixed(6)} ${minZ.toFixed(6)}`); // 4: -+-
    objLines.push(`v ${maxX.toFixed(6)} ${maxY.toFixed(6)} ${minZ.toFixed(6)}`); // 5: ++-
    objLines.push(`v ${maxX.toFixed(6)} ${maxY.toFixed(6)} ${maxZ.toFixed(6)}`); // 6: +++
    objLines.push(`v ${minX.toFixed(6)} ${maxY.toFixed(6)} ${maxZ.toFixed(6)}`); // 7: -++

    // 6 faces (12 triangles)
    objLines.push(`f ${v} ${v+1} ${v+2}`, `f ${v} ${v+2} ${v+3}`);           // Bottom (-Y)
    objLines.push(`f ${v+6} ${v+5} ${v+4}`, `f ${v+7} ${v+6} ${v+4}`);       // Top (+Y)
    objLines.push(`f ${v} ${v+4} ${v+5}`, `f ${v} ${v+5} ${v+1}`);           // Front (-Z)
    objLines.push(`f ${v+2} ${v+6} ${v+7}`, `f ${v+2} ${v+7} ${v+3}`);       // Back (+Z)
    objLines.push(`f ${v+3} ${v+7} ${v+4}`, `f ${v+3} ${v+4} ${v}`);         // Left (-X)
    objLines.push(`f ${v+1} ${v+5} ${v+6}`, `f ${v+1} ${v+6} ${v+2}`);       // Right (+X)

    vo += 8;
    count++;
    objLines.push('');
  }

  return { objString: objLines.join('\n'), count };
}
