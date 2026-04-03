# Known Issues

## Ground ladder inside diagonal building
- **Seed:** 42, **Size:** 48x48 (`node src/index.js --seed 42 --size 48x48 --debug`)
- **Object:** `ground_ladder_4` (red/external ladder)
- **Problem:** The ladder and its associated platforms are being generated inside a diagonal building rather than on the outside wall. Needs investigation into how ground ladder placement interacts with diagonal building geometry.
