/**
 * Hook: Warn if generated OBJ files exceed TTS vertex limit.
 * Trigger: PostToolUse on Bash (after generation runs).
 * Checks output/*.obj files for vertex count > 23,000 (warning) or > 25,000 (error).
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';

const input = JSON.parse(readFileSync(process.stdin.fd, 'utf8'));

if (input.tool_name !== 'Bash') process.exit(0);

const cmd = input.tool_input?.command || '';

// Only check after running the generator
if (!cmd.includes('src/index.js')) process.exit(0);

const outputDir = 'output';
if (!existsSync(outputDir)) process.exit(0);

try {
  const objFiles = readdirSync(outputDir).filter(f => f.endsWith('.obj') && !f.includes('collision'));

  for (const file of objFiles) {
    const content = readFileSync(path.join(outputDir, file), 'utf8');
    const vertexCount = (content.match(/^v /gm) || []).length;

    if (vertexCount > 25000) {
      process.stderr.write(`ERROR: ${file} has ${vertexCount} vertices — exceeds TTS limit of 25,000!\n`);
    } else if (vertexCount > 23000) {
      process.stderr.write(`WARNING: ${file} has ${vertexCount} vertices — approaching TTS limit of 25,000.\n`);
    }
  }
} catch (e) {
  // Ignore errors — output might not exist yet
}

process.exit(0);
