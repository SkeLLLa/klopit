import type { m } from '$lib/paraglide/messages.js';

type NoArgMessageKey = {
  [K in keyof typeof m]: Parameters<(typeof m)[K]>[0] extends
    | undefined
    | Record<string, never>
    ? K
    : never;
}[keyof typeof m];

export interface TaxSupportFund {
  id: string;
  name: string;
  krs: string;
  paymentDescription: string;
  /** i18n key — must exist in all locale message files */
  descriptionKey: NoArgMessageKey;
  taxDonationUrl: string;
  websiteUrl: string;
}

export interface DirectDonationFund {
  id: string;
  name: string;
  /** i18n key — must exist in all locale message files */
  descriptionKey: NoArgMessageKey;
  /** Locale-keyed donation URLs. Use locale code (e.g. 'uk') or '*' as fallback. */
  donationUrl: Record<string, string>;
  websiteUrl: string;
}

// Verified OPP organizations where 1.5% tax can support Ukraine-related aid.
export const taxSupportFunds: TaxSupportFund[] = [
  {
    id: 'pah',
    name: 'Polska Akcja Humanitarna',
    krs: '0000136833',
    paymentDescription: 'Wplacam na pomoc Ukrainie',
    descriptionKey: 'support_fund_pah_desc',
    taxDonationUrl:
      'https://www.pah.org.pl/wplac/?form=wplacam-na-pomoc-ukrainie',
    websiteUrl: 'https://www.pah.org.pl/',
  },
  {
    id: 'ukrainski-dom',
    name: 'Fundacja Ukraiński Dom',
    krs: '0000342283',
    paymentDescription:
      'Fundacja Ukraiński Dom — wsparcie integracji Ukraińców',
    descriptionKey: 'support_fund_ukrainski_dom_desc',
    taxDonationUrl: 'https://ukrainskidom.pl/przekaz-1-5-procenta/',
    websiteUrl: 'https://ukrainskidom.pl/',
  },
  {
    id: 'caritas',
    name: 'Caritas Polska',
    krs: '0000198645',
    paymentDescription:
      'Caritas Polska — akcje mające na celu wspieranie Ukrainy',
    descriptionKey: 'support_fund_caritas_desc',
    taxDonationUrl: 'https://caritas.pl/procent-podatku/',
    websiteUrl: 'https://caritas.pl/',
  },
  {
    id: 'pomagam',
    name: 'Fundacja Pomagam.pl',
    krs: '0000353888',
    paymentDescription: 'Fundacja Pomagam.pl — Solidarni z Ukrainą',
    descriptionKey: 'support_fund_pomagam_desc',
    taxDonationUrl: 'https://pomagam.pl/org/fundacjastandwithukraine',
    websiteUrl: 'https://pomagam.pl/',
  },
  {
    id: 'siepomaga',
    name: 'Fundacja Siepomaga',
    krs: '0000396361',
    paymentDescription: '0185785 Ukraina',
    descriptionKey: 'support_fund_siepomaga_desc',
    taxDonationUrl: 'https://www.siepomaga.pl/ukraina',
    websiteUrl: 'https://www.siepomaga.pl/',
  },
];

export const directDonationFunds: DirectDonationFund[] = [
  {
    id: 'savelife',
    name: 'Come Back Alive',
    descriptionKey: 'support_direct_savelife_desc',
    donationUrl: {
      'uk': 'https://savelife.in.ua/donate/',
      '*': 'https://savelife.in.ua/en/donate-en/',
    },
    websiteUrl: 'https://savelife.in.ua/',
  },
  {
    id: 'sternenko',
    name: 'Sternenko Fund',
    descriptionKey: 'support_direct_sternenko_desc',
    donationUrl: {
      'uk': 'https://www.sternenkofund.org/donate',
      '*': 'https://www.sternenkofund.org/en/donate',
    },
    websiteUrl: 'https://www.sternenkofund.org/',
  },
  {
    id: 'prytula',
    name: 'Prytula Foundation',
    descriptionKey: 'support_direct_prytula_desc',
    donationUrl: {
      'uk': 'https://prytulafoundation.org/donation',
      '*': 'https://prytulafoundation.org/en/donation',
    },
    websiteUrl: 'https://prytulafoundation.org/',
  },
];

export const officialUkraineSupportPortal = {
  name: 'PomagamUkrainie.gov.pl',
  description:
    'Official Polish government portal with verified support options and the "Przylacz sie do akcji" list.',
  url: 'https://pomagamukrainie.gov.pl/chce-pomoc/prywatnie/pomoc-finansowa',
};
