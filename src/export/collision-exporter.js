/**
 * Collision Mesh Exporter (file sink) — thin wrapper over buildCollisionObj that writes the
 * simplified TTS collider OBJ to disk. The buffer core (collision-buffer.js) holds the geometry
 * logic so the CLI output and the programmatic in-memory output stay identical.
 */

import { writeFile } from 'fs/promises';
import path from 'path';
import { buildCollisionObj } from './collision-buffer.js';

/**
 * Export collision mesh as an OBJ file. Returns the file path, or null if no collidable surfaces.
 */
export async function exportCollisionObj(geometry, outputDir, baseName) {
  const { objString, count } = buildCollisionObj(geometry);

  if (count === 0) {
    console.log('  No collision meshes found');
    return null;
  }

  const collisionPath = path.join(outputDir, `${baseName}_collision.obj`);
  await writeFile(collisionPath, objString);
  return collisionPath;
}
