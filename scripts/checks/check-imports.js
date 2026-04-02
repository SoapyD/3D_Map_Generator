import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, relative, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const FROM_PATH_RE = /from\s+['"]([^'"]+)['"]/;
const IMPORT_LINE_RE = /^\s*import\s/;

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

function toForwardSlash(p) {
  return p.split('\\').join('/');
}

/**
 * Check if a relative import bypasses a barrel.
 * If the import target's parent folder has an index.js, it should import from the barrel instead.
 */
/**
 * Check if an index.js file is actually a barrel (contains re-exports)
 * vs an app entry point (contains logic/imports but no re-exports).
 */
function isBarrelFile(indexPath) {
  const content = readFileSync(indexPath, 'utf-8');
  return /^export\s+\{/.test(content) || /^export\s+\*/.test(content) || content.split('\n').some((line) => /^\s*export\s+\{[^}]+\}\s+from\s/.test(line));
}

function isBarrelBypass(absPath, importPath) {
  const dir = dirname(absPath);
  const cleanImport = importPath.replace(/\.js$/, '');
  const resolved = resolve(dir, cleanImport);
  const parentDir = dirname(resolved);
  const barrelPath = join(parentDir, 'index.js');

  if (existsSync(barrelPath) && isBarrelFile(barrelPath)) {
    const barrelRel = toForwardSlash(relative(dir, parentDir));
    return { bypass: true, barrel: barrelRel };
  }
  return { bypass: false, barrel: '' };
}

function analyzeFile(absPath) {
  const content = readFileSync(absPath, 'utf-8');
  const lines = content.split('\n');
  const relPath = toForwardSlash(relative(ROOT, absPath));
  const findings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (!IMPORT_LINE_RE.test(line)) continue;

    const pathMatch = line.match(FROM_PATH_RE);
    if (!pathMatch) continue;
    const importPath = pathMatch[1];

    // Only check relative imports
    if (!importPath.startsWith('.')) continue;

    // Barrel bypass: importing a specific file from a folder that has an index.js
    // Only flag imports that go INTO a different folder (../folder/file or ./subfolder/file)
    // Skip same-folder sibling imports (./file.js) — those are internal to the barrel
    if (importPath.startsWith('..')) {
      // Skip explicit /index imports
      if (importPath.endsWith('/index.js') || importPath.endsWith('/index')) continue;

      const { bypass, barrel } = isBarrelBypass(absPath, importPath);
      if (bypass) {
        const dir = dirname(absPath);
        const cleanImport = importPath.replace(/\.js$/, '');
        const resolved = resolve(dir, cleanImport);
        const resolvedParent = dirname(resolved);
        const barrelDir = resolve(dir, barrel);
        if (resolve(resolvedParent) === resolve(barrelDir)) {
          findings.push({
            type: 'barrel-bypass',
            line: lineNum,
            detail: `Barrel bypass: ${importPath} — import from the barrel (${barrel}) instead`,
          });
        }
      }
    }
  }

  return { file: relPath, findings };
}

function walkDir(dir) {
  const results = [];
  if (!existsSync(dir)) return results;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else if (extname(entry.name) === '.js') {
      results.push(relative(ROOT, full));
    }
  }

  return results;
}

export function run() {
  const files = walkDir(resolve(ROOT, 'src'));
  const checkFindings = [];
  let scanned = 0;

  for (const file of files.sort()) {
    const posixFile = toForwardSlash(file);
    if (isSkipped(posixFile)) continue;
    scanned++;

    const absPath = resolve(ROOT, file);
    const report = analyzeFile(absPath);
    for (const f of report.findings) {
      checkFindings.push({
        file: report.file,
        line: f.line,
        detail: `[${f.type}] ${f.detail}`,
      });
    }
  }

  return { name: 'imports', findings: checkFindings, filesScanned: scanned };
}

function main() {
  const result = run();

  if (result.findings.length === 0) {
    console.log('\n  ✓ All imports use barrels correctly.\n');
    return;
  }

  const byFile = new Map();
  for (const f of result.findings) {
    const existing = byFile.get(f.file) ?? [];
    existing.push(f);
    byFile.set(f.file, existing);
  }

  console.log('');
  console.log('==========================================');
  console.log('  FAILED — Import violations found');
  console.log('==========================================');
  console.log('');

  for (const [file, findings] of byFile) {
    console.log(`  ${file}`);
    for (const f of findings) {
      console.log(`    ⚠ line ${f.line}: ${f.detail}`);
    }
    console.log('');
  }

  console.log(`  ${result.findings.length} violation${result.findings.length > 1 ? 's' : ''} in ${byFile.size} file${byFile.size > 1 ? 's' : ''}`);
  console.log('');

  process.exit(1);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) main();
