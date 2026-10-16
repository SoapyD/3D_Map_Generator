/**
 * Clone of a mesh's geometry baked into world space (same transform the GLB exporter applies).
 */
export function meshWorldGeometry(mesh) {
  mesh.updateMatrixWorld(true);
  const geo = mesh.geometry.clone();
  geo.applyMatrix4(mesh.matrixWorld);
  return geo;
}
