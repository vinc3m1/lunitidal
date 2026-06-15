<script lang="ts">
  import { path, matchRoute } from './router';
  import Home from '../routes/Home.svelte';
  import Detail from '../routes/Detail.svelte';
  import Settings from '../routes/Settings.svelte';

  $: route = matchRoute($path);
</script>

{#if route === 'detail'}
  <Detail />
{:else if route === 'settings'}
  <Settings />
{:else}
  <Home />
{/if}
