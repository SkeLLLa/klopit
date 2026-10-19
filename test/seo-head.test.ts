import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const buildDir = resolve(root, 'build');

type Messages = Partial<Record<string, string>>;
type Node = Record<string, unknown>;

const messagesByLocale: Partial<Record<string, Messages>> = {};
for (const locale of ['en', 'pl', 'uk']) {
  messagesByLocale[locale] = JSON.parse(
    readFileSync(resolve(root, `messages/${locale}.json`), 'utf8'),
  ) as Messages;
}

function collectHtml(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collectHtml(full, acc);
    else if (name === 'index.html') acc.push(full);
  }
  return acc;
}

function metaContent(html: string, attr: string, key: string): string[] {
  const out: string[] = [];
  const tagRe = /<meta\s[^>]*>/gi;
  for (const tag of html.match(tagRe) ?? []) {
    const keyMatch = new RegExp(`${attr}=["']${key}["']`, 'i').exec(tag);
    if (!keyMatch) continue;
    const content = /content=["']([^"']*)["']/i.exec(tag);
    if (content?.[1] !== undefined) out.push(content[1]);
  }
  return out;
}

function jsonLdNodes(html: string): Node[] {
  const nodes: Node[] = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  for (const match of html.matchAll(re)) {
    const parsed = JSON.parse(match[1]) as { '@graph'?: Node[] } & Node;
    nodes.push(...(parsed['@graph'] ?? [parsed]));
  }
  return nodes;
}

function decode(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

void test('built pages share one entity graph and localized head metadata', (t) => {
  if (!existsSync(buildDir)) {
    t.skip('build/ not found — run `pnpm build` first');
    return;
  }

  const failures: string[] = [];
  let checked = 0;
  for (const file of collectHtml(buildDir)) {
    const rel = relative(buildDir, file);
    const html = readFileSync(file, 'utf8');
    if (/<meta\s+http-equiv=["']?refresh/i.test(html)) continue;
    if (
      metaContent(html, 'name', 'robots').some((v) => v.startsWith('noindex'))
    )
      continue;
    checked++;

    const lang = /<html[^>]*\slang="([a-z]+)"/i.exec(html)?.[1] ?? 'en';
    const messages = messagesByLocale[lang];
    if (!messages) {
      failures.push(`${rel}: unknown locale ${lang}`);
      continue;
    }

    const themeColors = metaContent(html, 'name', 'theme-color');
    if (themeColors.length !== 1) {
      failures.push(`${rel}: ${String(themeColors.length)} theme-color tags`);
    }

    for (const [attr, key] of [
      ['property', 'og:image:alt'],
      ['name', 'twitter:image:alt'],
    ] as const) {
      const alt = metaContent(html, attr, key).at(0);
      if (alt === undefined || decode(alt) !== messages['og_image_alt']) {
        failures.push(`${rel}: ${key} is not the ${lang} og_image_alt`);
      }
    }

    const nodes = jsonLdNodes(html);
    for (const type of ['Organization', 'WebSite']) {
      const node = nodes.find((n) => n['@type'] === type);
      if (node?.['description'] !== messages['seo_site_description']) {
        failures.push(
          `${rel}: ${type}.description is not the ${lang} seo_site_description`,
        );
      }
    }

    const isHome =
      rel === 'index.html' ||
      rel === 'pl/index.html' ||
      rel === 'uk/index.html';
    const hasWebApp = nodes.some((n) => n['@type'] === 'WebApplication');
    if (hasWebApp !== isHome) {
      failures.push(
        `${rel}: WebApplication ${hasWebApp ? 'present' : 'missing'} (home only)`,
      );
    }

    const isDocsArticle = /^(?:(?:pl|uk)\/)?docs\/.+\/index\.html$/.test(rel);
    if (isDocsArticle) {
      const modified = metaContent(
        html,
        'property',
        'article:modified_time',
      ).at(0);
      const article = nodes.find((n) => n['@type'] === 'TechArticle');
      if (!modified) failures.push(`${rel}: missing article:modified_time`);
      else if (article?.['dateModified'] !== modified) {
        failures.push(
          `${rel}: TechArticle.dateModified differs from article:modified_time`,
        );
      } else if (modified > new Date().toISOString().slice(0, 10)) {
        failures.push(`${rel}: modified date ${modified} is in the future`);
      }
    }
  }

  assert.ok(checked > 0, 'no indexable pages found in build/');
  assert.deepEqual(failures, []);
});
