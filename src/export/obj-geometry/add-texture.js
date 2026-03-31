/**
 * Register a texture in the atlas state, returning its index.
 */
export function addTexture(atlasState, name, png) {
  if (!atlasState.texMap.has(name)) {
    atlasState.texMap.set(name, atlasState.allTextures.length);
    atlasState.allTextures.push(png);
  }
  return atlasState.texMap.get(name);
}
