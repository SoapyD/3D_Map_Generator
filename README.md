# Mordheim 3D Map Generator

Procedural ruined city map generator for Mordheim / Tabletop Simulator. Generates seed-based 3D terrain maps with buildings, walls, walkways, ladders, and cover — all with perfectly flat surfaces so models don't tip over.

## Quick Start

```bash
npm install
node src/index.js --seed 42
```

Outputs:
- `output/mordheim_map_42.glb` — GLB file for browser preview
- `output/mordheim_map_42.obj` — OBJ file for TTS import
- `output/mordheim_map_42.png` — Texture atlas

## CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `--seed N` | RNG seed for reproducible maps | random |
| `--size WxD` | Map dimensions in inches | 48x48 |
| `--tiers N` | Number of elevated tiers (+ base) | 4 |
| `--tier-height N` | Vertical spacing between tiers (inches) | 3 |
| `--debug` | Use flat debug colours instead of textures | off |
| `--preview` | Start basic browser preview (model + grid toggle) on localhost:3010 | off |
| `--visualize` | Start the full visualizer on localhost:3010 — layer/grid toggles, prior-step playback, debug overlays | off |
| `--texture-set NAME` | Texture pack folder name in assets/textures/ | base |

## Examples

```bash
# Generate with specific seed
node src/index.js --seed 42

# Debug mode (flat colours, labelled meshes)
node src/index.js --seed 42 --debug

# Custom map size
node src/index.js --seed 42 --size 36x36

# Browser visualize preview
node src/index.js --seed 42 --visualize 

# Use custom texture pack
node src/index.js --seed 42 --texture-set my_textures
```

## Importing into Tabletop Simulator

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
7. **Export** — GLB + OBJ with texture atlas

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
- **`transparent_base`** — same as base but walls have 85% opacity (15% transparent). Transparency works in GLB viewers but **not in TTS** (TTS doesn't support transparent PNGs on custom models)

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

Note: TTS does not support PNG transparency on custom models. The transparent pack is useful for the GLB browser preview only.

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
