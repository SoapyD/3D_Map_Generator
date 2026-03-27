/**
 * OBJ Exporter with texture atlas.
 *
 * Generates a single OBJ + single PNG texture atlas.
 * Each material gets a tile in the atlas, UVs are remapped to point into it.
 * TTS-compatible: just OBJ + one image URL, no MTL needed.
 */

import * as THREE from 'three';
import { writeFile, mkdir } from 'fs/promises';
import { PNG } from 'pngjs';
import path from 'path';

/**
 * Export scene to OBJ + texture atlas PNG.
 */
export async function exportToObj(scene, outputDir, baseName) {
  const meshes = [];
  scene.traverse((child) => {
    if (child.isMesh) meshes.push(child);
  });

  if (meshes.length === 0) throw new Error('Scene has no meshes to export');

  // Collect unique materials and assign atlas tiles
  const materialList = []; // ordered list of unique materials
  const materialIndexMap = new Map(); // uuid -> index in materialList

  for (const mesh of meshes) {
    const matKey = mesh.material.uuid;
    if (!materialIndexMap.has(matKey)) {
      materialIndexMap.set(matKey, materialList.length);
      materialList.push(mesh.material);
    }
  }

  // Build texture atlas — square grid of tiles
  const tileCount = materialList.length;
  const gridSize = Math.ceil(Math.sqrt(tileCount));
  const TILE_SIZE = 32; // pixels per tile
  const atlasSize = gridSize * TILE_SIZE;

  const atlas = new PNG({ width: atlasSize, height: atlasSize });

  // Fill background with opaque black (unused tiles shouldn't be transparent)
  for (let i = 0; i < atlasSize * atlasSize; i++) {
    atlas.data[i * 4 + 3] = 255;
  }

  // Fill atlas with each material's colour/texture
  for (let mi = 0; mi < materialList.length; mi++) {
    const mat = materialList[mi];
    const tileCol = mi % gridSize;
    const tileRow = Math.floor(mi / gridSize);
    const ox = tileCol * TILE_SIZE;
    const oy = tileRow * TILE_SIZE;

    let tilePng = null;
    if (mat._pngBuffer) {
      try {
        tilePng = PNG.sync.read(mat._pngBuffer);
      } catch (e) { /* fall through to colour */ }
    }

    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        const aidx = ((oy + y) * atlasSize + (ox + x)) * 4;

        if (tilePng) {
          // Sample from the source texture (tile/repeat within TILE_SIZE)
          const sx = x % tilePng.width;
          const sy = y % tilePng.height;
          const sidx = (sy * tilePng.width + sx) * 4;
          atlas.data[aidx] = tilePng.data[sidx];
          atlas.data[aidx + 1] = tilePng.data[sidx + 1];
          atlas.data[aidx + 2] = tilePng.data[sidx + 2];
          atlas.data[aidx + 3] = tilePng.data[sidx + 3];
        } else {
          // Solid colour from material
          const c = mat.color || new THREE.Color(0x888888);
          atlas.data[aidx] = Math.round(c.r * 255);
          atlas.data[aidx + 1] = Math.round(c.g * 255);
          atlas.data[aidx + 2] = Math.round(c.b * 255);
          atlas.data[aidx + 3] = 255;
        }
      }
    }
  }

  // Write atlas PNG
  await mkdir(outputDir, { recursive: true });
  const atlasPath = path.join(outputDir, `${baseName}.png`);
  await writeFile(atlasPath, PNG.sync.write(atlas));

  // Build OBJ with remapped UVs
  const objLines = [];
  let vertexOffset = 1;
  let uvOffset = 1;
  let normalOffset = 1;

  // Small inset to avoid bleeding between tiles
  const margin = 0.5 / atlasSize;

  objLines.push(`# Mordheim Map Generator`);
  objLines.push(`mtllib ${baseName}.mtl`);
  objLines.push('');

  for (const mesh of meshes) {
    mesh.updateMatrixWorld(true);
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);

    const position = geo.getAttribute('position');
    const normal = geo.getAttribute('normal');
    const uv = geo.getAttribute('uv');
    const index = geo.getIndex();

    const mi = materialIndexMap.get(mesh.material.uuid);
    const tileCol = mi % gridSize;
    const tileRow = Math.floor(mi / gridSize);

    // UV range for this material's tile in the atlas
    const uMin = tileCol / gridSize + margin;
    const uMax = (tileCol + 1) / gridSize - margin;
    const vMin = 1 - (tileRow + 1) / gridSize + margin; // OBJ V is flipped
    const vMax = 1 - tileRow / gridSize - margin;

    const isTransparent = mesh.material.transparent && mesh.material.opacity < 1;
    objLines.push(`o ${mesh.name || 'mesh'}`);
    objLines.push(`usemtl ${isTransparent ? 'atlas_transparent' : 'atlas_opaque'}`);

    // Vertices
    for (let i = 0; i < position.count; i++) {
      objLines.push(`v ${position.getX(i).toFixed(6)} ${position.getY(i).toFixed(6)} ${position.getZ(i).toFixed(6)}`);
    }

    // Remap UVs into the atlas tile
    if (uv) {
      for (let i = 0; i < uv.count; i++) {
        // Original UV 0-1 maps to the tile region, with tiling via fract
        const ou = uv.getX(i);
        const ov = uv.getY(i);
        // Fract to handle tiling, then map into atlas tile
        const fu = ou - Math.floor(ou);
        const fv = ov - Math.floor(ov);
        const mu = uMin + fu * (uMax - uMin);
        const mv = vMin + fv * (vMax - vMin);
        objLines.push(`vt ${mu.toFixed(6)} ${mv.toFixed(6)}`);
      }
    } else {
      // No UVs — generate simple ones pointing to centre of tile
      const cu = (uMin + uMax) / 2;
      const cv = (vMin + vMax) / 2;
      for (let i = 0; i < position.count; i++) {
        objLines.push(`vt ${cu.toFixed(6)} ${cv.toFixed(6)}`);
      }
    }

    // Normals
    if (normal) {
      for (let i = 0; i < normal.count; i++) {
        objLines.push(`vn ${normal.getX(i).toFixed(6)} ${normal.getY(i).toFixed(6)} ${normal.getZ(i).toFixed(6)}`);
      }
    }

    // Faces
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const a = index.array[i] + vertexOffset;
        const b = index.array[i + 1] + vertexOffset;
        const c = index.array[i + 2] + vertexOffset;
        const ua = index.array[i] + uvOffset;
        const ub = index.array[i + 1] + uvOffset;
        const uc = index.array[i + 2] + uvOffset;

        if (normal) {
          const na = index.array[i] + normalOffset;
          const nb = index.array[i + 1] + normalOffset;
          const nc = index.array[i + 2] + normalOffset;
          objLines.push(`f ${a}/${ua}/${na} ${b}/${ub}/${nb} ${c}/${uc}/${nc}`);
        } else {
          objLines.push(`f ${a}/${ua} ${b}/${ub} ${c}/${uc}`);
        }
      }
    }

    vertexOffset += position.count;
    uvOffset += uv ? uv.count : position.count;
    if (normal) normalOffset += normal.count;

    objLines.push('');
    geo.dispose();
  }

  const objPath = path.join(outputDir, `${baseName}.obj`);
  await writeFile(objPath, objLines.join('\n'));

  // Find the lowest opacity among transparent materials
  let transparentOpacity = 0.85;
  for (const mat of materialList) {
    if (mat.transparent && mat.opacity < 1) {
      transparentOpacity = mat.opacity;
      break;
    }
  }

  // Write MTL with opaque and transparent materials
  const mtlLines = [
    `# Mordheim Map Generator`,
    ``,
    `newmtl atlas_opaque`,
    `Ka 1.0000 1.0000 1.0000`,
    `Kd 1.0000 1.0000 1.0000`,
    `d 1.0`,
    `illum 1`,
    `map_Kd ${baseName}.png`,
    ``,
    `newmtl atlas_transparent`,
    `Ka 1.0000 1.0000 1.0000`,
    `Kd 1.0000 1.0000 1.0000`,
    `d 1.0`,
    `illum 2`,
    `map_Kd ${baseName}.png`,
    `map_d ${baseName}.png`,
  ];
  const mtlPath = path.join(outputDir, `${baseName}.mtl`);
  await writeFile(mtlPath, mtlLines.join('\n'));

  return objPath;
}

export function getObjOutputPath(config) {
  const baseName = `mordheim_map_${config.seed}`;
  return { dir: config.outputDir, baseName };
}
