import { FAQ_ITEMS, type FaqMessageKey } from '#lib/constants/faq.js';
import { m } from '#lib/paraglide/messages.js';
import { getLocale } from '#lib/paraglide/runtime.js';

const SITE_URL = 'https://klopit.co.pl';
const localeTags = {
  en: 'en',
  pl: 'pl-PL',
  uk: 'uk-UA',
} as const;

const messages: Readonly<Record<FaqMessageKey, () => string>> = m;

function localizedUrl(
  pathname: string,
  locale: keyof typeof localeTags,
): string {
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return `${SITE_URL}${locale === 'en' ? path : `/${locale}${path}`}`;
}

export const load = () => {
  const locale = getLocale();
  const pageUrl = localizedUrl('/docs/faq/', locale);

  return {
    meta: {
      title: m.page_faq_meta_title(),
      description: m.page_faq_meta_description(),
      datePublished: '2026-04-12',
      dateModified: '2026-10-19',
      jsonLd: {
        '@type': 'FAQPage',
        '@id': `${pageUrl}#faq`,
        'url': pageUrl,
        'name': m.page_faq_meta_title(),
        'description': m.page_faq_meta_description(),
        'inLanguage': localeTags[locale],
        'mainEntity': FAQ_ITEMS.map((faq) => ({
          '@type': 'Question',
          'name': messages[faq.questionKey](),
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': messages[faq.answerKey](),
          },
        })),
      },
    },
  };
};
