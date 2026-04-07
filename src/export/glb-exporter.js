/**
 * GLB Exporter — builds a GLB (glTF binary) file from Three.js scene.
 *
 * Hand-builds the GLB rather than using Three.js GLTFExporter,
 * because the GLTFExporter relies on browser APIs (FileReader, Blob)
 * that don't work reliably in Node.js.
 */

import * as THREE from 'three';
import { writeFile } from 'fs/promises';
import path from 'path';

/**
 * Export a Three.js scene to a GLB file.
 */
export async function exportToGlb(scene, outputPath) {
  const glb = await buildGlbBuffer(scene);
  await writeFile(outputPath, glb);
  return outputPath;
}

/**
 * Build a GLB Buffer from a Three.js scene without writing to disk.
 */
export async function buildGlbBuffer(scene) {
  const meshes = [];
  scene.traverse((child) => {
    if (child.isMesh) meshes.push(child);
  });

  if (meshes.length === 0) throw new Error('Scene has no meshes to export');

  const nodes = [];
  const meshDefs = [];
  const accessors = [];
  const bufferViews = [];
  const materials = [];
  const materialMap = new Map();
  const textures = [];
  const images = [];
  const imageMap = new Map();
  const samplers = [];
  let hasSampler = false;
  const bufferParts = [];
  let byteOffset = 0;

  for (const mesh of meshes) {
    mesh.updateMatrixWorld(true);
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);

    const position = geo.getAttribute('position');
    const normal = geo.getAttribute('normal');
    const uv = geo.getAttribute('uv');
    const index = geo.getIndex();

    let matIdx;
    const matKey = mesh.material.uuid;
    if (materialMap.has(matKey)) {
      matIdx = materialMap.get(matKey);
    } else {
      matIdx = materials.length;
      materialMap.set(matKey, matIdx);
      const c = mesh.material.color || new THREE.Color(0x888888);
      const matDef = {
        pbrMetallicRoughness: {
          baseColorFactor: [c.r, c.g, c.b, 1.0],
          metallicFactor: mesh.material.metalness || 0,
          roughnessFactor: mesh.material.roughness || 0.8,
        },
      };

      if (mesh.material._pngBuffer) {
        const pngBuf = mesh.material._pngBuffer;
        let imgIdx;
        if (imageMap.has(pngBuf)) {
          imgIdx = imageMap.get(pngBuf);
        } else {
          const padding = (4 - (pngBuf.length % 4)) % 4;
          const paddedPng = padding > 0 ? Buffer.concat([pngBuf, Buffer.alloc(padding)]) : pngBuf;
          const viewIdx = bufferViews.length;
          bufferViews.push({ buffer: 0, byteOffset, byteLength: pngBuf.length });
          bufferParts.push(paddedPng);
          byteOffset += paddedPng.length;
          imgIdx = images.length;
          images.push({ bufferView: viewIdx, mimeType: 'image/png' });
          imageMap.set(pngBuf, imgIdx);
        }
        if (!hasSampler) {
          samplers.push({ magFilter: 9728, minFilter: 9728, wrapS: 10497, wrapT: 10497 });
          hasSampler = true;
        }
        const texIdx = textures.length;
        textures.push({ source: imgIdx, sampler: 0 });
        matDef.pbrMetallicRoughness.baseColorTexture = { index: texIdx };
        matDef.pbrMetallicRoughness.baseColorFactor = [1, 1, 1, 1];
      }

      if (mesh.material.transparent && mesh.material.opacity < 1) {
        matDef.alphaMode = 'BLEND';
        matDef.pbrMetallicRoughness.baseColorFactor[3] = mesh.material.opacity;
      }

      materials.push(matDef);
    }

    const posData = new Float32Array(position.array);
    const posBuf = Buffer.from(posData.buffer);
    const posViewIdx = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset, byteLength: posBuf.length, target: 34962 });
    bufferParts.push(posBuf);

    let minPos = [Infinity, Infinity, Infinity];
    let maxPos = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
      minPos[0] = Math.min(minPos[0], x); minPos[1] = Math.min(minPos[1], y); minPos[2] = Math.min(minPos[2], z);
      maxPos[0] = Math.max(maxPos[0], x); maxPos[1] = Math.max(maxPos[1], y); maxPos[2] = Math.max(maxPos[2], z);
    }

    const posAccIdx = accessors.length;
    accessors.push({
      bufferView: posViewIdx,
      componentType: 5126,
      count: position.count,
      type: 'VEC3',
      min: minPos,
      max: maxPos,
    });
    byteOffset += posBuf.length;

    let normAccIdx;
    if (normal) {
      const normData = new Float32Array(normal.array);
      const normBuf = Buffer.from(normData.buffer);
      const normViewIdx = bufferViews.length;
      bufferViews.push({ buffer: 0, byteOffset, byteLength: normBuf.length, target: 34962 });
      bufferParts.push(normBuf);
      normAccIdx = accessors.length;
      accessors.push({ bufferView: normViewIdx, componentType: 5126, count: normal.count, type: 'VEC3' });
      byteOffset += normBuf.length;
    }

    let uvAccIdx;
    if (uv) {
      const uvData = new Float32Array(uv.array);
      const uvBuf = Buffer.from(uvData.buffer);
      const uvViewIdx = bufferViews.length;
      bufferViews.push({ buffer: 0, byteOffset, byteLength: uvBuf.length, target: 34962 });
      bufferParts.push(uvBuf);
      uvAccIdx = accessors.length;
      accessors.push({ bufferView: uvViewIdx, componentType: 5126, count: uv.count, type: 'VEC2' });
      byteOffset += uvBuf.length;
    }

    let idxAccIdx;
    if (index) {
      const useUint32 = position.count > 65535;
      const idxData = useUint32 ? new Uint32Array(index.array) : new Uint16Array(index.array);
      const idxBuf = Buffer.from(idxData.buffer);
      const padding = (4 - (idxBuf.length % 4)) % 4;
      const paddedBuf = padding > 0 ? Buffer.concat([idxBuf, Buffer.alloc(padding)]) : idxBuf;
      const idxViewIdx = bufferViews.length;
      bufferViews.push({ buffer: 0, byteOffset, byteLength: idxBuf.length, target: 34963 });
      bufferParts.push(paddedBuf);
      idxAccIdx = accessors.length;
      accessors.push({
        bufferView: idxViewIdx,
        componentType: useUint32 ? 5125 : 5123,
        count: index.count,
        type: 'SCALAR',
      });
      byteOffset += paddedBuf.length;
    }

    const primitive = { attributes: { POSITION: posAccIdx }, material: matIdx };
    if (normAccIdx !== undefined) primitive.attributes.NORMAL = normAccIdx;
    if (uvAccIdx !== undefined) primitive.attributes.TEXCOORD_0 = uvAccIdx;
    if (idxAccIdx !== undefined) primitive.indices = idxAccIdx;

    const meshIdx = meshDefs.length;
    meshDefs.push({ primitives: [primitive], name: mesh.name || undefined });
    nodes.push({ mesh: meshIdx, name: mesh.name || undefined });

    geo.dispose();
  }

  const gltf = {
    asset: { version: '2.0', generator: 'mordheim-map-generator' },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes: meshDefs,
    accessors,
    bufferViews,
    materials,
    buffers: [{ byteLength: byteOffset }],
  };

  if (textures.length > 0) gltf.textures = textures;
  if (images.length > 0) gltf.images = images;
  if (samplers.length > 0) gltf.samplers = samplers;

  const jsonStr = JSON.stringify(gltf);
  const jsonBuf = Buffer.from(jsonStr, 'utf-8');
  const jsonPadding = (4 - (jsonBuf.length % 4)) % 4;
  const paddedJsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jsonPadding, 0x20)]);

  const binBuf = Buffer.concat(bufferParts);
  const binPadding = (4 - (binBuf.length % 4)) % 4;
  const paddedBinBuf = binPadding > 0 ? Buffer.concat([binBuf, Buffer.alloc(binPadding)]) : binBuf;

  const totalLength = 12 + 8 + paddedJsonBuf.length + 8 + paddedBinBuf.length;
  const glb = Buffer.alloc(totalLength);
  let offset = 0;

  glb.writeUInt32LE(0x46546C67, offset); offset += 4;
  glb.writeUInt32LE(2, offset); offset += 4;
  glb.writeUInt32LE(totalLength, offset); offset += 4;

  glb.writeUInt32LE(paddedJsonBuf.length, offset); offset += 4;
  glb.writeUInt32LE(0x4E4F534A, offset); offset += 4;
  paddedJsonBuf.copy(glb, offset); offset += paddedJsonBuf.length;

  glb.writeUInt32LE(paddedBinBuf.length, offset); offset += 4;
  glb.writeUInt32LE(0x004E4942, offset); offset += 4;
  paddedBinBuf.copy(glb, offset);

  return glb;
}

/**
 * Build output file path from config.
 */
export function getOutputPath(config) {
  return path.join(config.outputDir, `mordheim_map_${config.seed}.glb`);
}
