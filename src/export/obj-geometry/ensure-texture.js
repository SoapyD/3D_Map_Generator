import { addTexture } from './add-texture.js';

/**
 * Ensure a texture key is registered in the atlas, resolving it from
 * the provided texture pools. Returns the atlas tile index.
 */
export function ensureTexture(atlasState, textureKey, texturePools) {
  if (atlasState.textureKeyToIdx.has(textureKey)) return atlasState.textureKeyToIdx.get(textureKey);

  const parts = textureKey.split(':');
  let idx;

  const {
    baseIdx, wallTextures, landmarkTextures, floorTextures,
    walkwayTextures, objectTextures, courtyardTextures, ladderTextures, roofTextures,
    riverTextures, riverBankTextures, streetTextures, pavementTextures,
  } = texturePools;

  if (parts[0] === 'floor') {
    if (parts[1] === 'base') {
      idx = baseIdx;
    } else {
      const ti = parseInt(parts[2], 10);
      const fTex = floorTextures[Math.abs(ti) % floorTextures.length];
      idx = addTexture(atlasState, `floor_${Math.abs(ti) % floorTextures.length}`, fTex);
    }
  } else if (parts[0] === 'wall') {
    const ti = parseInt(parts[2], 10);
    if (parts[1] === 'landmark') {
      const pool = landmarkTextures.length > 0 ? landmarkTextures : wallTextures;
      const tex = pool[Math.abs(ti) % pool.length];
      idx = addTexture(atlasState, `landmark_${Math.abs(ti) % pool.length}`, tex);
    } else {
      const tex = wallTextures[Math.abs(ti) % wallTextures.length];
      idx = addTexture(atlasState, `wall_${Math.abs(ti) % wallTextures.length}`, tex);
    }
  } else if (parts[0] === 'walkway') {
    const ti = parseInt(parts[1], 10);
    const tex = walkwayTextures[Math.abs(ti) % walkwayTextures.length];
    idx = addTexture(atlasState, `walkway_${Math.abs(ti) % walkwayTextures.length}`, tex);
  } else if (parts[0] === 'roof') {
    const ti = parseInt(parts[1], 10);
    const tex = roofTextures[Math.abs(ti) % roofTextures.length];
    idx = addTexture(atlasState, `roof_${Math.abs(ti) % roofTextures.length}`, tex);
  } else if (parts[0] === 'object') {
    const ti = parseInt(parts[1], 10);
    const tex = objectTextures.length > 0 ? objectTextures[Math.abs(ti) % objectTextures.length] : wallTextures[0];
    idx = addTexture(atlasState, `object_${Math.abs(ti) % (objectTextures.length || 1)}`, tex);
  } else if (parts[0] === 'courtyard') {
    idx = addTexture(atlasState, 'courtyard_0', courtyardTextures[0]);
  } else if (parts[0] === 'ladder') {
    const ti = parseInt(parts[1], 10);
    const tex = ladderTextures[Math.abs(ti) % ladderTextures.length];
    idx = addTexture(atlasState, `ladder_${Math.abs(ti) % ladderTextures.length}`, tex);
  } else if (parts[0] === 'river') {
    const ti = parseInt(parts[1] ?? 0, 10);
    const tex = riverTextures[Math.abs(ti) % riverTextures.length];
    idx = addTexture(atlasState, `river_${Math.abs(ti) % riverTextures.length}`, tex);
  } else if (parts[0] === 'river_bank') {
    const ti = parseInt(parts[1] ?? 0, 10);
    const tex = riverBankTextures[Math.abs(ti) % riverBankTextures.length];
    idx = addTexture(atlasState, `river_bank_${Math.abs(ti) % riverBankTextures.length}`, tex);
  } else if (parts[0] === 'street') {
    const ti = parseInt(parts[1] ?? 0, 10);
    const tex = streetTextures[Math.abs(ti) % streetTextures.length];
    idx = addTexture(atlasState, `street_${Math.abs(ti) % streetTextures.length}`, tex);
  } else if (parts[0] === 'pavement') {
    const ti = parseInt(parts[1] ?? 0, 10);
    const tex = pavementTextures[Math.abs(ti) % pavementTextures.length];
    idx = addTexture(atlasState, `pavement_${Math.abs(ti) % pavementTextures.length}`, tex);
  } else {
    idx = baseIdx;
  }

  atlasState.textureKeyToIdx.set(textureKey, idx);
  return idx;
}
