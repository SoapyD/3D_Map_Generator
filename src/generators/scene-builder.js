/**
 * Scene Builder — converts pipeline data into Three.js scene geometry.
 * Uses debug colours when config.debug is true, textured materials otherwise.
 */

import * as THREE from 'three';
import { createFloorSlab, createWallSlab, createSlab, createLadderMesh } from '../core/geometry.js';
import { buildTexturePools, pickFromPool } from './textures.js';
import { LADDER_DISPLAY, COVER, GEOMETRY, CONNECTIVITY } from '../config.js';

// Debug materials (flat colours)
const DEBUG_MATERIALS = {
  base: new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 }),
  floor: [
    new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x7a6848, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x6b5c3e, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x5c5034, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x4d442a, roughness: 0.8 }),
  ],
  wall: new THREE.MeshStandardMaterial({ color: 0x9b8b75, roughness: 0.85 }),
  ladder: new THREE.MeshStandardMaterial({ color: 0xcccc22, roughness: 0.7 }),
  walkway: new THREE.MeshStandardMaterial({ color: 0x4488cc, roughness: 0.7 }),
  ramp: new THREE.MeshStandardMaterial({ color: 0x44aa44, roughness: 0.7 }),
  groundLadder: new THREE.MeshStandardMaterial({ color: 0xcc4444, roughness: 0.7 }),
  orangeLadder: new THREE.MeshStandardMaterial({ color: 0xee8822, roughness: 0.7 }),
  cover: new THREE.MeshStandardMaterial({ color: 0x8844cc, roughness: 0.7 }),
  interiorCover: new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7 }),
  deletedFootprint: new THREE.MeshStandardMaterial({ color: 0xff66aa, roughness: 0.7 }),
  badLadder: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 }),
  interiorLadder: new THREE.MeshStandardMaterial({ color: 0x22cccc, roughness: 0.7 }),
  ladderPlatform: new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.7 }),
  streetScatter: new THREE.MeshStandardMaterial({ color: 0x22ee44, roughness: 0.7 }),
  pillar: new THREE.MeshStandardMaterial({ color: 0x666644, roughness: 0.9 }),
};

/**
 * Find which building a floor section or wall belongs to.
 */
function findBuildingIndex(x, z, buildings) {
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (x >= b.x - 0.5 && x <= b.x + b.w + 0.5 && z >= b.z - 0.5 && z <= b.z + b.d + 0.5) {
      return i;
    }
  }
  return -1;
}

/** Get the texture group index for a building (for consistent textures across composite parts) */
function getTextureIndex(bi, buildings) {
  if (bi < 0 || bi >= buildings.length) return bi;
  const b = buildings[bi];
  return b.textureGroup !== undefined ? b.textureGroup : bi;
}

/**
 * Build a Three.js scene from the pipeline data.
 */
