# Package Integration Plan: 3D Map Generator into WyrdWars

## Overview

Integrate `3d-map-generator` (a CLI-only procedural city map generator outputting GLB/OBJ/PNG) into the `wyrdwars` monorepo as a reusable workspace package, expose it via a Fastify API route, serve generated files, build a frontend generation UI, and provide a TTS Lua script for spawning generated maps.

---

## 1. Making the Map Generator a Reusable Package

### Current state
- `src/index.js` is a CLI entry point: parses `process.argv`, runs the pipeline, writes files to `config.outputDir`
- `parseArgs()` in `src/config.js` couples config parsing to CLI argv
- Exports: GLB, OBJ + PNG texture atlas, collision OBJ
- Single dependency: `three` (used for scene building and geometry, NOT browser three.js -- the exporters are hand-rolled for Node)
- `pngjs` is imported inside `obj-exporter.js` (via `PNG`) but is NOT listed in package.json -- this is a missing dependency that must be fixed

### Changes required

**a) Add missing dependency**
```
npm install pngjs
```
Add `"pngjs": "^7.0.0"` to `package.json` dependencies.

**b) Create `src/lib.js` -- the library entry point**

Extract the generation pipeline from `main()` in `src/index.js` into a pure function:

```js
// src/lib.js
export { generateMap } from './generate.js';
export { parseArgs, DEFAULTS } from './config.js';
```

**c) Create `src/generate.js` -- the core generate function**

```js
// src/generate.js
import { mkdir } from 'fs/promises';
import path from 'path';
import { createRng } from './core/rng.js';
import { generateGrid } from './generators/grid.js';
import { generateBuildings } from './generators/buildings.js';
import { generateFloors } from './generators/floors.js';
import { generateWalls } from './generators/walls.js';
import { generateConnectivity } from './generators/connectivity.js';
import { generateCover } from './generators/cover.js';
import { buildScene } from './generators/scene-builder.js';
import { exportToGlb, getOutputPath } from './export/glb-exporter.js';
import { exportToObj, getObjOutputPath } from './export/obj-exporter.js';
import { exportCollisionObj } from './export/collision-exporter.js';

/**
 * Generate a complete map from a config object.
 * @param {object} config - Must include: seed, mapWidth, mapDepth, tiers,
 *   tierHeight, slabThickness, wallThickness, streetWidth, damageLevel,
 *   maxSightline, textureSet, outputDir.
 * @returns {Promise<{glbPath: string, objPath: string, texturePath: string, collisionPath: string}>}
 */
export async function generateMap(config) {
  const rng = createRng(config.seed);

  const gridData = generateGrid(config, rng);
  const buildingData = generateBuildings(gridData, config, rng);
  const floorData = generateFloors(buildingData, config, rng);
  const wallData = generateWalls(floorData, config, rng);
  const connData = generateConnectivity(wallData, config, rng);
  const coverData = generateCover(connData, config, rng);
  const scene = buildScene(coverData, config);

  await mkdir(config.outputDir, { recursive: true });

  const glbPath = getOutputPath(config);
  await exportToGlb(scene, glbPath);

  const { dir, baseName } = getObjOutputPath(config);
  const objPath = await exportToObj(coverData, config, dir, baseName);
  const collisionPath = await exportCollisionObj(scene, dir, baseName);
  const texturePath = path.join(dir, baseName + '.png');

  return { glbPath, objPath, texturePath, collisionPath, seed: config.seed };
}
```

**d) Export DEFAULTS from config.js**

Already exported via `parseArgs`, but also export the raw DEFAULTS object so consumers can spread their own overrides:

```js
export { DEFAULTS };  // add to config.js
```

**e) Update `package.json` exports**

```json
{
  "name": "@wyrdwars/map-generator",
  "exports": {
    ".": "./src/lib.js",
    "./cli": "./src/index.js"
  },
  "bin": {
    "map-generate": "src/index.js"
  }
}
```

**f) Keep `src/index.js` as the CLI wrapper**

It should import from `./generate.js` and just handle argv parsing + console output + preview flag.

---

