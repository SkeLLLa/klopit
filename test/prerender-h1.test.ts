import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const buildDir = resolve(root, 'build');

function collectHtml(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collectHtml(full, acc);
    else if (name.endsWith('.html')) acc.push(full);
  }
  return acc;
}

function isRedirectStub(html: string): boolean {
  return (
    /<meta\s+http-equiv=["']?refresh["']?/i.test(html) &&
    /<script[^>]*>location\.href\s*=/i.test(html)
  );
}

void test('every prerendered page has exactly one <h1>', (t) => {
  if (!existsSync(buildDir)) {
    t.skip('build/ not found — run `pnpm build` first');
    return;
  }

  const files = collectHtml(buildDir);
  assert.ok(files.length > 0, 'no HTML files found in build/');

  const failures: string[] = [];
  for (const file of files) {
    const html = readFileSync(file, 'utf8');
    if (isRedirectStub(html)) continue;

    const count = (html.match(/<h1[\s>]/gi) ?? []).length;
    if (count !== 1) {
      failures.push(
        `${relative(root, file)}: found ${String(count)} <h1> tags`,
      );
    }
  }

  assert.equal(
    failures.length,
    0,
    `pages with wrong <h1> count (expected 1 each):\n  ${failures.join('\n  ')}`,
  );
});
