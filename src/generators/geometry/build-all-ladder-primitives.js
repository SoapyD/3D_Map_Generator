/**
 * Build all ladder primitives (yellow, ground, orange, interior) from pipeline data.
 */

import { buildLadderPrimitive } from './build-ladder-primitive.js';

/**
 * Build all ladder primitives (yellow, ground, orange, interior) from pipeline data.
 *
 * @param {object} conn - Connections data (conn.ladders, conn.groundLadders, etc.)
 * @param {object[]} walls - Wall data from pipeline
 * @returns {object[]} Array of primitives
 */
export function buildAllLadderPrimitives(conn, walls) {
  const primitives = [];

  // Yellow ladders
  const ladders = conn.ladders || [];
  for (let i = 0; i < ladders.length; i++) {
    const p = buildLadderPrimitive(`ladder_${i}`, ladders[i], i, walls);
    if (p) primitives.push(p);
  }

  // Ground ladders
  const groundLadders = conn.groundLadders || [];
  for (let i = 0; i < groundLadders.length; i++) {
    const p = buildLadderPrimitive(`ground_ladder_${i}`, groundLadders[i], i + 10, walls);
    if (p) primitives.push(p);
  }

  // Orange ladders
  const orangeLadders = conn.orangeLadders || [];
  for (let i = 0; i < orangeLadders.length; i++) {
    const l = orangeLadders[i];
    const name = l.bad ? `orange_ladder_BAD_${i}` : `orange_ladder_${i}`;
    const p = buildLadderPrimitive(name, l, i + 20, walls);
    if (p) primitives.push(p);
  }

  // Interior ladders
  const interiorLadders = conn.interiorLadders || [];
  for (let i = 0; i < interiorLadders.length; i++) {
    const p = buildLadderPrimitive(`interior_ladder_${i}`, interiorLadders[i], i + 30, walls);
    if (p) primitives.push(p);
  }

  return primitives;
}
