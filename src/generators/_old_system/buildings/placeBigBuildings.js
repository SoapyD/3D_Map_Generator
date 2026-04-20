import { BUILDING, DELETIONS } from '../../config.js';
import { generateBigBuilding } from './generateBigBuilding.js';
import { overlapsAny } from './overlapsAny.js';

const BUILDING_GAP = BUILDING.gap;

function overlapsRect(a, b) {
  return a.x < b.x + b.w - 0.01 && a.x + a.w > b.x + 0.01
      && a.z < b.z + b.d - 0.01 && a.z + a.d > b.z + 0.01;
}

function candidateOverlapsStreet(segments, streetBounds) {
  return segments.some(seg => streetBounds.some(s => overlapsRect(seg, s)));
}

export function placeBigBuildings(buildings, specs, config, rng, tiers, streetBounds) {
  const placedBig = [];
  const displacedByBig = [];

  for (const spec of specs) {
    const MAX_ATTEMPTS = 4; // 1 initial + 3 retries

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const candidate = generateBigBuilding(spec.sizeKey, spec.pos, config, tiers, rng);

      // Earmark small buildings that would be displaced by this candidate
      const earmarked = [];
      const notEarmarked = [];
      if (DELETIONS.buildingDisplaceByLarge) {
        for (const b of buildings) {
          // Skip buildings already displaced by a previous big building
          if (displacedByBig.includes(b)) continue;
          let touches = false;
          for (const seg of candidate) {
            if (b.x < seg.x + seg.w + BUILDING_GAP && b.x + b.w > seg.x - BUILDING_GAP &&
                b.z < seg.z + seg.d + BUILDING_GAP && b.z + b.d > seg.z - BUILDING_GAP) {
              touches = true;
              break;
            }
          }
          if (touches) earmarked.push(b);
          else notEarmarked.push(b);
        }
      }

      // Check candidate against: already-placed big buildings + non-earmarked small buildings + streets
      const checkAgainst = [...placedBig, ...notEarmarked];
      if (!overlapsAny(candidate, checkAgainst) && (!streetBounds || !candidateOverlapsStreet(candidate, streetBounds))) {
        // Success — confirm this placement
        placedBig.push(...candidate);
        displacedByBig.push(...earmarked);
        break;
      }
      // Overlap detected — retry with a different shape/size
    }
    // If all attempts failed, earmarked buildings are NOT displaced (restored implicitly)
  }

  // Resolve texture groups for placed big buildings
  const groups = new Map();
  for (let i = 0; i < placedBig.length; i++) {
    const b = placedBig[i];
    if (b._groupMarker) {
      if (!groups.has(b._groupMarker)) groups.set(b._groupMarker, i);
      b.textureGroup = groups.get(b._groupMarker);
      delete b._groupMarker;
    }
  }

  return { placedBig, displacedByBig };
}
