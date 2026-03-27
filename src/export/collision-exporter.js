/**
 * Collision Mesh Exporter — exports a simplified OBJ for TTS collider.
 *
 * Includes only walkable/standable surfaces:
 * - Ground level map (floor_t0)
 * - All visible floor quadrants (floor_t1+)
 * - Purple cover objects (cover_)
 * - Grey interior cover (interior_cover_)
 * - White ladder platforms (ladder_platform_)
 *
 * Excludes walls, ladders, walkways — so units can move freely.
 */

import * as THREE from 'three';
import { writeFile } from 'fs/promises';
import path from 'path';

// Mesh name prefixes to include in the collision mesh
const INCLUDE_PREFIXES = [
  'floor_',
  'cover_',
  'interior_cover_',
  'ladder_platform_',
  'deleted_',
];

/**
 * Export collision mesh as OBJ.
 */
export async function exportCollisionObj(scene, outputDir, baseName) {
  const meshes = [];
  scene.traverse((child) => {
    if (!child.isMesh) return;
    const name = child.name || '';
    if (INCLUDE_PREFIXES.some((p) => name.startsWith(p))) {
      meshes.push(child);
    }
    // Also include pillar groups (cover_ is a Group for tall objects)
    if (child.parent && child.parent.name && child.parent.name.startsWith('cover_')) {
      meshes.push(child);
    }
  });

  if (meshes.length === 0) {
    console.log('  No collision meshes found');
    return null;
  }

  // Deduplicate (group children might be added twice)
  const unique = [...new Set(meshes)];

  const objLines = [];
  let vertexOffset = 1;

  objLines.push(`# Mordheim Collision Mesh`);
  objLines.push('');

  for (const mesh of unique) {
    mesh.updateMatrixWorld(true);
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);

    const position = geo.getAttribute('position');
    const index = geo.getIndex();

    objLines.push(`o ${mesh.name || 'collision'}`);

    // Vertices
    for (let i = 0; i < position.count; i++) {
      objLines.push(`v ${position.getX(i).toFixed(6)} ${position.getY(i).toFixed(6)} ${position.getZ(i).toFixed(6)}`);
    }

    // Faces
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const a = index.array[i] + vertexOffset;
        const b = index.array[i + 1] + vertexOffset;
        const c = index.array[i + 2] + vertexOffset;
        objLines.push(`f ${a} ${b} ${c}`);
      }
    }

    vertexOffset += position.count;
    objLines.push('');
    geo.dispose();
  }

  const collisionPath = path.join(outputDir, `${baseName}_collision.obj`);
  await writeFile(collisionPath, objLines.join('\n'));
  return collisionPath;
}
