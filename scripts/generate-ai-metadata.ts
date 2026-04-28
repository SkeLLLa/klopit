import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { supportedBrokers } from '../src/core/parsers/registry.js';
import { FAQ_ITEMS } from '../src/lib/constants/faq.js';

const SITE_URL = 'https://klopit.co.pl';
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const aiDir = resolve(rootDir, 'static/ai');

type JsonObject = Record<string, unknown>;
type Messages = Record<string, string>;

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(resolve(rootDir, path), 'utf8')) as T;
}

async function writeJson(path: string, value: JsonObject): Promise<void> {
  await mkdir(aiDir, { recursive: true });
  await writeFile(
    resolve(rootDir, path),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}

function msg(messages: Messages, key: string): string {
  const value = messages[key];
  if (!value) {
    throw new Error(`Missing message key: ${key}`);
  }
  return value.replace(/<[^>]*>/g, '');
}

const [messages, pkg] = await Promise.all([
  readJson<Messages>('messages/en.json'),
  readJson<{ version: string }>('package.json'),
]);

const brokers = supportedBrokers();
const brokerNames = brokers.map((broker) => broker.name);

await writeJson('static/ai/summary.json', {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  '@id': `${SITE_URL}/#webapplication`,
  'name': 'kloPIT',
  'alternateName': 'klopit',
  'url': `${SITE_URL}/`,
  'description': msg(messages, 'meta_description'),
  'applicationCategory': 'FinanceApplication',
  'applicationSubCategory': 'TaxPreparation',
  'operatingSystem': 'All',
  'browserRequirements': 'Requires JavaScript',
  'softwareVersion': pkg.version,
  'isAccessibleForFree': true,
  'license': 'https://www.gnu.org/licenses/agpl-3.0.html',
  'codeRepository': 'https://github.com/SkeLLLa/klopit',
  'offers': {
    '@type': 'Offer',
    'price': '0',
    'priceCurrency': 'PLN',
  },
  'availableLanguage': [
    { '@type': 'Language', 'name': 'English', 'alternateName': 'en' },
    { '@type': 'Language', 'name': 'Polish', 'alternateName': 'pl' },
    { '@type': 'Language', 'name': 'Ukrainian', 'alternateName': 'uk' },
  ],
  'audience': {
    '@type': 'Audience',
    'audienceType': 'Polish tax residents with foreign brokerage accounts',
  },
  'dataResidency': 'Browser IndexedDB; no server processing',
  'issueTracker': 'https://github.com/SkeLLLa/klopit/issues',
  'repository': 'https://github.com/SkeLLLa/klopit',
  'requiresAuth': false,
  'supportedBrokers': [...brokerNames, 'Manual entry'],
  'supportedYears': '2019+',
  'taxForm': 'PIT-38',
  'taxJurisdiction': 'Poland',
});

await writeJson('static/ai/faq.json', {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  '@id': `${SITE_URL}/docs/faq/#faq`,
  'name': 'kloPIT FAQ',
  'inLanguage': 'en',
  'url': `${SITE_URL}/docs/faq/`,
  'mainEntity': FAQ_ITEMS.map((faq) => ({
    '@type': 'Question',
    '@id': `${SITE_URL}/docs/faq/#${faq.id}`,
    'name': msg(messages, faq.questionKey),
    'acceptedAnswer': {
      '@type': 'Answer',
      'text': msg(messages, faq.answerKey),
    },
  })),
});

await writeJson('static/ai/service.json', {
  '@context': 'https://schema.org',
  '@type': 'Service',
  '@id': `${SITE_URL}/#service`,
  'name': 'kloPIT PIT-38 calculation service',
  'url': `${SITE_URL}/`,
  'serviceType': 'Tax calculation',
  'areaServed': {
    '@type': 'Country',
    'name': 'Poland',
  },
  'audience': {
    '@type': 'Audience',
    'audienceType': 'Polish tax residents with foreign brokerage accounts',
  },
  'provider': {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    'name': 'kloPIT',
    'sameAs': 'https://github.com/SkeLLLa/klopit',
  },
  'offers': {
    '@type': 'Offer',
    'price': '0',
    'priceCurrency': 'PLN',
  },
  'availableLanguage': ['English', 'Polish', 'Ukrainian'],
  'dataResidency': 'Browser IndexedDB; no server processing',
  'legalBasis': [
    'Ustawa o PIT art. 30a (dywidendy, ryczalt 19%)',
    'Ustawa o PIT art. 30b (zyski kapitalowe)',
    'Ustawa o PIT art. 9 ust. 3 (rozliczenie strat)',
    'Ordynacja podatkowa art. 63 par. 1a (zaokraglenia)',
    'OECD MTC art. 13 (capital gains)',
  ],
  'serviceOutput': ['PIT-38 field values', 'PIT/ZG country breakdown'],
  'supportedBrokers': brokers.map((broker) => ({
    '@type': 'Thing',
    'name': broker.name,
    'fileFormat': broker.fileExtensions.join(', '),
  })),
  'taxForms': ['PIT-38(18)', 'PIT/ZG'],
  'taxRates': {
    capitalGains: '19%',
    creditInterest: '19%',
    dividends: '19%',
  },
});
