<script lang="ts">
  import { page } from '$app/state';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale, localizeHref } from '#lib/paraglide/runtime.js';

  const isNotFound = $derived(page.status === 404);

  // The 404 shell is prerendered once with lang="en"; fix it for the URL's locale.
  $effect(() => {
    document.documentElement.lang = getLocale();
    document.documentElement.dir = 'ltr';
  });
</script>

<section class="mx-auto max-w-xl py-12 text-center">
  <p class="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{page.status}</p>
  {#if isNotFound}
    <h1 class="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
      {m.error_404_title()}
    </h1>
    <p class="mt-3 text-slate-600 dark:text-slate-300">{m.error_404_body()}</p>
    <ul class="mt-6 space-y-2">
      <li>
        <a
          href={localizeHref('/')}
          class="font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
        >
          {m.error_404_link_home()}
        </a>
      </li>
      <li>
        <a
          href={localizeHref('/docs/')}
          class="font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
        >
          {m.error_404_link_docs()}
        </a>
      </li>
      <li>
        <a
          href={localizeHref('/docs/faq/')}
          class="font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
        >
          {m.error_404_link_faq()}
        </a>
      </li>
    </ul>
  {:else}
    <h1 class="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
      {m.error_generic_title()}
    </h1>
    <p class="mt-3 text-slate-600 dark:text-slate-300">{page.error?.message}</p>
  {/if}
</section>
