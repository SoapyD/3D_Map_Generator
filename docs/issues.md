# Known Issues

- **Thin floor slabs (2026-10-11)**: floors/roofs are 0.25" thick colliders and wall headroom is 2.75" (2 matrix rows + 0.75" geometry-only top row, which has no matrix cells). `src/tools/preview-building-main.js` and the stale `test/` directory (not run by vitest, which only includes `tests/`) still pin the old `tierHeight`/`slabThickness` fixtures.

## Resolved

- **Default-profile seeds 7 and 100 exceeded the 25k OBJ vertex cap** (seed 7: 26,490, seed 100: 25,522) — fixed 2026-10-13: the exporter grid fix and the shared greedy rect cover bring every seed well under (OBJ vertices: seed 7 15,666, seed 42 14,926, seed 100 15,228), and the cap itself no longer applies (TTS is not a target; OBJ is deprecated). The expected-failure test is gone; `npm test` has no expected failures.

- **Ground ladder inside diagonal building** (seed 42, 48x48, `ground_ladder_4`) — obsolete as of 2026-10-10. It came from the old connectivity system (`conn.groundLadders`) and the diagonal building shapes, both of which are no longer part of the live pipeline. Current ladders come from `generate-ladders.js` (`ladder_path_*` primitives) and seed 42 produces no `ground_ladder_*` objects.
