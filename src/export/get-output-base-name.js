/**
 * Base file name (no extension) shared by the GLB, geometry JSON and debug output of one run.
 *
 * @param {object} config - needs seed and outputDir
 * @returns {{ dir: string, baseName: string }}
 */
export function getOutputBaseName(config) {
  const baseName = `mordheim_map_${config.seed}`;
  return { dir: config.outputDir, baseName };
}
