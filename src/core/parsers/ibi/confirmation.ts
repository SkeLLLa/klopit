import {
  type ParsedStatement,
  type ParseWarning,
  type Trade,
} from '../../types.js';
import { buildStatement, parseAmount, parseLongDate } from './shared.js';

/**
 * Regexes for IBI Capital "Confirmation of Sale" PDFs (ESPP quick-sell).
 *
 * This document format differs from the "Sale Of Stock Activity Statement"
 * in field names and layout:
 *
 *   Activity Statement field  →  Confirmation of Sale field
 *   ─────────────────────────────────────────────────────
 *   Grant Date                →  Exercise Date   (actual purchase date)
 *   Execution Date            →  Sale Date
 *   Price For Tax             →  Exercise Period Price (85% of lower)
 *   Company: <TICKER>         →  <Name>.com Ltd. in the document title
 *   Order Number              →  (absent — synthetic lot id from period)
 *   Total Amount Due to Order →  Total Consideration
 *   Total Fees (…) USD …      →  Total Fees: …
 *   Sale Price from order row →  Sale Price* $… inline on the same row
 */
const ENTRY_DATE_RE = /Entry Date:\s*([A-Za-z]+\s+\d+,\s+\d{4})/;
const EXERCISE_DATE_RE = /Exercise Date:\s*([A-Za-z]+\s+\d+,\s+\d{4})/;
const SALE_DATE_RE = /Sale Date:\s*([A-Za-z]+\s+\d+,\s+\d{4})/;
const EXERCISE_PRICE_RE = /Exercise Period Price[^:]*:\s*([\d,]+(?:\.\d+)?)/;
/**
 * "Shares Purchased: 82" (Calculation section) or "Shares Sold: 82"
 * (Quick Sale section). Both carry the same value; the first match wins.
 */
const SHARES_RE = /Shares (?:Purchased|Sold):\s*(\d+)/;
/**
 * "Sale Price* $140.4901" — the asterisk and dollar sign may be separated
 * from the label by spaces or appear flush; the \s*\*? handles both.
 */
const SALE_PRICE_RE = /Sale Price\s*\*?\s*\$([\d,]+(?:\.\d+)?)/;
const TOTAL_CONSIDERATION_RE = /Total Consideration:\s*([\d,]+(?:\.\d+)?)/;
/**
 * "Total Fees: 13.98 $" — distinct from the Activity Statement's
 * "Total Fees (…) USD …" pattern, so there is no regex collision.
 */
const TOTAL_FEES_RE = /Total Fees:\s*([\d,]+(?:\.\d+)?)/;
/**
 * Extract a ticker-like symbol from the document title, e.g.
 * "Wix.com Ltd. Employee Stock Purchase Plan" → capture "Wix" → "WIX".
 * Works for <Name>.com / .co / .io / .ai companies. The result is an
 * approximation; rare mismatches (e.g. monday.com → "MONDAY" ≠ "MNDY")
 * should be corrected manually in the trade editor.
 */
const COMPANY_RE = /^([A-Za-z0-9]+)\.(?:com|co|io|ai|net|org)\b/im;

/**
 * Parse the flat text of an IBI Capital "Confirmation of Sale" PDF into a
 * ParsedStatement with two synthetic trades: a buy on Exercise Date at the
 * discounted Exercise Period Price, and a sell on Sale Date at the actual
 * sale price. Both legs are tagged `source: 'espp'` and share a `lotId`
 * derived from the exercise-period boundaries to isolate FIFO queues per
 * grant when multiple periods are imported.
 */
export function parseIbiConfirmationText(args: {
  text: string;
}): ParsedStatement {
  const warnings: ParseWarning[] = [];
  const trades: Trade[] = [];

  const entryDateMatch = ENTRY_DATE_RE.exec(args.text);
  const exerciseDateMatch = EXERCISE_DATE_RE.exec(args.text);
  const saleDateMatch = SALE_DATE_RE.exec(args.text);
  const exercisePriceMatch = EXERCISE_PRICE_RE.exec(args.text);
  const sharesMatch = SHARES_RE.exec(args.text);
  const salePriceMatch = SALE_PRICE_RE.exec(args.text);
  const totalConsiderationMatch = TOTAL_CONSIDERATION_RE.exec(args.text);
  const totalFeesMatch = TOTAL_FEES_RE.exec(args.text);
  const companyMatch = COMPANY_RE.exec(args.text);

  const entryDate = entryDateMatch
    ? parseLongDate(entryDateMatch[1])
    : undefined;
  const exerciseDate = exerciseDateMatch
    ? parseLongDate(exerciseDateMatch[1])
    : undefined;
  const saleDate = saleDateMatch ? parseLongDate(saleDateMatch[1]) : undefined;
  const exercisePrice = exercisePriceMatch
    ? parseAmount(exercisePriceMatch[1])
    : undefined;
  const shares = sharesMatch ? Number(sharesMatch[1]) : undefined;
  const salePrice = salePriceMatch ? parseAmount(salePriceMatch[1]) : undefined;
  const totalConsideration = totalConsiderationMatch
    ? parseAmount(totalConsiderationMatch[1])
    : undefined;
  const totalFees = totalFeesMatch ? parseAmount(totalFeesMatch[1]) : undefined;
  const symbol = companyMatch ? companyMatch[1].toUpperCase() : undefined;

  const missing: string[] = [];
  if (!entryDate) missing.push('Entry Date');
  if (!exerciseDate) missing.push('Exercise Date');
  if (!saleDate) missing.push('Sale Date');
  if (exercisePrice === undefined) missing.push('Exercise Period Price');
  if (shares === undefined) missing.push('Shares');
  if (salePrice === undefined) missing.push('Sale Price');
  if (totalConsideration === undefined) missing.push('Total Consideration');
  if (totalFees === undefined) missing.push('Total Fees');
  if (!symbol) missing.push('Company');

  if (
    missing.length > 0 ||
    !entryDate ||
    !exerciseDate ||
    !saleDate ||
    exercisePrice === undefined ||
    shares === undefined ||
    salePrice === undefined ||
    totalConsideration === undefined ||
    totalFees === undefined ||
    !symbol
  ) {
    warnings.push({
      line: 0,
      section: 'IBI Confirmation of Sale',
      message: `Missing required fields: ${missing.join(', ')}`,
    });
    return buildStatement({ trades, warnings, year: 0 });
  }

  // Synthetic lot ID: exercise-period boundaries uniquely identify this
  // grant. No order number appears in this document format.
  // Use local-calendar components (not toISOString/UTC) to avoid an
  // off-by-one date shift in non-UTC timezones.
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const lotId = `${fmt(entryDate)}-${fmt(exerciseDate)}`;

  trades.push({
    symbol,
    currency: 'USD',
    datetime: exerciseDate,
    quantity: shares,
    price: exercisePrice,
    proceeds: exercisePrice * shares,
    commission: 0,
    commissionCurrency: 'USD',
    type: 'buy',
    source: 'espp',
    lotId,
  });

  trades.push({
    symbol,
    currency: 'USD',
    datetime: saleDate,
    quantity: shares,
    price: salePrice,
    proceeds: totalConsideration,
    commission: totalFees,
    commissionCurrency: 'USD',
    type: 'sell',
    source: 'espp',
    lotId,
  });

  return buildStatement({
    trades,
    warnings,
    year: saleDate.getFullYear(),
  });
}
