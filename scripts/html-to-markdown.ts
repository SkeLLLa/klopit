/**
 * Minimal HTML → Markdown converter for the subset the prerendered docs use:
 * headings, paragraphs, lists, tables, links, emphasis, code, details/summary.
 * Chrome (nav, scripts, svg, buttons, images) is dropped.
 */

interface ElementNode {
  tag: string;
  attrs: Partial<Record<string, string>>;
  children: Node[];
}
type Node = ElementNode | string;

const VOID = new Set(['br', 'hr', 'img', 'meta', 'link', 'input', 'source']);
const RAW_TEXT = new Set(['script', 'style']);
const DROP = new Set([
  'script',
  'style',
  'svg',
  'nav',
  'button',
  'aside',
  'footer',
  'header',
  'img',
  'noscript',
  'template',
  'select',
  'input',
]);
const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
};

export function decodeEntities(text: string): string {
  return text.replaceAll(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (whole, body: string) => {
      if (body.startsWith('#')) {
        const code =
          body[1] === 'x' || body[1] === 'X'
            ? Number.parseInt(body.slice(2), 16)
            : Number.parseInt(body.slice(1), 10);
        return Number.isNaN(code) ? whole : String.fromCodePoint(code);
      }
      return ENTITIES[body.toLowerCase()] ?? whole;
    },
  );
}

// Optional regex groups are undefined at runtime; the lib types claim string
const group = (m: RegExpMatchArray, i: number): string | undefined => m[i];

const TOKEN =
  /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>|([^<]+|<)/g;
