import { m } from '$lib/paraglide/messages.js';
import { getLocale } from '$lib/paraglide/runtime';

const SITE_URL = 'https://klopit.co.pl';
const localeTags = {
  en: 'en',
  pl: 'pl-PL',
  uk: 'uk-UA',
} as const;

const DOC_LINKS = [
  { name: () => m.nav_docs_pit38(), path: '/docs/pit-38/' },
  { name: () => m.nav_docs_pitzg(), path: '/docs/pit-zg/' },
  { name: () => m.nav_docs_brokers(), path: '/docs/brokers/' },
  { name: () => m.nav_docs_ib(), path: '/docs/ibkr/' },
  { name: () => m.nav_docs_ibkr_w8ben(), path: '/docs/ibkr/w8ben/' },
  { name: () => m.nav_docs_ibi_espp(), path: '/docs/ibi/espp/' },
  { name: () => m.nav_docs_ibi_rsu(), path: '/docs/ibi/rsu/' },
  {
    name: () => m.nav_docs_div_usa(),
    path: '/docs/dividends/us-15-or-19/',
  },
  { name: () => m.nav_faq(), path: '/docs/faq/' },
];

function localizedUrl(
  pathname: string,
  locale: keyof typeof localeTags,
): string {
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return `${SITE_URL}${locale === 'en' ? path : `/${locale}${path}`}`;
}

export const load = () => {
  const locale = getLocale();
  const pageUrl = localizedUrl('/docs/', locale);

  return {
    meta: {
      title: m.page_docs_meta_title(),
      description: m.page_docs_meta_description(),
      jsonLd: {
        '@type': 'CollectionPage',
        '@id': `${pageUrl}#collection`,
        'url': pageUrl,
        'name': m.page_docs_meta_title(),
        'description': m.page_docs_meta_description(),
        'inLanguage': localeTags[locale],
        'isPartOf': { '@id': `${SITE_URL}/#website` },
        'hasPart': DOC_LINKS.map((link) => ({
          '@type': 'WebPage',
          'name': link.name(),
          'url': localizedUrl(link.path, locale),
        })),
      },
    },
  };
};
