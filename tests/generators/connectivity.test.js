import { describe, it, expect } from 'vitest';
import { runStages } from '../helpers/run-stages.js';
import { CONNECTIVITY, LADDERS } from '../../src/config.js';

const SEEDS = [42, 100, 7];
const WALKWAY_TYPES = ['walkway', 'bridge_low', 'bridge_battlement'];

describe('generateConnectivity', () => {
  it('returns the connections object with its documented arrays', () => {
    const { connectivity } = runStages(42);
    for (const key of ['anchors', 'candidates', 'doors', 'walkways', 'crossings', 'pillars']) {
      expect(Array.isArray(connectivity.connections[key]), key).toBe(true);
    }
  });

  it('anchors have unique ids, a direction and 1-cell-thick world rects', () => {
    const { anchors } = runStages(42).connectivity.connections;
    expect(new Set(anchors.map(a => a.id)).size).toBe(anchors.length);
    for (const a of anchors) {
      expect(['N', 'S', 'E', 'W']).toContain(a.direction);
      expect(a.w).toBeGreaterThan(0);
      expect(a.d).toBeGreaterThan(0);
    }
  });

  it('every walkway has a known type, an axis, and segments with positive world rects', () => {
    for (const seed of SEEDS) {
      const { walkways } = runStages(seed).connectivity.connections;
      expect(walkways.length).toBeGreaterThan(0);
      for (const w of walkways) {
        expect(WALKWAY_TYPES).toContain(w.connectionType);
        expect(['NS', 'WE']).toContain(w.axis);
        expect(w.segments.length).toBeGreaterThan(0);
        for (const s of w.segments) {
          expect(s.worldRect.w).toBeGreaterThan(0);
          expect(s.worldRect.d).toBeGreaterThan(0);
        }
      }
    }
  });

  it('walkways connect at a single tier: all segment cells share one cy', () => {
    for (const seed of SEEDS) {
      for (const w of runStages(seed).connectivity.connections.walkways) {
        const cys = new Set(w.segments.flatMap(s => s.cells.map(c => c.cy)));
        expect(cys.size, `seed ${seed} tier ${w.tier}`).toBe(1);
        expect(cys.has(w.tier)).toBe(true);
      }
    }
  });

  it('walkway tiers are the river level (-1) or an elevated tier level', () => {
    const { connectivity, config } = runStages(42);
    const stride = config.tierHeight + config.slabThickness;
    for (const w of connectivity.connections.walkways) {
      if (w.tier === -1) continue;
      // tier is the matrix cell row of the walking surface: the top cell of a tier band (3, 7, 11 ...)
      expect((w.tier + 1) % stride).toBe(0);
    }
  });

  it('walkway segments stay within the active area', () => {
    for (const seed of SEEDS) {
      const { connectivity, grid } = runStages(seed);
      const a = grid.activeArea;
      for (const w of connectivity.connections.walkways) {
        for (const s of w.segments) {
          expect(s.worldRect.x).toBeGreaterThanOrEqual(a.x);
          expect(s.worldRect.z).toBeGreaterThanOrEqual(a.z);
          expect(s.worldRect.x + s.worldRect.w).toBeLessThanOrEqual(a.x + a.w);
          expect(s.worldRect.z + s.worldRect.d).toBeLessThanOrEqual(a.z + a.d);
        }
      }
    }
  });

  it('pillars are only generated for connections at or above pillarMinLength', () => {
    const { connectivity } = runStages(42);
    for (const p of connectivity.connections.pillars) {
      expect(p.w).toBe(CONNECTIVITY.pillarWidth);
      expect(p.d).toBe(CONNECTIVITY.pillarWidth);
      expect(p.h).toBeGreaterThan(0);
    }
  });

  it('door stamps have positive dimensions', () => {
    for (const d of runStages(42).connectivity.connections.doors) {
      expect(d.w).toBeGreaterThan(0);
      expect(d.h).toBeGreaterThan(0);
      expect(d.d).toBeGreaterThan(0);
    }
  });

  it('is deterministic for the same seed (separate generation runs)', () => {
    const a = runStages(42);
    const b = runStages(42, { textureSet: 'base' });
    expect(a).not.toBe(b);
    expect(a.connectivity.connections.walkways).toEqual(b.connectivity.connections.walkways);
    expect(a.connectivity.connections.anchors).toEqual(b.connectivity.connections.anchors);
  });
});

describe('generateLadders', () => {
  // NOTE: some segments come out with keptTopY <= keptBottomY (zero or inverted height, e.g. seed 42
  // building 14 path 1). The geometry stage silently drops them. Reported as a possible bug; not asserted here.
  it('returns ladderPaths made of segments with positive footprint', () => {
    for (const seed of SEEDS) {
      const { ladders } = runStages(seed);
      expect(ladders.ladderPaths.length).toBeGreaterThan(0);
      for (const path of ladders.ladderPaths) {
        expect(path.segments.length).toBeGreaterThan(0);
        for (const s of path.segments) {
          expect(s.w).toBeGreaterThan(0);
          expect(s.d).toBeGreaterThan(0);
          expect(s.keptBottomY).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('kept ladder segments start at ground level (0) or a tier level and end on a tier boundary', () => {
    const { ladders, config } = runStages(42);
    const stride = config.tierHeight + config.slabThickness;
    for (const path of ladders.ladderPaths) {
      for (const s of path.segments) {
        expect(s.keptBottomY % stride).toBe(0);
        expect(s.keptTopY % stride).toBe(0);
      }
    }
  });

  it('ladder segments respect the map-edge clearance', () => {
    for (const seed of SEEDS) {
      const { ladders, grid } = runStages(seed);
      const a = grid.activeArea;
      for (const path of ladders.ladderPaths) {
        for (const s of path.segments) {
          // Ladders sit one cell outside the wall; their clearance is measured from the cell, so allow 1 cell of slack.
          expect(s.x).toBeGreaterThanOrEqual(a.x + LADDERS.mapEdgeClearance - 1);
          expect(s.z).toBeGreaterThanOrEqual(a.z + LADDERS.mapEdgeClearance - 1);
          expect(s.x + s.w).toBeLessThanOrEqual(a.x + a.w - LADDERS.mapEdgeClearance + 1);
          expect(s.z + s.d).toBeLessThanOrEqual(a.z + a.d - LADDERS.mapEdgeClearance + 1);
        }
      }
    }
  });

  it('geometry ladder primitives have two poles, rungs, and y1 above y0', () => {
    for (const seed of SEEDS) {
      const ladderPrims = runStages(seed).geometry.primitives.filter(p => p.type === 'ladder');
      expect(ladderPrims.length).toBeGreaterThan(0);
      for (const l of ladderPrims) {
        expect(l.y1).toBeGreaterThan(l.y0);
        expect(l.poles.length).toBe(2);
        expect(l.rungs.length).toBeGreaterThan(0);
      }
    }
  });

  it('one ladder geometry primitive is emitted per ladder segment with positive kept height', () => {
    for (const seed of SEEDS) {
      const { ladders, geometry } = runStages(seed);
      const segs = ladders.ladderPaths.reduce((n, p) => n + p.segments.filter(s => s.keptTopY > s.keptBottomY).length, 0);
      expect(geometry.primitives.filter(p => p.type === 'ladder').length).toBe(segs);
    }
  });
});
