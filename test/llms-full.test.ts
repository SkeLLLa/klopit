import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { htmlToMarkdown } from '../scripts/html-to-markdown.ts';

const here = dirname(fileURLToPath(import.meta.url));
const build = join(resolve(here, '..'), 'build');
const SITE = 'https://klopit.co.pl';
const SKIP = 'build output not found - run `pnpm run build` first';

const read = (path: string) => readFileSync(join(build, path), 'utf8');

function docsUrls(): string[] {
  return [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1])
    .filter((url) =>
      /^https:\/\/klopit\.co\.pl\/(?:(?:pl|uk)\/)?docs\//.test(url),
    );
}

void test('converter handles the docs subset', () => {
  const md = htmlToMarkdown(
    `<nav><a href="/x">nav</a></nav><h1 class="a">Title &amp; more</h1>
<script>alert(1)</script><p>See <a href="/docs/faq">the <strong>FAQ</strong></a> and <code>a|b</code>.</p>
<ul><li>one<ul><li>nested</li></ul></li><li>two</li></ul>
<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>
<details><summary>Q?</summary><p>Answer</p></details>
<svg><path d="M0"/></svg><a href="https://example.com/a">ext</a>`,
    `${SITE}/docs/`,
  );
  assert.equal(
    md,
    [
      '# Title & more',
      `See [the **FAQ**](${SITE}/docs/faq/) and \`a|b\`.`,
      '- one\n  - nested\n- two',
      '| A | B |\n| --- | --- |\n| 1 | 2 |',
      '### Q?',
      'Answer',
      '[ext](https://example.com/a)',
    ].join('\n\n') + '\n',
  );
});

void test('llms-full.txt contains every English docs URL from the sitemap', (t) => {
  if (!existsSync(build)) return t.skip(SKIP);
  const full = read('llms-full.txt');
  const english = docsUrls().filter(
    (u) => !/^https:\/\/klopit\.co\.pl\/(pl|uk)\//.test(u),
  );
  assert.ok(english.length > 0);
  assert.ok(full.startsWith('# kloPIT'));
  for (const url of english) {
    assert.ok(full.includes(`Source: ${url}\n`), `missing ${url}`);
  }
  assert.ok(!full.includes(`${SITE}/pl/docs/faq/\n`), 'only English pages');
});

void test('llms-full.txt and mirrors have no leftover HTML or script content', (t) => {
  if (!existsSync(build)) return t.skip(SKIP);
  const files = [
    'llms-full.txt',
    ...docsUrls().map((u) => `${u.slice(SITE.length)}index.md`),
  ];
  for (const file of files) {
    const text = read(file);
    assert.doesNotMatch(
      text,
      /<\/?(?:div|span|script|style|svg|nav|button|a|p|ul|li|table)[\s>]/i,
      file,
    );
    assert.doesNotMatch(
      text,
      /<!--|__sveltekit|_app\/immutable|\bfunction\s*\(/,
      file,
    );
  }
});

void test('every docs page has a markdown mirror per locale', (t) => {
  if (!existsSync(build)) return t.skip(SKIP);
  const urls = docsUrls();
  for (const locale of ['en', 'pl', 'uk']) {
    const prefix =
      locale === 'en' ? `${SITE}/docs/` : `${SITE}/${locale}/docs/`;
    const own = urls.filter((u) => u.startsWith(prefix));
    assert.ok(own.length > 0, locale);
    for (const url of own) {
      const mirror = join(url.slice(SITE.length), 'index.md');
      assert.ok(existsSync(join(build, mirror)), `missing ${mirror}`);
      assert.ok(read(mirror).includes(`Source: ${url}`));
    }
  }
});

void test('markdown links are absolute', (t) => {
  if (!existsSync(build)) return t.skip(SKIP);
  const links = [...read('llms-full.txt').matchAll(/\]\(([^)\s]+)\)/g)].map(
    (m) => m[1],
  );
  assert.ok(links.length > 0);
  for (const link of links) {
    assert.match(link, /^(https?:\/\/|mailto:)/, link);
  }
});

void test('markdown and text outputs stay out of the sitemap', (t) => {
  if (!existsSync(build)) return t.skip(SKIP);
  const xml = read('sitemap.xml');
  assert.doesNotMatch(xml, /\.md<|\.txt<|llms-full/);
  assert.ok(readdirSync(build).includes('llms-full.txt'));
});
