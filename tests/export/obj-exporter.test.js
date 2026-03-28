import { describe, it, expect } from 'vitest';
import { getObjOutputPath } from '../../src/export/obj-exporter.js';

// NOTE: Full exportToObj tests require texture assets on disk (PNG files).
// We test the pure utility functions and output path logic here.
// Integration tests with the full pipeline would need the asset directory.

describe('getObjOutputPath', () => {
  it('returns dir and baseName from config', () => {
    const config = { outputDir: 'output', seed: 42 };
    const result = getObjOutputPath(config);
    expect(result).toHaveProperty('dir');
    expect(result).toHaveProperty('baseName');
    expect(result.baseName).toContain('42');
  });
});
