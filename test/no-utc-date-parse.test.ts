import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const PATTERN = /new Date\(\s*(edit\w*|\w+\.value)\s*\)/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith('.svelte') ? [path] : [];
  });
}

void describe('date input parsing', () => {
  void it('does not parse input values with new Date() (UTC midnight bug)', () => {
    const files = [...walk('src/routes'), ...walk('src/lib/components')];
    const hits = files.filter((f) => PATTERN.test(readFileSync(f, 'utf8')));
    assert.deepEqual(hits, []);
  });
});
