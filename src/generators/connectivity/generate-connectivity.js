/**
 * Stage 5: Connectivity
 *
 * Ensures all elevated floor sections are reachable from ground level.
 * Three connection types:
 *   - Ladders: vertical, within a building (connects tier N to tier N+1)
 *   - Walkways: horizontal, between different buildings at the same tier
 *   - Ramps: angled, connects up to 1 tier higher (typically ground to tier 1)
 *
 * Algorithm:
 * 1. Build a graph of all floor sections as nodes
 * 2. Add edges for sections that share an edge at the same tier
 * 3. Flood-fill from tier 0 to find reachable sections
 * 4. Place ramps from ground to unreachable tier 1 sections
 * 5. Place ladders within buildings for unreachable higher tiers
 * 6. Place walkways between nearby buildings at the same tier
 * 7. Repeat flood-fill until everything is reachable
 *
 * Output: { ...data, connections: { ladders: [], walkways: [], ramps: [] } }
 */

import { CONNECTIVITY, DELETIONS } from '../../config.js';
import { detectGapsAndConnect } from '../gap-detection/index.js';
import { generateBranches } from '../branching.js';
import { generatePillars } from '../pillars.js';
import { generateWalkways } from './generate-walkways.js';
import { proximityCullWalkways } from './proximity-cull-walkways.js';
import { generateYellowLadders } from './generate-yellow-ladders.js';
import { generateGroundLadders } from './generate-ground-ladders.js';
import { generateOrangeLadders } from './generate-orange-ladders.js';
import { generateInteriorLadders } from './generate-interior-ladders.js';
import { filterAndCullLadders } from './filter-and-cull-ladders.js';
import { postFilterLadders } from './post-filter-ladders.js';
import { generateTowerLadders } from './generate-tower-ladders.js';
import { generateLadderPlatforms } from './generate-ladder-platforms.js';

