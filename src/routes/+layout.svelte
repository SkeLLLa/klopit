<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale, locales, localizeHref } from '$lib/paraglide/runtime';
  import { theme } from '$lib/state/theme.svelte.js';
  import { sidebar } from '$lib/state/sidebar.svelte.js';
  import { loggerState } from '$lib/state/logger.svelte.js';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import Header from '$lib/components/layout/Header.svelte';
  import Footer from '$lib/components/layout/Footer.svelte';
  import Breadcrumb from '$lib/components/ui/Breadcrumb.svelte';

  let { children } = $props();

  type Locale = (typeof locales)[number];
  type JsonLd = Record<string, unknown> | Record<string, unknown>[];
  interface SeoMeta {
    title?: string;
    description?: string;
    robots?: string;
    ogType?: 'website' | 'article';
    datePublished?: string;
    dateModified?: string;
    language?: string;
    alternateLocales?: Locale[];
    xDefaultLocale?: Locale;
    jsonLd?: JsonLd;
  }

  const SITE_URL = 'https://klopit.co.pl';
  const ORGANIZATION_ID = `${SITE_URL}/#organization`;
  const WEB_APP_ID = `${SITE_URL}/#webapplication`;
  const localeTags: Record<string, string> = {
    en: 'en',
    pl: 'pl-PL',
    uk: 'uk-UA',
  };
  const ogLocaleTags: Record<string, string> = {
    en: 'en_US',
    pl: 'pl_PL',
    uk: 'uk_UA',
  };
  const docsUpdatedLabels: Record<string, string> = {
    en: 'Last updated',
    pl: 'Ostatnia aktualizacja',
    uk: 'Останнє оновлення',
  };
  const docsMaintainerLabels: Record<string, string> = {
    en: 'Maintained by',
    pl: 'Utrzymuje',
    uk: 'Підтримує',
  };

  const locale = $derived(getLocale());
  const localeTag = $derived(localeTags[locale] ?? locale);
  const currentPath = $derived(page.url.pathname);
  const normalizedPath = $derived(stripLocalePrefix(currentPath));
  const canonicalUrl = $derived(`${SITE_URL}${currentPath}`);
  const pageMetaData = $derived((page.data as { meta?: SeoMeta }).meta);
  const metaTitle = $derived(pageMetaData?.title ?? m.meta_title());
  const metaDescription = $derived(pageMetaData?.description ?? m.meta_description());
  const robots = $derived(pageMetaData?.robots ?? 'index, follow');
  const metaLanguage = $derived(pageMetaData?.language ?? localeTag);
  const isDocsArticle = $derived(
    normalizedPath.startsWith('/docs/') && normalizedPath !== '/docs/',
  );
  const ogType = $derived(pageMetaData?.ogType ?? (isDocsArticle ? 'article' : 'website'));
  const datePublished = $derived(pageMetaData?.datePublished);
  const dateModified = $derived(pageMetaData?.dateModified ?? (isDocsArticle ? '2026-04-27' : undefined));
  const alternateLocales = $derived(pageMetaData?.alternateLocales ?? locales);
  const xDefaultLocale = $derived(pageMetaData?.xDefaultLocale ?? 'en');

  const publisher = {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'kloPIT',
    alternateName: 'klopit',
    url: `${SITE_URL}/`,
    description:
      'Darmowy, open-source kalkulator PIT-38 online — bez rejestracji, dane zostają w przeglądarce.',
    logo: {
      '@type': 'ImageObject',
      '@id': `${SITE_URL}/#logo`,
      url: `${SITE_URL}/icons/icon-512.svg`,
    },
    sameAs: ['https://github.com/SkeLLLa/klopit'],
  };

  function stripLocalePrefix(pathname: string): string {
    const path = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;
    for (const loc of locales) {
      if (loc === 'en') continue;
      if (path === `/${loc}`) return '/';
      if (path.startsWith(`/${loc}/`)) return path.slice(loc.length + 1) || '/';
    }
    return path || '/';
  }

  function withTrailingSlash(pathname: string): string {
    return pathname.endsWith('/') ? pathname : `${pathname}/`;
  }

  function asJsonLdArray(value: JsonLd | undefined): Record<string, unknown>[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  const jsonLd = $derived.by(() => {
    const graph: Record<string, unknown>[] = [
      publisher,
      {
        '@type': 'WebApplication',
        '@id': WEB_APP_ID,
        name: 'kloPIT',
        url: `${SITE_URL}/`,
        description: metaDescription,
        applicationCategory: 'FinanceApplication',
        applicationSubCategory: 'TaxPreparation',
        operatingSystem: 'All',
        browserRequirements: 'Requires JavaScript',
        isAccessibleForFree: true,
        license: 'https://www.gnu.org/licenses/agpl-3.0.html',
        codeRepository: 'https://github.com/SkeLLLa/klopit',
        softwareVersion: __APP_VERSION__,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'PLN' },
        featureList: [
          'CSV import (Interactive Brokers)',
          'PDF import (IBI Capital)',
          'FIFO capital gains calculation',
          'NBP exchange rates (Table A)',
          'PIT-38 form values',
          'PIT/ZG attachment',
          'Loss carryforward (5 years)',
          'Foreign dividend withholding credit',
        ],
        availableLanguage: [
          { '@type': 'Language', name: 'English', alternateName: 'en' },
          { '@type': 'Language', name: 'Polish', alternateName: 'pl' },
          { '@type': 'Language', name: 'Ukrainian', alternateName: 'uk' },
        ],
        inLanguage: metaLanguage,
        publisher: { '@id': ORGANIZATION_ID },
      },
    ];

    if (isDocsArticle) {
      graph.push({
        '@type': 'TechArticle',
        '@id': `${canonicalUrl}#article`,
        headline: metaTitle,
        description: metaDescription,
        mainEntityOfPage: canonicalUrl,
        inLanguage: metaLanguage,
        author: { '@id': ORGANIZATION_ID },
        publisher: { '@id': ORGANIZATION_ID },
        ...(datePublished ? { datePublished } : {}),
        ...(dateModified ? { dateModified } : {}),
      });
    }

    graph.push(...asJsonLdArray(pageMetaData?.jsonLd));

    return `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': graph,
    })}${'</'}script>`;
  });

  $effect(() => {
    theme.init();
    sidebar.init();
    loggerState.init();
  });
