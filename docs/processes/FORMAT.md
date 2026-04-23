# Process Documentation Format

This directory contains flow documentation — human-readable descriptions of how each pipeline stage works end-to-end. The goal is to reduce the number of tool calls needed to understand a stage (from ~10-15 file reads down to 1).

## Directory Structure

```
docs/processes/
  FORMAT.md                    <- this file
  pipeline-flows/              <- one file per pipeline stage
    1-grid.md
    2-buildings.md
    3-floors.md
    4-roofs.md
    5-streets.md
    6-connectivity.md
    7-ladders.md
    8-walls.md
    9-geometry.md
    10-scene-and-export.md
    archive/                   <- superseded docs
```

## Document Structure

Each flow doc covers one pipeline stage and follows this structure:

```markdown
# Stage N: Stage Name

> Last verified: YYYY-MM-DD

## Overview
One paragraph: what this stage does and why it exists.

## Input Contract
The data shape this stage receives from the previous stage (or from config for Stage 1).

## Algorithm
Step-by-step: what the stage does, in order.
Include key decisions, thresholds, and edge cases.

## Output Contract
The data shape this stage adds to or returns.
Include field names, types, and what they represent.

## Key Files
- `src/generators/<stage>/index.js` — public entry point
- `src/generators/<stage>/<file>.js` — what each internal file handles

## Edge Cases & Constraints
- Known constraints enforced by this stage
- What happens at boundary conditions (e.g., very small maps, extreme damage levels)

## Testing Notes
- What the stage tests cover
- What seeds or inputs are used as regression anchors
```

## Writing Guidelines

- Be specific: include file paths, function names, field names, and data shapes
- Document the algorithm, not the code — explain what happens and why, not how each line works
- Call out non-obvious decisions (why BSP instead of grid? why 50% overlap threshold?)
- Include the "Last verified" date so staleness is visible
- Keep the algorithm section to ~5-15 numbered steps — if it's longer, the stage is probably too complex

## When to Update

Update a flow doc when:
- The stage's algorithm changes
- The input or output contract changes
- A new edge case or constraint is discovered and handled
- A significant bug was fixed (so future readers know why something works the way it does)

## When to Create

Create a flow doc when a stage is first implemented — not before. Flow docs describe running code, not planned code. Use `GENERATION_PIPELINE.md` for design specs before implementation.
