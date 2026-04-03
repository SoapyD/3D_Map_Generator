/**
 * Pillar support generation for walkways and bridges.
 */

import { CONNECTIVITY } from '../../config.js';
import { collectPillarSurfaces } from './collect-pillar-surfaces.js';
import { placePillar } from './place-pillar.js';

/**
 * Generate pillar supports underneath long walkways and bridges.
 * Pillars extend from just below the walkway down to ground (y=0) or a flush floor/roof.
 * Skipped if they partially overlap a floor/roof, or overlap another walkway/bridge.
 */
export function generatePillars(walkways, bridges, data, config) {
  const pillarW = CONNECTIVITY.pillarWidth || 0.5;
  const spacing = CONNECTIVITY.pillarSpacing || 6;
  const inset = CONNECTIVITY.pillarEdgeInset || 1.0;
  const minHeight = CONNECTIVITY.pillarMinHeight || 1.0;
  const minLen = CONNECTIVITY.pillarMinWalkwayLength || 8;
  const { tierHeight, slabThickness } = config;

  const allConnections = [...walkways, ...bridges];
  const pillars = [];
  const surfaces = collectPillarSurfaces(data, tierHeight, slabThickness);

  for (const source of allConnections) {
    const runAxis = source.axis;
    const runLen = runAxis === 'x' ? source.w : source.d;
    if (runLen < minLen) continue;

    const runStart = (runAxis === 'x' ? source.x : source.z) + inset;
    const runEnd = (runAxis === 'x' ? source.x + source.w : source.z + source.d) - inset;
    const crossCentre = runAxis === 'x'
      ? source.z + source.d / 2
      : source.x + source.w / 2;

    const usableLen = runEnd - runStart;
    if (usableLen <= 0) continue;

    const numPillars = Math.max(1, Math.ceil(usableLen / spacing));
    const step = usableLen / numPillars;

    for (let i = 0; i <= numPillars; i++) {
      const pos = runStart + i * step;
      const result = placePillar(pos, runAxis, pillarW, crossCentre, source, allConnections, surfaces, minHeight);
      if (result) pillars.push(result);
    }
  }

  if (pillars.length > 0) console.log('  Pillar supports: ' + pillars.length);
  return pillars;
}
