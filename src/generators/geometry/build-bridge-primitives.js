import { CONNECTIVITY } from '../../config.js';
import { emitBattlements } from './emit-battlements.js';

export function buildBridgePrimitives(bridges) {
  const primitives = [];
  const {
    bridgeThickness,
    bridgeWallHeight:       wallH,
    bridgeWallThickness:    wallT,
    bridgeBattlementHeight: battH,
    bridgeBattlementSpacing: spacing,
    bridgeBattlementGap:    gap,
  } = CONNECTIVITY;

  const pillarW = spacing - gap;

  for (let i = 0; i < bridges.length; i++) {
    const b = bridges[i];
    const texKey = `wall:landmark:${i}`;
    const isBattlement = b.connectionType === 'bridge_battlement';
    // NS: travels along Z, 2 cells wide in X — side walls on X edges, run along Z
    // WE: travels along X, 2 cells wide in Z — side walls on Z edges, run along X
    const isNS = b.axis === 'NS';

    for (const seg of b.segments) {
      const r = seg.worldRect;

      // Slab — always emitted
      primitives.push({
        type: 'slab', name: `bridge_${i}`,
        x: r.x, y: r.y, z: r.z, w: r.w, h: bridgeThickness, d: r.d,
        textureKey: texKey,
        emitTop: true, emitBottom: true, simpleBottom: false,
        rotateUV: r.w > r.d,
        shared: true,
      });
      primitives.push({
        type: 'edges', name: `bridge_${i}`,
        x: r.x, y: r.y, z: r.z, w: r.w, h: bridgeThickness, d: r.d,
        textureKey: texKey,
      });

      if (seg.isCrossing) continue;

      // Side walls
      const wallY = r.y + bridgeThickness;

      let wallL, wallR;
      if (isNS) {
        // walls run along Z (depth axis), sit on west and east X edges
        wallL = { x: r.x,             y: wallY, z: r.z, w: wallT, h: wallH, d: r.d };
        wallR = { x: r.x + r.w - wallT, y: wallY, z: r.z, w: wallT, h: wallH, d: r.d };
      } else {
        // walls run along X (width axis), sit on north and south Z edges
        wallL = { x: r.x, y: wallY, z: r.z,             w: r.w, h: wallH, d: wallT };
        wallR = { x: r.x, y: wallY, z: r.z + r.d - wallT, w: r.w, h: wallH, d: wallT };
      }

      for (const [side, wall] of [['L', wallL], ['R', wallR]]) {
        primitives.push({
          type: 'slab', name: `bridge_${i}_wall${side}`,
          ...wall,
          textureKey: texKey,
          emitTop: false, emitBottom: false, simpleBottom: false, rotateUV: false,
          shared: false,
          thinAxis: isNS ? 'x' : 'z',
        });

        if (isBattlement) {
          const battY = wallY + wallH;
          // emitBattlements expects segments as [{ start, end }] along the travel axis
          const segArr = isNS
            ? [{ start: r.z, end: r.z + r.d }]
            : [{ start: r.x, end: r.x + r.w }];
          const fixedPos = isNS
            ? (side === 'L' ? r.x + wallT / 2 : r.x + r.w - wallT / 2)
            : (side === 'L' ? r.z + wallT / 2 : r.z + r.d - wallT / 2);
          emitBattlements(primitives, segArr, fixedPos, !isNS, side, i, battY, battH, wallT, spacing, pillarW, texKey);
        }
      }
    }
  }

  return primitives;
}
