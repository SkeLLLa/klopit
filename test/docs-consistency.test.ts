import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, it } from 'node:test';

import { ALL_PARSERS } from '../src/core/parsers/index.js';
import { KlopitDB } from '../src/lib/db.js';

const root = resolve(import.meta.dirname, '..');

const DOC_FILES = [
  'README.md',
  'CONTRIBUTING.md',
  ...readdirSync(join(root, 'docs'))
    .filter((f) => f.endsWith('.md') && f !== 'CHANGELOG.md')
    .map((f) => `docs/${f}`),
];

const read = (file: string): string => readFileSync(join(root, file), 'utf8');

/** Doc text without fenced code blocks (trees and shell snippets). */
const prose = (file: string): string =>
  read(file).replace(/```[\s\S]*?```/g, '');

void describe('docs consistency', () => {
  void it('every referenced repo path exists', () => {
    const missing: string[] = [];
    for (const file of DOC_FILES) {
      for (const m of prose(file).matchAll(
        /`((?:src|test|docs|messages|static|scripts)\/[^`\s:*{}<>]+)(?::[\d-]+)?`/g,
      )) {
        const path = m[1].replace(/\/$/, '');
        if (path.startsWith('src/lib/paraglide')) continue; // generated, gitignored
        if (!existsSync(join(root, path))) missing.push(`${file}: ${path}`);
      }
    }
    assert.deepEqual(missing, []);
  });

  void it('internal markdown links resolve', () => {
    const broken: string[] = [];
    for (const file of DOC_FILES) {
      for (const m of read(file).matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
        const target = m[1];
        if (/^[a-z]+:/i.test(target)) continue;
        if (!existsSync(resolve(root, dirname(file), target))) {
          broken.push(`${file}: ${target}`);
        }
      }
    }
    assert.deepEqual(broken, []);
  });

  void it('documented pnpm scripts exist in package.json', () => {
    const pkg = JSON.parse(read('package.json')) as {
      scripts: Record<string, string>;
    };
    const builtin = new Set([
      'install',
      'add',
      'exec',
      'dlx',
      'run',
      'update',
      'remove',
    ]);
    const unknown: string[] = [];
    for (const file of DOC_FILES) {
      for (const m of read(file).matchAll(
        /(?:`|^\s*)pnpm (?:run )?([a-z][\w:-]*)/gm,
      )) {
        const name = m[1];
        if (!(name in pkg.scripts) && !builtin.has(name)) {
          unknown.push(`${file}: pnpm ${name}`);
        }
      }
    }
    assert.deepEqual(unknown, []);
  });

  void it('docs mention the Node major from .mise.toml', () => {
    const major = /^node = "(\d+)\./m.exec(read('.mise.toml'))?.[1];
    assert.ok(major, 'node version not found in .mise.toml');
    const stale: string[] = [];
    for (const file of ['README.md', 'CONTRIBUTING.md']) {
      for (const m of read(file).matchAll(/Node(?:\.js)? (\d+)/g)) {
        if (m[1] !== major) stale.push(`${file}: Node ${m[1]}`);
      }
    }
    assert.deepEqual(stale, []);
  });

  void it('every parser broker is named in README and HOW-IT-WORKS', () => {
    for (const file of ['README.md', 'docs/HOW-IT-WORKS.md']) {
      const text = read(file);
      for (const parser of ALL_PARSERS) {
        assert.ok(
          text.includes(parser.brokerName),
          `${file} does not mention ${parser.brokerName}`,
        );
      }
    }
  });

  void it('documented DB versions do not exceed db.verno and the latest is mentioned', async () => {
    const database = new KlopitDB('klopit_docs_consistency');
    await database.open();
    const verno = database.verno;
    database.close();
    const mentioned: number[] = [];
    for (const file of DOC_FILES) {
      for (const m of read(file).matchAll(/\bDB v(\d+)\b/g)) {
        mentioned.push(Number(m[1]));
      }
    }
    assert.ok(mentioned.length > 0, 'no "DB vN" mention found in docs');
    assert.ok(
      Math.max(...mentioned) <= verno,
      `docs mention DB v${String(Math.max(...mentioned))}, db.verno is ${String(verno)}`,
    );
    assert.ok(
      mentioned.includes(verno),
      `no doc mentions the current DB version as "DB v${String(verno)}"`,
    );
  });
});
