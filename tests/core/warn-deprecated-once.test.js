import { describe, it, expect, vi, afterEach } from 'vitest';
import { warnDeprecatedOnce } from '../../src/core/warn-deprecated-once.js';
import { generateColliderToBuffer } from '../../src/generate-collider-buffer.js';
import { DEPRECATION } from '../../src/config.js';

afterEach(() => vi.restoreAllMocks());

describe('warnDeprecatedOnce', () => {
  it('warns once per feature key per process and names the plan doc', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(warnDeprecatedOnce('test-feature-a')).toBe(true);
    expect(warnDeprecatedOnce('test-feature-a')).toBe(false);
    expect(warnDeprecatedOnce('test-feature-b')).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0][0]).toContain('test-feature-a');
    expect(spy.mock.calls[0][0]).toContain(DEPRECATION.planDoc);
  });
});

describe('deprecated library exports', () => {
  it('generateColliderToBuffer warns once and still returns the collider OBJ unchanged', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const first = await generateColliderToBuffer(42, { mapWidth: 48, mapDepth: 48 });
    const second = await generateColliderToBuffer(42, { mapWidth: 48, mapDepth: 48 });
    expect(typeof first).toBe('string');
    expect(first.length).toBeGreaterThan(0);
    expect(second).toBe(first);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('generateColliderToBuffer');
  });
});
