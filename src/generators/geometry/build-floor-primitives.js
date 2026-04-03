import { findBuilding } from '../building-lookup/index.js';
import { floorTextureKey } from '../floor-texture-key.js';
import { getEdgeGaps } from '../geometry-helpers/index.js';

export function buildFloorPrimitives(floorData, buildings, config) {
  const primitives = [];

  // Base floor (tier 0)
  if (floorData.length > 0 && floorData[0].sections.length > 0) {
    const base = floorData[0].sections[0];
    primitives.push({
      type: 'slab', name: 'base_floor',
      x: base.x, y: 0, z: base.z, w: base.w, h: config.slabThickness, d: base.d,
      textureKey: 'floor:base:0',
      emitTop: true, emitBottom: true, simpleBottom: true, rotateUV: false,
      shared: true,
    });
    const edgeGaps = {};
    for (const side of ['north', 'south', 'west', 'east']) {
      edgeGaps[side] = getEdgeGaps(base, side, [base]);
    }
    primitives.push({
      type: 'edges', name: 'base_floor',
      x: base.x, y: 0, z: base.z, w: base.w, h: config.slabThickness, d: base.d,
      textureKey: 'floor:base:0', edgeGaps,
    });
  }

  // Building floors (tier 1+)
  for (let t = 1; t < floorData.length; t++) {
    const tier = floorData[t];
    const y = tier.tier * config.tierHeight;
    for (const section of tier.sections) {
      const bi = findBuilding(section.x, section.z, section.w, section.d, buildings);
      const texKey = bi >= 0 ? floorTextureKey(bi, buildings) : 'floor:base:0';
      const name = `floor_t${tier.tier}_${Math.round(section.x)}_${Math.round(section.z)}`;

      primitives.push({
        type: 'slab', name,
        x: section.x, y, z: section.z, w: section.w, h: config.slabThickness, d: section.d,
        textureKey: texKey,
        emitTop: true, emitBottom: true, simpleBottom: false, rotateUV: false,
        shared: true,
      });

      const edgeGaps = {};
      for (const side of ['north', 'south', 'west', 'east']) {
        edgeGaps[side] = getEdgeGaps(section, side, tier.sections);
      }
      primitives.push({
        type: 'edges', name,
        x: section.x, y, z: section.z, w: section.w, h: config.slabThickness, d: section.d,
        textureKey: texKey, edgeGaps,
      });
    }
  }

  return primitives;
}
