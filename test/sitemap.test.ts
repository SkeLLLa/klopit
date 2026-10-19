import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const buildDir = resolve(here, '..', 'build');
const SITE = 'https://klopit.co.pl';
const SKIP = 'build output not found - run `pnpm run build:app` first';

function htmlFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) htmlFiles(full, acc);
    else if (entry.name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

function pathOf(file: string): string {
  const rel = file.slice(buildDir.length).replace(/index\.html$/, '');
  return rel.endsWith('/') ? rel : `${rel}/`;
}

function hreflangs(html: string): string[] {
  return [
    ...html.matchAll(
      /<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"/g,
    ),
  ]
    .map((m) => `${m[1]} ${m[2]}`)
    .toSorted();
}

const isExcluded = (html: string) =>
  /<meta\s+name="robots"\s+content="[^"]*noindex/.test(html) ||
  html.includes('http-equiv="refresh"');

interface Entry {
  loc: string;
  lastmod: string | undefined;
  refs: string[];
}

function readSitemap(): { xml: string; entries: Entry[] } {
  const xml = readFileSync(join(buildDir, 'sitemap.xml'), 'utf8');
  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => {
    const body = m[1];
    return {
      loc: /<loc>([^<]+)<\/loc>/.exec(body)?.[1] ?? '',
      lastmod: /<lastmod>([^<]+)<\/lastmod>/.exec(body)?.[1],
      refs: [
        ...body.matchAll(
          /<xhtml:link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"/g,
        ),
      ]
        .map((r) => `${r[1]} ${r[2]}`)
        .toSorted(),
    };
  });
  return { xml, entries };
}

function pageFor(loc: string): string {
  assert.ok(loc.startsWith(SITE), `${loc} is not on ${SITE}`);
  const file = join(buildDir, loc.slice(SITE.length), 'index.html');
  assert.ok(existsSync(file), `${loc} has no built page`);
  return readFileSync(file, 'utf8');
}

void test('sitemap declares the xhtml namespace', (t) => {
  if (!existsSync(buildDir)) return t.skip(SKIP);
  assert.match(
    readSitemap().xml,
    /<urlset[^>]*xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/,
  );
});

void test('sitemap hreflang set equals the page head and is complete', (t) => {
  if (!existsSync(buildDir)) return t.skip(SKIP);
  const { entries } = readSitemap();
  assert.ok(entries.length > 0);
  for (const entry of entries) {
    assert.deepEqual(entry.refs, hreflangs(pageFor(entry.loc)), entry.loc);
    const langs = entry.refs.map((r) => r.split(' ')[0]);
    assert.deepEqual(
      langs.toSorted(),
      ['en', 'pl-PL', 'uk-UA', 'x-default'],
      entry.loc,
    );
  }
});

void test('sitemap lastmod equals article:modified_time and is never invented', (t) => {
  if (!existsSync(buildDir)) return t.skip(SKIP);
  for (const entry of readSitemap().entries) {
    const modified =
      /<meta\s+property="article:modified_time"\s+content="([^"]+)"/.exec(
        pageFor(entry.loc),
      )?.[1];
    assert.equal(entry.lastmod, modified, entry.loc);
  }
});

void test('sitemap lists exactly the indexable built pages', (t) => {
  if (!existsSync(buildDir)) return t.skip(SKIP);
  const { entries } = readSitemap();
  const locs = entries.map((e) => e.loc);
  assert.equal(new Set(locs).size, locs.length, 'duplicate URLs');
  assert.ok(!locs.some((l) => /\/404\/?$/.test(l)));

  const indexable = htmlFiles(buildDir)
    .filter((f) => f !== join(buildDir, '404.html'))
    .filter((f) => !isExcluded(readFileSync(f, 'utf8')))
    .map((f) => `${SITE}${pathOf(f)}`)
    .toSorted();
  assert.deepEqual(locs.toSorted(), indexable);
});
