<script lang="ts">
  import { KLO_ACRONYMS } from '$lib/constants/acronyms.js';

  let { collapsed = false }: { collapsed?: boolean } = $props();

  let currentIndex = $state(0);
  const DISPLAY_DURATION = 10000;

  $effect(() => {
    const interval = setInterval(() => {
      currentIndex = (currentIndex + 1) % KLO_ACRONYMS.length;
    }, DISPLAY_DURATION);

    return () => clearInterval(interval);
  });
</script>

<div class="flex min-w-0 flex-col gap-0.5">
  <div class="flex items-center gap-2">
    <img
      src="/icons/icon-32.svg"
      alt="kloPIT"
      class="h-7 w-7 shrink-0 rounded-[7px]"
      width="28"
      height="28"
    />
    {#if !collapsed}
      <span class="text-base font-bold text-slate-900 dark:text-slate-100">kloPIT</span>
    {/if}
  </div>
  {#if !collapsed}
    {#key currentIndex}
      <span
        class="typewriter text-[10px] leading-tight text-slate-400 dark:text-slate-500"
        style={`--chars: ${KLO_ACRONYMS[currentIndex].length};`}
      >
        {KLO_ACRONYMS[currentIndex]}
      </span>
    {/key}
  {/if}
</div>

<style>
  .typewriter {
    display: inline-block;
    width: 0;
    overflow: hidden;
    white-space: nowrap;
    letter-spacing: 0.08em;
    animation: typing 3.5s steps(var(--chars), end) forwards;
  }

  @keyframes typing {
    from {
      width: 0;
    }
    to {
      width: calc(var(--chars) * 1ch);
    }
  }
</style>
