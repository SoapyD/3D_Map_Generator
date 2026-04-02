import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, relative, dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const NAMESPACE_RE = /export\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;

function resolveTargetDir(fromDir, target) {
  const cleaned = target.replace(/\/index(\.js)?$/, '');
  const resolved = resolve(fromDir, cleaned);

  if (existsSync(resolved) && statSync(resolved).isDirectory()) return resolved;
  if (existsSync(resolved + '.js')) return null;
  return null;
}

function getNamespaceTargets(dirPath) {
  const indexPath = join(dirPath, 'index.js');
  if (!existsSync(indexPath)) return [];

  const content = readFileSync(indexPath, 'utf-8');
  const targets = [];

  let match;
  const re = new RegExp(NAMESPACE_RE.source, 'g');
  while ((match = re.exec(content)) !== null) {
    const alias = match[1];
    const target = match[2];
    const targetDir = resolveTargetDir(dirPath, target);
    if (targetDir) targets.push({ alias, targetDir });
  }

  return targets;
}

function findViolatingBarrels(dirPath, depth, findings, visited = new Set()) {
  if (visited.has(dirPath)) return;
  visited.add(dirPath);

  const targets = getNamespaceTargets(dirPath);
  if (targets.length === 0) return;

  for (const t of targets) {
    const childTargets = getNamespaceTargets(t.targetDir);
    if (childTargets.length === 0) continue;

    if (depth >= 2) {
      const barrelFile = relative(ROOT, join(dirPath, 'index.js')).split('\\').join('/');
      const childIndex = relative(ROOT, join(t.targetDir, 'index.js')).split('\\').join('/');
      findings.push({
        file: barrelFile,
        detail: `"${t.alias}" → ${childIndex} adds namespace nesting level ${depth + 1} (max allowed: 2)`,
      });
    }

    findViolatingBarrels(t.targetDir, depth + 1, findings, visited);
  }
}

function findBarrels(dir) {
  const results = [];
  if (!existsSync(dir)) return results;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      const indexPath = join(full, 'index.js');
      if (existsSync(indexPath)) results.push(relative(ROOT, indexPath));
      results.push(...findBarrels(full));
    }
  }

  return results;
}

export function run() {
  const allBarrels = findBarrels(resolve(ROOT, 'src'));
  const findings = [];
  const visited = new Set();

  for (const file of allBarrels.sort()) {
    const absDir = dirname(resolve(ROOT, file));
    findViolatingBarrels(absDir, 2, findings, visited);
  }

  return { name: 'barrel-nesting', findings, filesScanned: allBarrels.length };
}

function main() {
  const result = run();

  if (result.findings.length === 0) {
    console.log('\n  ✓ No nested namespace barrels found.\n');
    return;
  }

  console.log('');
  console.log('==========================================');
  console.log('  Nested Namespace Barrel Violations');
  console.log('==========================================');
  console.log('');

  const byFile = new Map();
  for (const f of result.findings) {
    const existing = byFile.get(f.file) ?? [];
    existing.push(f);
    byFile.set(f.file, existing);
  }

  for (const [file, findings] of byFile) {
    console.log(`  ${file}`);
    for (const f of findings) {
      console.log(`    ⚠ ${f.detail}`);
    }
    console.log('');
  }

  console.log(`  ${result.findings.length} violation${result.findings.length > 1 ? 's' : ''} in ${byFile.size} file${byFile.size > 1 ? 's' : ''}`);
  console.log('');

  process.exit(1);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) main();
