import { GEOMETRY } from '../../config.js';

export function buildRiverBankPrimitives(rivers) {
  const primitives = [];
  const thickness = GEOMETRY.riverBankThickness;
  let idx = 0;

  for (const river of rivers) {
    for (const bank of (river.banks ?? [])) {
      const h = bank.topY - bank.bottomY;
      if (h <= 0) continue;

      let x, z, w, d;
      if (bank.axis === 'WE') {
        // Runs along X. River is south of N-facing banks, north of S-facing — place slab on the river side.
        x = bank.x;
        z = bank.facing === 'N' ? bank.z : bank.z - thickness;
        w = bank.length;
        d = thickness;
      } else {
        // axis === 'NS', runs along Z. River is west of E-facing banks, east of W-facing.
        x = bank.facing === 'E' ? bank.x - thickness : bank.x;
        z = bank.z;
        w = thickness;
        d = bank.length;
      }

      primitives.push({
        type: 'slab', name: `river_bank_${idx}`,
        x, y: bank.bottomY, z, w, h, d,
        textureKey: 'river_bank:0',
        emitTop: true, emitBottom: false, simpleBottom: false,
        rotateUV: w > d,
        shared: true,
      });
      primitives.push({
        type: 'edges', name: `river_bank_${idx}`,
        x, y: bank.bottomY, z, w, h, d,
        textureKey: 'river_bank:0',
      });
      idx++;
    }
  }
  return primitives;
}
