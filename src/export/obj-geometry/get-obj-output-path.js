export function getObjOutputPath(config) {
  const baseName = `mordheim_map_${config.seed}`;
  return { dir: config.outputDir, baseName };
}
