/**
 * Seed-based RNG using mulberry32 algorithm.
 * All randomness in the generator MUST use this — never Math.random().
 */

export function createRng(seed) {
  let state = seed | 0;

  function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    /** Returns float in [0, 1) */
    random() {
      return next();
    },

    /** Returns integer in [min, max] inclusive */
    int(min, max) {
      return Math.floor(next() * (max - min + 1)) + min;
    },

    /** Returns float in [min, max) */
    float(min, max) {
      return next() * (max - min) + min;
    },

    /** Returns true with given probability (0-1) */
    chance(probability) {
      return next() < probability;
    },

    /** Pick a random element from an array */
    pick(array) {
      return array[Math.floor(next() * array.length)];
    },

    /** Shuffle array in place (Fisher-Yates) */
    shuffle(array) {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    },
  };
}
