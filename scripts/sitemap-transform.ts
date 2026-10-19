import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { OptionsSvelteSitemap } from 'svelte-sitemap';

const HREFLANG_LINK =
  /<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"\s*\/?>/g;
const NOINDEX = /<meta\s+name="robots"\s+content="[^"]*noindex/;
const MODIFIED_TIME =
  /<meta\s+property="article:modified_time"\s+content="([^"]+)"/;

/**
 * Svelte-sitemap `transform`: derives each entry from the built page so the
 * sitemap cannot diverge from the `<head>` (hreflang set, modification date).
 * Noindex pages and meta-refresh redirect stubs are dropped.
 */
export function transform(
  config: Pick<OptionsSvelteSitemap, 'outDir'>,
  path: string,
) {
  const file = join(config.outDir ?? 'build', path, 'index.html');
  // A missing page means the sitemap and the build disagree: fail the build
  const html = readFileSync(file, 'utf8');
  if (NOINDEX.test(html) || html.includes('http-equiv="refresh"')) {
    return null;
  }
  const alternateRefs = [...html.matchAll(HREFLANG_LINK)].map((m) => ({
    hreflang: m[1],
    href: m[2],
  }));
  // No invented dates: pages without article:modified_time get no lastmod
  const lastmod = MODIFIED_TIME.exec(html)?.[1];
  return { alternateRefs, ...(lastmod === undefined ? {} : { lastmod }) };
}
