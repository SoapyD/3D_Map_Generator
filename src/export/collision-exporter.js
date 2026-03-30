/**
 * Collision Mesh Exporter — exports a simplified OBJ for TTS collider.
 *
 * Consumes geometry primitives from the handover (geometry-builder.js).
 * Each collidable surface becomes a single box (8 verts, 12 triangles).
 * No subdivision needed — just the bounding box of each walkable surface.
 *
 * Includes:
 * - Ground level map (base_floor)
 * - All visible floor sections (floor_)
 * - Cover objects (cover_, interior_cover_)
 * - Ladder platforms (ladder_platform_)
 * - Junction platforms (junction_platform_)
 * - Courtyards (deleted_)
 * - Walkways (walkway_)
 * - Bridges (bridge_) — slab only, not walls/battlements
 * - Pillar supports (pillar_)
 * - Street scatter (street_scatter_)
 * - Flat roofs (roof_flat_)
 * - Pyramid roofs (roof_pyramid_) — base bounding box
 *
 * Excludes walls, ladders, ceilings, edges — so units can move freely.
 */

import { writeFile } from 'fs/promises';
import path from 'path';

const COLLIDABLE_PREFIXES = [
  'base_floor',
  'floor_',
  'cover_',
  'interior_cover_',
  'ladder_platform_',
  'junction_platform_',
  'deleted_',
  'walkway_',
  'bridge_',
  'pillar_',
  'street_scatter_',
  'roof_flat_',
  'roof_pyramid_',
];

/**
 * Export collision mesh as OBJ from geometry primitives.
 */
export async function exportCollisionObj(geometry, outputDir, baseName) {
  const objLines = [];
  let vo = 1;

  objLines.push('# Mordheim Collision Mesh');
  objLines.push('');

  let count = 0;

  for (const prim of geometry.primitives) {
    // Only include slab-type primitives with collidable names
    if (prim.type !== 'slab') continue;
    if (!COLLIDABLE_PREFIXES.some(prefix => prim.name.startsWith(prefix))) continue;

    // Skip bridge walls and battlements — only the bridge deck is collidable
    if (prim.name.includes('_wall_') || prim.name.includes('_batt_')) continue;

    const minX = prim.x, minY = prim.y, minZ = prim.z;
    const maxX = prim.x + prim.w, maxY = prim.y + prim.h, maxZ = prim.z + prim.d;

    objLines.push(`o ${prim.name}`);

    // 8 corner verts of the bounding box
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
    // Bottom (-Y)
    objLines.push(`f ${v} ${v+1} ${v+2}`);
    objLines.push(`f ${v} ${v+2} ${v+3}`);
    // Top (+Y)
    objLines.push(`f ${v+6} ${v+5} ${v+4}`);
    objLines.push(`f ${v+7} ${v+6} ${v+4}`);
    // Front (-Z)
    objLines.push(`f ${v} ${v+4} ${v+5}`);
    objLines.push(`f ${v} ${v+5} ${v+1}`);
    // Back (+Z)
    objLines.push(`f ${v+2} ${v+6} ${v+7}`);
    objLines.push(`f ${v+2} ${v+7} ${v+3}`);
    // Left (-X)
    objLines.push(`f ${v+3} ${v+7} ${v+4}`);
    objLines.push(`f ${v+3} ${v+4} ${v}`);
    // Right (+X)
    objLines.push(`f ${v+1} ${v+5} ${v+6}`);
    objLines.push(`f ${v+1} ${v+6} ${v+2}`);

    vo += 8;
    count++;
    objLines.push('');
  }

  if (count === 0) {
    console.log('  No collision meshes found');
    return null;
  }

  const collisionPath = path.join(outputDir, `${baseName}_collision.obj`);
  await writeFile(collisionPath, objLines.join('\n'));
  return collisionPath;
}