## 2. Adding as a Workspace Package in the WyrdWars Monorepo

### Monorepo structure (current)
```
wyrdwars/
  package.json          # workspaces: ["apps/*", "shared", "utils", "api"]
  api/                  # @wyrdwars/api - Fastify server
  apps/
    wyrdwars/           # Main frontend app
    admin/              # Admin frontend
    component_demo/     # Component demo
  shared/               # @wyrdwars/shared - React components
  utils/                # @wyrdwars/utils - DB, controllers, middleware, types
```

### Steps

1. **Copy or symlink the map generator into the monorepo:**
   ```
   wyrdwars/
     packages/
       map-generator/    # the 3d-map-generator codebase
   ```
   Alternatively, keep it as a separate repo and use `npm link` or a git submodule. A `packages/` directory is cleanest.

2. **Update root `package.json` workspaces:**
   ```json
   "workspaces": [
     "apps/*",
     "shared",
     "utils",
     "api",
     "packages/*"
   ]
   ```

3. **Rename package to `@wyrdwars/map-generator`** in its `package.json`.

4. **Add it as a dependency in `api/package.json`:**
   ```json
   "@wyrdwars/map-generator": "*"
   ```

5. **Run `npm install`** from the root to wire up the workspace link.

### Important: three.js in server context

`three` works fine in Node.js for geometry/math operations. The map generator already avoids browser APIs (it hand-builds GLB, uses `pngjs` for textures). No changes needed here. Just be aware that `three` is ~2MB and will be bundled into the API's `node_modules`.

---

## 3. API Route Design

### New route file: `api/src/routes/maps.ts`

Register in `app.ts`:
```ts
const { mapRoutes } = await import('./routes/maps.js');
await app.register(mapRoutes, { prefix: '/api/v1/maps' });
```

### Endpoints

#### `POST /api/v1/maps/generate`
**Auth:** `withAuth` (Bearer token, same pattern as all other routes)

**Request body:**
```json
{
  "seed": 42,              // optional, random if omitted
  "mapWidth": 48,          // optional, default 48
  "mapDepth": 48,          // optional, default 48
  "tiers": 4,              // optional, default 4
  "tierHeight": 3,         // optional, default 3
  "damageLevel": 0.5       // optional, default 0.5
}
```

**Response (202 or 200):**
```json
{
  "success": true,
  "data": {
    "mapId": "abc123",
    "seed": 42,
    "status": "complete",
    "files": {
      "glb": "/api/v1/maps/abc123/files/model.glb",
      "obj": "/api/v1/maps/abc123/files/model.obj",
      "texture": "/api/v1/maps/abc123/files/texture.png",
      "collision": "/api/v1/maps/abc123/files/collision.obj"
    },
    "createdAt": "2026-03-28T12:00:00Z"
  }
}
```

**Implementation notes:**
- Generation takes 1-5 seconds depending on map size. For a first pass, run synchronously and return 200 with results. If it gets slow, move to a job queue pattern (return 202 + poll endpoint).
- Generate a unique `mapId` (e.g., `crypto.randomUUID()`) for each generation.
- Store metadata in MongoDB (optional, or just use filesystem).

#### `GET /api/v1/maps/:mapId/files/:filename`
**Auth:** `withAuth`

Serves the generated static files (GLB, OBJ, PNG). Sets appropriate `Content-Type` headers:
- `.glb` -> `model/gltf-binary`
- `.obj` -> `text/plain`
- `.png` -> `image/png`

#### `GET /api/v1/maps`
**Auth:** `withAuth`

List user's generated maps (if storing metadata in DB). Returns array of map summaries with seeds, timestamps, file URLs.

#### `DELETE /api/v1/maps/:mapId`
**Auth:** `withAuth`

Delete a generated map and its files from disk.

#### `GET /api/v1/maps/:mapId/tts-script`
**Auth:** `withAuth`

Returns a ready-to-paste TTS Lua snippet with the correct URLs baked in for this specific map.

### Validation

