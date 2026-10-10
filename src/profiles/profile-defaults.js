import { getProfile } from './get-profile.js';

/** DEFAULTS overrides for a profile name ({} when there is no profile). */
export function profileDefaults(name) {
  return getProfile(name)?.defaults ?? {};
}
