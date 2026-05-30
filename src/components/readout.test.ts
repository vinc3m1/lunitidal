import { describe, expect, it } from 'vitest';
import { getReadoutState } from './readout';
import type { Extreme } from '../engine/types';

const at = (iso: string) => new Date(iso);

const extreme = (iso: string, high: boolean, level = high ? 1.5 : 0.2): Extreme => ({
  time: at(iso),
  level,
  high,
  low: !high,
  label: high ? 'High' : 'Low',
});

describe('readout state', () => {
  it('uses next-day extrema so the next high/low line can stay populated at end of day', () => {
    const state = getReadoutState({
      scrubDate: at('2026-05-30T15:59:00Z'),
      scrubLevel: 0.8,
      now: at('2026-05-30T10:00:00Z'),
      extremes: [
        extreme('2026-05-30T03:00:00Z', true),
        extreme('2026-05-30T09:00:00Z', false),
        extreme('2026-05-31T01:00:00Z', true),
      ],
      levelAt: () => 0.9,
    });

    expect(state.nextExtreme?.time.toISOString()).toBe('2026-05-31T01:00:00.000Z');
    expect(state.nextExtreme?.high).toBe(true);
  });

  it('shows countdown only when the scrubber is at now', () => {
    const next = extreme('2026-05-30T14:00:00Z', true);
    const atNow = getReadoutState({
      scrubDate: at('2026-05-30T10:00:30Z'),
      scrubLevel: 0.8,
      now: at('2026-05-30T10:00:00Z'),
      extremes: [next],
      levelAt: () => 0.9,
    });
    const scrubbed = getReadoutState({
      scrubDate: at('2026-05-30T11:00:00Z'),
      scrubLevel: 0.8,
      now: at('2026-05-30T10:00:00Z'),
      extremes: [next],
      levelAt: () => 0.9,
    });

    expect(atNow.showCountdown).toBe(true);
    expect(scrubbed.showCountdown).toBe(false);
  });

  it('derives rising/falling from the next extreme instead of a noisy local slope', () => {
    const noisyRisingSlope = getReadoutState({
      scrubDate: at('2026-05-30T10:00:00Z'),
      scrubLevel: 0.8,
      now: at('2026-05-30T10:00:00Z'),
      extremes: [extreme('2026-05-30T12:00:00Z', true)],
      levelAt: () => 0.7,
    });
    const noisyFallingSlope = getReadoutState({
      scrubDate: at('2026-05-30T10:00:00Z'),
      scrubLevel: 0.8,
      now: at('2026-05-30T10:00:00Z'),
      extremes: [extreme('2026-05-30T12:00:00Z', false)],
      levelAt: () => 0.9,
    });

    expect(noisyRisingSlope.rising).toBe(true);
    expect(noisyFallingSlope.rising).toBe(false);
  });
});
