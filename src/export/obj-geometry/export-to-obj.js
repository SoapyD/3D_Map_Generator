/**
 * OBJ Exporter (file sink) — thin wrapper over buildObjAndAtlas that writes the OBJ geometry and
 * its texture-atlas PNG to disk. The buffer core (build-obj-and-atlas.js) holds all the logic so the
 * CLI file output and the programmatic in-memory output stay byte-identical.
 */

import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { buildObjAndAtlas } from './build-obj-and-atlas.js';

/**
 * Export geometry primitives to OBJ + texture atlas files. Returns the OBJ file path.
 */
export async function exportToObj(geometry, config, outputDir, baseName) {
  const { objString, atlasPngBuffer } = buildObjAndAtlas(geometry, config);

  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, `${baseName}.png`), atlasPngBuffer);

  const objPath = path.join(outputDir, `${baseName}.obj`);
  await writeFile(objPath, objString);
  return objPath;
}
