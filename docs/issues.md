# Known Issues

No open issues.

## Resolved

- **Ground ladder inside diagonal building** (seed 42, 48x48, `ground_ladder_4`) — obsolete as of 2026-10-10. It came from the old connectivity system (`conn.groundLadders`) and the diagonal building shapes, both of which are no longer part of the live pipeline. Current ladders come from `generate-ladders.js` (`ladder_path_*` primitives) and seed 42 produces no `ground_ladder_*` objects.