Use Fastify schema validation (JSON Schema) on the POST body:
```ts
const generateSchema = {
  body: {
    type: 'object',
    properties: {
      seed: { type: 'integer', minimum: 0, maximum: 999999 },
      mapWidth: { type: 'number', minimum: 12, maximum: 96 },
      mapDepth: { type: 'number', minimum: 12, maximum: 96 },
      tiers: { type: 'integer', minimum: 1, maximum: 6 },
      tierHeight: { type: 'number', minimum: 1, maximum: 6 },
      damageLevel: { type: 'number', minimum: 0, maximum: 1 },
    },
  },
};
```

---

## 4. File Serving Strategy

### Storage location

```
wyrdwars/
  api/
    data/
      maps/
        <mapId>/
          model.glb
          model.obj
          model.png
          collision.obj
```

Use `path.resolve(__dirname, '../../data/maps')` as the base directory in the API. Add `data/` to `.gitignore`.

The map generator's `config.outputDir` will be set to `data/maps/<mapId>/` and the `seed` filename pattern overridden so files have predictable names (`model.glb` instead of `mordheim_map_42.glb`).

### Serving

Use Fastify's `reply.sendFile()` or raw `fs.createReadStream()` + pipe to response. Since files can be 5-50MB (GLB with embedded textures), stream rather than buffer:

```ts
app.get('/:mapId/files/:filename', { preHandler: [withAuth] }, async (request, reply) => {
  const { mapId, filename } = request.params;
  const filePath = path.join(MAPS_DIR, mapId, filename);

  // Validate filename is one of the expected files
  const ALLOWED = ['model.glb', 'model.obj', 'model.png', 'collision.obj'];
  if (!ALLOWED.includes(filename)) return reply.status(404).send({ error: 'Not found' });

  const stream = fs.createReadStream(filePath);
  const contentTypes = {
    'model.glb': 'model/gltf-binary',
    'model.obj': 'text/plain',
    'model.png': 'image/png',
    'collision.obj': 'text/plain',
  };
  return reply.type(contentTypes[filename]).send(stream);
});
```

### Cleanup policy

Options (implement one or both):
1. **Per-user cap:** Max 10 stored maps per user. When generating the 11th, delete the oldest.
2. **TTL-based:** Delete maps older than 7 days via a cron job or on-access check.
3. **Manual only (MVP):** Users delete maps themselves via the DELETE endpoint or UI.

For MVP, go with option 3 + a per-user cap of 10 maps.

### TTS external access

