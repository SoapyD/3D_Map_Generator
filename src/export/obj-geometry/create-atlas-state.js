/**
 * Create a new atlas state object that tracks textures, the atlas grid,
 * and the texture-key-to-index mapping.
 */
export function createAtlasState() {
  return {
    allTextures: [],
    texMap: new Map(),
    textureKeyToIdx: new Map(),
    baseIdx: -1,
  };
}
