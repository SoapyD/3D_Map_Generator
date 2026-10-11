import { WITHERING_PROFILE } from './withering.js';

const PROFILES = { [WITHERING_PROFILE.name]: WITHERING_PROFILE };

/** Look up a profile by name. Returns null for no profile; throws on an unknown name. */
export function getProfile(name) {
  if (!name) return null;
  const profile = PROFILES[name];
  if (!profile) throw new Error(`Unknown profile "${name}". Available: ${Object.keys(PROFILES).join(', ')}`);
  return profile;
}
