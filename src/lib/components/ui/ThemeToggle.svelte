<script lang="ts">
  import { Sun, Moon } from 'lucide-svelte';
  import { theme } from '$lib/state/theme.svelte.js';
</script>

<button
  onclick={theme.toggle}
  class="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800"
  aria-label={theme.dark ? 'Switch to light mode' : 'Switch to dark mode'}
>
  {#if theme.dark}
    <Moon size={14} class="text-slate-400" />
  {:else}
    <Sun size={14} class="text-slate-500" />
  {/if}
</button>
