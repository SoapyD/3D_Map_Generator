/**
 * Floor edge faces (adjacency-aware, from gap data).
 */
import { addEdge } from './add-edge.js';

export function addFloorEdgesFromGaps(state, x0, y0, z0, w, h, d, edgeGaps, uv) {
  const x1 = x0 + w, y1 = y0 + h, z1 = z0 + d;
  const cu = ((uv.uMin + uv.uMax) / 2).toFixed(6);
  const cv = ((uv.vMin + uv.vMax) / 2).toFixed(6);

  if (edgeGaps.north) {
    for (const gap of edgeGaps.north)
      addEdge(state, [gap.start,y0,z0],[gap.end,y0,z0],[gap.end,y1,z0],[gap.start,y1,z0], 0,0,-1, cu, cv);
  }
  if (edgeGaps.south) {
    for (const gap of edgeGaps.south)
      addEdge(state, [gap.end,y0,z1],[gap.start,y0,z1],[gap.start,y1,z1],[gap.end,y1,z1], 0,0,1, cu, cv);
  }
  if (edgeGaps.west) {
    for (const gap of edgeGaps.west)
      addEdge(state, [x0,y0,gap.end],[x0,y0,gap.start],[x0,y1,gap.start],[x0,y1,gap.end], -1,0,0, cu, cv);
  }
  if (edgeGaps.east) {
    for (const gap of edgeGaps.east)
      addEdge(state, [x1,y0,gap.start],[x1,y0,gap.end],[x1,y1,gap.end],[x1,y1,gap.start], 1,0,0, cu, cv);
  }
}
