import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  elementToMarkdown,
  findElement,
  parseHtml,
} from './html-to-markdown.ts';

const SITE_URL = 'https://klopit.co.pl';
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = join(rootDir, 'build');

const NOINDEX = /<meta\s+name="robots"\s+content="[^"]*noindex/;

/*
 * Post-build step (runs after `vite build`, see `generate:llms-full`):
 * - build/llms-full.txt: llms.txt intro + every English docs page, one document
 * - build/<docs path>/index.md next to each docs page's index.html, so the
 *   Markdown of https://klopit.co.pl/docs/faq/ is https://klopit.co.pl/docs/faq/index.md
 *   (GitHub Pages serves it as-is; same convention for /pl/ and /uk/)
 * Content comes from the prerendered <main>, so new pages need no changes.
 */

export interface DocsPage {
  /** Path of the page's index.html relative to the build dir */
  file: string;
  /** Canonical URL, with trailing slash */
  url: string;
  locale: 'en' | 'pl' | 'uk';
  markdown: string;
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (entry.name === 'index.html') yield path;
  }
}

/**
 * Converts every prerendered docs page (all locales) to Markdown. Redirect
 * stubs and noindex pages are skipped; new pages are picked up automatically.
 */
export function collectDocsPages(dir: string): DocsPage[] {
  const pages: DocsPage[] = [];
  for (const path of walk(dir)) {
    const file = relative(dir, path).split('\\').join('/');
    const match = /^(?:(pl|uk)\/)?docs(?:\/.*)?index\.html$/.exec(file);
    if (match === null) continue;
    const html = readFileSync(path, 'utf8');
    if (NOINDEX.test(html) || html.includes('http-equiv="refresh"')) continue;
    const main = findElement(parseHtml(html), 'main');
    if (main === undefined) continue;
    const url = `${SITE_URL}/${file.slice(0, -'index.html'.length)}`;
    const locale = match[1] === 'pl' || match[1] === 'uk' ? match[1] : 'en';
    pages.push({
      file,
      url,
      locale,
      markdown: `${elementToMarkdown(main, url).trimEnd()}\n\nSource: ${url}\n`,
    });
  }
  return pages.toSorted((a, b) => a.url.localeCompare(b.url));
}

/** Pulls the intro (title, summary, description) off the top of llms.txt */
function llmsIntro(dir: string): string {
  const text = readFileSync(join(dir, 'llms.txt'), 'utf8');
  const cut = text.indexOf('\n## ');
  return (cut === -1 ? text : text.slice(0, cut)).trim();
}

export function generate(dir: string = buildDir): void {
  const pages = collectDocsPages(dir);
  for (const page of pages) {
    writeFileSync(
      join(dir, page.file.replace(/\.html$/, '.md')),
      page.markdown,
    );
  }
  const english = pages.filter((p) => p.locale === 'en');
  const full = [
    llmsIntro(dir),
    'This file concatenates the English documentation of kloPIT. Polish and Ukrainian versions: `/pl/docs/` and `/uk/docs/`. Every docs page also has a Markdown mirror at its URL + `index.md`.',
    ...english.map((p) => p.markdown.trimEnd()),
  ].join('\n\n---\n\n');
  writeFileSync(join(dir, 'llms-full.txt'), `${full}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) generate();
