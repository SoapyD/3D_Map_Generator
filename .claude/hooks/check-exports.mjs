/**
 * Hook: Warn on default exports in source files.
 * Trigger: PostToolUse on Write|Edit.
 * Project convention: named exports only.
 */

import { readFileSync } from 'fs';

const input = JSON.parse(readFileSync(process.stdin.fd, 'utf8'));

if (!['Write', 'Edit'].includes(input.tool_name)) process.exit(0);

const filePath = input.tool_input?.file_path || input.tool_result?.filePath || '';

// Only check .js files in src/
if (!filePath.includes('/src/') && !filePath.includes('\\src\\')) process.exit(0);
if (!filePath.endsWith('.js')) process.exit(0);

// Skip test files
if (filePath.includes('test') || filePath.includes('spec')) process.exit(0);

try {
  const content = readFileSync(filePath, 'utf8');
  if (content.includes('export default')) {
    process.stderr.write(`WARNING: Default export found in ${filePath}. Use named exports only.\n`);
  }
} catch (e) {
  // File might not exist yet during Write
}

process.exit(0);