</script>

<svelte:head>
  <title>{metaTitle}</title>
  <meta name="description" content={metaDescription} />
  <meta name="author" content="kloPIT" />
  <meta name="robots" content={robots} />
  <meta name="theme-color" content="#0f172a" />
  <meta name="format-detection" content="telephone=no" />
  <link rel="canonical" href={canonicalUrl} />

  {#each alternateLocales as loc (loc)}
    <link
      rel="alternate"
      hreflang={localeTags[loc] ?? loc}
      href="{SITE_URL}{withTrailingSlash(localizeHref(normalizedPath, { locale: loc }))}"
    />
  {/each}
  <link
    rel="alternate"
    hreflang="x-default"
    href="{SITE_URL}{withTrailingSlash(localizeHref(normalizedPath, { locale: xDefaultLocale }))}"
  />

  <!-- Open Graph -->
  <meta property="og:type" content={ogType} />
  <meta property="og:locale" content={ogLocaleTags[locale] ?? locale} />
  {#each locales.filter((l) => l !== locale) as altLocale (altLocale)}
    <meta
      property="og:locale:alternate"
      content={ogLocaleTags[altLocale] ?? altLocale}
    />
  {/each}
  <meta property="og:title" content={metaTitle} />
  <meta property="og:description" content={metaDescription} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:site_name" content="kloPIT" />

  <meta property="og:image" content="https://klopit.co.pl/og-image.png" />
  <meta property="og:image:width" content="1280" />
  <meta property="og:image:height" content="640" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:alt" content="kloPIT — kalkulator PIT-38 online" />
  {#if dateModified}
    <meta property="og:updated_time" content={dateModified} />
  {/if}
  {#if ogType === 'article' && datePublished}
    <meta property="article:published_time" content={datePublished} />
  {/if}
  {#if ogType === 'article' && dateModified}
    <meta property="article:modified_time" content={dateModified} />
  {/if}

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={metaTitle} />
  <meta name="twitter:description" content={metaDescription} />
  <meta name="twitter:image" content="https://klopit.co.pl/og-image.png" />
  <meta name="twitter:image:alt" content="kloPIT — kalkulator PIT-38 online" />

  <!-- Structured Data -->
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON-LD structured data, no user input -->
  {@html jsonLd}
</svelte:head>

<div class="flex h-screen bg-slate-50 font-sans dark:bg-slate-900">
  <Sidebar />

  <div
    data-main-content
    class="flex min-w-0 flex-1 flex-col transition-all duration-300"
    style:margin-left={sidebar.collapsed ? '3.5rem' : '15rem'}
  >
    <Header />
    <main class="flex-1 overflow-y-auto p-5">
      <div class="mx-auto max-w-6xl">
        <Breadcrumb />
        {#if isDocsArticle}
          <p class="mb-4 text-xs text-slate-500 dark:text-slate-400">
            {docsUpdatedLabels[locale] ?? docsUpdatedLabels.en}: {dateModified ?? '2026-04-27'}
            <span aria-hidden="true"> · </span>
            {docsMaintainerLabels[locale] ?? docsMaintainerLabels.en}
            <a
              href="https://github.com/SkeLLLa/klopit"
              target="_blank"
              rel="noopener noreferrer"
              class="font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
            >
              m03geek
            </a>
          </p>
        {/if}
        {@render children()}
      </div>
    </main>
    <Footer />
  </div>
</div>
