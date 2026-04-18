interface PositionedToken {
  readonly str: string;
  readonly x: number;
  readonly y: number;
}

/**
 * Reconstruct a PDF page's text in visual reading order by grouping
 * tokens into rows (similar y, within `yTolerance` points) and sorting
 * each row by x. Without this, PDF text layers emit tokens in stream
 * order, which for the IBI template interleaves labels and values
 * unhelpfully (labels right-to-left, then values left-to-right).
 */
function reconstructText(args: {
  tokens: readonly PositionedToken[];
  yTolerance: number;
}): string {
  const { yTolerance } = args;
  const sorted = [...args.tokens].sort((a, b) => b.y - a.y);
  const rows: PositionedToken[][] = [];
  let currentY: number | undefined;
  for (const tok of sorted) {
    if (currentY === undefined || Math.abs(currentY - tok.y) > yTolerance) {
      rows.push([tok]);
      currentY = tok.y;
    } else {
      rows[rows.length - 1].push(tok);
    }
  }
  return rows
    .map((row) =>
      row
        .slice()
        .sort((a, b) => a.x - b.x)
        .map((t) => t.str.trim())
        .filter((s) => s.length > 0)
        .join(' '),
    )
    .join('\n');
}

/**
 * Extract positionally-aware text from a PDF buffer using `unpdf`, an
 * isomorphic wrapper around pdfjs-dist. Works identically in Node (test
 * runner) and the browser (Vite bundler), so we don't need the legacy
 * build + worker gymnastics pdfjs-dist normally requires.
 */
export async function extractPdfText(args: {
  buffer: ArrayBuffer;
}): Promise<string> {
  const { getDocumentProxy, extractTextItems } = await import('unpdf');
  const doc = await getDocumentProxy(new Uint8Array(args.buffer));
  const { items } = await extractTextItems(doc);
  return items
    .map((pageItems) => {
      const tokens: PositionedToken[] = pageItems.flatMap((item) => {
        const str = item.str;
        if (str.trim().length === 0) return [];
        return [{ str, x: item.x, y: item.y }];
      });
      return reconstructText({ tokens, yTolerance: 3 });
    })
    .join('\n');
}
