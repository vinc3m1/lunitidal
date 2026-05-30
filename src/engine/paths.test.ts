import { describe, expect, it } from 'vitest';
import { stationFileRelPath, stationFileSlug } from './paths';

describe('station file paths', () => {
  it('slugs slashes in station ids to flat filenames', () => {
    expect(stationFileSlug('noaa/1610367')).toBe('noaa__1610367');
    expect(stationFileSlug('ticon/benoa-163-idn-uhslc_fd')).toBe('ticon__benoa-163-idn-uhslc_fd');
  });

  it('leaves slash-free ids untouched', () => {
    expect(stationFileSlug('benoa')).toBe('benoa');
  });

  it('builds the public-relative path', () => {
    expect(stationFileRelPath('noaa/1610367')).toBe('data/stations/noaa__1610367.json');
  });
});
