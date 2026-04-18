# Stage 3: Floor Plate Generation

> Last verified: 2026-04-18

## Overview

Generates the horizontal slab geometry for every tier. Tier 0 covers the entire map (base/street level). Upper tiers cover only the footprints of buildings tall enough to reach them. Damage cutouts are applied — random rectangular chunks removed from floor edges to create the ruined aesthetic.

## Input Contract

```js
{
  buildings: Building[],    // from Stage 2
  blocks: Block[],
  streets: Street[],
  tiers: number,
  tierHeight: number,       // vertical spacing between tiers (inches, default 6)
  slabThickness: number,    // floor slab thickness (inches, default 0.5)
  rng: RNG,
}
```

## Algorithm

**For each tier (0 to config.tiers):**

**Tier 0 (base):**
1. Create a single rectangle covering the full map
2. No damage cutouts — the base is always intact
3. Extrude to `slabThickness`, place at Y = 0

**Tier 1+:**
1. Collect all buildings with `maxTier >= currentTier`
2. For each qualifying building, start with its `shape` rectangles
3. Apply damage cutouts:
   a. Sample a cutout count from the RNG, biased by `building.damage` and tier index (higher tiers = more cutouts)
   b. For each cutout, pick a random edge (N/S/E/W), a random inset depth, and a random width along that edge
   c. Subtract the cutout rectangle from the floor shape using axis-aligned boolean subtraction
   d. After all cutouts, check minimum walkable area: any remaining section must have at least one 2"×2" contiguous area; if not, restore the last cutout
4. Record the resulting polygon as a list of axis-aligned rect segments (the subtracted shape)
5. Extrude to `slabThickness`, place at Y = `currentTier * config.tierHeight`

## Output Contract

```js
{
  // all prior output fields carried forward, plus:
  floors: [
    {
      tier: number,                // 0-indexed tier
      buildingId: string | null,   // null for tier 0 (base)
      y: number,                   // Y position of top face
      rects: Rect[],               // axis-aligned rect decomposition of the floor shape
      cutouts: Rect[],             // the damage cutouts that were applied
      materialKey: string,         // e.g. "stone_floor", "wood_plank"
    }
  ],
}
```

## Key Files

- `src/generators/floors/index.js` — public entry, iterates tiers and buildings
- `src/generators/floors/generate-floor-plates.js` — main per-building floor generation
- `src/generators/floors/apply-damage.js` — cutout sampling and subtraction logic
- `src/generators/floor-texture-key.js` — maps floor type to material key
- `src/generators/geometry-rects.js` — shared rect arithmetic (subtract, intersect, union)

## Edge Cases & Constraints

- Minimum walkable area (2"×2") is enforced per floor section — a section removed entirely is preferable to leaving an unreachable sliver
- Tier 0 receives no cutouts regardless of damage factor
- Very high damage values (> 0.9) may reduce a building to only a narrow ledge — this is intentional for the ruined aesthetic, as long as the 2"×2" minimum is met
- Cutouts are axis-aligned only — no diagonal or curved cuts

## Testing Notes

- Tests verify all rects in `floors` are within the building's bounding footprint
- Tests verify cutouts do not consume > 80% of any floor plate
- Tests verify Y positions match `tier * tierHeight` exactly
