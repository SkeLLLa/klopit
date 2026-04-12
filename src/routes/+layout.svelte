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

  let { children } = $props();

  const locale = $derived(getLocale());
  const currentPath = $derived(page.url.pathname);

  const jsonLd = $derived(
    `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'kloPIT',
      url: 'https://klopit.pl/',
      description: m.meta_description(),
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'All',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'PLN' },
      inLanguage: locale,
      browserRequirements: 'Requires JavaScript',
    })}${'</'}script>`,
  );

  $effect(() => {
    theme.init();
    sidebar.init();
  });
</script>

<svelte:head>
  <title>{m.meta_title()}</title>
  <meta name="description" content={m.meta_description()} />
  <meta name="keywords" content={m.meta_keywords()} />
  <meta name="author" content="kloPIT" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://klopit.pl{currentPath}" />

  {#each locales as loc (loc)}
    <link
      rel="alternate"
      hreflang={loc}
      href="https://klopit.pl{localizeHref(currentPath, { locale: loc })}"
    />
  {/each}
  <link
    rel="alternate"
    hreflang="x-default"
    href="https://klopit.pl{localizeHref(currentPath, { locale: 'en' })}"
  />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta
    property="og:locale"
    content={locale === 'pl' ? 'pl_PL' : locale === 'uk' ? 'uk_UA' : 'en_GB'}
  />
  <meta property="og:title" content={m.meta_title()} />
  <meta property="og:description" content={m.meta_description()} />
  <meta property="og:url" content="https://klopit.pl{currentPath}" />
  <meta property="og:site_name" content="kloPIT" />

  <meta property="og:image" content="https://klopit.pl/og-image.png" />
  <meta property="og:image:width" content="1280" />
  <meta property="og:image:height" content="640" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={m.meta_title()} />
  <meta name="twitter:description" content={m.meta_description()} />
  <meta name="twitter:image" content="https://klopit.pl/og-image.png" />

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
        {@render children()}
      </div>
    </main>
    <Footer />
  </div>
</div>
