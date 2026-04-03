/**
 * Branching walkways: T-junctions off forced connections to nearby buildings.
 */

import { CONNECTIVITY } from '../../config.js';
import { findBranchCandidates } from './find-branch-candidates.js';
import { filterBranchCandidates } from './filter-branch-candidates.js';

/**
 * Generate branching walkways (T-junctions) off forced connections to nearby buildings.
 * For each forced walkway, scan perpendicular for building floors at the same tier.
 * Creates a perpendicular branch segment + junction platform at the intersection.
 */
export function generateBranches(data, allWalkways, config) {
  const { tierHeight } = config;
  const maxBranches = CONNECTIVITY.branchMaxPerMap || 2;

  const forcedWalkways = allWalkways.filter(w => w.forced);
  if (forcedWalkways.length === 0) return { branches: [], junctionPlatforms: [] };

  const candidates = findBranchCandidates(forcedWalkways, data, config);
  const valid = filterBranchCandidates(candidates, data, allWalkways, tierHeight);

  // Keep the longest branches, up to max
  valid.sort((a, b) => b.length - a.length);
  const kept = valid.slice(0, maxBranches);

  const branches = kept.map(c => c.branch);

  if (branches.length > 0) console.log('  Branching walkways: ' + branches.length);
  return { branches };
}
