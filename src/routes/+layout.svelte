<script lang="ts">
  import '../app.css';
  import { page } from '$app/state';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale, locales, localizeHref } from '$lib/paraglide/runtime';
  import { theme } from '$lib/state/theme.svelte.js';
  import { sidebar } from '$lib/state/sidebar.svelte.js';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import Header from '$lib/components/layout/Header.svelte';
  import Footer from '$lib/components/layout/Footer.svelte';
  import Breadcrumb from '$lib/components/ui/Breadcrumb.svelte';

  let { children } = $props();

  const locale = $derived(getLocale());
  const currentPath = $derived(page.url.pathname);
  const pageMetaData = $derived(
    (page.data as { meta?: { title?: string; description?: string } }).meta,
  );
  const metaTitle = $derived(pageMetaData?.title ?? m.meta_title());
  const metaDescription = $derived(pageMetaData?.description ?? m.meta_description());

  const publisher = {
    '@type': 'Organization',
    name: 'kloPIT',
    url: 'https://klopit.co.pl/',
    logo: {
      '@type': 'ImageObject',
      url: 'https://klopit.co.pl/icons/icon-512.svg',
    },
    sameAs: ['https://github.com/SkeLLLa/klopit'],
  };

  const jsonLd = $derived(
    `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'kloPIT',
      url: 'https://klopit.co.pl/',
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
        'CSV import (IBI)',
        'FIFO capital gains calculation',
        'NBP exchange rates (Table A)',
        'PIT-38 form values',
        'PIT-ZG attachment',
        'Loss carryforward (5 years)',
        'Foreign dividend withholding credit',
      ],
      availableLanguage: [
        { '@type': 'Language', name: 'English', alternateName: 'en' },
        { '@type': 'Language', name: 'Polish', alternateName: 'pl' },
        { '@type': 'Language', name: 'Ukrainian', alternateName: 'uk' },
      ],
      inLanguage: locale,
      publisher,
    })}${'</'}script>`,
  );

  $effect(() => {
    theme.init();
    sidebar.init();
  });
</script>

<svelte:head>
  <title>{metaTitle}</title>
  <meta name="description" content={metaDescription} />
  <meta name="keywords" content={m.meta_keywords()} />
  <meta name="author" content="kloPIT" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://klopit.co.pl{currentPath}" />

  {#each locales as loc (loc)}
    <link
      rel="alternate"
      hreflang={loc}
      href="https://klopit.co.pl{localizeHref(currentPath, { locale: loc })}"
    />
  {/each}
  <link
    rel="alternate"
    hreflang="x-default"
    href="https://klopit.co.pl{localizeHref(currentPath, { locale: 'en' })}"
  />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta
    property="og:locale"
    content={locale === 'pl' ? 'pl_PL' : locale === 'uk' ? 'uk_UA' : 'en_GB'}
  />
  {#each locales.filter((l) => l !== locale) as altLocale (altLocale)}
    <meta
      property="og:locale:alternate"
      content={altLocale === 'pl' ? 'pl_PL' : altLocale === 'uk' ? 'uk_UA' : 'en_GB'}
    />
  {/each}
  <meta property="og:title" content={metaTitle} />
  <meta property="og:description" content={metaDescription} />
  <meta property="og:url" content="https://klopit.co.pl{currentPath}" />
  <meta property="og:site_name" content="kloPIT" />

  <meta property="og:image" content="https://klopit.co.pl/og-image.png" />
  <meta property="og:image:width" content="1280" />
  <meta property="og:image:height" content="640" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={metaTitle} />
  <meta name="twitter:description" content={metaDescription} />
  <meta name="twitter:image" content="https://klopit.co.pl/og-image.png" />

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
        {@render children()}
      </div>
    </main>
    <Footer />
  </div>
</div>
