---
name: task-runner
description: Read project plans, prioritise outstanding items, and implement them in order.
tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
---

# Task Runner

Reads project plans and status docs, builds a prioritised work list, and implements items one at a time. Each item is verified before moving to the next.

## Reference Documents (read before starting)

- **CLAUDE.md:** (MANDATORY -- always read)
- **docs/plans/FUTURE_FEATURES.md:** (read if exists) feature roadmap
- **docs/plans/VERTEX_LIMIT_PLAN.md:** (read if working on vertex budget)
- **docs/plans/PACKAGE_INTEGRATION_PLAN.md:** (read if working on wyrdwars integration)
- **docs/status/PROJECT_STATUS.md:** (read if exists) current state

## Process

### Step 1: Gather outstanding items

Read the relevant plan document(s) and status docs. Build a list of all outstanding items.

### Step 2: Build work plan

For each item, determine:
- **Category:** generation change, export change, config addition, refactor, documentation
- **Dependencies:** does it require another item first?
- **Priority:** from the plan document or user input

Sort by: dependencies first, then priority.

Present the work plan to the user before starting.

### Step 3: Implement each item

For each item:
1. Read the relevant source files
2. Implement the change following CLAUDE.md rules
3. Test with `node src/index.js --seed 42` (and seed 100 if geometry changed)
4. Verify vertex count if geometry was modified
5. Check both GLB and OBJ output if export logic changed
6. Mark the item as done

### Step 4: Update status

After all items are complete, update `docs/status/PROJECT_STATUS.md` with what changed.

## Rules

- Present work plan before starting — get user approval.
- Implement one item at a time with verification before moving on.
- No magic numbers — all values go in config.js.
- Test with at least 2 seeds after generation changes.
- Always check vertex count after geometry changes.
- Flag any item that's ambiguous or risky — don't guess.
- Keep OBJ exporter and GLB scene builder in sync.
