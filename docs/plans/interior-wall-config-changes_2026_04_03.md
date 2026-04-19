# Interior Wall Config Changes

## Overview
Increase interior wall frequency for medium buildings and separate damage ratios so internal walls can be less damaged than external ones.

## Changes

### 1. Update medium interior wall chance
- **File:** `src/config.js`
- Change `interiorWallChance.medium` from `0.2` to `0.75`

### 2. Rename existing removal ratios to be external-specific
- **File:** `src/config.js`
- Rename `upperRemovalRatio` → `externalUpperRemovalRatio`
- Rename `lowerRemovalRatio` → `externalLowerRemovalRatio`
- Values stay the same (0.7 and 0.5)

### 3. Add internal wall removal ratios
- **File:** `src/config.js`
- Add `internalUpperRemovalRatio: 0.5`
- Add `internalLowerRemovalRatio: 0.25`

### 4. Update apply-wall-damage to accept wall type
- **File:** `src/generators/walls/apply-wall-damage.js`
- Add a third parameter (e.g. `type = 'external'`) to `applyWallDamage`
- Read the appropriate ratio pair from `WALL` config based on type

### 5. Pass wall type from callers
- **File:** `src/generators/walls/generate-exterior-walls.js`
  - Pass `'external'` to `applyWallDamage`
- **File:** `src/generators/walls/generate-interior-walls.js`
  - Pass `'internal'` to `applyWallDamage`
