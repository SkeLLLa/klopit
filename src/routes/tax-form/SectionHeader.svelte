<script lang="ts">
  import { localizeHref } from '$lib/paraglide/runtime';

  let {
    title,
    placeholder = false,
    seeTransactionsHref,
    seeTransactionsLabel,
  }: {
    title: string;
    placeholder?: boolean;
    seeTransactionsHref?: string;
    seeTransactionsLabel?: string;
  } = $props();
</script>

<div
  class="mb-3 flex items-center justify-between gap-3 border-b border-slate-200 pb-2 dark:border-slate-700"
  class:opacity-50={placeholder}
>
  <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">
    {title}
  </h3>
  {#if seeTransactionsHref && seeTransactionsLabel}
    <a
      href={localizeHref(seeTransactionsHref)}
      class="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
    >
      {seeTransactionsLabel}
    </a>
  {/if}
</div>
