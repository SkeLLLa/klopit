import { existsSync, readFileSync } from 'node:fs';

import { paraglideVitePlugin } from '@inlang/paraglide-js';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
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
  return {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    build: {
      minify: 'oxc',
    },
    server: { https },
    preview: { https },
    plugins: [
      tailwindcss(),
      sveltekit({
        adapter: adapter({
          pages: 'build',
          assets: 'build',
          fallback: undefined,
          precompress: false,
          strict: true,
        }),
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
    ],
  };
});
