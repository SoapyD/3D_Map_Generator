# Claude Code Agents & Hooks Plan

## Recommended Agents

### 1. Generator Stage Agent
**Purpose**: When implementing a new pipeline stage, use an agent to scaffold it.
**Trigger**: Building any of the 8 pipeline stages
**Approach**: Agent reads the relevant section of `GENERATION_PIPELINE.md`, the previous stage's output format, and generates the stage module + tests.

### 2. Test Runner Agent
**Purpose**: After implementing or modifying a generator stage, run the test suite.
**Trigger**: After code changes to any `src/generators/*.js` file
**Approach**: Runs `npm test` and reports results. If tests fail, reports which constraints were violated.

### 3. Visual Verification Agent
**Purpose**: After generation changes, produce a test GLB and confirm it's valid.
**Trigger**: After changes to geometry generation or export
**Approach**: Runs `node src/index.js --seed 1` and validates the output file exists and has reasonable file size. Can also check polygon counts.

### 4. Sightline Audit Agent
**Purpose**: Validate that generated maps meet sightline constraints.
**Trigger**: After changes to sightline or cover generation
**Approach**: Generates a map and runs the sightline analysis in isolation, reporting stats (max sightline, average, distribution).

## Recommended Hooks

### Pre-commit Hook
```json
{
  "hook": "pre-commit",
  "command": "npm test",
  "description": "Run all generator stage tests before committing"
}
```

### Post-Generation Validation Hook
For the CLI tool itself (not Claude hooks), the generation pipeline should have a built-in validation pass that checks:
- All floors are flat (Y values constant per tier)
- All elevated areas are reachable (connectivity flood-fill)
- No sightline exceeds configured maximum
- File size is reasonable for TTS import (< 50MB)
- Polygon count is reasonable (< 500k triangles)

### Claude Code Hooks (settings.json)

These can be added to `.claude/settings.json` once the project is underway:

```json
{
  "hooks": {
    "postToolUse": [
      {
        "tool": "Edit",
        "matchFiles": ["src/generators/**/*.js"],
        "command": "npm test --silent 2>&1 | tail -5",
        "description": "Auto-run tests after editing generator code"
      }
    ]
  }
}
```

## Workflow Recommendations

1. **Implement stages sequentially** — each builds on the previous
2. **Test each stage in isolation** before integrating into the pipeline
3. **Use the preview server** to visually verify after each phase
4. **Generate with multiple seeds** (1, 42, 999) to check variety and edge cases
5. **Keep a "golden seed"** (e.g., seed 42) as a regression test — if the output changes unexpectedly, something broke
