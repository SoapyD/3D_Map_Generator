import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createSlab } from '../../src/core/geometry-misc.js';
import { GEOMETRY } from '../../src/config.js';
import { textureKeyUvOffset } from '../../src/generators/scene/texture-key-uv-offset.js';

const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
const TILE = GEOMETRY.glbTileSize;

/** [worldPoint, uv] for every vertex of a slab mesh. */
function verts(mesh) {
  const pos = mesh.geometry.getAttribute('position');
  const uv = mesh.geometry.getAttribute('uv');
  const out = [];
  for (let i = 0; i < pos.count; i++) {
    out.push({
      face: Math.floor(i / 4),
      p: [pos.getX(i) + mesh.position.x, pos.getY(i) + mesh.position.y, pos.getZ(i) + mesh.position.z],
      uv: [uv.getX(i), uv.getY(i)],
    });
  }
  return out;
}

describe('createSlab world-space UVs', () => {
  it('maps every vertex to world position / tile size on the face axes (no offset)', () => {
    for (const vert of verts(createSlab(7.5, 2, 4, 3, 2, 6, mat))) {
      const [x, y, z] = vert.p;
      const expectU = [-z, z, x, x, x, -x][vert.face] / TILE;
      const expectV = [y, y, z, z, y, y][vert.face] / TILE;
      expect(vert.uv[0]).toBeCloseTo(expectU, 5);
      expect(vert.uv[1]).toBeCloseTo(expectV, 5);
    }
  });

  it('adds the uvOffset to every vertex', () => {
    const plain = verts(createSlab(0, 0, 0, 3, 1, 3, mat));
    const shifted = verts(createSlab(0, 0, 0, 3, 1, 3, mat, { uvOffset: [0.25, 0.5] }));
    plain.forEach((p, i) => {
      expect(shifted[i].uv[0]).toBeCloseTo(p.uv[0] + 0.25, 5);
      expect(shifted[i].uv[1]).toBeCloseTo(p.uv[1] + 0.5, 5);
    });
  });

  it('rotateUV swaps the top face axes only', () => {
    const a = verts(createSlab(0, 0, 0, 6, 1, 9, mat)).filter((v) => v.face === 2);
    const b = verts(createSlab(0, 0, 0, 6, 1, 9, mat, { rotateUV: true })).filter((v) => v.face === 2);
    a.forEach((v, i) => {
      expect(b[i].uv[0]).toBeCloseTo(v.uv[1], 5);
      expect(b[i].uv[1]).toBeCloseTo(v.uv[0], 5);
    });
  });

  it('adjacent boxes share identical UVs along their common edge (no seam)', () => {
    const offset = textureKeyUvOffset('wall:standard:1');
    // Two wall boxes meeting at x = 6, and two floor slabs meeting at z = 9 (rotateUV on one).
    const pairs = [
      [createSlab(3, 1, 5, 6, 2, 0.5, mat, { uvOffset: offset }), createSlab(9, 1, 5, 6, 2, 0.5, mat, { uvOffset: offset })],
      [createSlab(5, 0, 4.5, 8, 0.25, 9, mat, { uvOffset: offset }), createSlab(5, 0, 13.5, 8, 0.25, 9, mat, { uvOffset: offset })],
    ];
    for (const [left, right] of pairs) {
      const l = verts(left), r = verts(right);
      let shared = 0;
      for (const a of l) {
        for (const b of r) {
          const same = a.face === b.face && a.p.every((c, i) => Math.abs(c - b.p[i]) < 1e-9);
          if (!same) continue;
          shared++;
          expect(a.uv[0]).toBeCloseTo(b.uv[0], 6);
          expect(a.uv[1]).toBeCloseTo(b.uv[1], 6);
        }
      }
      expect(shared).toBeGreaterThan(0);
    }
  });

  it('a box split in two has the same UVs as the whole box', () => {
    const whole = verts(createSlab(6, 1, 0, 12, 2, 1, mat));
    const half = verts(createSlab(3, 1, 0, 6, 2, 1, mat));
    // Every vertex of the half box lies on the whole box's surface; compare the matching +z face.
    const front = (list) => list.filter((v) => v.face === 4);
    let matched = 0;
    for (const v of front(half)) {
      const match = front(whole).find((w) => w.p.every((c, i) => Math.abs(c - v.p[i]) < 1e-9));
      if (!match) continue;
      matched++;
      expect(match.uv[0]).toBeCloseTo(v.uv[0], 5);
      expect(match.uv[1]).toBeCloseTo(v.uv[1], 5);
    }
    expect(matched).toBeGreaterThan(0);
  });
});

describe('textureKeyUvOffset', () => {
  it('is deterministic and within 0..1', () => {
    const a = textureKeyUvOffset('wall:standard:3');
    expect(textureKeyUvOffset('wall:standard:3')).toEqual(a);
    for (const c of a) { expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThan(1); }
  });

  it('differs between keys and is zero-safe for a missing key', () => {
    expect(textureKeyUvOffset('wall:standard:3')).not.toEqual(textureKeyUvOffset('pavement:0'));
    expect(textureKeyUvOffset(undefined)).toEqual([0, 0]);
  });
});
