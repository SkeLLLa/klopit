import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Resvg } from '@resvg/resvg-js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BACKGROUND = '#10B981';

const source = readFileSync(resolve(root, 'static/favicon.svg'), 'utf8');
const inner = source
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '');
// Glyph only: drop the rounded background tile so we can draw full-bleed.
const glyph = inner.replace(/<rect[^>]*rx="12"[^>]*\/>/, '');

function compose(scale: number): string {
  const offset = (64 - 64 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${BACKGROUND}"/><g transform="translate(${offset} ${offset}) scale(${scale})">${glyph}</g></svg>`;
}

function render(svg: string, size: number, out: string): void {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
    .render()
    .asPng();
  writeFileSync(resolve(root, 'static/icons', out), png);
  console.log(`icons/${out} ${size}x${size} (${png.length} bytes)`);
}

// Rounded "any" icons come straight from the favicon artwork.
render(source, 192, 'icon-192.png');
render(source, 512, 'icon-512.png');
// iOS ignores SVG and masks corners itself, so use an opaque full-bleed tile.
render(compose(1.1), 180, 'apple-touch-icon.png');
// Maskable: glyph kept inside the central 80% safe zone.
render(compose(0.8), 512, 'icon-maskable-512.png');
