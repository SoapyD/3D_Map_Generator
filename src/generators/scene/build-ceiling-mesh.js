import * as THREE from 'three';

export function buildCeilingMesh(prim, mat) {
  const positions = new Float32Array([
    prim.x, prim.y, prim.z,
    prim.x + prim.w, prim.y, prim.z,
    prim.x + prim.w, prim.y, prim.z + prim.d,
    prim.x, prim.y, prim.z,
    prim.x + prim.w, prim.y, prim.z + prim.d,
    prim.x, prim.y, prim.z + prim.d,
  ]);
  const normals = new Float32Array([
    0, -1, 0, 0, -1, 0, 0, -1, 0,
    0, -1, 0, 0, -1, 0, 0, -1, 0,
  ]);
  const uvs = new Float32Array([
    0, 0, 1, 0, 1, 1,
    0, 0, 1, 1, 0, 1,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = prim.name;
  return mesh;
}
