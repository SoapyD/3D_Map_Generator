import { STREETS, GEOMETRY } from '../../config.js';

export function buildMapSkirtPrimitives(config) {
  const { mapWidth, mapDepth } = config;
  const riverDepth = config.riverDepth ?? STREETS.riverDepth;
  const skirtH = riverDepth + 1;
  const skirtT = 1;
  const yBase  = -skirtH;

  const borderH = GEOMETRY.mapBorderHeight;
  const borderT = GEOMETRY.mapBorderThickness;
  const borderI = GEOMETRY.mapBorderInset;

  const primitives = [];

  // Retaining-rim panel helper — emits a textured slab (top cap + GLB box) plus
  // an 'edges' primitive for the OBJ exporter's vertical side faces. The visual
  // OBJ subdivides these into 3" segments for per-tile texture variation.
  function panel(name, x, z, w, d, rotateUV = false) {
    primitives.push({
      type: 'slab', name,
      x, y: yBase, z, w, h: skirtH, d,
      textureKey: 'map_skirt',
      emitTop: true, emitBottom: false, simpleBottom: false,
      rotateUV, shared: true,
    });
    primitives.push({
      type: 'edges', name,
      x, y: yBase, z, w, h: skirtH, d,
      textureKey: 'map_skirt',
    });
  }

  // Raised-border helper — a single solid-colour box per side. `solid: true`
  // tells the OBJ exporter to emit a plain box (6 quads, no 3" subdivision):
  // the border is one flat colour, so subdivision would add hundreds of
  // vertices for zero visual gain. GLB and collision already treat a slab as a
  // single box, so nothing else needs the segmented form.
  function borderPanel(name, x, z, w, d) {
    primitives.push({
      type: 'slab', name,
      x, y: 0, z, w, h: borderH, d,
      textureKey: 'map_border',
      solid: true, shared: false,
    });
  }

  // Below-ground retaining rim — thin lip hugging the outside of the map edge,
  // top flush at Y=0, dropping to the river floor.
  panel('skirt_N', 0,         -skirtT,   mapWidth, skirtT);
  panel('skirt_S', 0,         mapDepth,  mapWidth, skirtT);
  panel('skirt_W', -skirtT,   0,         skirtT,   mapDepth, true);
  panel('skirt_E', mapWidth,  0,         skirtT,   mapDepth, true);

  // Raised perimeter border wall (parapet) — one box per side, extending upward
  // from Y=0, standing on the play surface `borderI` cells inside the map edge
  // so it cuts roads before they run off the map. Laid out as a mitred picture
  // frame: N and S run the full inset width (corners included), W and E fill
  // only the span between them. This leaves no overlap between the four boxes
  // and no gap at the corners.
  const insetW = mapWidth - borderI * 2;              // frame footprint width
  const midD   = mapDepth - borderI * 2 - borderT * 2; // W/E span between N and S inner faces
  borderPanel('border_N', borderI,                    borderI,                    insetW,  borderT);
  borderPanel('border_S', borderI,                    mapDepth - borderI - borderT, insetW,  borderT);
  borderPanel('border_W', borderI,                    borderI + borderT,          borderT, midD);
  borderPanel('border_E', mapWidth - borderI - borderT, borderI + borderT,        borderT, midD);

  // Bottom cap — seals below the river floor
  primitives.push({
    type: 'slab', name: 'skirt_bottom',
    x: -skirtT, y: yBase - skirtT, z: -skirtT,
    w: mapWidth + skirtT * 2, h: skirtT, d: mapDepth + skirtT * 2,
    textureKey: 'map_skirt',
    emitTop: true, emitBottom: false, simpleBottom: false,
    rotateUV: false, shared: true,
  });

  return primitives;
}
