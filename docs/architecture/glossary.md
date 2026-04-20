# Glossary

Terminology used across the `src/generators` pipeline.

---

## Core Data Types

**Primitive** — Renderer-agnostic geometry descriptor output by `buildGeometry()`. Each primitive has a `name` (type), position (`x`, `y`, `z`), dimensions (`w`, `h`, `d`), a `textureKey`, and rendering flags. Types: `slab`, `wall`, `quad`, `ceiling`, `edges`, `ladder`.

**Slab** — Primitive for a flat rectangular box with top/bottom faces. Flags: `emitTop`, `emitBottom`, `simpleBottom`, `rotateUV`.

**Wall** — Primitive for a directional structural boundary. Has an `axis` (`'x'` or `'z'`) indicating orientation.

**Quad** — Primitive for a 3-vertex face; used for pyramid roof triangles.

**Ceiling** — Primitive for an underside face with downward-pointing normals.

**Edges** — Primitive for edge geometry; may include `edgeGaps` defining uncovered intervals along each side.

**Ladder (primitive)** — Primitive describing a vertical climbing structure. Has `isThinX` (width < depth) and `wallOffsetDir` (offset direction from adjacent wall).

---

## Coordinate System

**Axes** — X (east–west), Z (north–south), Y (up). Horizontal layout lives on the X–Z plane.

**Cell** — Grid unit of the collision matrix. 1 cell = 1 inch in world space.

**Tier** — Vertical level index (0-based). World Y position of tier `t` = `t * tierHeight`.

**World Position** — Absolute `(x, z)` coordinates in global space.

**Direction** — Cardinal: `N`, `S`, `E`, `W`. Walls running along X are N/S-facing; walls running along Z are E/W-facing.

**Margin** — Small tolerance value (0.1–0.25) used in gap detection and adjacency checks.

---

## Buildings & Floors

**Building** — Top-level structure with `x`, `z`, `w`, `d`, `size` (`'small'` | `'medium'` | `'large'`), `buildingIndex`, and `textureGroup`.

**Building Footprint** — Primitive representing the base outline of a building.

**Floor / Section** — Rectangular area (`x`, `z`, `w`, `d`) with `floorIndex` and `buildingIndex`. Contains a `rects` array of sub-rectangular subdivisions.

**Roof** — Top surface of a building. `type`: `'flat'` (single slab) or `'pyramid'` (four triangles meeting at an apex).

**Deleted Footprint / Courtyard** — A removed building footprint rendered as a ground-level slab with courtyard texture.

---

## Connectivity

**Anchor** — Directional spawn point on a floor or roof edge. Properties: `direction` (N/S/E/W), `cells` (2-cell refs), `tier`, world-space rect (`x`, `y`, `z`, `w`, `d`).

**Walkway** — Horizontal connector between buildings or platforms. Properties: `textureId`, `branch` (child link), `blocked` flag.

**Bridge** — Wide horizontal connector with a slab, side walls, and optional battlements. Properties: `axis`, `y`, `variant` (`'battlement'`), `textureId`, `branch` flag.

**Branch** — Child walkway or bridge that links to a parent structure via matching `textureId`; shares the parent's texture.

**Ladder (connector)** — Vertical connector with footprint (`x`, `z`, `w`, `d`) and vertical extent (`y0` base, `y1` top). Types: `yellow` (standard), `ground` (ground-to-first), `orange` (inter-building), `interior` (inside buildings).

**Pillar** — Vertical support beneath a bridge or walkway. References parent via `textureId`. Has `isBridge` flag.

**Ladder Platform** — Small landing connecting a ladder to a walkway. References `ladderIndex`.

**Junction Platform** — Platform at a ladder/walkway intersection.

**conn / connections** — Pipeline object containing arrays of all connectivity elements: `anchors`, `walkways`, `bridges`, `pillars`, `ladders`, `groundLadders`, `orangeLadders`, `interiorLadders`, `ladderPlatforms`, `junctionPlatforms`.

---

## Walls & Segments

**Gap** — Uncovered interval `{start, end}` along an edge; used for branch-crossing detection.

**Edge Gaps** — Per-section map `{north, south, west, east}` of gap arrays for uncovered edge spans.

**Branch Gap** — Gap created where a branch walkway or ladder crosses a bridge wall (calculated with margin tolerance).

**Wall Segment** — Surviving span of wall between gaps: `{start, end}` in wall-axis coordinates.

---

## Battlements

**Battlement** — Crenellated wall variant with alternating solid pillars and open gaps, placed on bridge tops.

**Battlement Height (`battH`)** — Vertical extent of battlements above the base wall.

**Battlement Spacing** — Distance between pillar centres.

**Pillar Width** — Width of a single battlement pillar = spacing − gap width.

---

## Ladder Geometry

**Pole** — Vertical support member of a ladder. Cross-section: `ladderPoleWidth` × `ladderPoleDepth`.

**Rung** — Horizontal step. `ladderRungSpacing` = vertical gap between rungs; `ladderRungHeight` / `ladderRungDepth` = rung dimensions; `ladderRungInset` = inset from pole centrelines.

