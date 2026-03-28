import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { exportToGlb, getOutputPath } from '../../src/export/glb-exporter.js';
import { writeFile } from 'fs/promises';
import { mkdtemp, rm } from 'fs/promises';
import { readFile } from 'fs/promises';
import path from 'path';
import os from 'os';

function makeTestScene() {
  const scene = new THREE.Scene();
  const geo = new THREE.BoxGeometry(2, 1, 3);
  const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'test_box';
  scene.add(mesh);
  return scene;
}

describe('exportToGlb', () => {
  let tmpDir;

  it('exports a valid GLB file with correct magic bytes', async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'glb-test-'));
    const outputPath = path.join(tmpDir, 'test.glb');
    const scene = makeTestScene();
    await exportToGlb(scene, outputPath);

    const buf = await readFile(outputPath);
    // GLB magic: "glTF" = 0x46546C67
    expect(buf.readUInt32LE(0)).toBe(0x46546C67);
    // Version 2
    expect(buf.readUInt32LE(4)).toBe(2);
    // Total length matches buffer size
    expect(buf.readUInt32LE(8)).toBe(buf.length);

    await rm(tmpDir, { recursive: true });
  });

  it('includes JSON and BIN chunks', async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'glb-test-'));
    const outputPath = path.join(tmpDir, 'test.glb');
    const scene = makeTestScene();
    await exportToGlb(scene, outputPath);

    const buf = await readFile(outputPath);
    // JSON chunk type at offset 16
    expect(buf.readUInt32LE(16)).toBe(0x4E4F534A); // "JSON"
    // Find BIN chunk after JSON
    const jsonLength = buf.readUInt32LE(12);
    const binChunkOffset = 12 + 8 + jsonLength;
    expect(buf.readUInt32LE(binChunkOffset + 4)).toBe(0x004E4942); // "BIN\0"

    await rm(tmpDir, { recursive: true });
  });

  it('includes mesh data in glTF JSON', async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'glb-test-'));
    const outputPath = path.join(tmpDir, 'test.glb');
    const scene = makeTestScene();
    await exportToGlb(scene, outputPath);

    const buf = await readFile(outputPath);
    const jsonLength = buf.readUInt32LE(12);
    const jsonStr = buf.toString('utf-8', 20, 20 + jsonLength).trim();
    const gltf = JSON.parse(jsonStr);

    expect(gltf.asset.version).toBe('2.0');
    expect(gltf.meshes.length).toBe(1);
    expect(gltf.nodes.length).toBe(1);
    expect(gltf.accessors.length).toBeGreaterThanOrEqual(2); // position + index at minimum

    await rm(tmpDir, { recursive: true });
  });

  it('handles texture with sampler wrapping', async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'glb-test-'));
    const outputPath = path.join(tmpDir, 'test_tex.glb');
    const scene = new THREE.Scene();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    // Simulate a PNG buffer
    mat._pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x00, 0x00, 0x00, 0x00]);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'textured_box';
    scene.add(mesh);

    await exportToGlb(scene, outputPath);

    const buf = await readFile(outputPath);
    const jsonLength = buf.readUInt32LE(12);
    const jsonStr = buf.toString('utf-8', 20, 20 + jsonLength).trim();
    const gltf = JSON.parse(jsonStr);

    expect(gltf.samplers).toBeDefined();
    expect(gltf.samplers[0].wrapS).toBe(10497); // REPEAT
    expect(gltf.samplers[0].wrapT).toBe(10497);
    expect(gltf.textures.length).toBeGreaterThanOrEqual(1);
    expect(gltf.images.length).toBeGreaterThanOrEqual(1);

    await rm(tmpDir, { recursive: true });
  });

  it('throws when scene has no meshes', async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'glb-test-'));
    const outputPath = path.join(tmpDir, 'empty.glb');
    const scene = new THREE.Scene();
    await expect(exportToGlb(scene, outputPath)).rejects.toThrow('Scene has no meshes');
    await rm(tmpDir, { recursive: true });
  });

  it('deduplicates materials used by multiple meshes', async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'glb-test-'));
    const outputPath = path.join(tmpDir, 'dedup_mat.glb');
    const scene = new THREE.Scene();
    const sharedMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const mesh1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), sharedMat);
    mesh1.name = 'box1';
    const mesh2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), sharedMat);
    mesh2.name = 'box2';
    scene.add(mesh1);
    scene.add(mesh2);

    await exportToGlb(scene, outputPath);

    const buf = await readFile(outputPath);
    const jsonLength = buf.readUInt32LE(12);
    const jsonStr = buf.toString('utf-8', 20, 20 + jsonLength).trim();
    const gltf = JSON.parse(jsonStr);
    // Both meshes share one material
    expect(gltf.materials.length).toBe(1);
    expect(gltf.meshes.length).toBe(2);

    await rm(tmpDir, { recursive: true });
  });

  it('deduplicates images when same pngBuffer is reused', async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'glb-test-'));
    const outputPath = path.join(tmpDir, 'dedup_img.glb');
    const scene = new THREE.Scene();
    const pngBuf = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x00, 0x00, 0x00, 0x00]);

    const mat1 = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
    mat1._pngBuffer = pngBuf;
    const mesh1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat1);
    mesh1.name = 'tex1';

    const mat2 = new THREE.MeshStandardMaterial({ color: 0xbbbbbb });
    mat2._pngBuffer = pngBuf; // same buffer reference
    const mesh2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat2);
    mesh2.name = 'tex2';

    scene.add(mesh1);
    scene.add(mesh2);

    await exportToGlb(scene, outputPath);

    const buf = await readFile(outputPath);
    const jsonLength = buf.readUInt32LE(12);
    const jsonStr = buf.toString('utf-8', 20, 20 + jsonLength).trim();
    const gltf = JSON.parse(jsonStr);
    // Two different materials but only one image (deduplicated)
    expect(gltf.materials.length).toBe(2);
    expect(gltf.images.length).toBe(1);
    // But two textures (one per material)
    expect(gltf.textures.length).toBe(2);

    await rm(tmpDir, { recursive: true });
  });

  it('handles transparent materials with alphaMode BLEND', async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), 'glb-test-'));
    const outputPath = path.join(tmpDir, 'transparent.glb');
    const scene = new THREE.Scene();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.5,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    mesh.name = 'transparent_box';
    scene.add(mesh);

    await exportToGlb(scene, outputPath);

    const buf = await readFile(outputPath);
    const jsonLength = buf.readUInt32LE(12);
    const jsonStr = buf.toString('utf-8', 20, 20 + jsonLength).trim();
    const gltf = JSON.parse(jsonStr);

    expect(gltf.materials[0].alphaMode).toBe('BLEND');
    expect(gltf.materials[0].pbrMetallicRoughness.baseColorFactor[3]).toBe(0.5);

    await rm(tmpDir, { recursive: true });
  });
});

describe('getOutputPath', () => {
  it('returns correct path with seed', () => {
    const config = { outputDir: 'output', seed: 42 };
    const result = getOutputPath(config);
    expect(result).toContain('mordheim_map_42.glb');
    expect(result).toContain('output');
  });
});
