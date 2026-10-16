# Config Profiles

> Last verified: 2026-10-10

A **profile** is a named, swappable set of config overrides. It lets one codebase produce very different maps (for example the full Mordheim city vs a small test ground for another game) without editing `src/config.js`.

## Using one

| Where | How |
|---|---|
| CLI | `node src/index.js --profile withering --seed 3` (explicit flags such as `--size 28x28` still win over the profile) |
| Library | `generateToBuffer(seed, { profile: 'withering' })` |
| Direct `runPipeline` | put `profile: 'withering'` in the config you pass (merge `profileDefaults('withering')` into it first for the size/tier defaults) |

No profile = exactly the original behaviour. An unknown name fails with the list of valid names.

### Running a profile through npm scripts

`npm run generate` and `npm run preview` forward extra arguments to the CLI, so `--profile` works with them:

```
npm run generate -- --profile withering --seed 3
npm run preview -- --profile withering --seed 3
```

`npm run visualize` hard-codes `--seed 42 --size 48x48`. Explicit flags win over profile defaults, so that script overrides the profile's map size. To view a profile, run the CLI directly:

```
node src/index.js --profile withering --seed 3 --preview
```

There are no per-profile npm scripts yet.

## How it works

- A profile (`src/profiles/<name>.js`) has two parts:
  - `defaults` — overrides for `DEFAULTS` (map size, tiers, …), merged under any explicit options.
  - `sections` — deep-merged over generation sections of `config.js` for the duration of one `runPipeline` call, then **restored** (even if the run throws). So profiles cannot leak between runs in the same process.
- Overridable sections: `BUILDINGS`, `WALL`, `FLOOR`, `CONNECTIVITY`, `STREETS`, `GRID`, `LADDERS`, `COVER`. `GEOMETRY` and `LADDER_DISPLAY` are export-time and deliberately not overridable.
- Files: `withering.js` (the profile), `get-profile.js` (lookup), `profile-defaults.js`, `apply-profile.js`.

### Adding a profile

1. Create `src/profiles/<name>.js` exporting `{ name, defaults, sections }`.
2. Register it in `PROFILES` in `get-profile.js`.
3. Add a test next to `tests/profiles/withering.test.js`.

## Generator options profiles can use

| Setting | Meaning | Default (no profile) |
|---|---|---|
| `BUILDINGS.mode` | `'fill'` packs blocks with as many buildings as fit; `'single'` places exactly one per block | `'fill'` |
| `BUILDINGS.singleSizes` | Sizes tried in `'single'` mode | small, medium, largeA, largeB |
| `BUILDINGS.singleOrder` | `'random'` shuffles `singleSizes`; `'largestFirst'` tries the biggest footprint first so ruins are used only where nothing bigger fits | `'random'` |
| `BUILDINGS.emptyBlocks` | `{ min, max }` blocks left without a building (always keeps at least one built block) | `{ 0, 0 }` (off) |
| `COVER.shellChance / roofChance / streetChance` | Chance each group (interior floor / roof / street) gets any cover | `1` (always) |
| `GRID.strategy` | `'random'`, `'centerFirst'` or `'bspTopLeft'` block layout | `'random'` |
| `CONNECTIVITY.maxLengthMapFraction` | Longest connection as a fraction of the map's longer side (0.5 = half, 1 = full map) | `0.5` |
| `LADDERS.pathQuota` | Max ladder paths per building size | 1 / 2 / 3 by size |

Every option is off by default and consumes no RNG when off, so existing seeds still produce identical maps.

## Profile: `withering`

Small test ground for *The Withering* (`Game_Template/docs/plans/withering`).

| Aim | Setting |
|---|---|
| Smaller map | 32×32 (default 48×48). 24 and 28 also work, but 24 mostly fits only small buildings |
| Ground + tiers 1, 2 and 3 | `tiers: 4`. Standing surfaces are at 0", 3", 6" and 9". (`tiers: 3` would stop at tier 2 / 6".) Also fixed: small ruins used to ignore `tiers` and could exceed it |
| One building per block, blocks split by roads | `BUILDINGS.mode: 'single'` with `GRID.strategy: 'bspTopLeft'`, which always gives exactly 4 blocks from 24" to 32" (centre-first can give just one) |
| Empty blocks | None forced. `BUILDINGS.emptyBlocks` is available but the profile leaves it off; a block stays empty only if nothing in `singleSizes` fits it |
| Connections up to the full map | `CONNECTIVITY.maxLengthMapFraction: 1` (default 0.5). On this profile it changes little, because small blocks make most connections short anyway |
| Fewer objects | 50% chance for each cover group; 1 ladder path per building |

Measured over 40 seeds: no errors, no floor or roof above the top tier, about 250 primitives per map on average versus about 1,360 for the default (roughly 5× fewer).

## Interpretation notes

- A forced empty block (min 1, max 1) was tried first and then dropped at the user's request.
- Roads already separate blocks in every map; the profile only guarantees there are several blocks to separate.