const ATTR = /([^\s=/"'>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

function parseAttrs(source: string): ElementNode['attrs'] {
  const attrs: Partial<Record<string, string>> = {};
  for (const m of source.matchAll(ATTR)) {
    attrs[m[1].toLowerCase()] = decodeEntities(
      group(m, 2) ?? group(m, 3) ?? group(m, 4) ?? '',
    );
  }
  return attrs;
}

export function parseHtml(html: string): ElementNode {
  const root: ElementNode = { tag: '#root', attrs: {}, children: [] };
  const stack: ElementNode[] = [root];
  let pos = 0;
  while (pos < html.length) {
    TOKEN.lastIndex = pos;
    const m = TOKEN.exec(html);
    if (m === null || m.index !== pos) {
      pos += 1;
      continue;
    }
    pos = TOKEN.lastIndex;
    const top = stack[stack.length - 1];
    if (group(m, 1) !== undefined) {
      const name = m[1].toLowerCase();
      const at = stack.findLastIndex((el) => el.tag === name);
      if (at > 0) stack.length = at;
    } else if (group(m, 2) !== undefined) {
      const tag = m[2].toLowerCase();
      const el: ElementNode = {
        tag,
        attrs: parseAttrs(group(m, 3) ?? ''),
        children: [],
      };
      top.children.push(el);
      if (RAW_TEXT.has(tag)) {
        const end = html.toLowerCase().indexOf(`</${tag}`, pos);
        const close = end === -1 ? -1 : html.indexOf('>', end);
        pos = close === -1 ? html.length : close + 1;
      } else if (
        !VOID.has(tag) &&
        !(group(m, 3) ?? '').trimEnd().endsWith('/')
      ) {
        stack.push(el);
      }
    } else if (group(m, 4) !== undefined) {
      top.children.push(decodeEntities(m[4]));
    }
  }
  return root;
}

export function findElement(
  node: ElementNode,
  tag: string,
): ElementNode | undefined {
  for (const child of node.children) {
    if (typeof child === 'string') continue;
    if (child.tag === tag) return child;
    const found = findElement(child, tag);
    if (found !== undefined) return found;
  }
  return undefined;
}

function plainText(node: Node): string {
  if (typeof node === 'string') return node;
  if (DROP.has(node.tag)) return '';
  return node.children.map(plainText).join('');
}

const collapse = (text: string) => text.replaceAll(/\s+/g, ' ');
const escapeCell = (text: string) => text.replaceAll('|', String.raw`\|`);

function inline(nodes: Node[], base: string): string {
  let out = '';
  for (const node of nodes) {
    if (typeof node === 'string') {
      out += collapse(node);
      continue;
    }
    if (DROP.has(node.tag)) continue;
    const inner = () => inline(node.children, base);
    switch (node.tag) {
      case 'a': {
        const text = collapse(inner()).trim();
        const href = node.attrs['href'];
        out +=
          href === undefined || text === ''
            ? text
            : `[${text}](${absoluteUrl(href, base)})`;
        break;
      }
      case 'strong':
      case 'b': {
        const text = inner().trim();
        out += text === '' ? '' : `**${text}**`;
        break;
      }
      case 'em':
      case 'i': {
        const text = inner().trim();
        out += text === '' ? '' : `*${text}*`;
        break;
      }
      case 'code': {
        out += `\`${collapse(plainText(node)).trim()}\``;
        break;
      }
      case 'br': {
        out += '  \n';
        break;
      }
      default: {
        // Block-level tags nested in inline context still separate words
        out += INLINE_TAGS.has(node.tag) ? inner() : ` ${inner()} `;
      }
    }
  }
  return out;
}

export function absoluteUrl(href: string, base: string): string {
  if (/^(mailto:|tel:)/.test(href)) return href;
  const url = new URL(href, base);
  // Prerendered pages live at `<path>/`; point at the canonical form
  if (
    url.origin === new URL(base).origin &&
    !/[./]$|\.[a-z0-9]+$/i.test(url.pathname)
  ) {
    url.pathname += '/';
  }
  return url.href;
}

const INLINE_TAGS = new Set([
  'a',
  'strong',
  'b',
  'em',
  'i',
  'code',
  'span',
  'br',
  'small',
  'sup',
  'sub',
  'kbd',
  'mark',
  'abbr',
  'time',
  'u',
]);
const isInline = (node: Node): boolean =>
  typeof node === 'string' ||
  (INLINE_TAGS.has(node.tag) &&
    (node.tag !== 'a' || node.children.every(isInline)));

function list(node: ElementNode, base: string, depth: number): string[] {
  const ordered = node.tag === 'ol';
  const lines: string[] = [];
  let n = 0;
  for (const item of node.children) {
    if (typeof item === 'string' || item.tag !== 'li') continue;
    n += 1;
    const marker = ordered ? `${n}.` : '-';
    const pad = ' '.repeat(depth * 2);
    const isNested = (c: Node): c is ElementNode =>
      typeof c !== 'string' && (c.tag === 'ul' || c.tag === 'ol');
    const text = collapse(
      inline(
        item.children.filter((c) => !isNested(c)),
        base,
      ),
    ).trim();
    lines.push(`${pad}${marker} ${text}`);
    for (const child of item.children) {
      if (isNested(child)) lines.push(...list(child, base, depth + 1));
    }
  }
  return lines;
}

function table(node: ElementNode, base: string): string {
  const rows: string[][] = [];
  const walk = (el: ElementNode) => {
    for (const child of el.children) {
      if (typeof child === 'string' || DROP.has(child.tag)) continue;
      if (child.tag === 'tr') {
        rows.push(
          child.children
            .filter(
              (c): c is ElementNode =>
                typeof c !== 'string' && (c.tag === 'th' || c.tag === 'td'),
            )
            .map((c) => escapeCell(inline(c.children, base).trim())),
        );
      } else {
        walk(child);
      }
    }
  };
  walk(node);
  const width = Math.max(0, ...rows.map((r) => r.length));
  if (width === 0) return '';
  const row = (cells: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => cells[i] ?? '').join(' | ')} |`;
  const [head, ...body] = rows;
  return [
    row(head),
    row(Array.from({ length: width }, () => '---')),
    ...body.map((r) => row(r)),
  ].join('\n');
}

function blocks(node: ElementNode, base: string): string[] {
  const out: string[] = [];
  let run: Node[] = [];
  const flush = () => {
    const text = inline(run, base).trim();
    if (text !== '') out.push(text);
    run = [];
  };
  for (const child of node.children) {
    if (typeof child === 'string' || isInline(child)) {
      run.push(child);
      continue;
    }
    if (DROP.has(child.tag)) continue;
    flush();
    const level = /^h([1-6])$/.exec(child.tag);
    if (level !== null) {
      const text = collapse(inline(child.children, base)).trim();
      if (text !== '') out.push(`${'#'.repeat(Number(level[1]))} ${text}`);
    } else if (child.tag === 'ul' || child.tag === 'ol') {
      out.push(list(child, base, 0).join('\n'));
    } else if (child.tag === 'table') {
      const md = table(child, base);
      if (md !== '') out.push(md);
    } else if (child.tag === 'pre') {
      out.push(`\`\`\`\n${plainText(child).replace(/\n$/, '')}\n\`\`\``);
    } else if (child.tag === 'blockquote') {
      out.push(
        blocks(child, base)
          .join('\n\n')
          .split('\n')
          .map((l) => `> ${l}`.trimEnd())
          .join('\n'),
      );
    } else if (child.tag === 'a') {
      // Card-style link wrapping block content: keep it as one linked line
      const text = inline([child], base).trim();
      if (text !== '') out.push(text);
    } else if (child.tag === 'hr') {
      out.push('---');
    } else if (child.tag === 'details') {
      const summary = child.children.find(
        (c): c is ElementNode => typeof c !== 'string' && c.tag === 'summary',
      );
      if (summary !== undefined) {
        const title = collapse(inline(summary.children, base)).trim();
        if (title !== '') out.push(`### ${title}`);
      }
      out.push(
        ...blocks(
          {
            ...child,
            children: child.children.filter((c) => c !== summary),
          },
          base,
        ),
      );
    } else {
      out.push(...blocks(child, base));
    }
  }
  flush();
  return out;
}

/**
 * Converts an element subtree to Markdown; relative links resolve against
 * `base`.
 */
export function elementToMarkdown(node: ElementNode, base: string): string {
  return `${blocks(node, base).join('\n\n')}\n`;
}

export function htmlToMarkdown(html: string, base: string): string {
  return elementToMarkdown(parseHtml(html), base);
}
