<script lang="ts">
  import type { Extreme, HeightUnit, TimeFormat } from '../engine/types';
  import { formatHeight } from '../engine/units';
  import { formatTime } from '../engine/time';

  export let extremes: Extreme[];
  export let tz: string;
  export let heightUnit: HeightUnit;
  export let timeFormat: TimeFormat;
</script>

<ul class="extremes">
  {#each extremes as e}
    <li>
      <span class="badge" class:high={e.high} class:low={e.low}>
        {e.high ? 'High' : 'Low'}
      </span>
      <span class="time">{formatTime(e.time, tz, timeFormat)}</span>
      <span class="height">{formatHeight(e.level, heightUnit)}</span>
    </li>
  {/each}
</ul>

<style>
  .extremes {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  li {
    display: grid;
    grid-template-columns: 4rem 1fr auto;
    align-items: center;
    gap: 0.75rem;
    padding: 0.55rem 0.75rem;
    background: var(--surface);
    border-radius: 0.6rem;
  }
  .badge {
    font-size: 0.75rem;
    font-weight: 700;
    text-align: center;
    padding: 0.15rem 0;
    border-radius: 0.4rem;
  }
  .badge.high {
    color: var(--bg);
    background: var(--accent);
  }
  .badge.low {
    color: var(--bg);
    background: var(--falling);
  }
  .time {
    color: var(--muted);
  }
  .height {
    font-weight: 700;
  }
</style>
