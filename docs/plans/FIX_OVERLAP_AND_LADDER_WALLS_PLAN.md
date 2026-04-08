# Fix: Cover Overlap & Ladder Wall Clearance

## Problem 1 — Purple (Cover) Objects Overlapping Each Other

### What's happening

Cover objects are the purple pieces visible in debug mode (`0x8844cc`). They come from four separate generation functions:

- `generateRooftopCover` — places pieces on top-tier floor quadrants
- `generateInteriorCover` — places pieces inside buildings on lower tiers
- ground cover (in `generateGroundAndStreetCover`) — places pieces inside deleted-building footprints
- street scatter (in `generateGroundAndStreetCover`) — places pieces randomly across the ground

Each function has its own running list and calls `overlapsAny` to avoid duplicates, but they don't all check against each other. The gaps are:

1. **Ground cover pieces don't check against themselves.** The loop runs 1–3 times per footprint, adding each piece to `groundCover`, but `overlapsAny` is only called against `cover` (rooftop pieces). Two pieces from the same footprint can land on top of each other.

2. **Street scatter doesn't know about ground cover.** `streetScatter` and `groundCover` are built in the same function call. `streetScatter` checks against `cover` (rooftop-only at that moment) but not against `groundCover`, since both lists are built simultaneously. A street scatter piece can land exactly where a ground cover piece just went.

3. **Interior cover doesn't know about rooftop cover.** `interiorCover` is generated entirely separately from `cover`. If two buildings share a tier (one at its top tier, the other at an interior tier), an interior piece and a rooftop piece could overlap on the same XZ footprint at the same height.

### Fix

Collect all placed cover pieces into a single shared list and pass it to every placement check. Specifically:

- In `generateGroundAndStreetCover`, pass `groundCover` into the overlap check for each new ground piece (check against the growing list, not just the rooftop `cover`).
- After `groundCover` is built, pass both `cover` and `groundCover` into the street scatter loop so scatter pieces avoid both.
- In `generate-cover.js`, generate interior cover after rooftop cover and pass the rooftop list in, so interior pieces are checked against rooftop pieces too.

The `overlapsAny` helper already handles Y distance checks, so no changes to that function are needed — it just needs to be given all the right lists.

---

## Problem 2 — Ladder Wall Clearance Not Working (Seed 41)

### What's happening

When a red or orange ladder reaches the top of a building wall, a doorway is meant to be carved in that wall so a player can step off the ladder onto the floor above. The current code in `carve-ladder-doorway.js` works like this:

1. Calculate `exitWallY` — the Y coordinate of the floor the ladder reaches, plus slab thickness.
2. Find walls whose `baseY` matches `exitWallY` (within half an inch).
3. Among those, find walls positioned flush with the face the ladder is against.
4. Carve a gap the width of the ladder.

The problem is that after `applyWallDamage` runs, each wall is split into individual quadrant-height segments. A wall of full tier height becomes two rows of segments:

- **Lower row:** `baseY = exitWallY`, height = `tierHeight / 2`
- **Upper row:** `baseY = exitWallY + tierHeight / 2`, height = `tierHeight / 2`

The current filter `Math.abs(wall.baseY - exitWallY) > 0.5` only matches lower-row segments. Upper-row segments have a `baseY` that is half a tier higher and fail the check. So the code finds and carves the lower half of the wall but leaves the upper half intact — the character still can't step through at head height.

On seed 41, this is visible at several red and orange ladders where the upper wall quadrant remains unclipped above the exit.

### Better approach

Instead of filtering walls by their `baseY` matching a specific Y exactly, check whether the wall **straddles the floor level the ladder reaches**. A wall segment blocks a ladder exit if:

- It is on the right axis and face (same position/axis checks as now).
- It overlaps the ladder's width in the long axis of the wall (same XZ overlap check as now).
- Its bottom (`baseY`) is **below** the top of the ladder's floor level, AND its top (`baseY + height`) is **above** the slab surface the ladder reaches.

In plain numbers: if the floor the ladder reaches is at `floorSurfaceY = exitTier * tierHeight + slabThickness`, then a wall segment blocks the exit if:

```
wall.baseY < floorSurfaceY + tierHeight   AND
wall.baseY + wall.height > floorSurfaceY
```

This catches both the lower and upper quadrant rows of any wall at that tier, without caring exactly which row they are. It also naturally ignores walls from a different tier.

Once a blocking segment is found, carve out the portion that overlaps the ladder's width, exactly as the current code does (split into left/right remnants). The gap only needs to be cut from `floorSurfaceY` upward to a player-passable height (one full tier height above the floor), so only segments in that Y range need carving — which is exactly what the new bounds check captures.

### Summary of the fix

Replace the single `baseY` equality check:
```
Math.abs(wall.baseY - exitWallY) > 0.5
```

With a bounds-range check that matches any wall segment overlapping the ladder's exit zone vertically:
```
wall.baseY < floorSurfaceY + tierHeight  AND
wall.baseY + wall.height > floorSurfaceY
```

Keep all other logic (axis, position flush, XZ overlap, remnant carving) the same.
