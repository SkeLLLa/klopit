import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const BUNDLE_DIRS = [
  'build/_app',
  '.svelte-kit/output/client/_app',
  '.svelte-kit/output/server',
];
const FORBIDDEN_MARKERS = [
  'generate-ai-metadata',
  'scripts/generate-ai-metadata',
  'PIT-38 calculation service',
  'legalBasis',
];

function collectFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      collectFiles(full, acc);
    } else {
      acc.push(full);
    }
  }
  return acc;
}

void test('build app bundles do not include AI metadata generator code', (t) => {
  const existingBundleDirs = BUNDLE_DIRS.map((dir) =>
    resolve(root, dir),
  ).filter(existsSync);

  if (existingBundleDirs.length === 0) {
    t.skip('bundle output not found - run `pnpm run build:app` first');
    return;
  }

  const failures: string[] = [];
  for (const bundleDir of existingBundleDirs) {
    for (const file of collectFiles(bundleDir)) {
      const content = readFileSync(file, 'utf8');
      for (const marker of FORBIDDEN_MARKERS) {
        if (content.includes(marker)) {
          failures.push(`${relative(root, file)} contains ${marker}`);
        }
      }
    }
  }

  assert.deepEqual(failures, []);
});

void test('prerendered pages carry a CSP meta limiting connect-src to self and NBP', (t) => {
  const buildDir = resolve(root, 'build');
  if (!existsSync(buildDir)) {
    t.skip('build output not found - run `pnpm run build:app` first');
    return;
  }

  const failures: string[] = [];
  let checked = 0;
  for (const file of collectFiles(buildDir)) {
    if (!file.endsWith('.html')) continue;
    const html = readFileSync(file, 'utf8');
    // Redirect stubs are a bare meta refresh with no app code
    if (html.includes('http-equiv="refresh"')) continue;
    checked++;
    const csp =
      /<meta http-equiv="content-security-policy" content="([^"]*)"/.exec(
        html,
      )?.[1];
    if (csp === undefined) {
      failures.push(`${relative(root, file)} has no CSP meta`);
      continue;
    }
    if (!csp.includes("connect-src 'self' https://api.nbp.pl;")) {
      failures.push(`${relative(root, file)} has unexpected connect-src`);
    }
    if (/script-src[^;]*unsafe-/.test(csp)) {
      failures.push(`${relative(root, file)} allows unsafe script-src`);
    }
  }

  assert.ok(checked > 0);
  assert.deepEqual(failures, []);
});
