import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { run as checkFileSizes } from './check-file-sizes.js';
import { run as checkImports } from './check-imports.js';
import { run as checkBarrelNesting } from './check-barrel-nesting.js';
import { run as checkSingleExport } from './check-single-export.js';
import { run as checkSingleFunction } from './check-single-function.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const REPORTS_DIR = resolve(ROOT, 'scripts/reports');

const checks = [
  {
    name: 'file-sizes',
    description: 'Files must not exceed the line count threshold. Large files should be split into smaller, focused modules.',
    run: checkFileSizes,
  },
  {
    name: 'imports',
    description: 'No barrel bypasses — if a folder has an index.js, import from the barrel, not the specific file.',
    run: checkImports,
  },
  {
    name: 'barrel-nesting',
    description: 'Barrel files (index.js) must not re-export from other barrels. Keep barrel chains flat — one level of re-export only.',
    run: checkBarrelNesting,
  },
  {
    name: 'single-export',
    description: [
      'Each file should have at most one runtime export. Multiple exports suggest the file should be split.',
      'Each file should contain at most one function (exported or not). Multiple functions suggest the file should be split into focused modules.',
    ].join('\n'),
    run: checkSingleExport,
  },
  {
    name: 'single-function',
    description: 'Each file should contain at most one function (exported or not). Multiple functions suggest the file should be split into focused modules.',
    run: checkSingleFunction,
  },
];

function buildSummaryReport(results) {
  const lines = [];
  const totalFindings = results.reduce((sum, r) => sum + r.findings.length, 0);
  const totalFiles = results.reduce((sum, r) => sum + r.filesScanned, 0);
  const failed = results.filter((r) => r.findings.length > 0);
  const passed = results.filter((r) => r.findings.length === 0);

  lines.push('');
  lines.push('==========================================');
  lines.push('  Code Quality — Summary');
  lines.push('==========================================');
  lines.push('');
  lines.push(`  Checks run:    ${results.length}`);
  lines.push(`  Files scanned: ${totalFiles}`);
  lines.push(`  Total findings: ${totalFindings}`);
  lines.push('');

  if (passed.length > 0) {
    for (const r of passed) {
      lines.push(`  ✓ ${r.name} — passed (${r.filesScanned} files)`);
    }
  }
  if (failed.length > 0) {
    for (const r of failed) {
      lines.push(`  ✗ ${r.name} — ${r.findings.length} finding${r.findings.length > 1 ? 's' : ''} (${r.filesScanned} files)`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function buildDetailedReport(results) {
  const lines = [];
  const failed = results.filter((r) => r.findings.length > 0);

  if (failed.length === 0) {
    lines.push('');
    lines.push('  ✓ All checks passed — no findings.');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('');
  lines.push('==========================================');
  lines.push('  Code Quality — Detailed Findings');
  lines.push('==========================================');

  for (const result of failed) {
    lines.push('');
    lines.push(`  ── ${result.name} (${result.findings.length}) ──`);
    lines.push('');

    const byFile = new Map();
    for (const f of result.findings) {
      const existing = byFile.get(f.file) ?? [];
      existing.push(f);
      byFile.set(f.file, existing);
    }

    for (const [file, findings] of byFile) {
      lines.push(`  ${file}`);
      for (const f of findings) {
        const loc = f.line ? `line ${f.line}: ` : '';
        lines.push(`    ⚠ ${loc}${f.detail}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function buildDefinitionsReport() {
  const lines = [];

  lines.push('');
  lines.push('==========================================');
  lines.push('  Code Quality — Check Definitions');
  lines.push('==========================================');

  for (const check of checks) {
    lines.push('');
    lines.push(`  ── ${check.name} ──`);
    for (const descLine of check.description.split('\n')) {
      lines.push(`  ${descLine}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const writeToFile = args.includes('--output');
  const summaryOnly = args.includes('--summary');
  const definitionsOnly = args.includes('--definitions');

  if (definitionsOnly) {
    console.log(buildDefinitionsReport());
    return;
  }

  const results = [];
  for (const check of checks) {
    results.push(check.run());
  }

  const summary = buildSummaryReport(results);

  if (writeToFile) {
    const detailed = buildDetailedReport(results);
    mkdirSync(REPORTS_DIR, { recursive: true });

    const timestamp = new Date().toISOString().slice(0, 10);
    const summaryPath = resolve(REPORTS_DIR, `summary-${timestamp}.txt`);
    const detailedPath = resolve(REPORTS_DIR, `detailed-${timestamp}.txt`);

    writeFileSync(summaryPath, summary.trimStart() + '\n');
    writeFileSync(detailedPath, detailed.trimStart() + '\n');

    console.log(`  Reports written to:`);
    console.log(`    ${summaryPath}`);
    console.log(`    ${detailedPath}`);
  } else if (summaryOnly) {
    console.log(summary);
  } else {
    console.log(summary);
    console.log(buildDetailedReport(results));
  }

  const totalFindings = results.reduce((sum, r) => sum + r.findings.length, 0);
  if (totalFindings > 0) {
    process.exit(1);
  }
}

main();
