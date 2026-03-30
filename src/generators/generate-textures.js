/**
 * Generate simple solid-colour PNG textures for the base texture pack.
 * Multiple colours per category for testing skinning.
 * Run: node src/generators/generate-textures.js
 */

import { PNG } from 'pngjs';
import { writeFileSync } from 'fs';
import path from 'path';

const TEX_SIZE = 32;
const BASE_DIR = 'assets/textures/base';

function writeSolidPng(dir, name, r, g, b) {
  const png = new PNG({ width: TEX_SIZE, height: TEX_SIZE });
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      const idx = (y * TEX_SIZE + x) * 4;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }
  const filePath = path.join(BASE_DIR, dir, `${name}.png`);
  writeFileSync(filePath, PNG.sync.write(png));
  console.log(`  ${filePath}`);
}



console.log('Walls:');
writeSolidPng('walls', 'brown', 89, 77, 64);
writeSolidPng('walls', 'grey_brown', 102, 97, 89);
writeSolidPng('walls', 'reddish', 82, 71, 71);
writeSolidPng('walls', 'tan', 97, 92, 77);

console.log('Landmark Walls:');
writeSolidPng('landmark_walls', 'dark_stone', 77, 64, 56);
writeSolidPng('landmark_walls', 'slate', 71, 77, 82);
writeSolidPng('landmark_walls', 'charcoal', 64, 56, 51);
writeSolidPng('landmark_walls', 'umber', 89, 71, 56);

console.log('Floors:');
writeSolidPng('floors', 'dark_oak', 77, 56, 38);
writeSolidPng('floors', 'aged_pine', 89, 71, 46);
writeSolidPng('floors', 'walnut', 71, 51, 36);
writeSolidPng('floors', 'chestnut', 82, 64, 43);

console.log('Objects:');
writeSolidPng('objects', 'pine_crate', 115, 97, 71);
writeSolidPng('objects', 'pale_crate', 128, 107, 77);
writeSolidPng('objects', 'stone_block_dark', 89, 77, 64);
writeSolidPng('objects', 'stone_block_grey', 102, 97, 89);

console.log('Ladders:');
writeSolidPng('ladders', 'dark_wood', 89, 64, 38);
writeSolidPng('ladders', 'medium_wood', 102, 77, 46);
writeSolidPng('ladders', 'aged_wood', 77, 56, 36);
writeSolidPng('ladders', 'warm_wood', 97, 71, 43);

console.log('Walkways:');
writeSolidPng('walkways', 'dark_plank', 77, 56, 38);
writeSolidPng('walkways', 'light_plank', 89, 71, 46);
writeSolidPng('walkways', 'worn_plank', 71, 51, 36);

console.log('Courtyards:');
writeSolidPng('courtyards', 'grey_flag', 102, 97, 89);
writeSolidPng('courtyards', 'warm_flag', 97, 89, 77);
writeSolidPng('courtyards', 'dark_flag', 89, 84, 82);

console.log('Base Map:');
writeSolidPng('base_map', 'stone', 89, 84, 77);
writeSolidPng('base_map', 'mud', 77, 64, 46);
writeSolidPng('base_map', 'rubble', 97, 92, 87);

console.log('Roofs:');
writeSolidPng('roofs', 'dark_red', 102, 46, 36);
writeSolidPng('roofs', 'clay_red', 115, 56, 41);
writeSolidPng('roofs', 'dark_brown', 77, 51, 36);

console.log('Domes:');
writeSolidPng('domes', 'rusty_red', 102, 51, 36);
writeSolidPng('domes', 'dark_rust', 82, 41, 28);
writeSolidPng('domes', 'oxidised_copper', 56, 77, 64);
writeSolidPng('domes', 'dark_bronze', 71, 56, 36);

console.log('\nDone!');
