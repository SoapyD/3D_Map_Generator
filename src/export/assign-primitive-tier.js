/**
 * Tier assignment — maps each geometry primitive to exactly one vertical tier so the
 * OBJ/collider exports can be split into per-tier files (stacked, independently movable
 * objects in Tabletop Simulator). Pure: no side effects, no I/O.
 *
 * Tier model (see docs/PROJECT_OVERVIEW.md): the map is a stack of flat slabs. Tier `i`'s
 * floor slab sits at y = i*levelHeight - slabThickness and its walls at y = i*levelHeight,
 * where levelHeight = tierHeight + slabThickness. Floor indices run 0..config.tiers, so the
 * total tier count is config.tiers + 1.
 */

const EPS = 1e-6;

// Ground / below-ground terrain — always tier 0. Ordering note: 'river_' also catches
// 'river_bank_', and 'street_' also catches 'street_scatter_' (both correctly ground).
const GROUND_PREFIXES = [
  'street_', 'river_', 'skirt_', 'border_', 'deleted_', 'pavement_', 'building_footprint_',
];

// Cross-tier connectors — assigned to their LOWER (base) tier via floor-banding, so a raised
// upper tier detaches cosmetically at the top (accepted v1 behaviour). Ladders come in several
// name forms (ladder_, ground_ladder_, orange_ladder_, interior_ladder_, ladder_path_,
// ladder_platform_) so we match the 'ladder' substring rather than a single prefix.
const CONNECTOR_PREFIXES = ['pillar_', 'bridge_', 'walkway_', 'junction_platform_'];

const clampTier = (t, maxTier) => Math.min(Math.max(t, 0), maxTier);

/**
 * Base (lowest) world Y of a primitive. Most primitives carry `y`; ladders carry `y0`/`y1`.
 */
export function primBaseY(prim) {
  if (typeof prim.y === 'number') return prim.y;
  if (typeof prim.y0 === 'number') return prim.y0;
  return 0;
}

/** Top (highest) world Y of a primitive. */
export function primTopY(prim) {
  if (typeof prim.y === 'number') return prim.y + (prim.h || 0);
  if (typeof prim.y1 === 'number') return prim.y1;
  return primBaseY(prim);
}

/** Total number of tiers for a config (floor indices 0..config.tiers). */
export function tierCount(config) {
  return config.tiers + 1;
}

/**
 * @param {{ name: string, y: number }} prim
 * @param {{ tiers: number, tierHeight: number, slabThickness: number }} config
 * @returns {number} integer tier in [0, config.tiers]
 */
export function tierOf(prim, config) {
  const name = prim.name || '';
  const maxTier = config.tiers;
  const slab = config.slabThickness;
  const levelHeight = config.tierHeight + slab;
  const baseY = primBaseY(prim);

  // 1. Floors — authoritative tier encoded in the name (floor_f{tier}_...).
  const m = /^floor_f(\d+)_/.exec(name);
  if (m) return clampTier(parseInt(m[1], 10), maxTier);

  // 2. Ground-anchored terrain.
  if (GROUND_PREFIXES.some(p => name.startsWith(p))) return 0;

  // 3. Cross-tier connectors → lower/base tier (floor-band the base Y).
  if (name.includes('ladder') || CONNECTOR_PREFIXES.some(p => name.startsWith(p))) {
    return clampTier(Math.floor((baseY + slab + EPS) / levelHeight), maxTier);
  }

  // 4. Everything else (walls, roofs, rooftop cover) sits on a tier floor → round-band.
  return clampTier(Math.round((baseY + slab) / levelHeight), maxTier);
}
