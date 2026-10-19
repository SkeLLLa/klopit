<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import { m } from '#lib/paraglide/messages.js';
  import { getLocale, locales, localizeHref } from '#lib/paraglide/runtime.js';
  import { theme } from '#lib/state/theme.svelte.js';
  import { sidebar } from '#lib/state/sidebar.svelte.js';
  import { loggerState } from '#lib/state/logger.svelte.js';
  import Sidebar from '#lib/components/layout/Sidebar.svelte';
  import Header from '#lib/components/layout/Header.svelte';
  import Footer from '#lib/components/layout/Footer.svelte';
  import Breadcrumb from '#lib/components/ui/Breadcrumb.svelte';

  let { children } = $props();

  type Locale = (typeof locales)[number];
  type JsonLd = Record<string, unknown> | Record<string, unknown>[];
  interface SeoMeta {
    title?: string | undefined;
    description?: string | undefined;
    robots?: string | undefined;
    ogType?: 'website' | 'article';
    datePublished?: string | undefined;
    dateModified?: string | undefined;
    language?: string | undefined;
    alternateLocales?: Locale[] | undefined;
    xDefaultLocale?: Locale | undefined;
    jsonLd?: JsonLd | undefined;
  }

  const SITE_URL = 'https://klopit.co.pl';
  const ORGANIZATION_ID = `${SITE_URL}/#organization`;
  const WEB_APP_ID = `${SITE_URL}/#webapplication`;
  const WEBSITE_ID = `${SITE_URL}/#website`;
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

  const locale = $derived(getLocale());
  const localeTag = $derived(localeTags[locale] ?? locale);
  const currentPath = $derived(page.url.pathname);
  const normalizedPath = $derived(stripLocalePrefix(currentPath));
  const canonicalUrl = $derived(`${SITE_URL}${currentPath}`);
  const pageMetaData = $derived((page.data as { meta?: SeoMeta | undefined }).meta);
  const metaTitle = $derived(pageMetaData?.title ?? m.meta_title());
  const metaDescription = $derived(pageMetaData?.description ?? m.meta_description());
  const isError = $derived(Boolean(page.error));
  const robots = $derived(isError ? 'noindex, follow' : (pageMetaData?.robots ?? 'index, follow'));
  const metaLanguage = $derived(pageMetaData?.language ?? localeTag);
  const isDocsArticle = $derived(
    !isError && normalizedPath.startsWith('/docs/') && normalizedPath !== '/docs/',
  );
  const isHome = $derived(!isError && normalizedPath === '/');
  const ogType = $derived(pageMetaData?.ogType ?? (isDocsArticle ? 'article' : 'website'));
  const datePublished = $derived(pageMetaData?.datePublished);
  const dateModified = $derived(pageMetaData?.dateModified);
  const alternateLocales = $derived(pageMetaData?.alternateLocales ?? locales);
  const xDefaultLocale = $derived(pageMetaData?.xDefaultLocale ?? 'en');

  const publisher = $derived({
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'kloPIT',
    alternateName: 'klopit',
    url: `${SITE_URL}/`,
    description: m.seo_site_description(),
    logo: {
      '@type': 'ImageObject',
      '@id': `${SITE_URL}/#logo`,
      url: `${SITE_URL}/icons/icon-512.svg`,
    },
    sameAs: [
      'https://github.com/SkeLLLa/klopit',
      'https://github.com/SkeLLLa/klopit/discussions',
    ],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'technical support',
        url: 'https://github.com/SkeLLLa/klopit/issues',
        availableLanguage: ['English', 'Polish', 'Ukrainian'],
      },
    ],
  });

  const websiteSchema = $derived({
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: `${SITE_URL}/`,
    name: 'kloPIT',
    alternateName: 'klopit',
    description: m.seo_site_description(),
    inLanguage: ['en', 'pl-PL', 'uk-UA'],
    publisher: { '@id': ORGANIZATION_ID },
    license: 'https://www.gnu.org/licenses/agpl-3.0.html',
  });

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
    if (isError) return '';
    const graph: Record<string, unknown>[] = [publisher, websiteSchema];

    if (isHome) {
      graph.push({
        '@type': 'WebApplication',
        '@id': WEB_APP_ID,
        name: 'kloPIT',
        url: `${SITE_URL}/`,
        description: m.meta_description(),
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
        author: { '@id': ORGANIZATION_ID },
        creator: { '@id': ORGANIZATION_ID },
        publisher: { '@id': ORGANIZATION_ID },
        softwareHelp: {
          '@type': 'CreativeWork',
          url: `${SITE_URL}${withTrailingSlash(localizeHref('/docs/'))}`,
        },
      });
    }

    if (isDocsArticle) {
      graph.push({
        '@type': 'TechArticle',
        '@id': `${canonicalUrl}#article`,
        headline: metaTitle,
        description: metaDescription,
        mainEntityOfPage: canonicalUrl,
        isPartOf: { '@id': WEBSITE_ID },
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
  <meta name="format-detection" content="telephone=no" />
  {#if !isError}
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
  {/if}

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
  {#if !isError}
    <meta property="og:url" content={canonicalUrl} />
  {/if}
  <meta property="og:site_name" content="kloPIT" />

  <meta property="og:image" content="https://klopit.co.pl/og-image.png" />
  <meta property="og:image:width" content="1280" />
  <meta property="og:image:height" content="640" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:alt" content={m.og_image_alt()} />
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
  <meta name="twitter:image:alt" content={m.og_image_alt()} />

  <!-- Structured Data -->
  {#if !isError}
    {@html jsonLd}
  {/if}
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
            {#if dateModified}
              {m.docs_last_updated()}: {dateModified}
              <span aria-hidden="true"> · </span>
            {/if}
            {m.docs_maintained_by()}
            <a
              href="https://github.com/SkeLLLa/klopit/graphs/contributors"
              target="_blank"
              rel="noopener noreferrer"
              class="font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
            >
              {m.docs_community()}
            </a>
          </p>
        {/if}
        {@render children()}
      </div>
    </main>
    <Footer />
  </div>
</div>
