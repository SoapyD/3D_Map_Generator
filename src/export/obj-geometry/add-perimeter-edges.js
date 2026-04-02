/**
 * Full perimeter edge faces for a freestanding flat object.
 */
import { addEdge } from './add-edge.js';

export function addPerimeterEdges(state, x0, y0, z0, sizeX, sizeY, sizeZ, uv) {
  const x1 = x0 + sizeX, y1 = y0 + sizeY, z1 = z0 + sizeZ;
  const cu = ((uv.uMin + uv.uMax) / 2).toFixed(6);
  const cv = ((uv.vMin + uv.vMax) / 2).toFixed(6);

  addEdge(state, [x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0], 0,0,-1, cu, cv);
  addEdge(state, [x1,y0,z1],[x0,y0,z1],[x0,y1,z1],[x1,y1,z1], 0,0,1, cu, cv);
  addEdge(state, [x0,y0,z1],[x0,y0,z0],[x0,y1,z0],[x0,y1,z1], -1,0,0, cu, cv);
  addEdge(state, [x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0], 1,0,0, cu, cv);
}
