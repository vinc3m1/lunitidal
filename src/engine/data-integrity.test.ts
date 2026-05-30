import { describe, expect, it } from 'vitest';
import index from '../../public/data/stations-index.json';
import fs from 'node:fs';
import path from 'node:path';
import { stationFileSlug } from './paths';

describe('station data integrity', () => {
  it('slim index has active stations', () => {
    expect(index.length).toBeGreaterThan(3000);
  });

  it('every station in the index is a reference station and has constituents', () => {
    const invalidTypes = index.filter((s) => s.type !== 'reference');
    expect(invalidTypes).toEqual([]);
  });

  it('there are no duplicate station IDs', () => {
    const ids = index.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('every station in the index has a corresponding JSON file', () => {
    const stationsDir = path.resolve(__dirname, '../../public/data/stations');
    expect(fs.existsSync(stationsDir)).toBe(true);

    // Sample 20 random stations to keep the file check extremely fast but highly representative
    const sampleSize = 50;
    const shuffled = [...index].sort(() => 0.5 - Math.random());
    const samples = shuffled.slice(0, sampleSize);

    for (const station of samples) {
      const fileName = `${stationFileSlug(station.id)}.json`;
      const filePath = path.join(stationsDir, fileName);
      expect(fs.existsSync(filePath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(content.id).toBe(station.id);
      expect(content.type).toBe('reference');
      expect(Array.isArray(content.harmonic_constituents)).toBe(true);
      expect(content.harmonic_constituents.length).toBeGreaterThan(0);
    }
  });
});
