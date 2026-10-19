import { existsSync, readFileSync } from 'node:fs';

import { paraglideVitePlugin } from '@inlang/paraglide-js';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { svelteSitemap } from 'svelte-sitemap/vite';
import { defineConfig } from 'vite';

const pkg: unknown = JSON.parse(readFileSync('package.json', 'utf-8'));
if (
  typeof pkg !== 'object' ||
  pkg === null ||
  !('version' in pkg) ||
  typeof pkg.version !== 'string'
) {
  throw new Error('package.json: missing "version" field');
}
const appVersion = pkg.version;
// Dev TLS certificate created by `mise run certs`; plain HTTP without it
const loadHttps = () =>
  existsSync('.certs/key.pem')
    ? {
        key: readFileSync('.certs/key.pem'),
        cert: readFileSync('.certs/cert.pem'),
      }
    : undefined;

export default defineConfig(({ command }) => {
  const https = command === 'serve' ? loadHttps() : undefined;
  const tls = https ? { https } : {};
  return {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    build: {
      // Keep fonts as files: inlined data: URIs would need `data:` in font-src
      assetsInlineLimit: (file) =>
        /\.(woff2?|ttf)$/.test(file) ? false : undefined,
      minify: 'oxc',
      cssMinify: 'lightningcss',
    },
    server: tls,
    preview: tls,
    plugins: [
      tailwindcss(),
      sveltekit({
        adapter: adapter({
          pages: 'build',
          assets: 'build',
          precompress: false,
          strict: true,
        }),
        // Hosting (GitHub Pages) cannot set headers, so Kit emits the policy as
        // a <meta> tag in each prerendered page, hashing its own inline scripts.
        csp: {
          mode: 'hash',
          directives: {
            'default-src': ['self'],
            'script-src': ['self'],
            // Unovis (emotion) injects <style> elements at runtime
            'style-src': ['self', 'unsafe-inline'],
            'img-src': ['self', 'data:', 'blob:'],
            'font-src': ['self'],
            'connect-src': ['self', 'https://api.nbp.pl'],
            'worker-src': ['self'],
            'object-src': ['none'],
            'base-uri': ['self'],
            'form-action': ['self'],
          },
        },
        prerender: {
          entries: [
            '*',
            '/pl/docs/brokerzy',
            '/uk/docs/brokerzy',
            '/pl/docs/dywidendy/usa-15-czy-19',
            '/uk/docs/dywidendy/usa-15-czy-19',
          ],
        },
      }),
      paraglideVitePlugin({
        project: './project.inlang',
        outdir: './src/lib/paraglide',
        strategy: ['url', 'cookie', 'baseLocale'],
        emitTsDeclarations: true,
      }),
      // Writes build/sitemap.xml after the static adapter has written build/
      svelteSitemap({
        domain: 'https://klopit.co.pl',
        trailingSlashes: true,
        ignore: [
          'data/**',
          'dashboard/**',
          'tax-form/**',
          'settings/**',
          'prior-losses/**',
          'rates/**',
          'docs/brokerzy/**',
          'docs/dywidendy/**',
          'pl/data/**',
          'pl/dashboard/**',
          'pl/tax-form/**',
          'pl/settings/**',
          'pl/prior-losses/**',
          'pl/rates/**',
          'pl/docs/brokerzy/**',
          'pl/docs/dywidendy/**',
          'uk/data/**',
          'uk/dashboard/**',
          'uk/tax-form/**',
          'uk/settings/**',
          'uk/prior-losses/**',
          'uk/rates/**',
          'uk/docs/brokerzy/**',
          'uk/docs/dywidendy/**',
        ],
      }),
    ],
  };
});
