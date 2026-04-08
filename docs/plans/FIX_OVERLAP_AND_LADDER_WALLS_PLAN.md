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

### Why the current approach fails

After `applyWallDamage` runs, every full-height wall is split into individual quadrant-height segments — a lower row and an upper row, each with its own `baseY`. The current code in `carve-ladder-doorway.js` searches for walls by matching `wall.baseY` against a single computed Y value (`exitTier * tierHeight + slabThickness`). That value only matches the lower-row segments. Upper-row segments sit half a tier higher and slip through the filter untouched. The doorway gets carved in the bottom half of the wall but the top half remains, still blocking the exit.

Every time you try to pin down a wall segment by calculating an exact Y from floor offsets and slab thickness, a rounding edge or row offset breaks it. The approach needs to work from structural facts instead.

### New approach — work from the ladder outward

The ladder already knows everything needed to identify the blocking wall segments. No Y offset arithmetic required.

**Step 1 — Derive the exit tier from the ladder's top height**

`exitTier = Math.round(ladder.y1 / tierHeight)`

This gives the floor number the ladder reaches.

**Step 2 — Collect walls at that tier (w[])**

A wall segment belongs to tier F if its baseY falls within that tier's band:

`Math.floor(wall.baseY / tierHeight) === exitTier`

This is a simple integer comparison — no slab offset, no tolerance. It catches both the lower-row and upper-row segments at that tier because both have a baseY inside the same `tierHeight`-wide band.

**Step 3 — Filter to the exit face (rw[])**

From w[], keep only walls that are:
- On the correct axis (`x` for north/south ladders, `z` for east/west ladders) — derived from `platformDir` as before.
- Flush with the face the ladder is against — same position check as the current code (the wall's near or far edge sits at the same coordinate as the ladder's inner edge).

**Step 4 — Filter to walls whose extent overlaps the ladder's width (rw)**

For an x-axis wall, the wall spans from `wall.x` to `wall.x + wall.length`. The ladder spans from `ladder.x` to `ladder.x + ladder.w`. Keep walls where those ranges overlap:

`wall.x < ladder.x + ladder.w  AND  wall.x + wall.length > ladder.x`

For a z-axis wall, swap x/w for z/d.

**Step 5 — Delete all overlapping quadrant segments (qrw[])**

Each segment that passed all the filters above is a wall quadrant that sits in front of the ladder exit. Delete them all from the walls array — no carving, no remnants. The segments outside the ladder's width were already filtered out in step 4 and survive untouched.

This naturally clears both the lower and upper quadrant rows because both pass the tier check in step 2 and the width overlap check in step 4. No Y coordinate arithmetic beyond the single integer tier derivation in step 1.
