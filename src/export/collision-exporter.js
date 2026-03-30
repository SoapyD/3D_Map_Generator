/**
 * Collision Mesh Exporter — exports a simplified OBJ for TTS collider.
 *
 * Each surface is a single box (8 verts, 12 triangles) regardless of
 * how many texture tiles it has in the visual OBJ. No subdivision needed
 * for collision — just the bounding box of each walkable surface.
 *
 * Includes:
 * - Ground level map (floor_)
 * - All visible floor quadrants
 * - Cover objects (cover_, interior_cover_)
 * - Ladder platforms (ladder_platform_)
 * - Courtyards (deleted_)
 * - Walkways (walkway_)
 * - Street scatter (street_scatter_)
 *
 * Excludes walls, ladders — so units can move freely.
 */

import * as THREE from 'three';
import { writeFile } from 'fs/promises';
import path from 'path';

const INCLUDE_PREFIXES = [
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
];

/**
 * Export collision mesh as OBJ — one box per surface, no subdivision.
 */
export async function exportCollisionObj(scene, outputDir, baseName) {
  const meshes = [];
  scene.traverse((child) => {
    if (!child.isMesh) return;
    const name = child.name || '';
    if (INCLUDE_PREFIXES.some((p) => name.startsWith(p))) {
      meshes.push(child);
    }
    if (child.parent && child.parent.name && child.parent.name.startsWith('cover_')) {
      meshes.push(child);
    }
  });

  if (meshes.length === 0) {
    console.log('  No collision meshes found');
    return null;
  }

  const unique = [...new Set(meshes)];

  const objLines = [];
  let vo = 1;

  objLines.push(`# Mordheim Collision Mesh`);
  objLines.push('');

  for (const mesh of unique) {
    mesh.updateMatrixWorld(true);
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);

    const position = geo.getAttribute('position');

    // Find bounding box
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }

    objLines.push(`o ${mesh.name || 'collision'}`);

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
    objLines.push('');
    geo.dispose();
  }

  const collisionPath = path.join(outputDir, `${baseName}_collision.obj`);
  await writeFile(collisionPath, objLines.join('\n'));
  return collisionPath;
}