**halfSpread** — `(ladderWidth / 2) − (ladderPoleWidth / 2) − ladderRungInset`. Half the distance between pole centrelines.

**isThinX** — Boolean: ladder `w < d`, indicating thin orientation along X.

**wallOffsetDir** — `+1` or `−1`; direction of ladder offset from nearest adjacent wall (used in OBJ flat export).

---

## Textures & Materials

**Texture Key** — String `"category:index"` or `"category:subcategory:index"` identifying a material slot (e.g. `"wall:landmark:0"`, `"floor:building:2"`).

**Texture Group (`textureGroup`)** — Index shared by composite building parts so they use matching textures. Resolved via `getTexGroup()`.

**Texture Pools** — Categorised collections of loaded material objects. Categories: `walls`, `landmark_walls`, `floors`, `objects`, `ladders`, `walkways`, `courtyards`, `base_map`, `roofs`, `domes`.

**Texture Categories:**
| Category | Examples |
|---|---|
| `walls` | brown, grey_brown, reddish, tan |
| `landmark_walls` | dark_stone, slate, charcoal, umber |
| `floors` | dark_oak, aged_pine, walnut, chestnut |
| `ladders` | dark_wood, medium_wood, aged_wood, warm_wood |
| `walkways` | dark_plank, light_plank, worn_plank |
| `courtyards` | grey_flag, warm_flag, dark_flag |
| `base_map` | stone, mud, rubble |
| `roofs` | dark_red, clay_red, dark_brown |
| `domes` | rusty_red, dark_rust, oxidised_copper, dark_bronze |
| `objects` | pine_crate, pale_crate, stone_block variants |

---

## Rendering Flags

| Flag | Meaning |
|---|---|
| `emitTop` | Render top face |
| `emitBottom` | Render bottom face |
| `simpleBottom` | Simplified bottom shading (perf) |
| `rotateUV` | Rotate UV 90° (used when `w > d`) |
| `shared` | Material is shared/instanced across primitives |
| `thinAxis` | Axis (`'x'`/`'z'`) along which wall/battlement is thin |

---

## Cover & Scatter

**Cover** — Tactical/decorative object (crate, barrel) on ground level. Properties: `x`, `y`, `z`, `w`, `height`, `d`.

**Interior Cover** — Cover item placed inside building floors.

**Street Scatter** — Loose objects scattered in courtyards and streets.

---

## Key Constants

| Constant | Description |
|---|---|
| `TEX_SIZE` | Texture resolution (32 px) |
| `slabThickness` | Vertical thickness of floor/roof/platform slabs |
| `walkwayThickness` | Vertical thickness of walkway primitives |
| `platformThickness` | Vertical thickness of ladder/junction platforms |
| `wallHeight (wallH)` | Height of bridge side walls |
| `wallThickness (wallT)` | Thickness of bridge walls perpendicular to axis |
| `bridgeThickness` | Vertical thickness of bridge slab |
| `courtyardY` | Fixed Y for deleted-footprint slabs |
| `anchorPeriod` | Anchor emission interval (typically 4 cells) |
| `tierHeight` | Vertical distance between tiers |

---

## Pipeline Functions

**`buildGeometry(coverData)`** — Converts pipeline data into a `{version: 1, primitives[]}` object.

**`buildScene(primitives, texturePools, config)`** — Converts primitives into a Three.js scene.

**`buildTexturePools(packName)`** — Loads PNG texture pack from `assets/textures/{packName}`; returns pools object.

**`pickFromPool(pool, index)`** — Deterministic material selection: `pool[Math.abs(index) % pool.length]`.

**`getEdgeGaps(section, side, allSections)`** — Returns gaps along a section edge where no adjacent section provides coverage.

**`emitWallSegments()`** — Splits a bridge wall into primitives and segments; detects branch gaps; returns surviving segments for battlement placement.

**`splitWallSegments(wallStart, wallEnd, gaps)`** — Splits a continuous wall span into `[{start, end}]` segments, discarding spans shorter than 0.1 unit.

**`emitBattlements(segments, boundaries)`** — Emits battlement pillar primitives along given wall segments.

**`floorTextureKey(bi, buildings)`** — Returns `"floor:building:{ti}"` for a building index.

**`wallTextureKey(bi, buildings)`** — Returns `"wall:landmark:{ti}"` (medium/large buildings) or `"wall:standard:{ti}"` (small).

---

## Debug

**`debug`** — Config flag; when `true`, uses flat `DEBUG_MATERIALS` colours instead of textures.

**`showBoxLadders` / `showMeshLadders`** — `LADDER_DISPLAY` flags controlling which ladder representation renders.

**`resolveDebugMaterial(name)`** — Maps a primitive name to a flat-colour `MeshStandardMaterial`.

---

## Utility Maps

**`DIR_AXIS`** — `{N:'x', S:'x', E:'z', W:'z'}` — maps wall direction to run axis.

**`FACING_N/S/E/W`** — Sets of `CELL` label values indicating exposed faces in each direction.

**`CELL`** — Enum of collision matrix labels: `FLOOR_N`, `FLOOR_NE`, `FLOOR_NW`, `FLOOR_END_S`, `IFLOOR_*`, `ROOF_*`, `EMPTY`, `SHELL`.