export function buildScene(data, config) {
  const scene = new THREE.Scene();
  const debug = config.debug;

  // Build texture pools for textured mode
  let pools = null;
  if (!debug) {
    pools = buildTexturePools(config.textureSet || 'base');
  }

  // Build floor slabs
  for (const floorData of data.floors) {
    const tier = floorData.tier;
    const y = tier * config.tierHeight;

    for (const section of floorData.sections) {
      let material;
      if (debug) {
        material = tier === 0
          ? DEBUG_MATERIALS.base
          : DEBUG_MATERIALS.floor[Math.min(tier - 1, DEBUG_MATERIALS.floor.length - 1)];
      } else if (tier === 0) {
        material = pickFromPool(pools.base_map, Math.floor(section.x * 7 + section.z * 13));
      } else {
        const bi = findBuildingIndex(section.x, section.z, data.buildings);
        const ti = getTextureIndex(bi, data.buildings);
        if (bi >= 0 && data.buildings[bi].size !== 'small') {
          material = pickFromPool(pools.floors, ti);
        } else {
          material = pickFromPool(pools.floors, ti >= 0 ? ti : 0);
        }
      }

      const mesh = createFloorSlab(section, y, config.slabThickness, material);
      mesh.name = `floor_t${tier}_${Math.round(section.x)}_${Math.round(section.z)}`;
      scene.add(mesh);
    }
  }

  // Build wall slabs
  if (data.walls) {
    for (let i = 0; i < data.walls.length; i++) {
      const w = data.walls[i];
      let material;
      if (debug) {
        material = DEBUG_MATERIALS.wall;
      } else {
        const bi = findBuildingIndex(w.x, w.z, data.buildings);
        const ti = getTextureIndex(bi, data.buildings);
        if (bi >= 0 && (data.buildings[bi].size === 'large' || data.buildings[bi].size === 'medium')) {
          material = pickFromPool(pools.landmark_walls, ti);
        } else {
          material = pickFromPool(pools.walls, ti >= 0 ? ti : i);
        }
      }
      const mesh = createWallSlab(w.x, w.z, w.length, w.height, w.baseY, w.thickness, w.axis, material);
      mesh.name = `wall_${i}`;
      scene.add(mesh);
    }
  }

  // Roofs (flat and pyramid)
  if (data.roofs) {
    for (let ri = 0; ri < data.roofs.length; ri++) {
      const roof = data.roofs[ri];
      const roofTi = getTextureIndex(roof.buildingIndex, data.buildings);
      const roofMat = debug ? DEBUG_MATERIALS.floor[0] : pickFromPool(pools.roofs, roofTi);
      const ceilingMat = debug ? DEBUG_MATERIALS.floor[0] : pickFromPool(pools.floors, roofTi);

      if (roof.type === 'flat') {
        const y = roof.tier * config.tierHeight;
        const mesh = createFloorSlab(
          { x: roof.section.x, z: roof.section.z, w: roof.section.w, d: roof.section.d },
          y, config.slabThickness, roofMat
        );
        mesh.name = `roof_${ri}`;
        scene.add(mesh);
      } else if (roof.type === 'pyramid') {
        const b = roof.building;
        const topY = roof.tier * config.tierHeight;
        const apexY = topY + Math.min(b.w, b.d) * 0.6;
        const cx = b.x + b.w / 2;
        const cz = b.z + b.d / 2;

        // 4 sloped sides (outward-facing)
        const positions = new Float32Array([
          b.x + b.w, topY, b.z,  b.x, topY, b.z,  cx, apexY, cz,
          b.x + b.w, topY, b.z + b.d,  b.x + b.w, topY, b.z,  cx, apexY, cz,
          b.x, topY, b.z + b.d,  b.x + b.w, topY, b.z + b.d,  cx, apexY, cz,
          b.x, topY, b.z,  b.x, topY, b.z + b.d,  cx, apexY, cz,
        ]);

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.computeVertexNormals();

        const mesh = new THREE.Mesh(geo, roofMat);
        mesh.name = `roof_pyramid_${ri}`;
        scene.add(mesh);

        // Flat ceiling quad under pyramid — floor texture, downward-facing
        const ceilPositions = new Float32Array([
          b.x, topY, b.z,  b.x + b.w, topY, b.z,  b.x + b.w, topY, b.z + b.d,
          b.x, topY, b.z,  b.x + b.w, topY, b.z + b.d,  b.x, topY, b.z + b.d,
        ]);
        const ceilNormals = new Float32Array([
          0, -1, 0,  0, -1, 0,  0, -1, 0,
          0, -1, 0,  0, -1, 0,  0, -1, 0,
        ]);
        const ceilUVs = new Float32Array([
          0, 0,  1, 0,  1, 1,
          0, 0,  1, 1,  0, 1,
        ]);
        const ceilGeo = new THREE.BufferGeometry();
        ceilGeo.setAttribute('position', new THREE.Float32BufferAttribute(ceilPositions, 3));
        ceilGeo.setAttribute('normal', new THREE.Float32BufferAttribute(ceilNormals, 3));
        ceilGeo.setAttribute('uv', new THREE.Float32BufferAttribute(ceilUVs, 2));
        const ceilMesh = new THREE.Mesh(ceilGeo, ceilingMat);
        ceilMesh.name = `roof_pyramid_ceiling_${ri}`;
        scene.add(ceilMesh);
      }
    }
  }

  // Build connections
  if (data.connections) {
    const { ladders, walkways } = data.connections;

    const ladderOpts = {
      poleRadius: LADDER_DISPLAY.poleRadius,
      rungRadius: LADDER_DISPLAY.rungRadius,
      rungSpacing: LADDER_DISPLAY.rungSpacing,
      rungInset: LADDER_DISPLAY.rungInset,
    };

    // Helper: add ladder (box + mesh versions)
    function addLadder(l, material, name) {
      if (LADDER_DISPLAY.showBoxLadders) {
        const height = l.y1 - l.y0;
        const box = createSlab(l.x + l.w / 2, l.y0 + height / 2, l.z + l.d / 2, l.w, height, l.d, material);
        box.name = name + '_box';
        scene.add(box);
      }
      if (LADDER_DISPLAY.showMeshLadders) {
        const mesh = createLadderMesh(l, material, ladderOpts);
        if (mesh) {
          mesh.name = name;
          scene.add(mesh);
        }
      }
    }

    // Yellow ladders
    for (let i = 0; i < ladders.length; i++) {
      const material = debug ? DEBUG_MATERIALS.ladder : pickFromPool(pools.ladders, i);
      addLadder(ladders[i], material, `ladder_${i}`);
    }

    // Walkways — branches share their parent's texture via textureId
    for (let i = 0; i < walkways.length; i++) {
      const w = walkways[i];
      let material;
      if (debug) {
        material = w.blocked ? DEBUG_MATERIALS.ramp : DEBUG_MATERIALS.walkway;
      } else {
        const texIdx = (w.textureId !== undefined && w.branch)
          ? walkways.findIndex(ww => ww.textureId === w.textureId && !ww.branch)
          : i;
        material = pickFromPool(pools.walkways, texIdx >= 0 ? texIdx : i);
      }
      const mesh = createFloorSlab({ x: w.x, z: w.z, w: w.w, d: w.d }, w.y, GEOMETRY.walkwayThickness, material, { rotateUV: w.w > w.d });
      mesh.name = w.blocked ? `walkway_BLOCKED_${i}` : `walkway_${i}`;
      scene.add(mesh);
    }

    // Bridges
    const bridges = data.connections.bridges || [];

    // Collect all branch connections (walkways + bridges) to cut gaps in parent bridge walls
    const allBranches = [
      ...walkways.filter(w => w.branch),
      ...bridges.filter(b => b.branch),
    ];

    for (let i = 0; i < bridges.length; i++) {
      const b = bridges[i];
      const bridgeThickness = CONNECTIVITY.bridgeThickness || 0.5;
      const wallH = CONNECTIVITY.bridgeWallHeight || 0.75;
      const wallT = CONNECTIVITY.bridgeWallThickness || 0.25;

      // Bridge slab — branches use their parent's texture via textureId
      const bridgeTexIdx = (b.textureId !== undefined) ? bridges.findIndex(br => br.textureId === b.textureId && !br.branch) : i;
      const slabMat = debug ? DEBUG_MATERIALS.walkway : pickFromPool(pools.landmark_walls, bridgeTexIdx >= 0 ? bridgeTexIdx : i);
      const slab = createFloorSlab({ x: b.x, z: b.z, w: b.w, d: b.d }, b.y, bridgeThickness, slabMat, { rotateUV: b.w > b.d });
      slab.name = `bridge_${i}`;
      scene.add(slab);

      // Find branches that connect to this bridge (same textureId, same tier)
      const branchGaps = [];
      for (const br of allBranches) {
        if (br.textureId !== b.textureId || Math.abs(br.y - b.y) > 0.5) continue;
        // Branch must be perpendicular to this bridge
        if (br.axis === b.axis) continue;
        branchGaps.push(br);
      }

      // Side walls — split into segments with gaps where branches connect
      const wallMat = debug ? DEBUG_MATERIALS.wall : pickFromPool(pools.landmark_walls, i + 100);
      const wallY = b.y + bridgeThickness;

      // Helper: render wall segments along the bridge, skipping gap regions
      // wallAxis: the axis the wall runs along ('x' or 'z')
      // wallStart/wallEnd: start and end positions along that axis
      // fixedPos: the fixed cross-axis position (centre of the thin wall)
      // wallLen: length dimension for createSlab (wallT for thin dimension)
      function renderWallSegments(wallAxis, wallStart, wallEnd, fixedPos, isXWall) {
        // Collect gap intervals along the wall's run
        const gaps = [];
        for (const br of branchGaps) {
          let brMin, brMax;
          if (wallAxis === 'x') {
            // Wall runs along X; branch crosses in Z
            // Check branch Z range overlaps the wall's fixed Z position
            const brZ1 = br.z, brZ2 = br.z + br.d;
            if (fixedPos < brZ1 - 0.5 || fixedPos > brZ2 + 0.5) continue;
            brMin = br.x;
            brMax = br.x + br.w;
          } else {
            // Wall runs along Z; branch crosses in X
            const brX1 = br.x, brX2 = br.x + br.w;
            if (fixedPos < brX1 - 0.5 || fixedPos > brX2 + 0.5) continue;
            brMin = br.z;
            brMax = br.z + br.d;
          }
          // Clamp to wall range and add margin
          const margin = 0.25;
          const gapStart = Math.max(wallStart, brMin - margin);
          const gapEnd = Math.min(wallEnd, brMax + margin);
          if (gapEnd > gapStart) gaps.push({ start: gapStart, end: gapEnd });
        }

        // Sort gaps and merge overlapping
        gaps.sort((a, b) => a.start - b.start);
        const merged = [];
        for (const g of gaps) {
          if (merged.length > 0 && g.start <= merged[merged.length - 1].end) {
            merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, g.end);
          } else {
            merged.push({ ...g });
          }
        }

        // Build segments between gaps
        const segments = [];
        let cursor = wallStart;
        for (const g of merged) {
          if (g.start > cursor) segments.push({ start: cursor, end: g.start });
          cursor = g.end;
        }
        if (cursor < wallEnd) segments.push({ start: cursor, end: wallEnd });

        // Render each segment
        for (let si = 0; si < segments.length; si++) {
          const seg = segments[si];
          const segLen = seg.end - seg.start;
          if (segLen < 0.1) continue;
          let mesh;
          if (isXWall) {
            mesh = createSlab(seg.start + segLen / 2, wallY + wallH / 2, fixedPos, segLen, wallH, wallT, wallMat);
          } else {
            mesh = createSlab(fixedPos, wallY + wallH / 2, seg.start + segLen / 2, wallT, wallH, segLen, wallMat);
          }
          mesh.name = `bridge_wall_${i}_${si}`;
          scene.add(mesh);
        }

        return { segments, merged };
      }

      let wallDataL, wallDataR;
      if (b.axis === 'x') {
        // Bridge runs along X — walls on north (L) and south (R) edges
        wallDataL = renderWallSegments('x', b.x, b.x + b.w, b.z + wallT / 2, true);
        wallDataR = renderWallSegments('x', b.x, b.x + b.w, b.z + b.d - wallT / 2, true);
      } else {
        // Bridge runs along Z — walls on west (L) and east (R) edges
        wallDataL = renderWallSegments('z', b.z, b.z + b.d, b.x + wallT / 2, false);
        wallDataR = renderWallSegments('z', b.z, b.z + b.d, b.x + b.w - wallT / 2, false);
      }

      // Battlement variant — add tall sections on top of side wall segments (respecting gaps)
      if (b.variant === 'battlement') {
        const battH = CONNECTIVITY.bridgeBattlementHeight - wallH;
        const spacing = CONNECTIVITY.bridgeBattlementSpacing || 1.5;
        const gap = CONNECTIVITY.bridgeBattlementGap || 0.75;
        const pillarW = spacing - gap;
        const battY = wallY + wallH;

        function renderBattlements(wallData, fixedPos, isXWall, side) {
          for (const seg of wallData.segments) {
            const segStart = seg.start;
            const segLen = seg.end - seg.start;
            for (let pos = 0; pos < segLen - pillarW; pos += spacing) {
              let mesh;
              if (isXWall) {
                mesh = createSlab(segStart + pos + pillarW / 2, battY + battH / 2, fixedPos, pillarW, battH, wallT, wallMat);
              } else {
                mesh = createSlab(fixedPos, battY + battH / 2, segStart + pos + pillarW / 2, wallT, battH, pillarW, wallMat);
              }
              mesh.name = `bridge_batt_${i}_${side}_${Math.round(segStart + pos)}`;
              scene.add(mesh);
            }
          }
        }

        if (b.axis === 'x') {
          renderBattlements(wallDataL, b.z + wallT / 2, true, 'L');
          renderBattlements(wallDataR, b.z + b.d - wallT / 2, true, 'R');
        } else {
          renderBattlements(wallDataL, b.x + wallT / 2, false, 'L');
          renderBattlements(wallDataR, b.x + b.w - wallT / 2, false, 'R');
        }
      }
    }

    // Red ground ladders
    const groundLadders = data.connections.groundLadders || [];
    for (let i = 0; i < groundLadders.length; i++) {
      const material = debug ? DEBUG_MATERIALS.groundLadder : pickFromPool(pools.ladders, i + 10);
      addLadder(groundLadders[i], material, `ground_ladder_${i}`);
    }

    // Orange ladders
    const orangeLadders = data.connections.orangeLadders || [];
    for (let i = 0; i < orangeLadders.length; i++) {
      const l = orangeLadders[i];
      const material = l.bad ? DEBUG_MATERIALS.badLadder : (debug ? DEBUG_MATERIALS.orangeLadder : pickFromPool(pools.ladders, i + 20));
      addLadder(l, material, l.bad ? `orange_ladder_BAD_${i}` : `orange_ladder_${i}`);
    }

    // Interior ladders — cyan
    const interiorLadders = data.connections.interiorLadders || [];
    for (let i = 0; i < interiorLadders.length; i++) {
      const material = debug ? DEBUG_MATERIALS.interiorLadder : pickFromPool(pools.ladders, i + 30);
      addLadder(interiorLadders[i], material, `interior_ladder_${i}`);
    }

    // Ladder platforms — white
    const ladderPlatforms = data.connections.ladderPlatforms || [];
    for (let i = 0; i < ladderPlatforms.length; i++) {
      const p = ladderPlatforms[i];
      // All platforms from the same ladder share the same texture
      const material = debug ? DEBUG_MATERIALS.ladderPlatform : pickFromPool(pools.floors, p.ladderIndex);
      const mesh = createFloorSlab({ x: p.x, z: p.z, w: p.w, d: p.d }, p.y, GEOMETRY.platformThickness, material);
      mesh.name = `ladder_platform_${i}`;
      scene.add(mesh);
    }

    // Pillar supports — use parent walkway/bridge texture
    const pillars = data.connections.pillars || [];
    for (let i = 0; i < pillars.length; i++) {
      const p = pillars[i];
      let material;
      if (debug) {
        material = DEBUG_MATERIALS.pillar;
      } else if (p.isBridge) {
        const parentIdx = bridges.findIndex(b => b.textureId === p.textureId && !b.branch);
        material = pickFromPool(pools.landmark_walls, parentIdx >= 0 ? parentIdx : i);
      } else {
        const parentIdx = walkways.findIndex(w => w.textureId === p.textureId && !w.branch);
        material = pickFromPool(pools.walkways, parentIdx >= 0 ? parentIdx : i);
      }
      const mesh = createSlab(
        p.x + p.w / 2, p.y + p.height / 2, p.z + p.d / 2,
        p.w, p.height, p.d, material
      );
      mesh.name = `pillar_${i}`;
      scene.add(mesh);
    }
  }

  // Cover pieces
  if (data.cover) {
    for (let i = 0; i < data.cover.length; i++) {
      const c = data.cover[i];
      const bodyMat = debug ? DEBUG_MATERIALS.cover : pickFromPool(pools.objects, i);
      const mesh = createSlab(c.x + c.w / 2, c.y + c.height / 2, c.z + c.d / 2, c.w, c.height, c.d, bodyMat);
      mesh.name = `cover_${i}`;
      scene.add(mesh);
    }
  }

  // Interior cover
  if (data.interiorCover) {
    for (let i = 0; i < data.interiorCover.length; i++) {
      const c = data.interiorCover[i];
      let material;
      if (debug) {
        material = DEBUG_MATERIALS.interiorCover;
      } else {
        material = pickFromPool(pools.objects, i + 50);
      }
      const mesh = createSlab(c.x + c.w / 2, c.y + c.height / 2, c.z + c.d / 2, c.w, c.height, c.d, material);
      mesh.name = `interior_cover_${i}`;
      scene.add(mesh);
    }
  }

  // Debug: pink footprints for deleted building positions
  if (data.deletedFootprints) {
    for (let i = 0; i < data.deletedFootprints.length; i++) {
      const df = data.deletedFootprints[i];
      let material;
      if (debug) {
        material = DEBUG_MATERIALS.deletedFootprint;
      } else {
        material = pickFromPool(pools.courtyards, i);
      }
      const mesh = createFloorSlab({ x: df.x, z: df.z, w: df.w, d: df.d }, GEOMETRY.courtyardY, GEOMETRY.courtyardThickness, material);
      mesh.name = `deleted_${i}`;
      scene.add(mesh);
    }
  }

  // Street scatter
  if (data.streetScatter) {
    for (let i = 0; i < data.streetScatter.length; i++) {
      const c = data.streetScatter[i];
      const material = debug ? DEBUG_MATERIALS.streetScatter : pickFromPool(pools.objects, i + 100);
      const mesh = createSlab(c.x + c.w / 2, c.y + c.height / 2, c.z + c.d / 2, c.w, c.height, c.d, material);
      mesh.name = `street_scatter_${i}`;
      scene.add(mesh);
    }
  }

  return scene;
}
