import { readFileSync, existsSync, readdirSync, statSync, appendFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, relative, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileSizeRules, skipPatterns } from './file-size-rules.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

function countEffectiveLines(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  return content.split('\n').filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith('//')) return false;
    if (trimmed.startsWith('*')) return false;
    if (trimmed.startsWith('import ')) return false;
    return true;
  }).length;
}

function isSkipped(filePath) {
  return skipPatterns.some((pattern) => filePath.includes(pattern));
}

function toForwardSlash(p) {
  return p.split('\\').join('/');
}

function findMatchingRule(filePath) {
  const posix = toForwardSlash(filePath);

  for (const rule of fileSizeRules) {
    if (rule.file) {
      if (posix === rule.file) return rule;
      continue;
    }

    const dir = rule.dir + '/';
    if (!posix.startsWith(dir)) continue;
    if (extname(posix) !== rule.ext) continue;

    if (rule.shallow) {
      const remainder = posix.slice(dir.length);
      if (remainder.includes('/')) continue;
    }

    return rule;
  }

  return null;
}

function checkFiles(files) {
  const violations = [];

  for (const file of files) {
    const posixFile = toForwardSlash(file);
    if (isSkipped(posixFile)) continue;

    const rule = findMatchingRule(posixFile);
    if (!rule) continue;

    const absPath = resolve(ROOT, file);
    if (!existsSync(absPath)) continue;

    const lines = countEffectiveLines(absPath);
    if (lines > rule.limit) {
      violations.push({ area: rule.area, file: posixFile, lines, limit: rule.limit });
    }
  }

  return violations;
}

function getChangedFiles(baseBranch) {
  const output = execSync(
    `git diff --name-only --diff-filter=ACMR origin/${baseBranch}...HEAD`,
    { cwd: ROOT, encoding: 'utf-8' },
  );
  return output.trim().split('\n').filter(Boolean);
}

function walkDir(dir) {
  const results = [];
  if (!existsSync(dir)) return results;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full));
    } else {
      results.push(relative(ROOT, full));
    }
  }

  return results;
}

function getAllMatchingFiles() {
  const allSrcFiles = walkDir(resolve(ROOT, 'src'));
  return allSrcFiles.filter((f) => extname(f) === '.js');
}

function getFilesInFolders(folders) {
  const allFiles = [];
  for (const folder of folders) {
    const absFolder = resolve(ROOT, folder);
    allFiles.push(...walkDir(absFolder));
  }
  return [...new Set(allFiles)];
}

function formatViolations(violations, isCI) {
  if (violations.length === 0) return '';

  const header = '| Area | File | Lines | Limit |';
  const divider = '|------|------|-------|-------|';
  const rows = violations.map(
    (v) => `| ${v.area} | \`${v.file}\` | ${v.lines} | ${v.limit} |`,
  );

  const table = [header, divider, ...rows].join('\n');

  if (isCI) {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (summaryPath) {
      const summary = [
        '## File Size Limit Violations',
        '',
        'The following files exceed their area\'s line limit (effective lines = non-blank, non-comment, non-import):',
        '',
        table,
        '',
        'Split oversized files by pipeline sub-stage. See `.claude/agents/code-auditor.md` for details.',
      ].join('\n');
      appendFileSync(summaryPath, summary);
    }
  }

  return [
    '',
    '==========================================',
    '  FAILED — File size limit exceeded',
    '==========================================',
    '',
    table,
    '',
    'Split oversized files by pipeline sub-stage.',
  ].join('\n');
}

export function run() {
  const files = getAllMatchingFiles();
  const violations = checkFiles(files);

  const findings = violations.map((v) => ({
    file: v.file,
    detail: `[${v.area}] ${v.lines} lines (limit: ${v.limit})`,
  }));

  return { name: 'file-sizes', findings, filesScanned: files.length };
}

function main() {
  const args = process.argv.slice(2);
  const isCI = args.includes('--ci');

  let files;

  if (isCI) {
    const baseBranch = process.env.GITHUB_BASE_REF || 'main';
    files = getChangedFiles(baseBranch);
  } else {
    const folders = args.filter((a) => !a.startsWith('--'));
    files = folders.length > 0
      ? getFilesInFolders(folders)
      : getAllMatchingFiles();
  }

  const violations = checkFiles(files);

  if (violations.length > 0) {
    console.log(formatViolations(violations, isCI));
    process.exit(1);
  }

  console.log('All files within size limits.');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) main();
