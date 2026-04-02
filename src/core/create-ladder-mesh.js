import * as THREE from 'three';
import { mergeBufferGeometries } from './merge-buffer-geometries.js';

/**
 * Create a detailed ladder mesh: two vertical poles with horizontal rungs.
 *
 * @param {object} ladder - { x, z, w, d, y0, y1 }
 * @param {THREE.Material} material
 * @param {object} opts - { poleRadius, rungRadius, rungSpacing, rungInset }
 * @returns {THREE.Mesh}
 */
export function createLadderMesh(ladder, material, opts) {
  const { poleRadius, rungRadius, rungSpacing, rungInset } = opts;
  const height = ladder.y1 - ladder.y0;
  if (height <= 0) return null;

  const segments = 6; // polygon segments for cylinders
  const geometries = [];

  // Determine ladder orientation — thin axis faces the wall
  const isThinX = ladder.w < ladder.d;
  const ladderWidth = isThinX ? ladder.d : ladder.w;

  // Pole positions: at each side of the ladder's wide axis
  const cx = ladder.x + ladder.w / 2;
  const cz = ladder.z + ladder.d / 2;
  const cy = ladder.y0 + height / 2;

  const halfSpread = (ladderWidth / 2) - poleRadius - rungInset;

  // Two vertical poles
  for (const side of [-1, 1]) {
    const poleGeo = new THREE.CylinderGeometry(poleRadius, poleRadius, height, segments);
    if (isThinX) {
      poleGeo.translate(cx, cy, cz + side * halfSpread);
    } else {
      poleGeo.translate(cx + side * halfSpread, cy, cz);
    }
    geometries.push(poleGeo);
  }

  // Rungs
  const rungCount = Math.floor(height / rungSpacing);
  const rungLength = halfSpread * 2;
  for (let i = 1; i <= rungCount; i++) {
    const ry = ladder.y0 + i * rungSpacing;
    if (ry >= ladder.y1 - rungSpacing * 0.3) break;

    const rungGeo = new THREE.CylinderGeometry(rungRadius, rungRadius, rungLength, segments);
    // Rotate rung to be horizontal
    if (isThinX) {
      rungGeo.rotateX(Math.PI / 2);
      rungGeo.translate(cx, ry, cz);
    } else {
      rungGeo.rotateZ(Math.PI / 2);
      rungGeo.translate(cx, ry, cz);
    }
    geometries.push(rungGeo);
  }

  if (geometries.length === 0) return null;

  const merged = mergeBufferGeometries(geometries);
  geometries.forEach((g) => g.dispose());

  const mesh = new THREE.Mesh(merged, material);
  return mesh;
}
