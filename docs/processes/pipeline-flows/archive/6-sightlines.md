# Stage 6: Sightline Analysis & Cover

> Last verified: 2026-04-18

## Overview

Enforces the sightline constraint: no unbroken line of sight may exceed the configured maximum (default 24", Mordheim's maximum shooting range). Samples point pairs across all tiers, identifies violations, and places cover elements (wall fragments, rubble, barricades) to break them. Iterates until all sightlines are within the limit.

## Input Contract

```js
{
  floors: Floor[],
  walls: Wall[],
  connections: Connection[],  // from Stage 5
  buildings: Building[],
  maxSightline: number,        // max allowed unbroken LOS (inches, default 24)
  rng: RNG,
}
```

## Algorithm

### Phase A: Point Sampling

1. For each floor section at each tier, sample points on a 2" grid
2. Discard points that fall in cutout regions (the floor was removed there)
3. Result: a set of candidate shooter positions across the entire map

### Phase B: Sightline Casting

4. For each pair of points on the same tier or adjacent tiers, check line of sight:
   - Cast a ray between the two points
   - Test against all wall rects and building footprint bounds (as opaque blockers)
   - If unobstructed AND distance > `maxSightline`, flag the pair
5. To keep the O(n²) check tractable, skip pairs where the straight-line distance is already ≤ `maxSightline` (no violation possible)

### Phase C: Cover Placement

6. For each flagged sightline pair, find its midpoint
7. Try to place a cover element at or near the midpoint:
   - **Wall fragment**: thin slab (~0.25" thick × 2-3" wide × 1.5-2" tall), oriented perpendicular to the sightline
   - **Rubble pile**: flat-topped slab (~2" × 2" × 0.5" tall), always walkable (counts as cover without blocking movement)
   - **Barricade**: thin slab (~3" wide × 1" tall) in a fixed or angled orientation
8. Check cover density: if the midpoint area already has > 2 cover elements per 6"×6" area, skip placement (avoid clutter)
9. After placing, re-cast the sightline — if still violated, shift the cover position by 1" increments along the sightline and retry (max 5 attempts)

### Phase D: Re-validation

10. After all cover is placed, re-run the full sightline check (Phase B)
11. If violations remain, repeat Phase C for the remaining pairs
12. Abort after 5 full passes to prevent infinite loops — log any remaining violations as warnings

## Output Contract

```js
{
  // all prior output fields carried forward, plus:
  coverElements: [
    {
      type: 'wall_fragment' | 'rubble' | 'barricade',
      rect: Rect,              // XZ footprint
      y: number,               // Y of base
      height: number,          // element height
      rotation: number,        // Y-axis rotation in degrees (0, 90, 180, 270)
      materialKey: string,     // 'rubble', 'stone_wall', etc.
    }
  ],
  sightlineReport: {
    initialViolations: number,
    remainingViolations: number,  // 0 = fully satisfied
    passesRun: number,
  },
}
```

## Key Files

- `src/generators/cover/index.js` — public entry, orchestrates phases
- `src/generators/cover/` — sightline casting and cover placement logic

## Edge Cases & Constraints

- Rubble piles are always placed flat (walkable surface at top) — they do not block model placement
- Cover density cap prevents over-cluttering any local area; some sightlines may remain if no valid placement exists
- The sightline check treats tier 0 as open ground — no walls on the base tier means long sightlines there are structural (covered by buildings and alleyway geometry instead)
- After 5 passes, remaining violations are warnings, not errors — the generation continues

## Testing Notes

- Tests verify that after stage completion, `sightlineReport.remainingViolations` is 0 for standard configs
- Tests verify no cover element is placed outside map bounds
- Tests verify rubble elements do not overlap floor cutout regions
