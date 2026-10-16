# Loaded-Map Texture Preview Plan — 2026-10-13

**Completed:** 2026-10-13
**Outcome:** Built as a tab in one unified preview server: the Loaded map and Visualizer tabs (the Model tab was dropped; `viewer.html` stays routable at `/model.html`). `--preview` always records debug frames and `--visualize` is an alias. `--preview-map FILE` starts the server from a frozen fixture with no generation, and `--textures` sets the default pack. The Loaded map tab has a texture report with fallback statuses, a fallback highlight, tier cut-away, a base/loaded switch, a file picker and WASD camera controls. The agents did not visually verify browser behaviour; the owner is to confirm it in a browser.

Status: **implemented** (completed 2026-10-13). Originally **proposed**, nothing built. Applied by another session working in this repo (`D:\programming\Node\3D_Map_Generator`); the Withering repo (`D:\programming\Node\Game_Template`) is **read-only reference** here. All paths and line numbers in the manifest were grepped on 2026-10-13; re-grep before editing (lines drift).

## Purpose

A preview that shows **only the loaded map**, textured, so we can check textures are applied properly. It contains nothing from the game: no units, nav graph, line of sight, orders, panels or phases.

"Loaded" matters: Withering never uses the GLB. It loads a frozen `withering-map/2` fixture (decoded by `load-map.ts`) and draws boxes from it, in flat colours, ignoring textures (no texture code in `games/withering/client/src` or `sim/src`). The preview takes that same fixture and renders it textured, so a bad fixture, a missing texture or a wrong fallback is visible before the game adopts textures.

## What the loaded data contains (verified)

- Fixture: `{ format:'withering-map/2', seed, opts{mapWidth,mapDepth,tiers,levelHeight,floorThickness}, matrix{...}, primitives[] }`. `primitives` = the generator's `geometry.primitives` unfiltered, each with its `textureKey` (the `36x36-seed3.json` fixture has e.g. `pavement:0` x162, `wall:landmark:5` x73, `wall:standard:13` x34, `floor:building:7` x14).
- `load-map.ts` rejects: unknown format, missing/≤0 `opts.levelHeight` or `opts.floorThickness` (`/1` fixtures fall back to legacy values), and a cell count that isn't `W*D*(maxY+belowGround)`.

## Key design point: reuse the GLB path, not the OBJ path

P1 is "3-inch repeat", which is the **GLB** convention (`GEOMETRY.glbTileSize: 3`, applied in `createSlab`). The GLB path already does everything needed from a primitives list:

`buildScene(geometry, config)` → `buildTexturePools(config.textureSet)` → per primitive `resolveTexturedMaterial(prim.textureKey, pools)` → `buildPrimitiveMesh` → `createSlab` (3" UV scaling, `rotateUV` honoured). So the preview needs **no new texturing or box code**: feed the fixture's `primitives` to `buildScene({ version, primitives }, { textureSet, debug:false })`, build a GLB with `buildGlbBuffer(scene)`, serve it, and view it with the existing GLTFLoader approach. (The OBJ path's `ensureTexture` has similar key→pool rules but builds an atlas and has different fallbacks; it is not used.)

What the GLB path does **not** do is tell you when a texture fell back. `buildTexturePools` silently substitutes a grey `MeshStandardMaterial(0x888888)` for an empty or missing pool, and `resolveTexturedMaterial` sends unknown keys to `pools.walls[0]`. The preview adds that reporting (below).

## Proposal

A tab in the unified preview server (see P3 note below), leaving `viewer.html` untouched.

1. **Input (P2: both).** CLI: `node src/index.js --preview-map <fixture.json> [--textures base|loaded]`. In page: a file picker that posts a fixture to the server (`POST /load-map`) and reloads the model. The CLI path is loaded on start.
2. **Decode and validate** the fixture with the same rules as Withering's `loadMap` (format, pitch, slab thickness, cell count; optionally re-hash against `matrixSha1`/`primitivesSha1`). Errors are shown on the page, not as a blank view. Withering's TypeScript can't be imported; re-implement the checks in a small JS module and cite the source.
3. **Render** via the GLB path above, served as `/loaded-model.glb`.
4. **Texture report** (the main value). A new function walks the fixture's `textureKey`s with the same branches as `resolveTexturedMaterial` but also records the pool, the index (`abs(n) % pool.length`), the file, and a status: `ok`, `pool-empty (grey fallback)`, `unknown-key (walls[0] fallback)`, `file-missing`. Served as `/texture-report.json`; the page lists it with counts and a toggle that recolours fallback meshes (mesh name = primitive `name`).
5. **Viewing only:** orbit camera and a tier cut-away, cut for tier k = `(k+1)*levelHeight - floorThickness` (same as Withering's `tierCuts`), using the fixture's `opts.tiers` rather than Withering's hard-coded 4. A texture-set switch (`base`/`loaded`) re-requests the model.

## Decisions (settled 2026-10-13)

- **P1 — UV convention:** 3" repeat per face (GLB-style), not the OBJ atlas layout.
- **P2 — Input:** both. A fixture path on the command line (loaded on start) and a file picker in the page.
- **P3 — Placement:** a tab in one unified preview server (changed 2026-10-13; originally a separate page and flag). `src/preview/shell.html` at `/` hosts two iframe tabs (Loaded map, Visualizer); `visualizer.html` and `loaded-map.html` are embedded. Update 2026-10-13: the Model tab was removed (`viewer.html` stays on disk and routable at `/model.html` and `/viewer.html`, with `/model.glb` and `/geometry.json`); `--preview` implies debug-frame recording and `--visualize` is an alias, so modes collapse to `run` and `preview-map`. One route table (`src/preview/preview-routes.js`) serves every mode; `--preview-map` starts it with no generated run (Visualizer greyed out, run routes answer 404 JSON). With a generated run the Loaded map tab wraps the run's own geometry as a `withering-map/2` fixture (`src/preview/run-fixture.js`).

> Note 2026-10-13: P3 revised from "separate page, viewer.html untouched" to "tab in one unified server, existing pages unchanged and embedded".

## Phases

1. **Fixture decode + validate module** (`src/preview/loaded-map/decode-fixture.js`) with a test.
2. **Texture report** (`src/preview/loaded-map/texture-report.js`) with a test that every key in `36x36-seed3.json` resolves, and unknown/empty cases report a fallback.
3. **Server routes + CLI flag** (`/loaded-map.html`, `/loaded-model.glb`, `/texture-report.json`, `POST /load-map`; `--preview-map`).
4. **Page** (`loaded-map.html`): model, report list, fallback highlight, cut-away, texture-set switch, file picker.

New files follow project rules: ESM, named exports only, config values in `src/config.js`, no `Math.random()`, `npm run check:file-sizes`. (File names above are proposals.)

## Manifest — where to look (grepped 2026-10-13)

### A. This repo (`D:\programming\Node\3D_Map_Generator`) — files to change or reuse

| Change | File : line | What is there |
|---|---|---|
| Add `--preview-map` flag | `src/config.js:245-253` (`--preview`, `--visualize` branches in `parseArgs`, which is `export` at `:236`); defaults `src/config.js:30-31` (`preview`, `visualize`) | Add `previewMap: null` default and a branch that takes the next arg. `--profile` is pre-read at `:237-240`; follow the same pattern for valued flags |
| Start the new page | `src/index.js:104-108` | `if (config.preview) { … startPreview(outputPath, 3010, config.visualize ? 'visualize' : 'preview') }`. Add a `previewMap` branch; it should skip generation (decode the fixture instead). `src/index.js:24-25` is the `--visualize` branch, for comparison |
| Server routes | `src/preview/server.js:13` (`startPreview(glbPath, port = 3000, mode = 'preview')`); routes `:16` `/`, `:20` `/visualizer.html`, `:24` `/debug_frames.json`, `:28` `/model.glb`, `:35` `/geometry.json`; `:50` mode URL choice; `:54` `listen` | Add the new routes in a sibling `startMapPreview` in a new file to leave `server.js` untouched, or extend it. Uses port 3010 from `index.js` |
| Page template | `src/preview/viewer.html:41-45` (importmap: three@0.170.0 from jsdelivr), `:51-53` (imports `THREE`, `OrbitControls`, `GLTFLoader`), `:67` (`new OrbitControls`), `:77` (`new GLTFLoader()`), `:88` (`child.material.opacity = 0.35` on every mesh — **do not copy**; show materials as exported) | Copy structure, not the transparency |
| Scene from primitives | `src/generators/scene/build-scene.js:22` (`buildScene(geometry, config)`), `:27` (pools built only when `!debug`), `:31-34` (`getMaterial` → `resolveTexturedMaterial(prim.textureKey, pools)`), `:44` (`buildPrimitiveMesh` per primitive) | Call with `{ version, primitives }` and `{ textureSet, debug:false }` |
| Texture pools | `src/generators/scene/buildTexturePools.js:22` (`buildTexturePools(packName='base')`), `:23` (packDir under `assets/textures/<pack>`), `:13-17` (`CATEGORIES`, 15 pools), `:48` (`_pngBuffer` set), `:55` (grey `0x888888` fallback) | The silent fallback the report must expose |
| Key → material rules | `src/generators/scene/resolve-textured-material.js:17` (`resolveTexturedMaterial`), key table in the comment `:6-15`, unknown-key fallback `:40` (`pools.walls[0]`) | The report function mirrors these branches line for line |
| Pool index | `src/generators/selectors/pickFromPool.js` (`pool[Math.abs(index) % pool.length]`) | Reuse for the report's index and file |
| Box + 3" UV | `src/core/geometry-misc.js:18` (`TILE_SIZE = GEOMETRY.glbTileSize`), `:20` (`createSlab`, per-face UV scaling, `rotateUV`); `src/config.js:172` (`glbTileSize: 3`) | Where P1 is already implemented; nothing to change |
| Primitive → mesh | `src/generators/scene/build-primitive-mesh.js:7` (`buildPrimitiveMesh`); cases `slab :11`, `wall :22`, `quad :33`, `ceiling :51`, `ladder :56`, `edges :75` | Mesh `.name = prim.name` (ties report rows to meshes). Note the `quad` type: Withering's `primitive-box.ts` draws only slab/wall/ladder, so the preview may show more than the game does |
| GLB bytes | `src/export/glb-exporter.js:25` (`buildGlbBuffer(scene)`), `:16` (`exportToGlb`), `:73-74` (`mesh.material._pngBuffer` embedded), `:235` (`getOutputPath`) | Use `buildGlbBuffer`; no file write needed |
| Tier maths | `src/core/levels.js:10-11` (`floorThickness`, `levelHeight` re-exports from `src/core/levels/`) | Only needed if computing server-side; the fixture already stores `opts.levelHeight` and `opts.floorThickness` |
| Texture assets | `assets/textures/base/<pool>` and `assets/textures/loaded/<pool>`: 18 pool dirs each (base_map, courtyards, domes, floors, ladders, landmark_walls, map_border, map_skirt, objects, objects_medium, objects_tall, pavements, river_banks, rivers, roofs, streets, walkways, walls) | `CATEGORIES` has 15; `domes`, `objects_medium`, `objects_tall` are not loaded by the GLB path |
| OBJ-side equivalent (reference only) | `src/export/obj-geometry/ensure-texture.js:7`, `build-obj-and-atlas.js:52` (`buildObjAtlas`) with empty-pool fallbacks at `:58-84` (walkways→floors, ladders→walls, rivers/streets/pavements/courtyards→base_map, river_banks→walls, …), `load-tex-pool.js:5` | **Not** the same fallbacks as the GLB path. Don't mix them |
| Tests | `tests/export/glb-exporter.test.js`, `tests/export/obj-exporter.test.js`, `tests/helpers/run-stages.js`; `npm test` = `vitest run` | Pattern for the new tests |
| Docs to update | `README.md:26` (`--preview` row in the flags table) | Add `--preview-map` |

### B. Withering repo (`D:\programming\Node\Game_Template`) — read-only reference

| What | File : line |
|---|---|
| Fixture writer + format doc | `docs/plans/withering/tools/extract-map.mjs:32` (`FORMAT = 'withering-map/2'`), `:34` (`parseArgs`), `:67` (`build`); header comment lines 1-25 describes the fields |
| Fixture decode and the validation rules to copy | `games/withering/sim/src/map/load-map.ts:7` (`loadMap`) |
| Fixture / primitive types | `games/withering/sim/src/types/map.ts:4` (`MapPrimitive`), `:7` (`MapFixture`) |
| What the game draws and skips | `games/withering/client/src/scene/primitive-box.ts:7` (`primitiveBox`: slab, wall, ladder only) |
| Tier cut formula | `games/withering/client/src/data/tiers.ts:10` (`tierCuts`); `LEVELS = 4` hard-coded at `:5` |
| Fixtures to test with | `games/withering/sim/data/fixtures/36x36-seed3.json`, `withering-32x32-seed8.json`, `withering-32x32-seed9.json`, `24x24-seed1.json`..`seed3.json` |

To re-grep: in this repo `rg -n "buildScene|resolveTexturedMaterial|buildTexturePools|createSlab|buildGlbBuffer|startPreview|--preview" src`; in the Withering repo `rg -n "withering-map/2|textureKey" games/withering docs/plans/withering/tools`.

## Risks

- **Fallbacks are silent today** (grey pools, `walls[0]`). The report function must mirror `resolveTexturedMaterial` exactly or it will mislead; add a test that runs both on every key in the 36x36 fixture and asserts the same pool and index.
- **GLB and OBJ paths differ** in fallbacks (see manifest). The preview follows the GLB path only.
- **Pool coverage:** `domes`, `objects_medium`, `objects_tall` have asset folders but no GLB loader entry. Confirm whether any `textureKey` needs them.
- **Fixture staleness:** textures come from the current assets, not the ones present when the fixture was cut. The page should print the fixture's `generator.rev` and `dirty`.
- **Preview ≠ game shape:** the preview draws every primitive type the GLB path does (including `quad`), the game only slab/wall/ladder.
- Matrix `ox/oz` are not used here; not checked whether they are always 0.

## Limits

- Map only. No game content of any kind.
- Not a replacement for the GLB/OBJ previews or the TTS vertex-limit check.