export function generateConnectivity(data, config, rng) {
  const { tierHeight } = config;
  const ctx = { data, config, rng };

  // Generate walkways between buildings
  const { culledWalkways } = generateWalkways(ctx);

  // Generate all ladder types
  const ladders = generateYellowLadders(ctx, culledWalkways);
  const filteredGroundLadders = generateGroundLadders(ctx, culledWalkways);
  const orangeLadders = generateOrangeLadders(ctx);
  const interiorLadders = generateInteriorLadders(ctx);

  // Filter and proximity-cull ladders
  let ladderResults = filterAndCullLadders(ctx,
    { ladders, filteredGroundLadders, orangeLadders, interiorLadders },
    culledWalkways
  );

  // Proximity-cull walkways
  let finalWalkways = proximityCullWalkways(culledWalkways);

  // Post-filter ladders (remove those near walkways, orphaned yellow ladders)
  ladderResults = postFilterLadders(ladderResults, finalWalkways);
  const { survivingYellow, finalOrange, finalInterior } = ladderResults;
  let { finalRed } = ladderResults;

  // Tower ladders (placed last to avoid overlaps)
  finalRed = generateTowerLadders(ctx, { survivingYellow, finalRed, finalOrange, finalInterior });

  // Gap detection: add forced connections before bridge upgrade so they can become bridges
  const gapWalkways = detectGapsAndConnect(data, finalWalkways, [], config, rng);
  finalWalkways.push(...gapWalkways);

  // Branching walkways: T-junctions off forced connections to nearby buildings
  const { branches } = generateBranches(data, finalWalkways, config);
  finalWalkways.push(...branches);

  // Upgrade some tier 2+ walkways (including forced ones) to bridges
  // Branches inherit the same upgrade decision as their parent
  const bridges = [];
  const remainingWalkways = [];
  const bridgeVariants = CONNECTIVITY.bridgeVariants;

  // First pass: decide which non-branch walkways become bridges and pick their variant
  const upgradeMap = new Map(); // walkway ref -> variant string (or null if not upgraded)
  for (const w of finalWalkways) {
    if (w.branch) continue; // branches handled in second pass
    const walkwayTier = Math.round(w.y / tierHeight);
    if (walkwayTier >= 2 && rng.chance(CONNECTIVITY.bridgeChance)) {
      const entries = Object.entries(bridgeVariants);
      const totalWeight = entries.reduce((sum, [, v]) => sum + v.weight, 0);
      const roll = rng.random() * totalWeight;
      let cum = 0, variant = entries[0][0];
      for (const [name, v] of entries) {
        cum += v.weight;
        if (roll < cum) { variant = name; break; }
      }
      upgradeMap.set(w, variant);
    }
  }

  // Assign textureId to parents, branches inherit
  let nextTexId = 0;
  const texIdMap = new Map(); // walkway ref -> textureId
  for (const w of finalWalkways) {
    if (w.branch) continue;
    texIdMap.set(w, nextTexId++);
  }
  for (const w of finalWalkways) {
    if (!w.branch || !w.parentRef) continue;
    const parentId = texIdMap.get(w.parentRef);
    texIdMap.set(w, parentId !== undefined ? parentId : nextTexId++);
  }

  // Second pass: apply upgrades, branches inherit from their parent
  for (const w of finalWalkways) {
    let variant = null;
    if (w.branch && w.parentRef) {
      variant = upgradeMap.get(w.parentRef) || null;
    } else {
      variant = upgradeMap.get(w) || null;
    }

    const textureId = texIdMap.get(w);
    if (variant) {
      const bw = CONNECTIVITY.bridgeWidth;
      let bridge;
      if (w.axis === 'x') {
        const centreZ = w.z + w.d / 2;
        bridge = { ...w, type: 'bridge', z: centreZ - bw / 2, d: bw, variant, textureId };
      } else {
        const centreX = w.x + w.w / 2;
        bridge = { ...w, type: 'bridge', x: centreX - bw / 2, w: bw, variant, textureId };
      }
      bridges.push(bridge);
    } else {
      w.textureId = textureId;
      remainingWalkways.push(w);
    }
  }

  // Adjust branch bridges to align with parent's new (wider) edges
  for (const branch of bridges) {
    if (!branch.branch || !branch.parentRef) continue;
    const parent = bridges.find(b => !b.branch && b.textureId === branch.textureId);
    if (!parent) continue;

    if (branch.axis === 'x' && parent.axis !== 'x') {
      // Branch runs along X; parent runs along Z — align branch X start/end to parent X edges
      const parentEdgeW = parent.x;
      const parentEdgeE = parent.x + parent.w;
      if (branch.x < parentEdgeE && branch.x + branch.w > parentEdgeW) {
        // Branch starts inside parent — push start to parent's far edge
        if (branch.x >= parentEdgeW && branch.x < parentEdgeE) {
          const oldStart = branch.x;
          branch.x = parentEdgeE;
          branch.w -= (branch.x - oldStart);
        }
        // Branch ends inside parent — pull end to parent's near edge
        if (branch.x + branch.w > parentEdgeW && branch.x + branch.w <= parentEdgeE) {
          branch.w = parentEdgeW - branch.x;
        }
      }
    } else if (branch.axis === 'z' && parent.axis !== 'z') {
      // Branch runs along Z; parent runs along X — align branch Z start/end to parent Z edges
      const parentEdgeN = parent.z;
      const parentEdgeS = parent.z + parent.d;
      if (branch.z < parentEdgeS && branch.z + branch.d > parentEdgeN) {
        if (branch.z >= parentEdgeN && branch.z < parentEdgeS) {
          const oldStart = branch.z;
          branch.z = parentEdgeS;
          branch.d -= (branch.z - oldStart);
        }
        if (branch.z + branch.d > parentEdgeN && branch.z + branch.d <= parentEdgeS) {
          branch.d = parentEdgeN - branch.z;
        }
      }
    }
  }

  // Generate ladder platforms
  const filteredPlatforms = generateLadderPlatforms(ctx,
    { survivingYellow, finalRed, finalOrange, finalInterior },
    finalWalkways, tierHeight
  );

  // Generate pillar supports under long walkways/bridges
  const pillars = DELETIONS.pillarGeneration
    ? generatePillars(remainingWalkways, bridges, data, config)
    : [];

  const connections = { ladders: survivingYellow, walkways: remainingWalkways, bridges, groundLadders: finalRed, orangeLadders: finalOrange, interiorLadders: finalInterior, ladderPlatforms: filteredPlatforms, pillars };
  return { ...data, connections };
}
