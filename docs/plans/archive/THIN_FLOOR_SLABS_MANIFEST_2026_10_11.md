# Thin Floor Slabs — Grepped File Manifest

Status: **Archived 2026-10-16** with `THIN_FLOOR_SLABS_PLAN_2026_10_11.md` (plan complete; shipped in v0.3.0, dev PR #39). Line numbers below are as of generation (2026-10-11) and are not kept current.

Companion to `THIN_FLOOR_SLABS_PLAN_2026_10_11.md`. Generated 2026-10-11 on branch `dev` from live greps (line numbers will drift; re-run the command under each heading before starting a phase). `_old_system/` is excluded throughout — it is dead code and is not touched.

Shorthand: `EX` = `--exclude-dir=_old_system`; scope is `src test`.

## A. Definitions (where the values live)

Regenerate: `grep -rnE 'tierHeight:|slabThickness:|wallThickness:|streetThickness|pavementThickness' src/config.js src/profiles src/tools/preview-building-main.js`

```
src/config.js:20:  tierHeight: 3,      // room height per tier (inches)
src/config.js:21:  slabThickness: 1,   // floor slab thickness (inches)
src/config.js:22:  // wallThickness: 0.25,  // _old_system: wall slab thickness
src/config.js:47:  wallThickness: 0.25,
src/config.js:183:  streetThickness:   0.25,   // street surface slab thickness
src/config.js:184:  pavementThickness: 0.25,   // pavement slab thickness
src/tools/preview-building-main.js:42:    tierHeight: 3,
src/tools/preview-building-main.js:43:    slabThickness: 0.5,
src/tools/preview-building-main.js:44:    wallThickness: 0.25,
```

## B. Inline levelHeight derivations (tierHeight + slabThickness) — collapse into one helper

Regenerate: `grep -rnE 'tierHeight \+ (config\.)?slabThickness|tierHeight \+ slab\b|tierHeight, slabThickness' src --include=*.js --exclude-dir=_old_system`

```
src/export/assign-primitive-tier.js:8: * where levelHeight = tierHeight + slabThickness. Floor indices run 0..config.tiers, so the
src/export/assign-primitive-tier.js:58:  const levelHeight = config.tierHeight + slab;
src/export/export-tiers.js:140:  const levelHeight = config.tierHeight + config.slabThickness;
src/generators/buildings/generateBuildings.js:32:  const levelHeight = tierHeight + config.slabThickness;
src/generators/collision/matrix.js:81:export function createCollisionMatrix(activeArea, maxTiers, tierHeight, slabThickness = 1) {
src/generators/collision/matrix.js:85:  const maxY = (maxTiers + 1) * (tierHeight + slabThickness); // +1 tier headroom (above-ground only)
src/generators/cover/index.js:51:  const levelHeight = config.tierHeight + config.slabThickness;
src/generators/floors/process-building-floors.js:9: * Produces one slab per tier, placed at Y = floorIndex * (tierHeight + slabThickness) - slabThickness.
src/generators/floors/process-building-floors.js:14:  const { tierHeight, slabThickness, damageLevel } = config;
src/generators/floors/process-building-floors.js:15:  const levelHeight = tierHeight + slabThickness;
src/generators/ladders/generate-ladders.js:90:function floorIndex(cy, tierHeight, slabThickness) {
src/generators/ladders/generate-ladders.js:91:  return Math.round((cy + slabThickness) / (tierHeight + slabThickness));
src/generators/ladders/generate-ladders.js:95:function slabY(tier, tierHeight, slabThickness) {
src/generators/ladders/generate-ladders.js:96:  return tier * (tierHeight + slabThickness) - slabThickness;
src/generators/ladders/generate-ladders.js:133:  const { tierHeight, slabThickness, mapWidth, mapDepth } = config;
src/generators/ladders/generate-ladders.js:155:        const tier = floorIndex(cy, tierHeight, slabThickness);
src/generators/ladders/generate-ladders.js:195:function cullFullHeight(startTier, endTier, rng, tierHeight, slabThickness) {
src/generators/ladders/generate-ladders.js:217:  const newBottomY = newStart === 0 ? 0 : slabY(newStart, tierHeight, slabThickness);
src/generators/ladders/generate-ladders.js:219:  const newTopY = slabY(newEnd - 1, tierHeight, slabThickness) + 1;
src/generators/ladders/generate-ladders.js:225:  const { tierHeight, slabThickness } = config;
src/generators/ladders/generate-ladders.js:248:    const lowestTier = floorIndex(lowestCy,  tierHeight, slabThickness);
src/generators/ladders/generate-ladders.js:249:    const highestTier= floorIndex(highestCy, tierHeight, slabThickness);
src/generators/ladders/generate-ladders.js:272:    const startTier = floorIndex(bottomCy, tierHeight, slabThickness);
src/generators/ladders/generate-ladders.js:479:  const { tierHeight, slabThickness } = config;
src/generators/ladders/generate-ladders.js:480:  const tierH = tierHeight + slabThickness;
src/generators/walls/extract-wall-segments.js:117:  const { tierHeight, slabThickness } = config;
src/generators/walls/extract-wall-segments.js:118:  const levelHeight = tierHeight + slabThickness;
src/preview/debug-recorder.js:55:    const { mapWidth, mapDepth, tiers, tierHeight, slabThickness } = config;
src/preview/debug-recorder.js:56:    return JSON.stringify({ seed, config: { mapWidth, mapDepth, tiers, tierHeight, slabThickness }, stages }, null, 2);
src/preview/debug-recorder.js:198:    const levelHeight = config.tierHeight + config.slabThickness;
```

## C. Floor/roof slab Y (yCollisionLevel producers and consumers)

Regenerate: `grep -rnE 'yCollisionLevel|i \* levelHeight' src test --include=*.js --exclude-dir=_old_system`

```
src/generators/connectivity/emit-anchors.js:75:    const cy = level.yCollisionLevel;
src/generators/connectivity/emit-anchors.js:143:    ...data.floors.map(f => f.yCollisionLevel),
src/generators/connectivity/emit-anchors.js:144:    ...data.roofs.map(r => r.yCollisionLevel),
src/generators/floors/index.js:28:          matrix.fillBox(rect.x, level.yCollisionLevel, rect.z, rect.w, slabThickness, rect.d, CELL.FLOOR);
src/generators/floors/label-floor-cells.js:19:  const yLevels = new Set(data.floors.map(f => f.yCollisionLevel));
src/generators/floors/label-floor-cells.js:25:    buildingIndexForLevel.set(data.floors[i].yCollisionLevel, data.floors[i].buildingIndex);
src/generators/floors/process-building-floors.js:56:    const yCollisionLevel = i * levelHeight - slabThickness;
src/generators/floors/process-building-floors.js:62:      yCollisionLevel,
src/generators/geometry/build-floor-primitives.js:9:    const y = floor.yCollisionLevel; // cellSize=1" so cell index = world Y in inches
src/generators/geometry/build-roof-primitives.js:23:    const ry = roof.yCollisionLevel;
src/generators/roofs/index.js:19:      matrix.fillBox(rect.x, slab.yCollisionLevel, rect.z, rect.w, slabThickness, rect.d, CELL.ROOF);
src/generators/roofs/index.js:24:      yCollisionLevel: slab.yCollisionLevel,
src/generators/roofs/label-roof-cells.js:16:  const yLevels = new Set(data.roofs.map(r => r.yCollisionLevel));
src/generators/roofs/label-roof-cells.js:20:    buildingIndexForLevel.set(data.roofs[i].yCollisionLevel, data.roofs[i].buildingIndex);
src/generators/walls/extract-wall-segments.js:123:  const yLevels = [...new Set(data.floors.map(f => f.yCollisionLevel))];
src/preview/debug-recorder.js:222:        box('floor', r.x, f.yCollisionLevel, r.z, r.w, config.slabThickness, r.d, color)
src/preview/debug-recorder.js:239:    rects: r.rects.map(rect => box('roof', rect.x, r.yCollisionLevel, rect.z, rect.w, config.slabThickness, rect.d, color)),
```

## D. Geometry thickness of slabs (config.slabThickness used as render height)

Regenerate: `grep -rnE 'config\.slabThickness|h: slab|slabH' src/generators/geometry src/preview src/export --include=*.js`

```
src/generators/geometry/build-building-footprint-primitives.js:2:  const slabH = config.slabThickness ?? 0.2;
src/generators/geometry/build-building-footprint-primitives.js:6:    x: b.x, y: 0, z: b.z, w: b.w, h: slabH, d: b.d,
src/generators/geometry/build-floor-primitives.js:17:        x: rect.x, y, z: rect.z, w: rect.w, h: config.slabThickness, d: rect.d,
src/generators/geometry/build-floor-primitives.js:29:        x: rect.x, y, z: rect.z, w: rect.w, h: config.slabThickness, d: rect.d,
src/generators/geometry/build-roof-primitives.js:31:        x: rs.x, y: ry, z: rs.z, w: rs.w, h: config.slabThickness, d: rs.d,
src/generators/geometry/build-roof-primitives.js:38:        x: rs.x, y: ry, z: rs.z, w: rs.w, h: config.slabThickness, d: rs.d,
src/generators/geometry/build-roof-primitives.js:44:        x: rs.x, y: ry, z: rs.z, w: rs.w, h: config.slabThickness, d: rs.d,
src/preview/debug-recorder.js:198:    const levelHeight = config.tierHeight + config.slabThickness;
src/preview/debug-recorder.js:203:      rects: [box('building', b.x, -config.slabThickness, b.z, b.w, h, b.d, color)],
src/preview/debug-recorder.js:222:        box('floor', r.x, f.yCollisionLevel, r.z, r.w, config.slabThickness, r.d, color)
src/preview/debug-recorder.js:239:    rects: r.rects.map(rect => box('roof', rect.x, r.yCollisionLevel, rect.z, rect.w, config.slabThickness, rect.d, color)),
src/export/assign-primitive-tier.js:57:  const slab = config.slabThickness;
src/export/export-tiers.js:140:  const levelHeight = config.tierHeight + config.slabThickness;
src/export/export-tiers.js:215:    slabThickness: config.slabThickness,
src/export/obj-geometry/build-obj-and-atlas.js:217:        addSharedFlat(state, prim.name, prim.x, prim.y, prim.z, prim.w, prim.h || config.slabThickness, prim.d, uv, true, false, false, fal
```

## E. Matrix writes that reserve the slab cell / shell height

Regenerate: `grep -rnE 'fillBox\(' src/generators/floors src/generators/roofs src/generators/buildings src/generators/streets src/pipeline.js src/generators/walls --include=*.js`

```
src/generators/floors/index.js:28:          matrix.fillBox(rect.x, level.yCollisionLevel, rect.z, rect.w, slabThickness, rect.d, CELL.FLOOR);
src/generators/roofs/index.js:19:      matrix.fillBox(rect.x, slab.yCollisionLevel, rect.z, rect.w, slabThickness, rect.d, CELL.ROOF);
src/generators/buildings/generateBuildings.js:36:    matrix.fillBox(b.x, -config.slabThickness, b.z, b.w, b.maxTier * levelHeight - config.tierHeight, b.d, CELL.SHELL);
src/generators/streets/write-river.js:11:    matrix.fillBox(x, -depth, z, w, 1, d, CELL.RIVER);
src/generators/streets/write-river.js:14:    matrix.fillBox(x, -config.slabThickness, z, w, config.slabThickness, d, CELL.EMPTY);
src/generators/streets/write-streets.js:8:    matrix.fillBox(x, -slabThickness, z, w, slabThickness, d, CELL.STREET);
src/pipeline.js:69:    matrix.fillBox(block.x, slabY, block.z, block.w, config.slabThickness, block.d, CELL.FOUNDATION_PLACEHOLDER);
src/pipeline.js:72:    matrix.fillBox(street.x, slabY, street.z, street.w, config.slabThickness, street.d, CELL.STREET_PLACEHOLDER);
src/generators/walls/extract-wall-segments.js:204:        matrix.fillBox(x, wallWorldY, z, w, tierHeight, d, intWallCell);
src/generators/walls/extract-wall-segments.js:246:            matrix.fillBox(x, wallWorldY, z, w, tierHeight, d, FACE_INT_WALL[face]);
src/generators/walls/index.js:87:        matrix.fillBox(seg.x, seg.y, seg.z, seg.w, seg.h, seg.d, WALL_CELL[wall.direction]);
```

## F. Wall height, rows and tier-gap probes (cy + levelHeight)

Regenerate: `grep -rnE 'h: tierHeight|tierHeight, d|cy \+ levelHeight|wallWorldY|wall\.h|Math\.round\(wall' src/generators/walls src/generators/geometry --include=*.js`

```
src/generators/walls/extract-wall-segments.js:129:    const wallWorldY = cy + slabThickness;
src/generators/walls/extract-wall-segments.js:138:          if (!isSlabCell(matrix.getCell(cx, cy + levelHeight, cz))) continue;
src/generators/walls/extract-wall-segments.js:184:        walls.push({ direction: dir, floorY: cy, x, y: wallWorldY, z, w, h: tierHeight, d });
src/generators/walls/extract-wall-segments.js:203:        internalWalls.push({ direction: dir, floorY: cy, x, y: wallWorldY, z, w, h: tierHeight, d });
src/generators/walls/extract-wall-segments.js:204:        matrix.fillBox(x, wallWorldY, z, w, tierHeight, d, intWallCell);
src/generators/walls/extract-wall-segments.js:211:    const wallWorldY = cy + slabThickness;
src/generators/walls/extract-wall-segments.js:218:        if (!isSlabCell(matrix.getCell(cx, cy + levelHeight, cz))) continue;
src/generators/walls/extract-wall-segments.js:245:            internalWalls.push({ direction: face, floorY: cy, x, y: wallWorldY, z, w, h: tierHeight, d });
src/generators/walls/extract-wall-segments.js:246:            matrix.fillBox(x, wallWorldY, z, w, tierHeight, d, FACE_INT_WALL[face]);
src/generators/walls/extract-wall-segments.js:248:            walls.push({ direction: face, floorY: cy, x, y: wallWorldY, z, w, h: tierHeight, d });
src/generators/walls/subdivide-wall.js:10:  const cols = Math.max(1, Math.round(wallLength));  // 1" columns (cellSize = 1)
src/generators/walls/subdivide-wall.js:11:  const rows = Math.max(1, Math.round(wall.h));       // 1" rows   (tierHeight = 3 → 3 rows)
src/generators/walls/subdivide-wall.js:13:  const rowHeight = wall.h    / rows;
src/generators/geometry/build-bridge-primitives.js:65:            x: wall.x, y: wall.y, z: wall.z, w: wall.w, h: wall.h, d: wall.d,
src/generators/geometry/build-wall-primitives.js:18:      x: wall.x, y: wall.y, z: wall.z, w: wall.w, h: wall.h, d: wall.d,
```

## G. Tier banding / floor-index maths (cy <-> tier)

Regenerate: `grep -rnE 'floorIndex\(|slabY\(|tierH\b|Math\.round\(\(cy|baseY \+ slab' src --include=*.js --exclude-dir=_old_system`

```
src/export/assign-primitive-tier.js:70:    return clampTier(Math.floor((baseY + slab + EPS) / levelHeight), maxTier);
src/export/assign-primitive-tier.js:78:  return clampTier(Math.floor((baseY + slab + EPS) / levelHeight), maxTier);
src/generators/cover/index.js:52:  return Math.round((cy + config.slabThickness) / levelHeight);
src/generators/ladders/generate-ladders.js:90:function floorIndex(cy, tierHeight, slabThickness) {
src/generators/ladders/generate-ladders.js:91:  return Math.round((cy + slabThickness) / (tierHeight + slabThickness));
src/generators/ladders/generate-ladders.js:95:function slabY(tier, tierHeight, slabThickness) {
src/generators/ladders/generate-ladders.js:155:        const tier = floorIndex(cy, tierHeight, slabThickness);
src/generators/ladders/generate-ladders.js:217:  const newBottomY = newStart === 0 ? 0 : slabY(newStart, tierHeight, slabThickness);
src/generators/ladders/generate-ladders.js:219:  const newTopY = slabY(newEnd - 1, tierHeight, slabThickness) + 1;
src/generators/ladders/generate-ladders.js:248:    const lowestTier = floorIndex(lowestCy,  tierHeight, slabThickness);
src/generators/ladders/generate-ladders.js:249:    const highestTier= floorIndex(highestCy, tierHeight, slabThickness);
src/generators/ladders/generate-ladders.js:272:    const startTier = floorIndex(bottomCy, tierHeight, slabThickness);
src/generators/ladders/generate-ladders.js:480:  const tierH = tierHeight + slabThickness;
src/generators/ladders/generate-ladders.js:532:        const keptBottomY    = Math.max(currentTier * tierH, picked.bottomY);
src/generators/ladders/generate-ladders.js:533:        const keptTopY       = Math.min(nextTier * tierH, picked.topY);
src/generators/ladders/generate-ladders.js:542:        const endFloor   = Math.round(keptTopY / tierH);
src/generators/ladders/generate-ladders.js:544:          const baseCy = floorIdx * tierH;
```

## H. Matrix sizing and below-ground assumptions

Regenerate: `grep -rnE 'maxY|BELOW_GROUND|createCollisionMatrix' src --include=*.js --exclude-dir=_old_system`

```
src/config.js:109:  riverDepth: 3,   // cells below Y=0 occupied by river volume (must be <= BELOW_GROUND)
src/export/collision-buffer.js:33:    const maxX = prim.x + prim.w, maxY = prim.y + prim.h, maxZ = prim.z + prim.d;
src/export/collision-buffer.js:42:    objLines.push(`v ${minX.toFixed(6)} ${maxY.toFixed(6)} ${minZ.toFixed(6)}`); // 4: -+-
src/export/collision-buffer.js:43:    objLines.push(`v ${maxX.toFixed(6)} ${maxY.toFixed(6)} ${minZ.toFixed(6)}`); // 5: ++-
src/export/collision-buffer.js:44:    objLines.push(`v ${maxX.toFixed(6)} ${maxY.toFixed(6)} ${maxZ.toFixed(6)}`); // 6: +++
src/export/collision-buffer.js:45:    objLines.push(`v ${minX.toFixed(6)} ${maxY.toFixed(6)} ${maxZ.toFixed(6)}`); // 7: -++
src/generators/collision/matrix.js:79:export const BELOW_GROUND = 12;
src/generators/collision/matrix.js:81:export function createCollisionMatrix(activeArea, maxTiers, tierHeight, slabThickness = 1) {
src/generators/collision/matrix.js:85:  const maxY = (maxTiers + 1) * (tierHeight + slabThickness); // +1 tier headroom (above-ground only)
src/generators/collision/matrix.js:86:  const totalY = maxY + BELOW_GROUND;
src/generators/collision/matrix.js:90:  // Flat Uint8Array, row-major: index = cx + cz * W + (cy + BELOW_GROUND) * W * D
src/generators/collision/matrix.js:102:    return cx >= 0 && cx < W && cy >= -BELOW_GROUND && cy < maxY && cz >= 0 && cz < D;
src/generators/collision/matrix.js:106:    return cx + cz * W + (cy + BELOW_GROUND) * W * D;
src/generators/collision/matrix.js:136:    W, D, maxY, ox, oz, cellSize,
src/generators/collision/matrix.js:212:      return { W, D, maxY, belowGround: BELOW_GROUND, ox, oz, cellSize, cells: Array.from(data) };
src/generators/connectivity/generate-pillars.js:1:import { CELL, STAGE, BELOW_GROUND } from '../collision/matrix.js';
src/generators/connectivity/generate-pillars.js:29:  for (let scanY = cy - 1; scanY >= -BELOW_GROUND; scanY--) {
src/generators/cover/index.js:189:  const { W, D, maxY, ox, oz, cellSize } = matrix;
src/generators/cover/index.js:208:  for (let cy = cyMin; cy < maxY; cy++) {
src/generators/ladders/generate-ladders.js:145:  for (let cy = 0; cy < matrix.maxY; cy++) {
src/index.js:12:import { BELOW_GROUND } from './generators/collision/matrix.js';
src/index.js:62:      historyOut.push({ cx, cy: cy_arr - BELOW_GROUND, cz, writes });
src/pipeline.js:16:import { createCollisionMatrix, CELL, STAGE } from './generators/collision/matrix.js';
src/pipeline.js:56:  const matrix = createCollisionMatrix(
```

## I. Export paths that read tier geometry (OBJ/GLB parity, split-tiers manifest)

Regenerate: `grep -rnE 'levelHeight|slabThickness|tierHeight' src/export --include=*.js`

```
src/export/assign-primitive-tier.js:7: * floor slab sits at y = i*levelHeight - slabThickness and its walls at y = i*levelHeight,
src/export/assign-primitive-tier.js:8: * where levelHeight = tierHeight + slabThickness. Floor indices run 0..config.tiers, so the
src/export/assign-primitive-tier.js:51: * @param {{ tiers: number, tierHeight: number, slabThickness: number }} config
src/export/assign-primitive-tier.js:57:  const slab = config.slabThickness;
src/export/assign-primitive-tier.js:58:  const levelHeight = config.tierHeight + slab;
src/export/assign-primitive-tier.js:70:    return clampTier(Math.floor((baseY + slab + EPS) / levelHeight), maxTier);
src/export/assign-primitive-tier.js:74:  // Walls are subdivided into 1"-tall rows that stack the full tierHeight above the floor (row r
src/export/assign-primitive-tier.js:75:  // at y = i*levelHeight + r, for r in 0..tierHeight-1), so a tier owns its floor AND all the wall
src/export/assign-primitive-tier.js:76:  // rows up to — but not including — the next floor: baseY in [i*levelHeight, (i+1)*levelHeight) → i.
src/export/assign-primitive-tier.js:77:  // Round-banding here wrongly pushed the upper wall rows (r >= levelHeight/2) into the tier above.
src/export/assign-primitive-tier.js:78:  return clampTier(Math.floor((baseY + slab + EPS) / levelHeight), maxTier);
src/export/export-tiers.js:140:  const levelHeight = config.tierHeight + config.slabThickness;
src/export/export-tiers.js:213:    levelHeight,
src/export/export-tiers.js:214:    tierHeight: config.tierHeight,
src/export/export-tiers.js:215:    slabThickness: config.slabThickness,
src/export/obj-geometry/build-obj-and-atlas.js:217:        addSharedFlat(state, prim.name, prim.x, prim.y, prim.z, prim.w, prim.h || config.slabThickness, prim.d, uv, true, false, false, fal
```

## J. Tests that pin current values (tierHeight 6 / slab 0.5 fixtures)

Regenerate: `grep -rnE 'tierHeight|slabThickness|yCollisionLevel|levelHeight' test`

```
test/floors.test.js:10:  tiers: 4, tierHeight: 6, slabThickness: 0.5, damageLevel: 0.5,
test/walls.test.js:11:  tiers: 4, tierHeight: 6, slabThickness: 0.5,
test/walls.test.js:47:    const maxH = baseConfig.tierHeight - baseConfig.slabThickness;
test/walls.test.js:81:        const baseY = tierBelow * baseConfig.tierHeight + baseConfig.slabThickness;
```

## K. Docs that state the formulas

Regenerate: `grep -rnE 'slabThickness|levelHeight|tierHeight|slabY' docs --include=*.md --exclude-dir=archive`

```
docs/architecture/collision_matrix.md:127:Formula: `slabY(floorIndex) = floorIndex * (tierHeight + slabThickness) - slabThickness`  
docs/architecture/collision_matrix.md:128:With defaults: `slabY(i) = i * 4 - 1`
docs/architecture/glossary.md:31:**Tier** — Vertical level index (0-based). World Y position of tier `t` = `t * tierHeight`.
docs/architecture/glossary.md:167:| `slabThickness` | Vertical thickness of floor/roof/platform slabs |
docs/architecture/glossary.md:175:| `tierHeight` | Vertical distance between tiers |
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:9:Regenerate: `grep -rnE 'tierHeight:|slabThickness:|wallThickness:|streetThickness|pavementThickness' src/config.js src/profiles src/tools
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:12:src/config.js:20:  tierHeight: 3,      // room height per tier (inches)
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:13:src/config.js:21:  slabThickness: 1,   // floor slab thickness (inches)
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:18:src/tools/preview-building-main.js:42:    tierHeight: 3,
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:19:src/tools/preview-building-main.js:43:    slabThickness: 0.5,
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:23:## B. Inline levelHeight derivations (tierHeight + slabThickness) — collapse into one helper
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:25:Regenerate: `grep -rnE 'tierHeight \+ (config\.)?slabThickness|tierHeight \+ slab\b|tierHeight, slabThickness' src --include=*.js --exclude-dir=_old_system`
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:28:src/export/assign-primitive-tier.js:8: * where levelHeight = tierHeight + slabThickness. Floor indices run 0..config.tiers, so the
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:29:src/export/assign-primitive-tier.js:58:  const levelHeight = config.tierHeight + slab;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:30:src/export/export-tiers.js:140:  const levelHeight = config.tierHeight + config.slabThickness;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:31:src/generators/buildings/generateBuildings.js:32:  const levelHeight = tierHeight + config.slabThickness;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:32:src/generators/collision/matrix.js:81:export function createCollisionMatrix(activeArea, maxTiers, tierHeight, slabThickness = 1) {
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:33:src/generators/collision/matrix.js:85:  const maxY = (maxTiers + 1) * (tierHeight + slabThickness); // +1 tier headroom (above-ground only)
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:34:src/generators/cover/index.js:51:  const levelHeight = config.tierHeight + config.slabThickness;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:35:src/generators/floors/process-building-floors.js:9: * Produces one slab per tier, placed at Y = floorIndex * (tierHeight + slabThickness) - slabThickness.
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:36:src/generators/floors/process-building-floors.js:14:  const { tierHeight, slabThickness, damageLevel } = config;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:37:src/generators/floors/process-building-floors.js:15:  const levelHeight = tierHeight + slabThickness;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:38:src/generators/ladders/generate-ladders.js:90:function floorIndex(cy, tierHeight, slabThickness) {
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:39:src/generators/ladders/generate-ladders.js:91:  return Math.round((cy + slabThickness) / (tierHeight + slabThickness));
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:40:src/generators/ladders/generate-ladders.js:95:function slabY(tier, tierHeight, slabThickness) {
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:41:src/generators/ladders/generate-ladders.js:96:  return tier * (tierHeight + slabThickness) - slabThickness;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:42:src/generators/ladders/generate-ladders.js:133:  const { tierHeight, slabThickness, mapWidth, mapDepth } = config;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:43:src/generators/ladders/generate-ladders.js:155:        const tier = floorIndex(cy, tierHeight, slabThickness);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:44:src/generators/ladders/generate-ladders.js:195:function cullFullHeight(startTier, endTier, rng, tierHeight, slabThickness) {
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:45:src/generators/ladders/generate-ladders.js:217:  const newBottomY = newStart === 0 ? 0 : slabY(newStart, tierHeight, slabThickness);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:46:src/generators/ladders/generate-ladders.js:219:  const newTopY = slabY(newEnd - 1, tierHeight, slabThickness) + 1;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:47:src/generators/ladders/generate-ladders.js:225:  const { tierHeight, slabThickness } = config;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:48:src/generators/ladders/generate-ladders.js:248:    const lowestTier = floorIndex(lowestCy,  tierHeight, slabThickness);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:49:src/generators/ladders/generate-ladders.js:249:    const highestTier= floorIndex(highestCy, tierHeight, slabThickness);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:50:src/generators/ladders/generate-ladders.js:272:    const startTier = floorIndex(bottomCy, tierHeight, slabThickness);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:51:src/generators/ladders/generate-ladders.js:479:  const { tierHeight, slabThickness } = config;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:52:src/generators/ladders/generate-ladders.js:480:  const tierH = tierHeight + slabThickness;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:53:src/generators/walls/extract-wall-segments.js:117:  const { tierHeight, slabThickness } = config;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:54:src/generators/walls/extract-wall-segments.js:118:  const levelHeight = tierHeight + slabThickness;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:55:src/preview/debug-recorder.js:55:    const { mapWidth, mapDepth, tiers, tierHeight, slabThickness } = config;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:56:src/preview/debug-recorder.js:56:    return JSON.stringify({ seed, config: { mapWidth, mapDepth, tiers, tierHeight, slabThickness }, stages }, null, 2);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:57:src/preview/debug-recorder.js:198:    const levelHeight = config.tierHeight + config.slabThickness;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:62:Regenerate: `grep -rnE 'yCollisionLevel|i \* levelHeight' src test --include=*.js --exclude-dir=_old_system`
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:68:src/generators/floors/index.js:28:          matrix.fillBox(rect.x, level.yCollisionLevel, rect.z, rect.w, slabThickness, rect.d, CELL.FL
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:71:src/generators/floors/process-building-floors.js:56:    const yCollisionLevel = i * levelHeight - slabThickness;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:75:src/generators/roofs/index.js:19:      matrix.fillBox(rect.x, slab.yCollisionLevel, rect.z, rect.w, slabThickness, rect.d, CELL.ROOF);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:80:src/preview/debug-recorder.js:222:        box('floor', r.x, f.yCollisionLevel, r.z, r.w, config.slabThickness, r.d, color)
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:81:src/preview/debug-recorder.js:239:    rects: r.rects.map(rect => box('roof', rect.x, r.yCollisionLevel, rect.z, rect.w, config.slabThickness, rect.d, color)),
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:84:## D. Geometry thickness of slabs (config.slabThickness used as render height)
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:86:Regenerate: `grep -rnE 'config\.slabThickness|h: slab|slabH' src/generators/geometry src/preview src/export --include=*.js`
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:89:src/generators/geometry/build-building-footprint-primitives.js:2:  const slabH = config.slabThickness ?? 0.2;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:91:src/generators/geometry/build-floor-primitives.js:17:        x: rect.x, y, z: rect.z, w: rect.w, h: config.slabThickness, d: rect.d,
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:92:src/generators/geometry/build-floor-primitives.js:29:        x: rect.x, y, z: rect.z, w: rect.w, h: config.slabThickness, d: rect.d,
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:93:src/generators/geometry/build-roof-primitives.js:31:        x: rs.x, y: ry, z: rs.z, w: rs.w, h: config.slabThickness, d: rs.d,
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:94:src/generators/geometry/build-roof-primitives.js:38:        x: rs.x, y: ry, z: rs.z, w: rs.w, h: config.slabThickness, d: rs.d,
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:95:src/generators/geometry/build-roof-primitives.js:44:        x: rs.x, y: ry, z: rs.z, w: rs.w, h: config.slabThickness, d: rs.d,
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:96:src/preview/debug-recorder.js:198:    const levelHeight = config.tierHeight + config.slabThickness;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:97:src/preview/debug-recorder.js:203:      rects: [box('building', b.x, -config.slabThickness, b.z, b.w, h, b.d, color)],
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:98:src/preview/debug-recorder.js:222:        box('floor', r.x, f.yCollisionLevel, r.z, r.w, config.slabThickness, r.d, color)
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:99:src/preview/debug-recorder.js:239:    rects: r.rects.map(rect => box('roof', rect.x, r.yCollisionLevel, rect.z, rect.w, config.slabThickness, rect.d, color)),
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:100:src/export/assign-primitive-tier.js:57:  const slab = config.slabThickness;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:101:src/export/export-tiers.js:140:  const levelHeight = config.tierHeight + config.slabThickness;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:102:src/export/export-tiers.js:215:    slabThickness: config.slabThickness,
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:103:src/export/obj-geometry/build-obj-and-atlas.js:217:        addSharedFlat(state, prim.name, prim.x, prim.y, prim.z, prim.w, prim.h || config.slabThickness, prim.d, uv, true, false, false, fal
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:111:src/generators/floors/index.js:28:          matrix.fillBox(rect.x, level.yCollisionLevel, rect.z, rect.w, slabThickness, rect.d, CELL.FLOOR);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:112:src/generators/roofs/index.js:19:      matrix.fillBox(rect.x, slab.yCollisionLevel, rect.z, rect.w, slabThickness, rect.d, CELL.ROOF);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:113:src/generators/buildings/generateBuildings.js:36:    matrix.fillBox(b.x, -config.slabThickness, b.z, b.w, b.maxTier * levelHeight - config.tierHeight, b.d, CELL.SHELL);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:115:src/generators/streets/write-river.js:14:    matrix.fillBox(x, -config.slabThickness, z, w, config.slabThickness, d, CELL.EMPTY);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:116:src/generators/streets/write-streets.js:8:    matrix.fillBox(x, -slabThickness, z, w, slabThickness, d, CELL.STREET);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:117:src/pipeline.js:69:    matrix.fillBox(block.x, slabY, block.z, block.w, config.slabThickness, block.d, CELL.FOUNDATION_PLACEHOLDER);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:118:src/pipeline.js:72:    matrix.fillBox(street.x, slabY, street.z, street.w, config.slabThickness, street.d, CELL.STREET_PLACEHOLDER);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:119:src/generators/walls/extract-wall-segments.js:204:        matrix.fillBox(x, wallWorldY, z, w, tierHeight, d, intWallCell);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:120:src/generators/walls/extract-wall-segments.js:246:            matrix.fillBox(x, wallWorldY, z, w, tierHeight, d, FACE_INT_WALL[face]);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:124:## F. Wall height, rows and tier-gap probes (cy + levelHeight)
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:126:Regenerate: `grep -rnE 'h: tierHeight|tierHeight, d|cy \+ levelHeight|wallWorldY|wall\.h|Math\.round\(wall' src/generators/walls src/generators/geometry --include=*.js`
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:129:src/generators/walls/extract-wall-segments.js:129:    const wallWorldY = cy + slabThickness;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:130:src/generators/walls/extract-wall-segments.js:138:          if (!isSlabCell(matrix.getCell(cx, cy + levelHeight, cz))) continue;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:131:src/generators/walls/extract-wall-segments.js:184:        walls.push({ direction: dir, floorY: cy, x, y: wallWorldY, z, w, h: tierHeight, d });
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:132:src/generators/walls/extract-wall-segments.js:203:        internalWalls.push({ direction: dir, floorY: cy, x, y: wallWorldY, z, w, h: tierHeight, d });
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:133:src/generators/walls/extract-wall-segments.js:204:        matrix.fillBox(x, wallWorldY, z, w, tierHeight, d, intWallCell);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:134:src/generators/walls/extract-wall-segments.js:211:    const wallWorldY = cy + slabThickness;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:135:src/generators/walls/extract-wall-segments.js:218:        if (!isSlabCell(matrix.getCell(cx, cy + levelHeight, cz))) continue;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:136:src/generators/walls/extract-wall-segments.js:245:            internalWalls.push({ direction: face, floorY: cy, x, y: wallWorldY, z, w, h: tierHeight, d });
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:137:src/generators/walls/extract-wall-segments.js:246:            matrix.fillBox(x, wallWorldY, z, w, tierHeight, d, FACE_INT_WALL[face]);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:138:src/generators/walls/extract-wall-segments.js:248:            walls.push({ direction: face, floorY: cy, x, y: wallWorldY, z, w, h: tierHeight, d });
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:140:src/generators/walls/subdivide-wall.js:11:  const rows = Math.max(1, Math.round(wall.h));       // 1" rows   (tierHeight = 3 → 3 rows)
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:148:Regenerate: `grep -rnE 'floorIndex\(|slabY\(|tierH\b|Math\.round\(\(cy|baseY \+ slab' src --include=*.js --exclude-dir=_old_system`
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:151:src/export/assign-primitive-tier.js:70:    return clampTier(Math.floor((baseY + slab + EPS) / levelHeight), maxTier);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:152:src/export/assign-primitive-tier.js:78:  return clampTier(Math.floor((baseY + slab + EPS) / levelHeight), maxTier);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:153:src/generators/cover/index.js:52:  return Math.round((cy + config.slabThickness) / levelHeight);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:154:src/generators/ladders/generate-ladders.js:90:function floorIndex(cy, tierHeight, slabThickness) {
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:155:src/generators/ladders/generate-ladders.js:91:  return Math.round((cy + slabThickness) / (tierHeight + slabThickness));
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:156:src/generators/ladders/generate-ladders.js:95:function slabY(tier, tierHeight, slabThickness) {
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:157:src/generators/ladders/generate-ladders.js:155:        const tier = floorIndex(cy, tierHeight, slabThickness);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:158:src/generators/ladders/generate-ladders.js:217:  const newBottomY = newStart === 0 ? 0 : slabY(newStart, tierHeight, slabThickness);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:159:src/generators/ladders/generate-ladders.js:219:  const newTopY = slabY(newEnd - 1, tierHeight, slabThickness) + 1;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:160:src/generators/ladders/generate-ladders.js:248:    const lowestTier = floorIndex(lowestCy,  tierHeight, slabThickness);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:161:src/generators/ladders/generate-ladders.js:249:    const highestTier= floorIndex(highestCy, tierHeight, slabThickness);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:162:src/generators/ladders/generate-ladders.js:272:    const startTier = floorIndex(bottomCy, tierHeight, slabThickness);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:163:src/generators/ladders/generate-ladders.js:480:  const tierH = tierHeight + slabThickness;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:182:src/generators/collision/matrix.js:81:export function createCollisionMatrix(activeArea, maxTiers, tierHeight, slabThickness = 1) {
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:183:src/generators/collision/matrix.js:85:  const maxY = (maxTiers + 1) * (tierHeight + slabThickness); // +1 tier headroom (above-ground only)
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:203:Regenerate: `grep -rnE 'levelHeight|slabThickness|tierHeight' src/export --include=*.js`
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:206:src/export/assign-primitive-tier.js:7: * floor slab sits at y = i*levelHeight - slabThickness and its walls at y = i*levelHeight,
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:207:src/export/assign-primitive-tier.js:8: * where levelHeight = tierHeight + slabThickness. Floor indices run 0..config.tiers, so the
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:208:src/export/assign-primitive-tier.js:51: * @param {{ tiers: number, tierHeight: number, slabThickness: number }} config
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:209:src/export/assign-primitive-tier.js:57:  const slab = config.slabThickness;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:210:src/export/assign-primitive-tier.js:58:  const levelHeight = config.tierHeight + slab;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:211:src/export/assign-primitive-tier.js:70:    return clampTier(Math.floor((baseY + slab + EPS) / levelHeight), maxTier);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:212:src/export/assign-primitive-tier.js:74:  // Walls are subdivided into 1"-tall rows that stack the full tierHeight above the floor (row r
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:213:src/export/assign-primitive-tier.js:75:  // at y = i*levelHeight + r, for r in 0..tierHeight-1), so a tier owns its floor AND all the wall
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:214:src/export/assign-primitive-tier.js:76:  // rows up to — but not including — the next floor: baseY in [i*levelHeight, (i+1)*levelHeight) → i.
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:215:src/export/assign-primitive-tier.js:77:  // Round-banding here wrongly pushed the upper wall rows (r >= levelHeight/2) into the tier above.
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:216:src/export/assign-primitive-tier.js:78:  return clampTier(Math.floor((baseY + slab + EPS) / levelHeight), maxTier);
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:217:src/export/export-tiers.js:140:  const levelHeight = config.tierHeight + config.slabThickness;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:218:src/export/export-tiers.js:213:    levelHeight,
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:219:src/export/export-tiers.js:214:    tierHeight: config.tierHeight,
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:220:src/export/export-tiers.js:215:    slabThickness: config.slabThickness,
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:221:src/export/obj-geometry/build-obj-and-atlas.js:217:        addSharedFlat(state, prim.name, prim.x, prim.y, prim.z, prim.w, prim.h || config.slabThickness, prim.d, uv, true, false, false, fal
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:229:test/floors.test.js:10:  tiers: 4, tierHeight: 6, slabThickness: 0.5, damageLevel: 0.5,
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:230:test/walls.test.js:11:  tiers: 4, tierHeight: 6, slabThickness: 0.5,
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:231:test/walls.test.js:47:    const maxH = baseConfig.tierHeight - baseConfig.slabThickness;
docs/plans/THIN_FLOOR_SLABS_MANIFEST_2026_10_11.md:232:test/walls.test.js:81:        const baseY = tierBelow * baseConfig.tierHeight + baseConfig.slabThickness;
docs/processes/pipeline-flows/1-grid.md:32:5. Create the collision matrix from `activeArea`, `config.tiers`, `config.tierHeight`, `config.slabThickness`.
docs/processes/pipeline-flows/1-grid.md:33:6. Write ground-slab placeholders into the matrix at `Y = -slabThickness`:
docs/processes/pipeline-flows/11-scene-and-export.md:84:4. **Everything else** (walls, roofs, rooftop cover) → **floor-banded** to the floor at or below `baseY` (`floor((baseY + slabThickness) / levelHeight)`), with `levelHeight` = `tierHeight + slabThickness`.
docs/processes/pipeline-flows/11-scene-and-export.md:93:| Manifest | `<baseName>_tiers.json` — `{ version, seed, tierCount, levelHeight, tierHeight, slabThickness, units, tiers: [{ tier, o
docs/processes/pipeline-flows/11-scene-and-export.md:97:`levelHeight` in the manifest is the vertical distance between stacked tier floors — the elevator lift delta a TTS script applies.
docs/processes/pipeline-flows/2-buildings.md:19:  tierHeight: number,
docs/processes/pipeline-flows/2-buildings.md:20:  slabThickness: number,
docs/processes/pipeline-flows/2-buildings.md:34:   - `matrix.fillBox(b.x, -slabThickness, b.z, b.w, b.maxTier * levelHeight - tierHeight, b.d, CELL.SHELL)`
docs/processes/pipeline-flows/2-buildings.md:35:   - Shells start at `Y = -slabThickness` so walls can begin at `Y = 0`.
docs/processes/pipeline-flows/2-buildings.md:63:- Shell height is `maxTier * levelHeight - tierHeight` — this stops the shell below the roof slab, which is written by the Roofs stage.
docs/processes/pipeline-flows/3-floors.md:17:  tierHeight: number,
docs/processes/pipeline-flows/3-floors.md:18:  slabThickness: number,
docs/processes/pipeline-flows/3-floors.md:41:4. Compute `yCollisionLevel = i * (tierHeight + slabThickness) - slabThickness`.
docs/processes/pipeline-flows/3-floors.md:45:- Interior floors only: `matrix.setWriteContext(STAGE.FLOORS, floors.length)` then `matrix.fillBox(rect.x, yCollisionLevel, rect.z, rect.w, slabThickness, rect.d, CELL.FLOOR)`.
docs/processes/pipeline-flows/4-roofs.md:17:  slabThickness: number,
docs/processes/pipeline-flows/4-roofs.md:26:   - Write each rect: `matrix.fillBox(rect.x, slab.yCollisionLevel, rect.z, rect.w, slabThickness, rect.d, CELL.ROOF)`.
docs/processes/pipeline-flows/5-streets.md:19:  slabThickness: number,
docs/processes/pipeline-flows/5-streets.md:60:- Clear `CELL.STREET_PLACEHOLDER` at `Y = -slabThickness` → `CELL.EMPTY` so Connectivity anchor ray-casts are not blocked
docs/processes/pipeline-flows/5-streets.md:70:Non-river street rects → `CELL.STREET` at `Y = -slabThickness`, replacing `CELL.STREET_PLACEHOLDER`.
docs/processes/pipeline-flows/5-streets.md:74:For each foundation block, scan every `(cx, cz)` at `cy = 0`. Cells that are not `CELL.SHELL` get `CELL.PAVEMENT` at `Y = -slabThickness`. Written as a ground-layer placeholder pattern.
docs/processes/pipeline-flows/5-streets.md:107:- Must run **before** Connectivity (Stage 6) — `CELL.RIVER` must be in the matrix before anchor ray-casts fire. River corridors at `cy = -slabThickness` (ground layer).
docs/processes/pipeline-flows/6-connectivity.md:68:- `cy = Math.floor(-slabThickness / cellSize)` — matches tier-0 floor anchors so walkways sit flush with ground
docs/processes/pipeline-flows/6-connectivity.md:186:- River crossing anchors emit at `cy = -slabThickness` to match tier-0 floor anchors — `CELL.STREET_PLACEHOLDER` is cleared from river rects
docs/processes/pipeline-flows/7-ladders.md:19:  tierHeight: number,
docs/processes/pipeline-flows/7-ladders.md:20:  slabThickness: number,
docs/processes/pipeline-flows/8-walls.md:19:  tierHeight: number,
docs/processes/pipeline-flows/8-walls.md:20:  slabThickness: number,
docs/processes/pipeline-flows/8-walls.md:32:Reads the matrix and the `floors[]` data to derive raw wall candidates. For each floor slab's exposed-edge cells (labelled `FLOOR_N/S/E/W` etc.), 
docs/processes/pipeline-flows/9-cover.md:18:  slabThickness: number,        // used to derive cyMin for ground-floor scan
docs/processes/pipeline-flows/9-cover.md:19:  tierHeight: number,           // used to map cy back to tier index
docs/processes/pipeline-flows/9-cover.md:29:Iterates every cell from `cy = -ceil(slabThickness)` (ground floor) to `cy < maxY`:
docs/processes/pipeline-flows/9-cover.md:40:- **Shells** (`rawFloor`): each cell is mapped to `{ buildingIndex, tier }`. `buildingIndex` = first building whose world footprint contains the c
docs/processes/pipeline-flows/9-cover.md:101:- Ground floor cells are at `cy = -slabThickness` (negative world Y). The scan starts at `cyMin = -ceil(slabThickness / cellSize)` so they are in
docs/reports/CODE_AUDIT.md:244:### 6.5 `0 * tierHeight` -- `connectivity.js` line 388
docs/reports/CODE_AUDIT.md:247:const groundWallY = 0 * tierHeight + slabThickness;
docs/reports/CODE_AUDIT.md:249:The `0 *` multiplication is unnecessary. Should simply be `slabThickness`.
```

## L. Hardcoded literals worth checking (possible baked-in 4" pitch)

Regenerate: `grep -rnE '\* ?4\b|/ ?4\b|\b4 ?\*' src/generators src/export src/preview --include=*.js --exclude-dir=_old_system`

```
src/generators/buildings/building-sizes.js:3:const BBD = GLOBAL_GRID.bbd;   // 4 inches
src/generators/connectivity/rasterise-connections.js:169:  // 4. Build segments
src/generators/generate-textures.js:20:      const idx = (y * TEX_SIZE + x) * 4;
src/generators/scene/buildTexturePools.js:38:            totalAlpha += png.data[i * 4 + 3];
src/export/assign-primitive-tier.js:73:  // 4. Everything else (walls, roofs, rooftop cover) → floor-band to the floor at or below it.
src/export/collision-buffer.js:42:    objLines.push(`v ${minX.toFixed(6)} ${maxY.toFixed(6)} ${minZ.toFixed(6)}`); // 4: -+-
src/export/export-tiers.js:71:    lines.push(`v ${f(x0)} ${f(y1)} ${f(z0)}`); // 4 -+-
src/export/export-tiers.js:183:    // 4 visible corner posts at the map footprint corners (this tier's height). Emitted into BOTH the
src/export/obj-geometry/build-atlas-image.js:16:  for (let i = 0; i < atlasSize * atlasSize; i++) atlas.data[i * 4 + 3] = 255;
src/export/obj-geometry/build-atlas-image.js:26:        const si = (sy * src.width + sx) * 4;
src/export/obj-geometry/build-atlas-image.js:30:        const di = (dy * atlasSize + dx) * 4;
```
