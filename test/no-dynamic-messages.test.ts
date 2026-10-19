import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'src');
const generated = resolve(src, 'lib/paraglide');

// A dynamic lookup on the paraglide `m` object (or aliasing the whole object)
// defeats tree-shaking and bundles every message of every locale.
const FORBIDDEN = [
  /\bm\[/,
  /\bmessages\[/,
  /\bm\s+as\s/,
  /=\s*m\s*;/,
  /Object\.\w+\(\s*m\s*\)/,
];

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (path === generated) continue;
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (/\.(ts|svelte)$/.test(entry.name)) yield path;
  }
}

void test('src never accesses paraglide messages dynamically', () => {
  const offenders: string[] = [];
  for (const file of sourceFiles(src)) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        const code = line.replace(/\/\/.*$/, '');
        if (FORBIDDEN.some((re) => re.test(code))) {
          offenders.push(`${relative(root, file)}:${i + 1}: ${line.trim()}`);
        }
      });
  }
  assert.deepEqual(offenders, [], 'use explicit message references instead');
});
