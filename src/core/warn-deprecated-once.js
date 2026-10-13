import { DEPRECATION } from '../config.js';

const warned = new Set();

/**
 * Emit a deprecation warning at most once per process for the given feature key.
 * Never changes behaviour or return values of the caller.
 *
 * @param {string} feature - Key for the deprecated feature (e.g. 'generateObjToBuffers')
 * @returns {boolean} true if a warning was printed, false if it was already printed
 */
export function warnDeprecatedOnce(feature) {
  if (warned.has(feature)) return false;
  warned.add(feature);
  console.warn(`[deprecated] ${feature}: ${DEPRECATION.message} See ${DEPRECATION.planDoc}.`);
  return true;
}
