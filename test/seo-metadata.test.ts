import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const LOCALES = ['en', 'pl', 'uk'] as const;

const REQUIRED_KEYS = [
  'meta_title',
  'meta_description',
  'meta_keywords',
  'home_welcome',
  'home_description',
  'home_cta',
  'home_why_free_label',
  'home_why_free_desc',
  'home_why_online_label',
  'home_why_online_desc',
  'home_why_oss_label',
  'home_why_oss_desc',
  'home_why_nosignup_label',
  'home_why_nosignup_desc',
  'home_how_title',
  'home_how_step1_title',
  'home_how_step1_desc',
  'home_how_step2_title',
  'home_how_step2_desc',
  'home_how_step3_title',
  'home_how_step3_desc',
  'home_cta_primary',
  'home_trust_deadline',
  'home_faq_teaser_title',
  'home_faq_teaser_q1',
  'home_faq_teaser_q2',
  'home_faq_teaser_q3',
  'nav_docs_pit38',
  'page_docs_desc_pit38',
  'page_pit38',
  'page_pit38_h1',
  'page_pit38_intro',
  'page_pit38_meta_title',
  'page_pit38_sec1_title',
  'page_pit38_sec1_body',
  'page_pit38_sec2_title',
  'page_pit38_sec2_b1',
  'page_pit38_sec2_b2',
  'page_pit38_sec2_b3',
  'page_pit38_sec2_b4',
  'page_pit38_sec3_title',
  'page_pit38_sec3_body',
  'page_pit38_sec4_title',
  'page_pit38_sec4_c',
  'page_pit38_sec4_d',
  'page_pit38_sec4_g',
  'page_pit38_sec4_pitzg',
  'page_pit38_sec5_title',
  'page_pit38_sec5_step1',
  'page_pit38_sec5_step2',
  'page_pit38_sec5_step3',
  'page_pit38_sec5_step4',
  'page_pit38_sec5_step5',
  'page_pit38_sec6_title',
  'page_pit38_sec6_intro',
  'page_pit38_sec6_link1_title',
  'page_pit38_sec6_link1_desc',
  'page_pit38_sec6_link2_title',
  'page_pit38_sec6_link2_desc',
  'page_pit38_sec6_link3_title',
  'page_pit38_sec6_link3_desc',
  'page_pit38_sec7_title',
  'page_pit38_sec7_body',
  'page_pit38_sec7_cta',
  'page_pit38_sec8_title',
  'page_pit38_sec8_item1',
  'page_pit38_sec8_item2',
  'page_pit38_sec8_item3',
  'page_pit38_sec8_item4',
];

const PILLAR_WORDS: Record<(typeof LOCALES)[number], string[]> = {
  en: ['free', 'online', 'open-source', 'no signup'],
  pl: ['darmowy', 'online', 'open-source', 'bez rejestracji'],
  uk: ['безкоштовний', 'онлайн', 'open-source', 'без реєстрації'],
};

for (const locale of LOCALES) {
  const messages = JSON.parse(
    readFileSync(resolve(root, `messages/${locale}.json`), 'utf8'),
  ) as Record<string, string>;

  void test(`${locale}: all SEO keys present`, () => {
    for (const key of REQUIRED_KEYS) {
      assert.ok(messages[key], `${locale}.json missing key: ${key}`);
    }
  });

  void test(`${locale}: meta_title includes all four pillar signals`, () => {
    const title = messages.meta_title.toLowerCase();
    for (const word of PILLAR_WORDS[locale]) {
      assert.ok(
        title.includes(word),
        `${locale}.json meta_title missing "${word}": ${messages.meta_title}`,
      );
    }
  });

  void test(`${locale}: meta_description fits 158 chars`, () => {
    const len = messages.meta_description.length;
    assert.ok(
      len <= 158,
      `${locale}.json meta_description too long (${String(len)}): ${messages.meta_description}`,
    );
  });
}
