# Known Issues

- **Default-profile seeds 7 and 100 exceed the 25k OBJ vertex cap** (seed 7: 26,490, seed 100: 25,522 after thin floor slabs; seed 1 dropped under the cap at 24,682). Pre-existing; the seed 100 snapshot test is an expected failure (`it.fails`).
- **Thin floor slabs (2026-10-11)**: floors/roofs are 0.25" thick colliders and wall headroom is 2.75" (2 matrix rows + 0.75" geometry-only top row, which has no matrix cells). Playtest TTS physics on the 0.25" floor colliders. `src/tools/preview-building-main.js` and the stale `test/` directory (not run by vitest, which only includes `tests/`) still pin the old `tierHeight`/`slabThickness` fixtures.

## Resolved

- **Ground ladder inside diagonal building** (seed 42, 48x48, `ground_ladder_4`) — obsolete as of 2026-10-10. It came from the old connectivity system (`conn.groundLadders`) and the diagonal building shapes, both of which are no longer part of the live pipeline. Current ladders come from `generate-ladders.js` (`ladder_path_*` primitives) and seed 42 produces no `ground_ladder_*` objects.
