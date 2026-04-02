import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const SKIP_PATTERNS = [
  'index.js',
  '__tests__',
  '.test.',
  '.spec.',
  'config.js',
];

function isSkipped(filePath) {
  return SKIP_PATTERNS.some((pattern) => filePath.includes(pattern));
}

function analyzeExports(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const exports = [];
  const functions = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // export default function Name
    const exportDefaultFnMatch = trimmed.match(/^export\s+default\s+function\s+(\w+)/);
    if (exportDefaultFnMatch) {
      exports.push(exportDefaultFnMatch[1]);
      functions.push(exportDefaultFnMatch[1]);
      continue;
    }

    // export default anonymous function
    if (/^export\s+default\s+function\s*\(/.test(trimmed)) {
      exports.push('default');
      functions.push('default');
      continue;
    }

    // export default <identifier>
    if (/^export\s+default\s+\w+/.test(trimmed)) {
      exports.push('default');
      continue;
    }

    // export function Name
    const exportFnMatch = trimmed.match(/^export\s+function\s+(\w+)/);
    if (exportFnMatch) {
      exports.push(exportFnMatch[1]);
      functions.push(exportFnMatch[1]);
      continue;
    }

    // export class Name
    const exportClassMatch = trimmed.match(/^export\s+class\s+(\w+)/);
    if (exportClassMatch) {
      exports.push(exportClassMatch[1]);
      functions.push(exportClassMatch[1]);
      continue;
    }

    // export const Name = ...
    const exportConstMatch = trimmed.match(/^export\s+const\s+(\w+)/);
    if (exportConstMatch) {
      exports.push(exportConstMatch[1]);
      if (/=\s*(async\s+)?\(/.test(trimmed) || /=\s*(async\s+)?(\w+)\s*=>/.test(trimmed)) {
        functions.push(exportConstMatch[1]);
      }
      continue;
    }

    // export { ... } from — re-exports, skip
    if (/^export\s+\{[^}]*\}\s+from\s/.test(trimmed)) continue;
    if (/^export\s+\*/.test(trimmed)) continue;

    // Non-exported functions are private helpers — they support the main
    // export and don't count toward the function limit.
  }

  return { exports, functions };
}

function walkDir(dir) {
  const results = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkDir(full));
      } else if (extname(entry.name) === '.js') {
        results.push(relative(ROOT, full));
      }
    }
  } catch { /* dir doesn't exist */ }
  return results;
}

export function run() {
  const files = walkDir(resolve(ROOT, 'src'));
  const findings = [];
  let scanned = 0;

  for (const file of files.sort()) {
    const posixFile = file.split('\\').join('/');
    if (isSkipped(posixFile)) continue;
    scanned++;

    const absPath = resolve(ROOT, file);
    const { exports, functions } = analyzeExports(absPath);

    if (exports.length > 1) {
      findings.push({
        file: posixFile,
        detail: `${exports.length} exports: ${exports.join(', ')}`,
      });
    }

    if (functions.length > 1) {
      findings.push({
        file: posixFile,
        detail: `${functions.length} functions: ${functions.join(', ')}`,
      });
    }
  }

  return { name: 'single-export', findings, filesScanned: scanned };
}

function main() {
  const result = run();

  if (result.findings.length === 0) {
    console.log('\n  ✓ All files follow the 1-function / 1-export rule.\n');
    return;
  }

  const byFile = new Map();
  for (const f of result.findings) {
    const existing = byFile.get(f.file) ?? [];
    existing.push(f.detail);
    byFile.set(f.file, existing);
  }

  console.log('');
  console.log('==========================================');
  console.log('  FAILED — Single-export rule violations');
  console.log('==========================================');
  console.log('');

  for (const [file, details] of byFile) {
    console.log(`  ${file}`);
    for (const d of details) {
      console.log(`    ⚠ ${d}`);
    }
    console.log('');
  }

  console.log(`  ${result.findings.length} violation${result.findings.length > 1 ? 's' : ''} in ${byFile.size} file${byFile.size > 1 ? 's' : ''}`);
  console.log('');

  process.exit(1);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) main();
