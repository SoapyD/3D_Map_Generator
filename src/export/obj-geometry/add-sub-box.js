import { GEOMETRY } from '../../config.js';
import { addEdgeFace } from './add-edge-face.js';
import { addWallPair } from './add-wall-pair.js';
import { emitFloorSlab } from './emit-floor-slab.js';

const SEG_SIZE = 3;
const SEGS_PER_TILE = GEOMETRY.objAtlasTileSize / GEOMETRY.objSegmentPixelSize;

/**
 * Subdivided box — floors, walls, or columns depending on dimensions.
 */
export function addSubBox(state, name, x0, y0, z0, sizeX, sizeY, sizeZ, uv, showEdges = false, rotateUV = false, thinAxis = null) {
  const isFloor = thinAxis ? false : sizeY < 1;
  const isColumn = !thinAxis && sizeX < 1 && sizeZ < 1;
  const isWallX = thinAxis === 'x' || (!thinAxis && sizeX < 1 && sizeZ >= 1);
  const isWallZ = thinAxis === 'z' || (!thinAxis && sizeZ < 1 && sizeX >= 1);

  const tileW = uv.uMax - uv.uMin;
  const tileH = uv.vMax - uv.vMin;
  const uvStep = tileW / SEGS_PER_TILE;
  const uvStepV = tileH / SEGS_PER_TILE;

  const fract = (v) => v - Math.floor(v);
  const [hu0, hu1] = GEOMETRY.uvHashU;
  const [hv0, hv1, hv2] = GEOMETRY.uvHashV;
  const hashU = fract(x0 * hu0 + z0 * hu1) * SEGS_PER_TILE;
  const hashV = fract(x0 * hv0 + z0 * hv1 + y0 * hv2) * SEGS_PER_TILE;
  const baseSegU = Math.floor(hashU);
  const baseSegV = Math.floor(hashV);

  if (isColumn) {
    addSubBox(state, name + '_zf', x0, y0, z0, sizeX, sizeY, sizeZ, uv, false, rotateUV, 'z');
    addSubBox(state, name + '_xf', x0, y0, z0, sizeX, sizeY, sizeZ, uv, false, rotateUV, 'x');
    return;
  }

  const uvParams = { uvStep, uvStepV, baseSegU, baseSegV, SEGS_PER_TILE };

  if (isFloor || (!isWallX && !isWallZ)) {
    emitFloorSlab(state, name, x0, y0, z0, sizeX, sizeY, sizeZ, uv, uvParams, showEdges, rotateUV);
  } else if (isWallZ) {
    const segsL = Math.max(1, Math.ceil(sizeX / SEG_SIZE));
    const segsH = Math.max(1, Math.ceil(sizeY / SEG_SIZE));
    const stepL = sizeX / segsL;
    const stepH = sizeY / segsH;
    const z1 = z0 + sizeZ;

    addWallPair(state, name, { x0, y0, z0, sizeX, sizeY, sizeZ }, uv,
      { segsL, segsH, stepL, stepH }, uvParams, showEdges,
      (gh, gl) => `v ${(x0 + gl * stepL).toFixed(6)} ${(y0 + gh * stepH).toFixed(6)} ${z0.toFixed(6)}`,
      (gh, gl) => `v ${(x0 + gl * stepL).toFixed(6)} ${(y0 + gh * stepH).toFixed(6)} ${z1.toFixed(6)}`,
      [0, 0, -1], [0, 0, 1], true,
      (st, uv2) => {
        const y1 = y0 + sizeY;
        addEdgeFace(st, [x0,y0+sizeY,z0],[x0+sizeX,y0+sizeY,z0],[x0+sizeX,y0+sizeY,z1],[x0,y0+sizeY,z1], 0,1,0, uv2);
        addEdgeFace(st, [x0,y0,z1],[x0+sizeX,y0,z1],[x0+sizeX,y0,z0],[x0,y0,z0], 0,-1,0, uv2);
        addEdgeFace(st, [x0,y0,z1],[x0,y0,z0],[x0,y1,z0],[x0,y1,z1], -1,0,0, uv2);
        addEdgeFace(st, [x0+sizeX,y0,z0],[x0+sizeX,y0,z1],[x0+sizeX,y1,z1],[x0+sizeX,y1,z0], 1,0,0, uv2);
      },
    );
  } else if (isWallX) {
    const segsL = Math.max(1, Math.ceil(sizeZ / SEG_SIZE));
    const segsH = Math.max(1, Math.ceil(sizeY / SEG_SIZE));
    const stepL = sizeZ / segsL;
    const stepH = sizeY / segsH;
    const x1 = x0 + sizeX;

    addWallPair(state, name, { x0, y0, z0, sizeX, sizeY, sizeZ }, uv,
      { segsL, segsH, stepL, stepH }, uvParams, showEdges,
      (gh, gl) => `v ${x0.toFixed(6)} ${(y0 + gh * stepH).toFixed(6)} ${(z0 + gl * stepL).toFixed(6)}`,
      (gh, gl) => `v ${x1.toFixed(6)} ${(y0 + gh * stepH).toFixed(6)} ${(z0 + gl * stepL).toFixed(6)}`,
      [-1, 0, 0], [1, 0, 0], false,
      (st, uv2) => {
        const y1 = y0 + sizeY;
        addEdgeFace(st, [x0,y1,z0],[x1,y1,z0],[x1,y1,z0+sizeZ],[x0,y1,z0+sizeZ], 0,1,0, uv2);
        addEdgeFace(st, [x0,y0,z0+sizeZ],[x1,y0,z0+sizeZ],[x1,y0,z0],[x0,y0,z0], 0,-1,0, uv2);
        addEdgeFace(st, [x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0], 0,0,-1, uv2);
        addEdgeFace(st, [x0,y0,z0+sizeZ],[x1,y0,z0+sizeZ],[x1,y1,z0+sizeZ],[x0,y1,z0+sizeZ], 0,0,1, uv2);
      },
    );
  }

  state.objLines.push('');
}
