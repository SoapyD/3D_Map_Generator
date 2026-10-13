/**
 * Hook: informational OBJ vertex count (never blocks).
 * Trigger: PostToolUse on Bash (after generation runs).
 * The 25,000-vertex Tabletop Simulator cap no longer applies (TTS is not a target; the Withering game
 * consumes the GLB + primitives + collision matrix). OBJ output is now legacy and only written with
 * `--obj`, so this reports vertex counts for any output/*.obj files that exist and always exits 0.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';

const input = JSON.parse(readFileSync(process.stdin.fd, 'utf8'));

if (input.tool_name !== 'Bash') process.exit(0);

const cmd = input.tool_input?.command || '';

// Only report after running the generator with the legacy OBJ export
if (!cmd.includes('src/index.js') || !cmd.includes('--obj')) process.exit(0);

const outputDir = 'output';
if (!existsSync(outputDir)) process.exit(0);

try {
  const objFiles = readdirSync(outputDir).filter(f => f.endsWith('.obj') && !f.includes('collision'));

  for (const file of objFiles) {
    const content = readFileSync(path.join(outputDir, file), 'utf8');
    const vertexCount = (content.match(/^v /gm) || []).length;
    process.stderr.write(`INFO: ${file} has ${vertexCount} vertices (legacy OBJ; the old 25,000 TTS cap no longer applies).\n`);
  }
} catch (e) {
  // Ignore errors — output might not exist yet
}

process.exit(0);
