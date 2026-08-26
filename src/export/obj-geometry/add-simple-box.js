import { addEdge } from './add-edge.js';

/**
 * Emit an axis-aligned box as 6 flat quads with a single atlas tile per face —
 * no 3" segment subdivision. Intended for solid-colour cosmetic geometry (e.g.
 * the raised map border) where per-tile UV variation buys nothing, so paying
 * for a subdivided grid of vertices would be pure waste.
 *
 * Reuses addEdge (the tested double-sided quad emitter) for each of the 6 faces.
 */
export function addSimpleBox(state, name, x0, y0, z0, sizeX, sizeY, sizeZ, uv) {
  const x1 = x0 + sizeX, y1 = y0 + sizeY, z1 = z0 + sizeZ;
  const cu = ((uv.uMin + uv.uMax) / 2).toFixed(6);
  const cv = ((uv.vMin + uv.vMax) / 2).toFixed(6);

  state.objLines.push(`o ${name}`);
  addEdge(state, [x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1],  0, 1, 0, cu, cv); // top
  addEdge(state, [x0,y0,z1],[x1,y0,z1],[x1,y0,z0],[x0,y0,z0],  0,-1, 0, cu, cv); // bottom
  addEdge(state, [x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],  0, 0,-1, cu, cv); // -Z
  addEdge(state, [x1,y0,z1],[x0,y0,z1],[x0,y1,z1],[x1,y1,z1],  0, 0, 1, cu, cv); // +Z
  addEdge(state, [x0,y0,z1],[x0,y0,z0],[x0,y1,z0],[x0,y1,z1], -1, 0, 0, cu, cv); // -X
  addEdge(state, [x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0],  1, 0, 0, cu, cv); // +X
  state.objLines.push('');
}
