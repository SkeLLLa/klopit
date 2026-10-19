import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const build = join(root, 'build');
const SITE = 'https://klopit.co.pl';
const SKIP = 'build output not found - run `pnpm run build` first';

const LEGAL_CITATIONS = [
  'art. 30b ust. 1',
  'art. 30b ust. 5a–5b',
  'art. 30b ust. 6',
  'art. 45 ust. 1 i ust. 1a pkt 1',
  'art. 30a ust. 1 pkt 4',
  'art. 30a ust. 9',
  'art. 11a ust. 1–2',
  'art. 24 ust. 10',
  'art. 9 ust. 3',
];

function readBuild(path: string): string {
  return readFileSync(join(build, path), 'utf8');
}

function urlToFile(url: string): string {
  const path = url.slice(SITE.length);
  return path.endsWith('/') ? `${path}index.html` : path;
}

function jsonLdBlocks(html: string): unknown[] {
  return [
    ...html.matchAll(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ].map((match) => JSON.parse(match[1]) as unknown);
}

void test('robots.txt has a single wildcard group with Content-Signal', (t) => {
  if (!existsSync(build)) {
    t.skip(SKIP);
    return;
  }
  const lines = readBuild('robots.txt')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  const agents = lines.filter((line) => /^user-agent:/i.test(line));
  assert.deepEqual(agents, ['User-agent: *']);
  assert.ok(lines.some((line) => /^content-signal:/i.test(line)));
  assert.ok(!lines.some((line) => /^disallow:/i.test(line)));
  assert.ok(lines.some((line) => /^sitemap:/i.test(line)));
});

void test('llms.txt links resolve to built files', (t) => {
  if (!existsSync(build)) {
    t.skip(SKIP);
    return;
  }
  const links = [
    ...readBuild('llms.txt').matchAll(/\]\((https:\/\/klopit\.co\.pl[^)]*)\)/g),
  ].map((match) => match[1]);
  assert.ok(links.length > 0);
  for (const link of links) {
    assert.ok(existsSync(join(build, urlToFile(link))), `missing ${link}`);
  }
});

void test('llms.txt lists every English sitemap URL', (t) => {
  if (!existsSync(join(build, 'sitemap.xml'))) {
    t.skip(SKIP);
    return;
  }
  const llms = readBuild('llms.txt');
  const urls = [
    ...readBuild('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g),
  ].map((match) => match[1]);
  const english = urls.filter(
    (url) => !/^https:\/\/klopit\.co\.pl\/(pl|uk)\//.test(url),
  );
  assert.ok(english.length > 0);
  for (const url of english) {
    assert.ok(llms.includes(`(${url})`), `llms.txt is missing ${url}`);
  }
});

void test('llms.txt legal basis is the verified set', () => {
  const llms = readFileSync(join(root, 'static/llms.txt'), 'utf8');
  const section = llms
    .split('## Legal basis (ustawa o PIT)')[1]
    ?.split('\n## ')[0];
  assert.ok(section, 'legal basis section missing');
  const cited = [...section.matchAll(/^- (art\. .+?) ustawy o PIT —/gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(cited, LEGAL_CITATIONS);
  assert.ok(!llms.includes('art. 27'));
});

void test('ai/service.json legal basis uses the verified citations', (t) => {
  if (!existsSync(join(build, 'ai/service.json'))) {
    t.skip(SKIP);
    return;
  }
  const service = JSON.parse(readBuild('ai/service.json')) as {
    legalBasis: string[];
  };
  const pit = service.legalBasis.filter((entry) =>
    entry.startsWith('Ustawa o PIT'),
  );
  assert.equal(pit.length, LEGAL_CITATIONS.length);
  assert.ok(!service.legalBasis.some((entry) => entry.includes('art. 27')));
});

void test('brokers page does not claim Schwab dividends', (t) => {
  if (!existsSync(build)) {
    t.skip(SKIP);
    return;
  }
  const claim = /schwab[^.,;]{0,80}(dividend|dywidend|дивіденд)/i;
  const dividends = /dividend|dywidend|дивіденд/i;
  const notImported = /not imported|nie są jeszcze importowane|не імпортуються/;
  for (const locale of ['', 'pl/', 'uk/']) {
    const html = readBuild(`${locale}docs/brokers/index.html`);
    const rows = [...html.matchAll(/<tr[\s\S]*?<\/tr>/g)]
      .map((match) => match[0])
      .filter((row) => /schwab/i.test(row) && /CSV/.test(row));
    assert.ok(rows.length > 0, `${locale} Schwab row missing`);
    for (const row of rows) {
      const text = row.replace(/<[^>]+>/g, ' ');
      if (dividends.test(text)) {
        assert.match(text, notImported, `${locale} Schwab row`);
      }
    }
    const ld = JSON.stringify(jsonLdBlocks(html));
    assert.doesNotMatch(ld, claim, `${locale} JSON-LD`);
  }
});

void test('redirect stubs point at existing trailing-slash URLs', (t) => {
  if (!existsSync(build)) {
    t.skip(SKIP);
    return;
  }
  for (const locale of ['pl', 'uk']) {
    for (const stub of ['brokerzy', 'dywidendy/usa-15-czy-19']) {
      const html = readBuild(`${locale}/docs/${stub}/index.html`);
      const target = /http-equiv="refresh"[^>]*url=([^"]+)"/i.exec(html)?.[1];
      assert.ok(target, `${locale}/${stub} has no refresh target`);
      assert.ok(target.endsWith('/'), `${target} lacks trailing slash`);
      assert.ok(
        existsSync(join(build, target, 'index.html')),
        `${target} does not exist`,
      );
    }
  }
});
