import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { stationFileSlug } from './paths';
import type { IndexEntry } from './types';

// Loaded at runtime (not a static import): the index is generated at build time
// by scripts/build-station-index.ts and is gitignored, so type-checking must not
// depend on it existing. See CLAUDE.md.
const index: IndexEntry[] = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../public/data/stations-index.json'), 'utf8'),
);

describe('station data integrity', () => {
  it('slim index has active stations', () => {
    expect(index.length).toBeGreaterThan(3000);
  });

  it('every station in the index is a valid type and has correct attributes', () => {
    const invalidStations = index.filter((s) => s.type !== 'reference' && s.type !== 'subordinate');
    expect(invalidStations).toEqual([]);

    const subordinateStations = index.filter((s) => s.type === 'subordinate');
    expect(subordinateStations.length).toBeGreaterThan(1000); // Verify we loaded subordinates successfully
  });

  it('there are no duplicate station IDs', () => {
    const ids = index.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('every station in the index has a corresponding JSON file', () => {
    const stationsDir = path.resolve(__dirname, '../../public/data/stations');
    expect(fs.existsSync(stationsDir)).toBe(true);

    const refIds = new Set(index.filter((s) => s.type === 'reference').map((s) => s.id));

    // Sample random stations to keep the file check extremely fast but highly representative
    const sampleSize = 100;
    const shuffled = [...index].sort(() => 0.5 - Math.random());
    const samples = shuffled.slice(0, sampleSize);

    for (const station of samples) {
      const fileName = `${stationFileSlug(station.id)}.json`;
      const filePath = path.join(stationsDir, fileName);
      expect(fs.existsSync(filePath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(content.id).toBe(station.id);
      expect(content.type).toBe(station.type);

      if (station.type === 'reference') {
        expect(Array.isArray(content.harmonic_constituents)).toBe(true);
        expect(content.harmonic_constituents.length).toBeGreaterThan(0);
      } else {
        expect(content.offsets).toBeDefined();
        expect(content.offsets.reference).toBeDefined();
        // Check that the referenced station is in our reference index
        expect(refIds.has(content.offsets.reference)).toBe(true);
        expect(content.offsets.time).toBeDefined();
        expect(content.offsets.height).toBeDefined();
      }
    }
  });
});
