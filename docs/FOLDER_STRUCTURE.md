# Project Folder Structure

> Last verified: 2026-10-10

```
3d_map_generator/
├── docs/
│   ├── PROJECT_OVERVIEW.md        # Problem statement and design goals
│   ├── GENERATION_PIPELINE.md     # Stage order and links to flow docs
│   ├── BUILDING_REFERENCE.md      # Building size classes and placement
│   ├── IMPLEMENTATION_PHASES.md   # Historical build plan
│   ├── FOLDER_STRUCTURE.md        # This file
│   ├── AGENTS_AND_HOOKS.md        # Historical agent/hook plan
│   ├── issues.md                  # Known open bugs
│   ├── architecture/              # Cross-cutting concepts (philosophy, glossary,
│   │                              #   collision matrix, debug tooling, docs/config guide)
│   ├── processes/
│   │   ├── FORMAT.md              # How to write flow docs
│   │   └── pipeline-flows/        # 1-grid … 11-scene-and-export (+ archive/)
│   ├── plans/                     # Active plans; archive/ holds completed ones
│   ├── reports/                   # One-off audits
│   └── archive/                   # Superseded rule docs
│
├── src/
│   ├── index.js                   # CLI entry point
│   ├── pipeline.js                # Runs the stages in order
│   ├── lib.js                     # Package entry (importable API)
│   ├── config.js                  # Defaults, tunables, CLI arg parsing
│   ├── generate-*-buffers.js      # In-memory generation (OBJ / collider / per-tier)
│   ├── core/                      # RNG and shared geometry/rect helpers
│   ├── generators/                # One folder per stage (grid is under foundations/),
│   │                              #   plus collision/ (matrix), selectors/, utils/,
│   │                              #   scene/, geometry/ and _old_system/ (legacy)
│   ├── profiles/                  # Swappable config profiles (withering, …)
│   ├── export/                    # GLB, OBJ + atlas, collision and per-tier exporters
│   ├── preview/                   # Unified viewer (README "Running the viewer"): server.js (--preview),
│   │                              #   preview-routes.js (one route table), shell.html (tabs),
│   │                              #   visualizer.html, viewer.html (/model.html), debug-recorder.js,
│   │                              #   run-fixture.js, tab-flags.js; loaded-map/ = Loaded map tab
│   │                              #   (loaded-map.html, decode-fixture.js, texture-report.js, map-state.js)
│   └── tools/                     # Standalone building/bridge preview scripts
│
├── assets/textures/               # Texture packs (base, transparent_base, …)
├── scripts/checks/                # File-size, import and export-shape checks
├── tests/                         # Vitest suites (core, export, generators, snapshot)
├── test/                          # Older test files
├── output/                        # Generated maps (gitignored)
├── .claude/                       # Agents, hooks, settings
├── CLAUDE.md
└── package.json
```

## Key Decisions

- **ESM modules** (`"type": "module"`), named exports only
- **No framework** — plain Node.js + Three.js, no build step
- **Generators are independent stages** — each takes data in, returns enriched data out
- **Preview server** is a dev convenience, not required for generation
- **Output folder** is gitignored
