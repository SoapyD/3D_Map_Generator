# Stage 8: Export (GLB)

> Last verified: 2026-04-18

## Overview

Converts the fully-annotated pipeline data into a Three.js scene and exports it as a `.glb` file. This is the only stage that constructs Three.js geometry. All prior stages work in abstract data (rects, heights, material keys); the exporter is the single place where that abstract data becomes 3D meshes.

## Input Contract

```js
{
  floors: Floor[],
  walls: Wall[],
  connections: Connection[],
  coverElements: CoverElement[],
  materials: Material[],         // from Stage 7
  seed: number,
  config: Config,                // full config object, stored in GLB extras
}
```

## Algorithm

### Phase A: Material Setup

1. For each entry in `materials[]`, create a `THREE.MeshStandardMaterial` with its texture:
   - Load the texture file from `assets/textures/`
   - Set `repeat` based on the element's `uvScale` (applied per-mesh, not per-material)
   - Set `wrapS` and `wrapT` to `THREE.RepeatWrapping`
2. Cache materials by key to avoid duplicates in the Three.js scene

### Phase B: Geometry Construction

For each element in all collections (floors, walls, connections, coverElements):

3. Create a `THREE.BoxGeometry` using the element's dimensions:
   - `width` = element's X extent
   - `height` = element's vertical thickness or height
   - `depth` = element's Z extent
4. Apply the element's UV scale to the geometry's UV attribute
5. Create a `THREE.Mesh` from the geometry and its material
6. Set the mesh position from the element's `rect` (XZ) and `y`
7. Apply rotation if the element has a non-zero `rotation` (cover elements)
8. Add the mesh to the scene

**For floors and walls with openings/cutouts:** The abstract rect decomposition from prior stages is used directly — each sub-rect becomes a separate mesh. This avoids CSG (constructive solid geometry) entirely. Multiple meshes per floor/wall is acceptable because TTS handles polygon count, not mesh count.

### Phase C: Scene Assembly

9. Add all meshes to a `THREE.Group` (one group per building, plus a group for connections and a group for cover)
10. Add metadata to the scene's `userData`: `{ seed, config, generatedAt }`

### Phase D: GLB Export

11. Run `THREE.GLTFExporter` on the assembled scene
12. Write the binary output to `output/mordheim_map_{seed}.glb`
13. Log the output file path, file size, and approximate polygon count

## Output Contract

A `.glb` file at `output/mordheim_map_{seed}.glb` containing:
- All geometry with embedded textures
- Scene `userData` with seed and config (accessible from TTS Lua scripting via object.getCustomObject())
- Scale: 1 unit = 1 inch (TTS default scale is 1 unit = 1 inch)

## Key Files

- `src/export/glb-exporter.js` — main exporter, orchestrates phases A-D
- `src/export/obj-geometry/` — helper functions for constructing box geometries with UV
- `src/core/geometry.js` — shared geometry helpers (merge, extrude)
- `src/core/merge-buffer-geometries.js` — merges multiple BufferGeometries into one for efficiency

## Edge Cases & Constraints

- Textures must be loaded synchronously-equivalent before export begins — GLTFExporter is async, so texture loading is awaited upfront
- File size target is < 50MB for TTS compatibility — if exceeded, a warning is logged (no auto-reduction)
- Polygon count target is < 500k triangles — logged alongside the warning if exceeded
- The output directory is created if it does not exist; existing files with the same seed name are overwritten

## Testing Notes

- Tests verify the output `.glb` file exists and has a non-zero file size after export
- Tests verify the file size is below the 50MB threshold for the standard seed-42 test case
- Integration: running `node src/index.js --seed 1 --seed 42 --seed 999` and comparing file sizes across runs is the primary regression check
