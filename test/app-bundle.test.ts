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
