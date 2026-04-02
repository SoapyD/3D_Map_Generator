import { readFileSync, readdirSync } from 'node:fs';
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

function countFunctions(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const functions = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // export default function Name
    const exportDefaultFnMatch = trimmed.match(/^export\s+default\s+function\s+(\w+)/);
    if (exportDefaultFnMatch) {
      functions.push(exportDefaultFnMatch[1]);
      continue;
    }

    // export default anonymous function
    if (/^export\s+default\s+function\s*\(/.test(trimmed)) {
      functions.push('default');
      continue;
    }

    // export function Name
    const exportFnMatch = trimmed.match(/^export\s+function\s+(\w+)/);
    if (exportFnMatch) {
      functions.push(exportFnMatch[1]);
      continue;
    }

    // export class Name
    const exportClassMatch = trimmed.match(/^export\s+class\s+(\w+)/);
    if (exportClassMatch) {
      functions.push(exportClassMatch[1]);
      continue;
    }

    // export const Name = arrow/function expression
    const exportConstMatch = trimmed.match(/^export\s+const\s+(\w+)/);
    if (exportConstMatch) {
      if (/=\s*(async\s+)?\(/.test(trimmed) || /=\s*(async\s+)?(\w+)\s*=>/.test(trimmed)) {
        functions.push(exportConstMatch[1]);
      }
      continue;
    }

    // Non-exported functions are private helpers — they support the main
    // export and don't count toward the single-function limit.
  }

  return functions;
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
    const functions = countFunctions(absPath);

    if (functions.length > 1) {
      findings.push({
        file: posixFile,
        detail: `${functions.length} functions: ${functions.join(', ')}`,
      });
    }
  }

  return { name: 'single-function', findings, filesScanned: scanned };
}

function main() {
  const result = run();

  if (result.findings.length === 0) {
    console.log('\n  ✓ All files follow the single-function rule.\n');
    return;
  }

  console.log('');
  console.log('==========================================');
  console.log('  FAILED — Single-function rule violations');
  console.log('==========================================');
  console.log('');

  for (const f of result.findings) {
    console.log(`  ${f.file}`);
    console.log(`    ⚠ ${f.detail}`);
    console.log('');
  }

  console.log(`  ${result.findings.length} violation${result.findings.length > 1 ? 's' : ''}`);
  console.log('');

  process.exit(1);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) main();
