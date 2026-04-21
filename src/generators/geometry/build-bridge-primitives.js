import { CONNECTIVITY } from '../../config.js';

export function buildBridgePrimitives(bridges) {
  const primitives = [];
  const {
    bridgeThickness,
    bridgeWallHeight:    wallH,
    bridgeWallThickness: wallT,
    bridgeBattlementPeriod:  period,
    bridgeBattlementTallH:   tallH,
  } = CONNECTIVITY;

  for (let i = 0; i < bridges.length; i++) {
    const b = bridges[i];
    const texKey = `wall:landmark:${b.texIndex ?? i}`;
    const isBattlement = b.connectionType === 'bridge_battlement';
    // NS: travels along Z — side walls sit on X edges, run along Z
    // WE: travels along X — side walls sit on Z edges, run along X
    const isNS = b.axis === 'NS';

    for (const seg of b.segments) {
      const r = seg.worldRect;

      // Slab: 0.5" thick, top face flush with cell top.
      // r.y is anchor.y = wp.y + 0.75 (= cell floor + 0.75).
      // Cell top = wp.y + 1 = r.y + 0.25, so slabY = r.y + 0.25 - bridgeThickness = r.y - 0.25.
      const slabY = r.y - 0.25;

      primitives.push({
        type: 'slab', name: `bridge_${i}`,
        x: r.x, y: slabY, z: r.z, w: r.w, h: bridgeThickness, d: r.d,
        textureKey: texKey,
        emitTop: true, emitBottom: true, simpleBottom: false,
        rotateUV: r.w > r.d,
        shared: true,
      });
      if (!seg.isCrossing) {
        primitives.push({
          type: 'edges', name: `bridge_${i}`,
          x: r.x, y: slabY, z: r.z, w: r.w, h: bridgeThickness, d: r.d,
          textureKey: texKey,
        });
      }

      if (seg.isCrossing) continue;

      // Wall base sits at cell top.
      const wallY = slabY + bridgeThickness; // = r.y - 0.25 + 0.5 = r.y + 0.25

      if (!isBattlement) {
        // bridge_low: one continuous slab per side, 1" tall.
        const walls = isNS
          ? [
              { x: r.x,             y: wallY, z: r.z, w: wallT, h: wallH, d: r.d, side: 'L' },
              { x: r.x + r.w - wallT, y: wallY, z: r.z, w: wallT, h: wallH, d: r.d, side: 'R' },
            ]
          : [
              { x: r.x, y: wallY, z: r.z,             w: r.w, h: wallH, d: wallT, side: 'L' },
              { x: r.x, y: wallY, z: r.z + r.d - wallT, w: r.w, h: wallH, d: wallT, side: 'R' },
            ];

        for (const wall of walls) {
          primitives.push({
            type: 'slab', name: `bridge_${i}_wall${wall.side}`,
            x: wall.x, y: wall.y, z: wall.z, w: wall.w, h: wall.h, d: wall.d,
            textureKey: texKey,
            emitTop: true, emitBottom: false, simpleBottom: false, rotateUV: false,
            shared: false,
            thinAxis: isNS ? 'x' : 'z',
          });
        }
      } else {
        // bridge_battlement: per-cell sections, height alternates by position.
        // Travel axis is Z (NS) or X (WE). Each cell is 1".
        const travelLength = isNS ? r.d : r.w;
        const cellCount = Math.round(travelLength); // should be integer

        for (let ci = 0; ci < cellCount; ci++) {
          const h = ci % period === (period - 1) ? tallH : wallH;
          const travelOffset = ci; // 1" per cell

          for (const side of ['L', 'R']) {
            let wx, wy, wz, ww, wd;
            if (isNS) {
              wx = side === 'L' ? r.x : r.x + r.w - wallT;
              wy = wallY;
              wz = r.z + travelOffset;
              ww = wallT;
              wd = 1;
            } else {
              wx = r.x + travelOffset;
              wy = wallY;
              wz = side === 'L' ? r.z : r.z + r.d - wallT;
              ww = 1;
              wd = wallT;
            }

            primitives.push({
              type: 'slab', name: `bridge_${i}_batt${ci}_${side}`,
              x: wx, y: wy, z: wz, w: ww, h, d: wd,
              textureKey: texKey,
              emitTop: true, emitBottom: false, simpleBottom: false, rotateUV: false,
              shared: false,
              thinAxis: isNS ? 'x' : 'z',
            });
          }
        }
      }
    }
  }

  return primitives;
}
