<script lang="ts">
  import { getLocale } from '$lib/paraglide/runtime';
  import { m } from '$lib/paraglide/messages.js';
  import { pageTitle } from '$lib/state/page-title.svelte.js';
  import {
    directDonationFunds,
    taxSupportFunds,
  } from '$lib/constants/support-funds.js';

  const mbankAffiliateCode = 'bemyfellowm1n1on';
  const mbankAffiliateUrl =
    'https://www.mbank.pl/mgm/konta.html?numer=bemyfellowm1n1on';

  const locale = $derived(getLocale());

  pageTitle.set(m.page_support());
</script>

<div class="space-y-8">
  <section>
    <h1 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">
      {m.support_title()}
    </h1>
    <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
      {m.support_intro()}
    </p>
  </section>

  <section class="space-y-4">
    <div>
      <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {m.support_tax_section_title()}
      </h3>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {m.support_tax_section_subtitle()}
      </p>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {#each taxSupportFunds as fund (fund.id)}
        <article
          class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <div class="mb-3 flex items-start justify-between gap-3">
            <h4 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {fund.name}
            </h4>
            <span
              class="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
            >
              {m.support_krs_label()}: {fund.krs}
            </span>
          </div>

          <div class="mb-2 rounded-md bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            <div class="font-medium text-slate-700 dark:text-slate-200">{m.support_payment_description_label()}:</div>
            <div class="mt-0.5 italic">{fund.paymentDescription}</div>
          </div>

          <p class="text-sm text-slate-600 dark:text-slate-300">{m[fund.descriptionKey]()}</p>

          <div class="mt-4 flex flex-wrap gap-2">
            <a
              href={fund.taxDonationUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700"
            >
              {m.support_tax_cta()}
            </a>
            <a
              href={fund.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {m.support_website_cta()}
            </a>
          </div>
        </article>
      {/each}
    </div>
  </section>

  <section class="space-y-4">
    <div>
      <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {m.support_direct_section_title()}
      </h3>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {m.support_direct_section_subtitle()}
      </p>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {#each directDonationFunds as fund (fund.id)}
        <article
          class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
        >
          <h4 class="text-sm font-semibold text-slate-900 dark:text-slate-100">{fund.name}</h4>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">{m[fund.descriptionKey]()}</p>

          <div class="mt-4 flex flex-wrap gap-2">
            <a
              href={fund.donationUrl[locale] ?? fund.donationUrl['*']}
              target="_blank"
              rel="noopener noreferrer"
              class="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
            >
              {m.support_direct_cta()}
            </a>
            <a
              href={fund.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {m.support_website_cta()}
            </a>
          </div>
        </article>
      {/each}
    </div>
  </section>

  <section class="space-y-4">
    <div>
      <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {m.support_affiliate_section_title()}
      </h3>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {m.support_affiliate_section_subtitle()}
      </p>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <article
        class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
      >
        <h4 class="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {m.support_affiliate_mbank_title()}
        </h4>

        <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">{m.support_affiliate_intro()}</p>

        <div class="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-600 dark:bg-slate-700">
          <div class="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">
            {m.support_affiliate_code_label()}
          </div>
          <div class="mt-1 break-all font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
            {mbankAffiliateCode}
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <a
            href={mbankAffiliateUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700"
          >
            {m.support_affiliate_cta()}
          </a>
        </div>
      </article>

    </div>
  </section>
</div>
