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

// Every http(s) host that may appear in the client bundle. Almost all are
// link targets in docs content or strings inside dependencies; the only host
// the app ever fetches is api.nbp.pl (enforced at runtime by the CSP). A new
// host fails the test so a new outbound call or link gets reviewed.
const ALLOWED_HOSTS = new Set([
  // fetched at runtime
  'api.nbp.pl',
  // the site itself
  'klopit.co.pl',
  // namespaces, metadata and strings inside dependencies (svelte, pdf.js, unovis, paraglide)
  'svelte.dev',
  'www.w3.org',
  'schema.org',
  'www.xfa.org',
  'ns.adobe.com',
  'example.com',
  'foo.bar',
  'fallback.com',
  'bit.ly',
  'tinyurl.com',
  'sveltekit-redirect.invalid',
  'paraglidejs.com',
  'www.gnu.org',
  // links in docs, FAQ and legal references
  'github.com',
  'lexlege.pb.pl',
  'sip.lex.pl',
  'www.podatki.gov.pl',
  'www.gov.pl',
  'isap.sejm.gov.pl',
  'orzeczenia.nsa.gov.pl',
  'www.irs.gov',
  'www.oecd.org',
  'www.platnik.e-pity.pl',
  'www.interpretacje.pl',
  'www.inforlex.pl',
  'anylawyer.com',
  'grantthornton.pl',
  'www.sii.org.pl',
  'www.stockwatch.pl',
  'stockanalysis.com',
  'www.interactivebrokers.com',
  'www.xtb.com',
  'www.mbank.pl',
  // donation links on the support page
  'www.sternenkofund.org',
  'savelife.in.ua',
  'prytulafoundation.org',
  'www.siepomaga.pl',
  'www.pah.org.pl',
  'ukrainskidom.pl',
  'pomagam.pl',
  'caritas.pl',
]);

void test('client bundle only references allow-listed external hosts', (t) => {
  const appDir = resolve(root, 'build/_app');
  if (!existsSync(appDir)) {
    t.skip('build output not found - run `pnpm run build:app` first');
    return;
  }

  const failures = new Set<string>();
  for (const file of collectFiles(appDir)) {
    if (!file.endsWith('.js')) continue;
    for (const match of readFileSync(file, 'utf8').matchAll(
      /https?:\/\/([A-Za-z0-9.-]+)/g,
    )) {
      const host = match[1];
      if (!ALLOWED_HOSTS.has(host)) {
        failures.add(`${host} (${relative(root, file)})`);
      }
    }
  }

  assert.deepEqual([...failures], []);
});
