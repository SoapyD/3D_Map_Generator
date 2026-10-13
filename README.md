# Mordheim 3D Map Generator

Procedural ruined city map generator for Mordheim. The output (GLB, geometry primitives and collision matrix) is consumed by the Withering game; Tabletop Simulator is no longer a target. Generates seed-based 3D terrain maps with buildings, walls, walkways, ladders, and cover — all with perfectly flat surfaces so models don't tip over.

## Quick Start

```bash
npm install
node src/index.js --seed 42
```

Outputs:
- `output/mordheim_map_42.glb` — GLB file (browser preview, Withering game)
- `output/mordheim_map_42_geometry.json` — primitives plus the collision matrix

With the deprecated `--obj` flag it also writes (legacy, for consumers pinned to v0.2.0):
- `output/mordheim_map_42.obj` — OBJ file (was for TTS import)
- `output/mordheim_map_42.png` — Texture atlas
- `output/mordheim_map_42_collision.obj` — collision OBJ

## CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `--seed N` | RNG seed for reproducible maps | random |
| `--size WxD` | Map dimensions in inches | 48x48 |
| `--tiers N` | Number of elevated tiers (+ base) | 4 |
| `--tier-height N` | Vertical spacing between tiers (inches) | 3 |
| `--debug` | Use flat debug colours instead of textures | off |
| `--obj` | **Deprecated.** Also write the legacy OBJ + atlas PNG + collision OBJ (Tabletop Simulator). Prints a one-time deprecation warning | off |
| `--split-tiers` | **Deprecated.** Also write one OBJ + collider per tier and a manifest (legacy TTS elevator). Warns once | off |
| `--preview` | Generate, then start the viewer on localhost:3010 (see [Running the viewer](#running-the-viewer)). Always records debug frames to `output/debug_frames.json` | off |
| `--visualize` | Alias of `--preview` | off |
| `--preview-map FILE` | Skip generation; start the viewer from a frozen `withering-map/1` or `/2` fixture. The Visualizer tab is greyed out | none |
| `--textures NAME` | Texture pack the Loaded map tab starts with (`base` or `loaded`). Alias of `--texture-set`, so it also sets the pack used for export | base |
| `--profile NAME` | Swap in a named config profile, e.g. `withering` (small 3-level test ground). See `docs/architecture/profiles.md` | none |
| `--texture-set NAME` | Texture pack folder name in assets/textures/ | base |

## Examples

```bash
# Generate with specific seed
node src/index.js --seed 42

# Debug mode (flat colours, labelled meshes)
node src/index.js --seed 42 --debug

# Custom map size
node src/index.js --seed 42 --size 36x36

# Generate and open the viewer at http://localhost:3010
node src/index.js --seed 42 --preview

# Use custom texture pack
node src/index.js --seed 42 --texture-set my_textures
```

Run the `withering` profile through npm: `npm run generate -- --profile withering --seed 3` (also works with `npm run preview`). `npm run visualize` fixes the size at 48x48, which overrides a profile's size, so for the viewer use `node src/index.js --profile withering --seed 3 --preview`.

## Running the viewer

One server (`src/preview/`) serves a tabbed page at **http://localhost:3010**. Stop it with **Ctrl+C**. Three.js loads from the jsDelivr CDN, so the browser needs internet access.

```bash
npm run preview                                            # = node src/index.js --preview (random seed)
node src/index.js --seed 42 --preview                      # generate seed 42, then open the viewer
node src/index.js --profile withering --seed 3 --preview   # Withering test ground (npm run preview -- --profile withering --seed 3 also works)
node src/index.js --seed 42 --preview --textures loaded    # start the Loaded map tab on the 'loaded' pack
node src/index.js --preview-map FIXTURE.json               # no generation: view a frozen withering-map fixture
node src/index.js --preview-map FIXTURE.json --textures loaded
```

`--visualize` is an alias of `--preview` and behaves the same. `--preview` always records debug frames to `output/debug_frames.json`.

### Tabs and which mode enables them

| Tab | `--preview` (generated run) | `--preview-map FILE` (fixture only) |
|-----|-----------------------------|--------------------------------------|
| **Loaded map** (opens first) | Enabled. Shows the current run, textured | Enabled. Shows the fixture |
| **Visualizer** | Enabled. Stage-by-stage replay of the pipeline: layer and grid toggles, prior-step playback, debug overlays | Greyed out, with a tooltip: no generated run |

- **Loaded map** shows only the map's primitives with textures (3-inch repeat, as in the GLB). It has no game content. The page remembers the last tab you picked per mode.
- The fixture format is `withering-map/1` or `/2`. A `/1` fixture has no recorded pitch or slab thickness, so the legacy values (4" pitch, 1" slab) are used.

### Loaded map controls

- **Textures** dropdown: `base` or `loaded`. Switching reloads the model. Only these two packs are offered; any other `--texture-set` name shows as `base`.
- **Ground / Tier N / All** buttons: cut-away. The cut keeps everything at or below that tier's floor level and hides the rest. **All** removes the cut.
- **Highlight fallbacks**: recolours in magenta every mesh whose texture status is not `ok`.
- **Load fixture** file picker: posts a JSON fixture to the server and reloads. If the file is invalid, the errors appear in red and the view is cleared.
- **Texture report** (bottom left): one row per texture key with count, key, `pool[index]`, file and status. Rows that are not `ok` are red.

Report statuses:

| Status | Meaning |
|--------|---------|
| `ok` | Key resolved to a real file in its pool |
| `unknown-key` | Key is not recognised, so it uses the first wall texture |
| `pool-empty` | Pool folder has no PNGs, so the mesh is flat grey |
| `file-missing` | Pool folder does not exist, so the mesh is flat grey |
| `bad-index` | Key's index is not a number (shown as `?`) |

The header shows the fixture's generator revision and `(dirty)` if it was cut from uncommitted code. A generated run shows `current-run`. Textures always come from the current assets, not those present when the fixture was cut.

### Camera

- **W / S**: forward / back. **A / D**: strafe left / right. **Q / E**: down / up. **Shift**: 3x faster.
- Mouse drag orbits and the scroll wheel zooms.
- Click the 3D view first so the keys have focus. Keys are ignored while the dropdown or file picker has focus.

Design history: `docs/plans/archive/LOADED_MAP_TEXTURE_PREVIEW_PLAN_2026_10_13.md`.

## Importing into Tabletop Simulator (legacy, deprecated)

> Tabletop Simulator is no longer a target. These steps apply only to OBJ files from `--obj` or generator v0.2.0 (tag `v0.2.0`), and the OBJ export is scheduled for removal.

1. Upload the `.obj` and `.png` files somewhere accessible via URL (Steam Cloud, Imgur, etc.)
2. In TTS: Objects > Components > Custom > Custom Model
3. Set **Model/Mesh** URL to the `.obj` file
4. Set **Diffuse/Image** URL to the `.png` file
5. Set **Collider/Mesh** URL to the same `.obj` file (required for collision)
6. Scale down as needed (try 0.05-0.1)

## Generation Pipeline

1. **Grid** — BSP partitions the map into city blocks with streets
2. **Buildings** — Grid of small buildings + landmark medium/large buildings
3. **Floors** — Quadrant system with progressive removal per tier
4. **Walls** — Quadrant-driven with upper/lower damage rows
5. **Connectivity** — Walkways (blue), yellow/red/orange ladders
6. **Cover** — Rooftop, ground, and interior cover objects
7. **Export** — GLB + geometry JSON (OBJ with texture atlas only with the deprecated `--obj`)

## Configuration

All generation parameters are centralised in `src/config.js` — building sizes, wall damage ratios, walkway dimensions, spawn chances, cover rules, etc.

## Texture Packs

Textures are loaded from `assets/textures/{packName}/` with subdirectories:

```
assets/textures/base/
  walls/           — building wall textures
  landmark_walls/  — medium/large building wall textures
  floors/          — wooden floor textures
  objects/         — crate and stone block textures
  ladders/         — ladder textures
  walkways/        — walkway plank textures
  courtyards/      — ground courtyard textures
  base_map/        — base ground textures
  domes/           — dome/spire top textures (rusty/oxidised colours)
```

### Included packs

- **`base`** — default solid colour textures, fully opaque
- **`transparent_base`** — same as base but walls have 85% opacity (15% transparent). Transparency works in GLB viewers (legacy note: it did not work in the old TTS OBJ path, which does not support transparent PNGs on custom models)

### Switching texture packs

```bash
node src/index.js --seed 42                                    # uses 'base' (default)
node src/index.js --seed 42 --texture-set transparent_base     # semi-transparent walls (GLB only)
node src/index.js --seed 42 --texture-set my_custom_pack       # your own textures
```

The default pack is set in `src/config.js` under `textureSet: 'base'`.

### Creating a custom pack

1. Copy the `assets/textures/base/` folder
2. Rename it (e.g. `my_pack`)
3. Replace the PNGs in each subfolder with your own textures
4. Run with `--texture-set my_pack`

Each subfolder is a pool — all PNGs in that folder are available for random selection. Buildings use the same texture for all their walls/floors but different buildings can use different textures from the pool.

### Adding transparency (GLB only)

PNGs with alpha channels are automatically detected. Materials with alpha < 100% are set to transparent in the GLB export. To make walls semi-transparent:

1. Copy the base pack
2. Edit the wall PNGs to have a lower alpha (e.g. 85%)
3. Use `--texture-set your_transparent_pack`

Note (legacy): the old TTS OBJ path did not support PNG transparency on custom models. The transparent pack is useful for the GLB browser preview only.

### Regenerating procedural textures

```bash
node src/generators/generate-textures.js
```

## Debug Colours

When using `--debug`, elements are colour-coded:
- Grey — base ground
- Brown tones — building floors (by tier)
- Tan — walls
- Blue — walkways
- Green — blocked walkways (hit a wall)
- Yellow — walkway ladders
- Red — ground ladders
- Orange — free-standing ladders
- Purple — cover objects
- Grey — interior cover
- Pink — deleted building footprints (debug)
