import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { exportCollisionObj } from '../../src/export/collision-exporter.js';
import { mkdtemp, rm, readFile } from 'fs/promises';
import path from 'path';
import os from 'os';

function makeTestScene() {
  const scene = new THREE.Scene();
  const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });

  // Floor (should be included)
  const floorGeo = new THREE.BoxGeometry(10, 0.5, 10);
  const floorMesh = new THREE.Mesh(floorGeo, mat);
  floorMesh.name = 'floor_t0';
  scene.add(floorMesh);

  // Cover (should be included)
  const coverGeo = new THREE.BoxGeometry(1.5, 0.75, 1.5);
  const coverMesh = new THREE.Mesh(coverGeo, mat);
  coverMesh.name = 'cover_rooftop_0';
  scene.add(coverMesh);

  // Wall (should be excluded)
  const wallGeo = new THREE.BoxGeometry(5, 3, 0.25);
  const wallMesh = new THREE.Mesh(wallGeo, mat);
  wallMesh.name = 'wall_0';
  scene.add(wallMesh);

  // Ladder (should be excluded)
  const ladderGeo = new THREE.BoxGeometry(1, 6, 0.5);
  const ladderMesh = new THREE.Mesh(ladderGeo, mat);
  ladderMesh.name = 'ladder_0';
  scene.add(ladderMesh);

  // Walkway (should be included)
  const walkwayGeo = new THREE.BoxGeometry(5, 0.3, 2);
  const walkwayMesh = new THREE.Mesh(walkwayGeo, mat);
  walkwayMesh.name = 'walkway_0';
  scene.add(walkwayMesh);

  // Interior cover (should be included)
  const intCoverGeo = new THREE.BoxGeometry(1.5, 0.75, 2);
  const intCoverMesh = new THREE.Mesh(intCoverGeo, mat);
  intCoverMesh.name = 'interior_cover_0';
  scene.add(intCoverMesh);

  // Ladder platform (should be included)
  const platGeo = new THREE.BoxGeometry(2, 0.2, 2);
  const platMesh = new THREE.Mesh(platGeo, mat);
  platMesh.name = 'ladder_platform_0';
  scene.add(platMesh);

  // Deleted building courtyard (should be included)
  const deletedGeo = new THREE.BoxGeometry(4, 0.3, 4);
  const deletedMesh = new THREE.Mesh(deletedGeo, mat);
  deletedMesh.name = 'deleted_courtyard_0';
  scene.add(deletedMesh);

  return scene;
}

describe('exportCollisionObj', () => {
  let tmpDir;

  it('includes floor, cover, walkway, interior_cover, ladder_platform, deleted prefixes', async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'col-test-'));
    const scene = makeTestScene();
    const result = await exportCollisionObj(scene, tmpDir, 'test');

    const content = await readFile(result, 'utf-8');

    // Should include these prefixes
    expect(content).toContain('o floor_t0');
    expect(content).toContain('o cover_rooftop_0');
    expect(content).toContain('o walkway_0');
    expect(content).toContain('o interior_cover_0');
    expect(content).toContain('o ladder_platform_0');
    expect(content).toContain('o deleted_courtyard_0');

    // Should NOT include walls or ladders
    expect(content).not.toContain('o wall_0');
    expect(content).not.toContain('o ladder_0');

    await rm(tmpDir, { recursive: true });
  });

  it('exports valid OBJ format with vertices and faces', async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'col-test-'));
    const scene = makeTestScene();
    const result = await exportCollisionObj(scene, tmpDir, 'test');

    const content = await readFile(result, 'utf-8');
    const lines = content.split('\n');

    const vertexLines = lines.filter(l => l.startsWith('v '));
    const faceLines = lines.filter(l => l.startsWith('f '));

    expect(vertexLines.length).toBeGreaterThan(0);
    expect(faceLines.length).toBeGreaterThan(0);

    // Verify vertex format
    for (const vl of vertexLines) {
      const parts = vl.split(' ');
      expect(parts.length).toBe(4); // v x y z
      expect(parseFloat(parts[1])).not.toBeNaN();
      expect(parseFloat(parts[2])).not.toBeNaN();
      expect(parseFloat(parts[3])).not.toBeNaN();
    }

    // Verify face format
    for (const fl of faceLines) {
      const parts = fl.split(' ');
      expect(parts.length).toBe(4); // f a b c (triangles)
    }

    await rm(tmpDir, { recursive: true });
  });

  it('includes children of cover_ groups via parent name check', async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'col-test-'));
    const scene = new THREE.Scene();
    const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });

    // Create a Group named cover_pillar with a child mesh (unnamed)
    const group = new THREE.Group();
    group.name = 'cover_pillar_0';
    const childGeo = new THREE.BoxGeometry(1, 2, 1);
    const childMesh = new THREE.Mesh(childGeo, mat);
    childMesh.name = 'pillar_part'; // Not a cover_ prefix itself
    group.add(childMesh);
    scene.add(group);

    const result = await exportCollisionObj(scene, tmpDir, 'test');
    expect(result).not.toBeNull();
    const content = await readFile(result, 'utf-8');
    // The child mesh should be included because its parent starts with cover_
    expect(content).toContain('o pillar_part');

    await rm(tmpDir, { recursive: true });
  });

  it('returns null when no collision meshes found', async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'col-test-'));
    const scene = new THREE.Scene();
    // Add only a wall (excluded prefix)
    const geo = new THREE.BoxGeometry(5, 3, 0.25);
    const mat = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'wall_only';
    scene.add(mesh);

    const result = await exportCollisionObj(scene, tmpDir, 'test');
    expect(result).toBeNull();

    await rm(tmpDir, { recursive: true });
  });
});
