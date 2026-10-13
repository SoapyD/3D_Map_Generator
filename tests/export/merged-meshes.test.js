import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import * as THREE from 'three';
import { runStages } from '../helpers/run-stages.js';
import { buildScene } from '../../src/generators/scene/index.js';
import { buildGlbBuffer } from '../../src/export/glb-exporter.js';
import { tierOf } from '../../src/export/assign-primitive-tier.js';
import { meshWorldGeometry } from '../../src/generators/scene/mesh-world-geometry.js';
import { GEOMETRY } from '../../src/config.js';

const SEED = 42;
const OPTS = { mapWidth: 36, mapDepth: 36 };
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');
const merge = (byTier = true) => ({ mergeMeshes: { enabled: true, byTier } });
const off = { mergeMeshes: { enabled: false, byTier: true } };

function sceneFor(extra, debug = true) {
  const { geometry, config } = runStages(SEED, OPTS);
  return buildScene(geometry, { ...config, debug, ...extra });
}

function meshesOf(scene) {
  const meshes = [];
  scene.traverse((m) => m.isMesh && meshes.push(m));
  return meshes;
}

/** Per-material totals (key = colour + texture file) of triangles, area and bounds, from world-space geometry. */
function perMaterial(scene) {
  const out = new Map();
  for (const mesh of meshesOf(scene)) {
    const key = `${mesh.material.color.getHex()}|${mesh.material._fileName ?? ''}`;
    const e = out.get(key) ?? { tris: 0, area: 0, box: new THREE.Box3() };
    out.set(key, e);
    const g = meshWorldGeometry(mesh);
    const pos = g.getAttribute('position');
    const idx = g.getIndex();
    const n = idx ? idx.count : pos.count;
    const [a, b, c] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    for (let i = 0; i < n; i += 3) {
      const at = (k) => (idx ? idx.getX(i + k) : i + k);
      a.fromBufferAttribute(pos, at(0)); b.fromBufferAttribute(pos, at(1)); c.fromBufferAttribute(pos, at(2));
      e.area += new THREE.Triangle(a, b, c).getArea();
      e.tris++;
    }
    g.computeBoundingBox();
    e.box.union(g.boundingBox);
  }
  return out;
}

describe('merged scene meshes', () => {
  it('defaults to enabled, per tier', () => {
    expect(GEOMETRY.mergeMeshes).toEqual({ enabled: true, byTier: true });
  });

  it.each([['debug', true], ['textured', false]])('keeps per-material triangles, area and bounds (%s)', (_, debug) => {
    const before = perMaterial(sceneFor(off, debug));
    const after = perMaterial(sceneFor(merge(), debug));
    expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
    for (const [key, b] of before) {
      const a = after.get(key);
      expect(a.tris).toBe(b.tris);
      expect(a.area).toBeCloseTo(b.area, 6);
      expect(a.box.min.toArray()).toEqual(b.box.min.toArray());
      expect(a.box.max.toArray()).toEqual(b.box.max.toArray());
    }
  });

  it('disabled reproduces one mesh per primitive without extras', async () => {
    const { geometry } = runStages(SEED, OPTS);
    const scene = sceneFor(off);
    const meshes = meshesOf(scene);
    expect(meshes.length).toBeGreaterThanOrEqual(geometry.primitives.filter((p) => p.type !== 'edges').length);
    expect(meshes.every((m) => !m.userData.primitives)).toBe(true);
    expect(meshes.map((m) => m.name).filter(Boolean)).toContain(geometry.primitives[0].name);
  });

  it('produces far fewer meshes when enabled', () => {
    expect(meshesOf(sceneFor(merge())).length).toBeLessThan(meshesOf(sceneFor(off)).length / 4);
  });

  it('splits by tier: every member primitive belongs to its mesh tier; byTier=false merges tiers', () => {
    const { config } = runStages(SEED, OPTS);
    const { geometry } = runStages(SEED, OPTS);
    const byName = new Map(geometry.primitives.map((p) => [p.name, p]));
    const tiered = meshesOf(sceneFor(merge(true)));
    const tiersSeen = new Set();
    for (const mesh of tiered) {
      tiersSeen.add(mesh.userData.tier);
      for (const entry of mesh.userData.primitives) {
        const prim = byName.get(entry.name.replace(/_box$/, ''));
        expect(tierOf(prim, config)).toBe(mesh.userData.tier);
      }
    }
    expect(tiersSeen.size).toBeGreaterThan(1);
    const flat = meshesOf(sceneFor(merge(false)));
    expect(flat.length).toBeLessThan(tiered.length);
    expect(new Set(flat.map((m) => m.userData.tier))).toEqual(new Set([0]));
  });

  it('records every primitive with a contiguous index range and its textureKey', () => {
    const { geometry } = runStages(SEED, OPTS);
    const meshes = meshesOf(sceneFor(merge(), false));
    const names = new Set();
    for (const mesh of meshes) {
      let next = 0;
      for (const p of mesh.userData.primitives) {
        expect(p.indexStart).toBe(next);
        next += p.indexCount;
        names.add(p.name);
      }
      expect(next).toBe(mesh.geometry.getIndex().count);
    }
    for (const prim of geometry.primitives) {
      if (prim.type !== 'edges') expect(names.has(prim.name) || names.has(`${prim.name}_box`)).toBe(true);
    }
    const sample = meshes[0].userData.primitives[0];
    expect(typeof sample.textureKey).toBe('string');
  });

  it('is deterministic and exports the lookup as glTF extras', async () => {
    const a = await buildGlbBuffer(sceneFor(merge(), false));
    const b = await buildGlbBuffer(sceneFor(merge(), false));
    expect(md5(a)).toBe(md5(b));
    const json = JSON.parse(a.slice(20, 20 + a.readUInt32LE(12)).toString('utf8'));
    expect(json.meshes.every((m) => m.extras && Array.isArray(m.extras.primitives))).toBe(true);
    expect(json.meshes.length).toBe(json.nodes.length);
    const unmerged = await buildGlbBuffer(sceneFor(off, false));
    expect(md5(unmerged)).not.toBe(md5(a));
    expect(unmerged.length).toBeGreaterThan(a.length);
  });

  it('embeds each texture once per material, not per mesh', async () => {
    const glb = await buildGlbBuffer(sceneFor(merge(), false));
    const json = JSON.parse(glb.slice(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
    expect(json.images.length).toBeLessThanOrEqual(json.materials.length);
  });
});
