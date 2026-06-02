<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{ change: void; togglefav: void }>();

  export let name: string;
  export let isFav = false;
</script>

<header class="locbar">
  <div class="top">
    <div class="info">
      <div class="name">{name}</div>
    </div>
    <div class="actions">
    <button
      class="star"
      class:on={isFav}
      type="button"
      data-testid="toggle-favorite"
      aria-pressed={isFav}
      aria-label={isFav ? 'Remove from favorites' : 'Save to favorites'}
      on:click={() => dispatch('togglefav')}
    >
      {isFav ? '★' : '☆'}
    </button>
    <button
      class="change"
      type="button"
      data-testid="change-location"
      aria-label="Search location"
      on:click={() => dispatch('change')}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
    </button>
    </div>
  </div>
</header>

<style>
  .locbar {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .info {
    min-width: 0;
  }
  .name {
    font-size: 1.15rem;
    font-weight: 700;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    flex: none;
  }
  .star {
    background: none;
    border: none;
    color: var(--accent);
    font-size: 1.4rem;
    min-width: 44px;
    min-height: 44px;
  }
  .star.on {
    color: var(--accent);
  }
  .change {
    background: var(--surface);
    color: var(--text);
    border: 1px solid color-mix(in srgb, var(--muted) 35%, transparent);
    border-radius: 50%;
    min-width: 44px;
    min-height: 44px;
    display: grid;
    place-items: center;
    padding: 0;
    cursor: pointer;
    transition: background-color 0.15s ease, transform 0.1s ease;
  }
  .change:hover {
    background: color-mix(in srgb, var(--surface) 80%, var(--text) 20%);
  }
  .change:active {
    transform: scale(0.95);
  }
</style>
