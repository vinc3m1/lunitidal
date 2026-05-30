<script lang="ts">
  import type { Extreme, HeightUnit, TimeFormat } from '../engine/types';
  import { formatHeight, formatCountdown } from '../engine/units';
  import { formatTime } from '../engine/time';
  import { getReadoutState } from './readout';

  export let scrubDate: Date;
  export let scrubLevel: number;
  export let levelAt: (t: Date) => number;
  export let extremes: Extreme[];
  export let tz: string;
  export let heightUnit: HeightUnit;
  export let timeFormat: TimeFormat;
  export let now: Date;

  $: ({ nextExtreme, isNow, rising, showCountdown } = getReadoutState({
    scrubDate,
    scrubLevel,
    levelAt,
    extremes,
    now,
  }));
</script>

<div class="readout">
  <div class="primary">
    <span class="state" class:rising class:falling={!rising}>
      {rising ? '▲ Rising' : '▼ Falling'}
    </span>
    <span class="height">{formatHeight(scrubLevel, heightUnit)}</span>
    <span class="at">{isNow ? 'now' : `at ${formatTime(scrubDate, tz, timeFormat)}`}</span>
  </div>
  {#if nextExtreme}
    <div class="next" data-testid="next-extreme">
      Next {nextExtreme.high ? 'high' : 'low'}
      <strong>{formatHeight(nextExtreme.level, heightUnit)}</strong>
      at {formatTime(nextExtreme.time, tz, timeFormat)}
      {#if showCountdown}
        <span class="muted">
          (in {formatCountdown(now.getTime(), nextExtreme.time.getTime())})
        </span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .readout {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .primary {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
  }
  .state {
    font-weight: 700;
    font-size: 1.05rem;
  }
  .state.rising {
    color: var(--rising);
  }
  .state.falling {
    color: var(--falling);
  }
  .height {
    font-size: 1.9rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .at {
    color: var(--muted);
  }
  .next {
    color: var(--text);
  }
  .next .muted,
  .muted {
    color: var(--muted);
  }
</style>
