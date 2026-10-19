import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = resolve(root, 'build');

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

function pngSize(path: string): { width: number; height: number } {
  const buf = readFileSync(path);
  assert.equal(
    buf.subarray(0, 8).toString('hex'),
    '89504e470d0a1a0a',
    `${path} is not a PNG`,
  );
  assert.equal(buf.subarray(12, 16).toString('ascii'), 'IHDR');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const PNG_ICONS = [
  ['icons/apple-touch-icon.png', 180],
  ['icons/icon-192.png', 192],
  ['icons/icon-512.png', 512],
  ['icons/icon-maskable-512.png', 512],
] as const;

void test('build contains PNG icons with the expected dimensions', (t) => {
  if (!existsSync(build)) {
    t.skip('build output not found - run `pnpm run build:app` first');
    return;
  }
  for (const [file, size] of PNG_ICONS) {
    const path = resolve(build, file);
    assert.ok(existsSync(path), `${file} missing from build`);
    assert.deepEqual(pngSize(path), { width: size, height: size }, file);
  }
});

void test('apple-touch-icon PNG is opaque in the corner pixel', (t) => {
  if (!existsSync(build)) {
    t.skip('build output not found - run `pnpm run build:app` first');
    return;
  }
  const buf = readFileSync(resolve(build, 'icons/apple-touch-icon.png'));
  assert.equal(buf[25], 6, 'expected 8-bit RGBA');
  const chunks: Buffer[] = [];
  for (let off = 8; off < buf.length;) {
    const len = buf.readUInt32BE(off);
    if (buf.subarray(off + 4, off + 8).toString('ascii') === 'IDAT') {
      chunks.push(buf.subarray(off + 8, off + 8 + len));
    }
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  // First scanline: filter byte, then the first pixel (no left/up neighbours,
  // so every PNG filter leaves it unchanged).
  assert.equal(raw[4], 255, 'top-left pixel must be fully opaque');
});

void test('manifest references the PNG icons', (t) => {
  if (!existsSync(build)) {
    t.skip('build output not found - run `pnpm run build:app` first');
    return;
  }
  const manifest = JSON.parse(
    readFileSync(resolve(build, 'site.webmanifest'), 'utf8'),
  ) as { icons: ManifestIcon[] };
  const find = (src: string): ManifestIcon | undefined =>
    manifest.icons.find((i) => i.src === src);
  assert.equal(find('/icons/icon-192.png')?.sizes, '192x192');
  assert.equal(find('/icons/icon-512.png')?.sizes, '512x512');
  assert.equal(find('/icons/icon-maskable-512.png')?.sizes, '512x512');
  assert.equal(find('/icons/icon-maskable-512.png')?.purpose, 'maskable');
  for (const icon of manifest.icons) {
    assert.ok(
      existsSync(resolve(build, icon.src.slice(1))),
      `${icon.src} missing`,
    );
    assert.ok(!/\bany maskable\b/.test(icon.purpose ?? ''));
  }
});

void test('html head links the PNG apple-touch-icon', (t) => {
  if (!existsSync(build)) {
    t.skip('build output not found - run `pnpm run build:app` first');
    return;
  }
  const html = readFileSync(resolve(build, 'index.html'), 'utf8');
  assert.match(
    html,
    /<link\s+rel="apple-touch-icon"\s+href="\/icons\/apple-touch-icon\.png"\s+sizes="180x180"/,
  );
});
