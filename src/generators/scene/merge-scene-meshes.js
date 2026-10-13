import * as THREE from 'three';
import { tierOf } from '../../export/assign-primitive-tier.js';
import { meshWorldGeometry } from './mesh-world-geometry.js';
import { mergeGroupGeometry } from './merge-group-geometry.js';

/**
 * Merge per-primitive meshes into one mesh per (material[, tier]) group.
 * Groups and members keep first-encounter order, so output is deterministic.
 * Each merged mesh records its members in userData.primitives
 * ({ name, textureKey, indexStart, indexCount }) for the preview's fallback highlight.
 *
 * @param {{ prim: object, mesh: THREE.Mesh }[]} entries - in primitive order
 * @param {object} config - needs tiers / tierHeight when mergeCfg.byTier
 * @param {{ byTier: boolean }} mergeCfg
 * @returns {THREE.Mesh[]}
 */
export function mergeSceneMeshes(entries, config, mergeCfg) {
  const groups = new Map();
  const materialIds = new Map();
  for (const { prim, mesh } of entries) {
    const tier = mergeCfg.byTier ? tierOf(prim, config) : 0;
    if (!materialIds.has(mesh.material.uuid)) materialIds.set(mesh.material.uuid, materialIds.size);
    const key = `${tier}|${mesh.material.uuid}`;
    if (!groups.has(key)) groups.set(key, { tier, material: mesh.material, members: [] });
    groups.get(key).members.push({ prim, mesh });
  }

  const merged = [];
  for (const group of groups.values()) {
    const worldGeos = group.members.map(({ mesh }) => meshWorldGeometry(mesh));
    const { geometry, ranges } = mergeGroupGeometry(worldGeos);
    worldGeos.forEach((g) => g.dispose());

    const mesh = new THREE.Mesh(geometry, group.material);
    mesh.name = `merged_t${group.tier}_m${materialIds.get(group.material.uuid)}`;
    mesh.userData = {
      tier: group.tier,
      primitives: group.members.map(({ prim, mesh: src }, i) => ({
        name: src.name || prim.name,
        textureKey: prim.textureKey ?? null,
        ...ranges[i],
      })),
    };
    merged.push(mesh);
  }
  return merged;
}
