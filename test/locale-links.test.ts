import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const buildDir = join(root, 'build');

// Static files and framework output that are intentionally not locale-prefixed.
const NON_PAGE =
  /^\/(_app|icons|llms\.txt|robots\.txt|sitemap\.xml|favicon|og-image|site\.webmanifest|theme-init\.js|ai\/)/;
const LOCALES = ['pl', 'uk'] as const;

function collectHtml(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collectHtml(full, acc);
    else if (name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

for (const locale of LOCALES) {
  void test(`build/${locale}: every internal <a href> keeps the /${locale} prefix`, (t) => {
    const dir = join(buildDir, locale);
    if (!existsSync(dir)) {
      t.skip('build/ not present; run `pnpm build` first');
      return;
    }
    const offenders: string[] = [];
    for (const file of collectHtml(dir)) {
      const html = readFileSync(file, 'utf8');
      for (const match of html.matchAll(/<a\b[^>]*?\shref="([^"]*)"[^>]*>/g)) {
        const tag = match[0];
        const href = match[1];
        if (!href.startsWith('/') || href.startsWith('//')) continue;
        if (NON_PAGE.test(href)) continue;
        // Language picker links deliberately point at the other locales.
        if (tag.includes('data-sveltekit-reload')) continue;
        if (
          href === `/${locale}` ||
          href.startsWith(`/${locale}/`) ||
          href.startsWith(`/${locale}#`)
        )
          continue;
        offenders.push(`${relative(buildDir, file)}: ${href}`);
      }
    }
    assert.deepEqual([...new Set(offenders)].toSorted(), []);
  });
}
