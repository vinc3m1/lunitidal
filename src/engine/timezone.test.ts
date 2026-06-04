import { describe, expect, it } from 'vitest';
import { timezoneAt } from './timezone';

describe('timezoneAt', () => {
  it('resolves coordinates to their IANA zone (offline)', async () => {
    expect(await timezoneAt(-8.74, 115.21)).toBe('Asia/Makassar'); // Benoa, Bali
    expect(await timezoneAt(40.71, -74.0)).toBe('America/New_York'); // NYC
    expect(await timezoneAt(22.57, 88.36)).toBe('Asia/Kolkata'); // Kolkata
  });

  it('returns null for non-finite coordinates rather than throwing', async () => {
    expect(await timezoneAt(NaN, 0)).toBeNull();
    expect(await timezoneAt(0, Infinity)).toBeNull();
  });
});
