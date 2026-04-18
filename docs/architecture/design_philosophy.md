# Design Philosophy

This document captures the architectural principles behind the 3d_map_generator project. These principles are tool-agnostic — they describe *how* the project is designed and *why*, not the specific technologies used.

---

## Core Principles

### 1. Sequential Pipeline with Clear Contracts

The generator is a staged pipeline. Each stage has a defined input contract (data shape from the previous stage) and a defined output contract (enriched data passed to the next). No stage reaches backwards or sideways into another stage's data — it only consumes what it received and adds to it.

```
Seed → Grid → Buildings → Floors → Walls → Connectivity → Sightlines → Textures → Export
```

Stages are not functions called in sequence inside a monolith — they are independent modules. If a stage grows complex, it splits into sub-steps within its own directory, not across stages.

**Why:** When you need to debug a connectivity problem, you can feed a fixed floor dataset directly into Stage 5 and ignore the rest. When you want to change how buildings are damaged, only `floors/` changes. Pipeline clarity is the thing that makes isolated testing possible.

### 2. Determinism Through the Seed

All randomness flows from a single seed, threaded through a seeded RNG. No stage calls `Math.random()` directly. Identical seed + config = identical output, always.

This enables:
- **Regression testing** — run seed 42 before and after a change; any diff is a change you made
- **Reproducibility** — a player can share a seed number to recreate a map
- **Debugging** — a broken map can be re-generated deterministically for inspection

The RNG is passed as an argument into each stage. Stages do not hold a global RNG instance.

### 3. Pure Stage Functions

Each pipeline stage is a pure function: data in, enriched data out, no side effects. Stages do not write files, mutate shared state, or log. Side effects (file I/O, preview serving) happen only at the entry point and the export stage.

This enables:
- **Isolated testing** — feed a stage synthetic input, assert on the output shape
- **Speculative evaluation** — "what would the floor layout look like if I used this building set?" without committing
- **Composability** — stages can be combined, skipped, or replaced without cascading changes

### 4. Gameplay Constraints Drive Geometry

Every structural decision serves gameplay quality, not visual fidelity:
- **Flat surfaces** — every walkable plane is axis-aligned and flat (models don't tip)
- **Verified connectivity** — every elevated area must be reachable before export; generation fails if not
- **Sightline budget** — the generator enforces its own sightline constraint; it does not rely on the user to check manually
- **Scale fidelity** — geometry is in inches from the start, not scaled at export

When a gameplay constraint and a visual preference conflict, the gameplay constraint wins.

### 5. One Responsibility Per Module

Each file in `src/generators/` handles one pipeline stage. Each file in `src/core/` handles one shared concern (RNG, geometry helpers). When a module starts handling two things, it splits.

File names match their export names. If you need the building footprint generator, it is in `buildings/`. If you need the RNG, it is in `core/rng.js`.

### 6. Validation Is Not Optional

The pipeline includes a built-in validation pass after generation. A generated map is not considered done until it passes:
- All floors are flat (Y values constant per tier)
- All elevated areas are reachable from ground level (flood-fill)
- No sightline exceeds the configured maximum
- Output file size and polygon count are within TTS limits

Validation is not an afterthought bolted on at the end — it is the definition of "done."

---

## Structural Patterns

### Stage Modules

Each stage is a folder when it has internal complexity, a single file when it does not:

```
generators/
  grid.js              <- simple enough to be one file
  buildings/
    index.js           <- public API (barrel)
    place-footprints.js
    assign-heights.js
  floors/
    index.js
    generate-floor-plates.js
    apply-damage.js
  connectivity/
    index.js
    build-graph.js
    place-ladders.js
    place-walkways.js
```

Consumers import from the barrel (`generators/buildings/`), never from internal files.

### Data Shape Contracts

Each stage's output is a plain object (not a class instance, not a Three.js scene). Three.js geometry is only constructed at the end — generators work in abstract data (rectangles, edges, heights, material tags) until the geometry builder turns them into meshes.

**Why:** Abstract data is serialisable, diffable, and testable without a render context. You can write a test that asserts `floors[0].cutouts.length === 3` without importing Three.js.

### Testing Strategy

Tests are per-stage, feeding synthetic input and asserting on output shape and constraints. No integration tests that run the full pipeline — if each stage is correct in isolation, the pipeline is correct by composition.

Use a fixed set of seeds for regression tests. If the output of seed 42 changes, the change was intentional or it's a bug — either way, it must be noticed.

---

## What Not to Do

- **Don't reach across stages.** If Stage 5 (connectivity) needs something from Stage 2 (buildings), it should be in the data contract that Stage 2 passes forward — not a direct import of Stage 2's internals.
- **Don't generate geometry in stages.** Generate abstract data. Build geometry once, in the geometry layer, using the data.
- **Don't skip validation.** A map that fails its own constraints is not a valid output.
- **Don't add complexity for one variant.** If the only current use case is GLB export, there is no "exporter interface" with a GLB implementation. Add abstraction when a second exporter exists.

---

## Documentation Strategy

### Pipeline Flow Docs

Every pipeline stage has a flow document in `docs/processes/pipeline-flows/`. These docs describe the stage's input contract, algorithm, output contract, and known edge cases. Reading one flow doc replaces reading the stage's source files.

- Flow docs include a "Last verified" date — staleness is visible at a glance
- When a stage's algorithm or data contract changes, its flow doc is updated in the same commit

### What Not to Document

- Code patterns visible from reading the source
- Git history (use `git log`)
- Debugging solutions (the fix is in the code; the commit message has the context)
- The pipeline sequence itself (that lives in `GENERATION_PIPELINE.md`)
