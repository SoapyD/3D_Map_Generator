import { BUILDINGS, WALL, FLOOR, CONNECTIVITY, STREETS, GRID, LADDERS, COVER } from '../config.js';
import { getProfile } from './get-profile.js';

// Generation sections a profile may override. GEOMETRY / LADDER_DISPLAY are deliberately absent:
// they are export-time and must not change when a profile is swapped in.
const SECTIONS = { BUILDINGS, WALL, FLOOR, CONNECTIVITY, STREETS, GRID, LADDERS, COVER };

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function mergeInto(target, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(target[key])) mergeInto(target[key], value);
    else target[key] = structuredClone(value);
  }
}

/**
 * Apply config.profile's section overrides in place and return a function that restores them.
 * No-op (returns a no-op restore) when config has no profile.
 */
export function applyProfile(config) {
  const profile = getProfile(config.profile);
  if (!profile) return () => {};

  const saved = {};
  for (const [name, patch] of Object.entries(profile.sections ?? {})) {
    const section = SECTIONS[name];
    if (!section) throw new Error(`Profile "${profile.name}" overrides unknown section "${name}"`);
    saved[name] = structuredClone(section);
    mergeInto(section, patch);
  }

  return () => {
    for (const [name, original] of Object.entries(saved)) {
      const section = SECTIONS[name];
      for (const key of Object.keys(section)) delete section[key];
      Object.assign(section, original);
    }
  };
}
