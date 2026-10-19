import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = resolve(root, 'build');

// Measured 2026-10: 38 preloads, ~184 KB raw. Bounds are that + ~10%.
// Regressions usually come from a dynamic `m[key]` lookup (or a heavy import)
// in the root layout, which drags every paraglide message into every page.
const MAX_PRELOADS = 42;
const MAX_RAW_BYTES = 203 * 1024;

function preloadSize(page: string): { count: number; bytes: number } {
  const pagePath = resolve(build, page);
  const html = readFileSync(pagePath, 'utf8');
  const hrefs = new Set(
    [...html.matchAll(/<link href="([^"]*)" rel="modulepreload"/g)].map(
      (match) => match[1],
    ),
  );
  let bytes = 0;
  for (const href of hrefs) {
    bytes += statSync(resolve(dirname(pagePath), href)).size;
  }
  return { count: hrefs.size, bytes };
}

for (const page of ['index.html', 'pl/index.html']) {
  void test(`landing page ${page} stays within the JS preload budget`, (t) => {
    if (!existsSync(build)) {
      t.skip('build output not found - run `pnpm run build:app` first');
      return;
    }
    const { count, bytes } = preloadSize(page);
    assert.ok(count > 0, 'expected modulepreload links');
    assert.ok(count <= MAX_PRELOADS, `${count} preloads > ${MAX_PRELOADS}`);
    assert.ok(
      bytes <= MAX_RAW_BYTES,
      `${(bytes / 1024).toFixed(0)} KB preloaded > ${MAX_RAW_BYTES / 1024} KB`,
    );
  });
}

// Measured 2026-10 after removing dynamic message lookups from docs/support:
// 35-37 preloads, 162-189 KB raw. Bounds are that + ~10%.
const PAGE_BUDGETS: Record<string, { preloads: number; kb: number }> = {
  'docs/index.html': { preloads: 41, kb: 193 },
  'docs/faq/index.html': { preloads: 39, kb: 208 },
  'pl/docs/faq/index.html': { preloads: 39, kb: 208 },
  'docs/ibi/index.html': { preloads: 39, kb: 179 },
  'support/index.html': { preloads: 38, kb: 200 },
};

for (const [page, budget] of Object.entries(PAGE_BUDGETS)) {
  void test(`${page} stays within the JS preload budget`, (t) => {
    if (!existsSync(build)) {
      t.skip('build output not found - run `pnpm run build:app` first');
      return;
    }
    const { count, bytes } = preloadSize(page);
    assert.ok(count > 0, 'expected modulepreload links');
    assert.ok(
      count <= budget.preloads,
      `${count} preloads > ${budget.preloads}`,
    );
    assert.ok(
      bytes <= budget.kb * 1024,
      `${(bytes / 1024).toFixed(0)} KB preloaded > ${budget.kb} KB`,
    );
  });
}