TTS Lua scripts fetch files via HTTP. The API must be accessible from the internet for TTS to load models. Options:
- Deploy to a server with a public URL
- Use ngrok/cloudflare tunnel for dev
- For the file-serve endpoint specifically, consider making it accessible via a short-lived token in the URL query param (so TTS doesn't need Bearer auth headers): `GET /api/v1/maps/:mapId/files/:filename?token=<short-lived-token>`

---

## 5. Frontend Integration

### Generation UI page: `/maps/generate`

**Controls (form):**
- Seed input (number, optional -- "random" button)
- Map size preset dropdown: Small (24x24), Medium (36x36), Large (48x48), Custom
- Custom width/depth sliders (12-96 range) if "Custom" selected
- Tiers slider (1-6)
- Damage level slider (0-1 with labels: Pristine / Light / Moderate / Heavy / Ruined)
- "Generate Map" button

**Generation flow:**
1. User clicks Generate
2. Show loading spinner with progress text ("Generating city grid...", etc. -- or just a generic spinner since server-side generation is opaque)
3. On completion, show the preview + download links

### Map preview component

Use `@google/model-viewer` or `three.js` with `GLTFLoader` to show the GLB in-browser:

```tsx
// apps/wyrdwars/src/components/MapPreview.tsx
<model-viewer
  src={glbUrl}
  camera-controls
  auto-rotate
  shadow-intensity="1"
  style={{ width: '100%', height: '400px' }}
/>
```

`model-viewer` is the simplest option -- it's a web component, no React wrapper needed, ~150KB.

### Map list page: `/maps`

- Grid of previously generated maps (thumbnail could be a pre-rendered top-down screenshot, or just metadata cards)
- Each card shows: seed, size, tiers, date, action buttons
- Actions: Preview (opens 3D viewer), Download (GLB/OBJ zip), Copy TTS Script, Delete

### Download links

Provide individual file downloads and a "Download All" that zips the files server-side (or just individual links for GLB, OBJ, PNG, collision OBJ).

---

## 6. TTS Lua Script Design

### Auth flow

TTS Lua can make HTTP requests via `WebRequest`. The auth flow:

1. User generates a map in the WyrdWars web app
2. Web app shows a "Copy TTS Script" button that includes a **short-lived download token** (e.g., 1-hour expiry JWT or a random token stored in DB)
3. The Lua script uses this token as a query parameter (TTS Lua `WebRequest` does not easily support custom headers)

### API endpoint for TTS tokens

`POST /api/v1/maps/:mapId/tts-token`
- Auth: `withAuth`
- Returns: `{ token: "abc...", expiresAt: "...", baseUrl: "https://your-api.com/api/v1/maps/<mapId>/files" }`

The file-serve endpoint accepts `?token=<tts-token>` as an alternative to Bearer auth.

### Lua script template

```lua
-- WyrdWars Map Loader for Tabletop Simulator
-- Paste this into a Global script or Object script

local BASE_URL = "{{BASE_URL}}"
local TOKEN = "{{TOKEN}}"
local MAP_ID = "{{MAP_ID}}"

function onLoad()
    -- Spawn the main model (OBJ + texture)
    local modelUrl = BASE_URL .. "/model.obj?token=" .. TOKEN
    local textureUrl = BASE_URL .. "/model.png?token=" .. TOKEN
    local collisionUrl = BASE_URL .. "/collision.obj?token=" .. TOKEN

    local params = {
        type = "Custom_Model",
        position = {x=0, y=0, z=0},
        rotation = {x=0, y=0, z=0},
        scale = {x=1, y=1, z=1},
    }
    local obj = spawnObject(params)
    obj.setCustomObject({
        mesh = modelUrl,
        diffuse = textureUrl,
        collider = collisionUrl,
        material = 0,  -- Plastic
        type = 0,       -- Generic
    })
    obj.setLock(true)
    obj.setName("Mordheim Map (seed {{SEED}})")
end
```

### What the frontend "Copy TTS Script" button does

1. Calls `POST /api/v1/maps/:mapId/tts-token` to get a fresh token
2. Interpolates the token, base URL, map ID, and seed into the Lua template
3. Copies the result to clipboard
4. User pastes into TTS scripting console

---

## 7. Dependencies to Watch

| Dependency | Concern | Mitigation |
|---|---|---|
| `three` (~2MB) | Large, but only used for geometry math in Node.js. No browser APIs used. | Already works. Keep it. Don't try to tree-shake -- the map generator uses BufferGeometry, Matrix4, Color, etc. extensively. |
| `pngjs` | **Missing from package.json** but imported in `obj-exporter.js`. | Add it to dependencies immediately. |
| `fs/promises`, `path` | Node built-ins, no issue. | N/A |
| File system writes | Generator writes to disk. Must control output paths to prevent path traversal. | Sanitize mapId (UUID only), resolve outputDir to an absolute path under `data/maps/`. |
| Memory usage | Large maps (96x96, 6 tiers) may use significant memory during generation due to Three.js scene graph. | Set per-request memory limits or reject oversized configs. Monitor in production. |
| Concurrent generation | Multiple users generating simultaneously will compete for CPU. | For MVP, allow only 1 concurrent generation (use a simple mutex/semaphore). Scale later with a job queue. |
| `textureSet` / texture pack files | `obj-exporter.js` loads texture PNGs from disk via `loadTexPool()` which reads from a `textures/` directory relative to the project. | Ensure the `textures/` directory is included in the workspace package, or configure the path via config. |

---

## 8. Migration Steps (in order)

### Phase 1: Package cleanup (map generator repo)

1. Add `pngjs` to `package.json` dependencies
2. Export `DEFAULTS` from `src/config.js`
3. Create `src/generate.js` with the `generateMap()` function extracted from `src/index.js`
4. Create `src/lib.js` re-exporting `generateMap` and `DEFAULTS`
5. Refactor `src/index.js` to import from `./generate.js` instead of duplicating the pipeline
6. Update `package.json`: set `"name": "@wyrdwars/map-generator"`, add `"exports"` field, add `"bin"` field
7. Allow `outputDir` and filename pattern to be configurable (so the API can control where files go and what they're named)
8. Test: `node src/index.js --seed 42` still works, and `import { generateMap } from './src/lib.js'` works

### Phase 2: Monorepo integration

9. Copy/move the map generator into `wyrdwars/packages/map-generator/`
10. Add `"packages/*"` to root `package.json` workspaces array
11. Add `"@wyrdwars/map-generator": "*"` to `api/package.json` dependencies
12. Run `npm install` from the monorepo root
13. Verify: `import { generateMap } from '@wyrdwars/map-generator'` resolves in the API code

### Phase 3: API routes

14. Create `api/src/routes/maps.ts` with the generate endpoint
15. Create a controller in `utils/src/controllers/maps.ts` (following existing pattern where routes delegate to controllers)
16. Add Fastify schema validation for the request body
17. Wire up `withAuth` middleware
18. Register routes in `app.ts` under `/api/v1/maps`
19. Add the file-serve endpoint with streaming + content-type headers
20. Add `data/` to `.gitignore`
21. Test: `curl -X POST http://localhost:4000/api/v1/maps/generate -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"seed": 42}'`

### Phase 4: Map management

22. Create a `Map` Mongoose model in `utils/src/db/models/` to store map metadata (userId, mapId, seed, config, createdAt, file paths)
23. Add GET `/api/v1/maps` (list), DELETE `/api/v1/maps/:mapId` (cleanup files + DB record)
24. Implement per-user cap (10 maps, delete oldest on overflow)

### Phase 5: TTS support

25. Add token-based file access (`?token=` query param alternative to Bearer auth)
26. Create `POST /api/v1/maps/:mapId/tts-token` endpoint
27. Create `GET /api/v1/maps/:mapId/tts-script` endpoint that returns the Lua template with interpolated URLs
28. Test end-to-end: generate map, get script, paste into TTS, model loads

### Phase 6: Frontend

29. Add a `/maps` route to the wyrdwars frontend app
30. Build the generation form component (seed, size, tiers, damage sliders)
31. Build the map preview component (model-viewer or three.js GLTFLoader)
32. Build the map list view with download/delete/copy-script actions
33. Wire up API calls with the existing auth token flow

### Phase 7: Polish

34. Add rate limiting to the generate endpoint (e.g., 5 maps/hour/user)
35. Add generation progress feedback (WebSocket or SSE) if generation time warrants it
36. Add map thumbnails (render a top-down view server-side or capture from the preview component)
37. Add "Download All" as a zip file
38. Add map sharing (public link with read-only token)

---

## File tree after integration

```
wyrdwars/
  package.json                          # workspaces += "packages/*"
  api/
    package.json                        # deps += "@wyrdwars/map-generator"
    data/
      maps/
        <uuid>/
          model.glb
          model.obj
          model.png
          collision.obj
    src/
      routes/
        maps.ts                         # NEW
      app.ts                            # register mapRoutes
  packages/
    map-generator/                      # MOVED from 3d_map_generator
      package.json                      # @wyrdwars/map-generator
      src/
        lib.js                          # NEW - library entry
        generate.js                     # NEW - extracted pipeline
        index.js                        # CLI entry (refactored)
        config.js                       # (add DEFAULTS export)
        ...
  utils/
    src/
      controllers/
        maps.ts                         # NEW
      db/models/
        Map.ts                          # NEW
  apps/
    wyrdwars/
      src/
        pages/
          maps/                         # NEW
            MapGeneratePage.tsx
            MapListPage.tsx
        components/
          maps/                         # NEW
            MapPreview.tsx
            MapGenerateForm.tsx
            MapCard.tsx
            TtsScriptModal.tsx
```
