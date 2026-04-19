/**
 * Return the list of placement specs for a given layout.
 * Each spec is { sizeKey, pos } — the caller generates and validates each one.
 */
export function getLayoutSpecs(layout, config) {
  const mw = config.mapWidth;
  const md = config.mapDepth;

  const TL = { x: mw * 0.25, z: md * 0.25 };
  const TR = { x: mw * 0.75, z: md * 0.25 };
  const BL = { x: mw * 0.25, z: md * 0.75 };
  const BR = { x: mw * 0.75, z: md * 0.75 };
  const C  = { x: mw * 0.5, z: md * 0.5 };

  switch (layout) {
    case 0: return [{ sizeKey: 'large', pos: C }];
    case 1: return [{ sizeKey: 'large', pos: TL }, { sizeKey: 'large', pos: BR }];
    case 2: return [{ sizeKey: 'medium', pos: TL }, { sizeKey: 'medium', pos: BR }, { sizeKey: 'medium', pos: TR }];
    case 3: return [{ sizeKey: 'medium', pos: TL }, { sizeKey: 'medium', pos: BL }, { sizeKey: 'medium', pos: TR }];
    case 4: {
      const TL1 = { x: mw * 0.15, z: md * 0.15 };
      const TL2 = { x: mw * 0.35, z: md * 0.35 };
      return [{ sizeKey: 'medium', pos: TL1 }, { sizeKey: 'medium', pos: TL2 }, { sizeKey: 'medium', pos: BR }, { sizeKey: 'medium', pos: TR }];
    }
    default: return [];
  }
}
