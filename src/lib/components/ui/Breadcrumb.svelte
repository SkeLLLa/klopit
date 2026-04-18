<script lang="ts">
  import { page } from '$app/state';
  import { m } from '$lib/paraglide/messages.js';
  import { localizeHref, getLocale } from '$lib/paraglide/runtime';
  import { ChevronRight } from 'lucide-svelte';

  const BASE_URL = 'https://klopit.co.pl';

  const locale = $derived(getLocale());

  const routes: Record<string, { label: () => string; linkable: boolean }> = {
    '/': { label: () => m.nav_home(), linkable: true },
    '/data': { label: () => m.nav_data(), linkable: true },
    '/dashboard': { label: () => m.nav_dashboard(), linkable: true },
    '/rates': { label: () => m.nav_rates(), linkable: true },
    '/tax-form': { label: () => m.nav_tax_form(), linkable: true },
    '/support': { label: () => m.nav_support(), linkable: true },
    '/about': { label: () => m.nav_about(), linkable: true },
    '/docs': { label: () => m.nav_docs(), linkable: false },
    '/docs/faq': { label: () => m.nav_faq(), linkable: true },
    '/docs/ibkr': { label: () => m.nav_docs_ib(), linkable: true },
    '/docs/ibi': { label: () => m.nav_docs_ibi(), linkable: true },
    '/docs/ibi/espp': { label: () => m.nav_docs_ibi_espp(), linkable: true },
  };

  interface Crumb {
    label: string;
    href: string;
    linkable: boolean;
  }

  const crumbs: Crumb[] = $derived.by(() => {
    const rawPath = page.url.pathname;
    const localizedHome = localizeHref('/');
    const stripped =
      localizedHome !== '/' && rawPath.startsWith(localizedHome)
        ? rawPath.slice(localizedHome.length) || '/'
        : rawPath;

    if (stripped === '/') return [];

    const segments = stripped.split('/').filter(Boolean);
    const result: Crumb[] = [{ label: m.nav_home(), href: '/', linkable: true }];

    for (let i = 0; i < segments.length; i++) {
      const path = '/' + segments.slice(0, i + 1).join('/');
      const route = routes[path];
      if (route) {
        result.push({ label: route.label(), href: path, linkable: route.linkable });
      }
    }

    return result.length > 1 ? result : [];
  });

  const jsonLd = $derived.by(() => {
    if (crumbs.length === 0) return '';
    const items = crumbs.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.label,
      item: `${BASE_URL}${localizeHref(crumb.href, { locale })}`,
    }));
    return `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items,
    })}${'</'}script>`;
  });
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON-LD structured data, no user input -->
<svelte:head>{@html jsonLd}</svelte:head>

{#if crumbs.length > 0}
  <nav aria-label="Breadcrumb" class="mb-4">
    <ol class="flex flex-wrap items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
      {#each crumbs as crumb, i (crumb.href)}
        {#if i > 0}
          <li aria-hidden="true" class="flex items-center">
            <ChevronRight size={12} />
          </li>
        {/if}
        <li>
          {#if i === crumbs.length - 1}
            <span class="font-medium text-slate-700 dark:text-slate-200" aria-current="page">
              {crumb.label}
            </span>
          {:else if crumb.linkable}
            <a
              href={localizeHref(crumb.href)}
              class="hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              {crumb.label}
            </a>
          {:else}
            <span>{crumb.label}</span>
          {/if}
        </li>
      {/each}
    </ol>
  </nav>
{/if}
