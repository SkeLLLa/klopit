import {
  type ParsedStatement,
  type ParseWarning,
  type Trade,
} from '../../types.js';
import { resolveIbiTicker } from './companies.js';
import { buildStatement, parseAmount, parseLongDateStrict } from './shared.js';

/**
 * Regex: "Order Number: 1234567" — appears once in the page header. The
 * order number uniquely identifies a single ESPP grant-purchase + sell
 * pair; we use it as the trade's `lotId` so the FIFO engine isolates each
 * order into its own queue.
 */
const ORDER_NUMBER_RE = /Order Number:\s*(\S+)/;
const GRANT_DATE_RE = /Grant Date:\s*([A-Za-z]+\s+\d+,\s+\d{4})/;
const EXECUTION_DATE_RE = /Execution Date:\s*([A-Za-z]+\s+\d+,\s+\d{4})/;
const PRICE_FOR_TAX_RE = /Price For Tax:\s*USD\s+([\d,]+\.\d+|\d+)/;
const ORDER_LINE_RE =
  /Total Amount Due to Order\s+(\d+(?:\.\d+)?)\s+USD\s+([\d,]+\.\d+|\d+)\s+USD\s+([\d,]+\.\d+|\d+)/;
// Inner `[^)]*` (zero-or-more) mirrors upstream pit-38's regex shape,
// covering both "(NOTE)" and "()" parenthetical forms; outer `(?:...)?`
// also handles the no-parenthetical case.
const TOTAL_FEES_RE = /Total Fees\s+(?:\([^)]*\)\s+)?USD\s+([\d,]+\.\d+|\d+)/;
const COMPANY_RE = /Company:\s*(.+?)\s*(?:\r?\n|Grant Date:|Plan:|$)/;
const PLAN_RE = /Plan:\s*(.+?)\s*(?:\r?\n|Order Date:|Price For Tax:|$)/;

/**
 * Parse the flat text of a single IBI Capital "Sale Of Stock Activity
 * Statement" PDF into a ParsedStatement with two synthetic trades.
 */
export function parseIbiEsppText(args: { text: string }): ParsedStatement {
  const warnings: ParseWarning[] = [];
  const trades: Trade[] = [];

  const grantDateMatch = GRANT_DATE_RE.exec(args.text);
  const executionDateMatch = EXECUTION_DATE_RE.exec(args.text);
  const priceForTaxMatch = PRICE_FOR_TAX_RE.exec(args.text);
  const orderLineMatch = ORDER_LINE_RE.exec(args.text);
  const totalFeesMatch = TOTAL_FEES_RE.exec(args.text);
  const companyMatch = COMPANY_RE.exec(args.text);
  const orderNumberMatch = ORDER_NUMBER_RE.exec(args.text);
  const planMatch = PLAN_RE.exec(args.text);
  const plan = planMatch ? planMatch[1].trim() : undefined;

  const grantDateResult = grantDateMatch
    ? parseLongDateStrict(grantDateMatch[1])
    : undefined;
  const executionDateResult = executionDateMatch
    ? parseLongDateStrict(executionDateMatch[1])
    : undefined;

  const grantDate = grantDateResult?.ok ? grantDateResult.date : undefined;
  const executionDate = executionDateResult?.ok
    ? executionDateResult.date
    : undefined;
  const priceForTax = priceForTaxMatch
    ? parseAmount(priceForTaxMatch[1])
    : undefined;

  const shares = orderLineMatch ? Number(orderLineMatch[1]) : undefined;
  const salePrice = orderLineMatch ? parseAmount(orderLineMatch[2]) : undefined;
  const totalValue = orderLineMatch
    ? parseAmount(orderLineMatch[3])
    : undefined;
  const totalFees = totalFeesMatch ? parseAmount(totalFeesMatch[1]) : undefined;
  const symbol = companyMatch ? resolveIbiTicker(companyMatch[1]) : undefined;

  const missing: string[] = [];
  if (!grantDate)
    missing.push(
      grantDateResult && !grantDateResult.ok
        ? `Grant Date (unparseable: "${grantDateResult.raw}")`
        : 'Grant Date',
    );
  if (!executionDate)
    missing.push(
      executionDateResult && !executionDateResult.ok
        ? `Execution Date (unparseable: "${executionDateResult.raw}")`
        : 'Execution Date',
    );
  if (priceForTax === undefined) missing.push('Price For Tax');
  if (shares === undefined) missing.push('Shares');
  if (salePrice === undefined) missing.push('Sale Price');
  if (totalValue === undefined) missing.push('Total Amount Due to Order');
  if (totalFees === undefined) missing.push('Total Fees');
  if (!symbol) missing.push('Company');

  if (
    missing.length > 0 ||
    !grantDate ||
    !executionDate ||
    priceForTax === undefined ||
    shares === undefined ||
    salePrice === undefined ||
    totalValue === undefined ||
    totalFees === undefined ||
    !symbol
  ) {
    warnings.push({
      line: 0,
      section: 'IBI Statement',
      message: `Missing required fields: ${missing.join(', ')}`,
    });
    return buildStatement({ trades, warnings, year: 0 });
  }

  const lotId = orderNumberMatch ? orderNumberMatch[1] : undefined;

  trades.push({
    symbol,
    currency: 'USD',
    datetime: grantDate,
    quantity: shares,
    price: priceForTax,
    proceeds: priceForTax * shares,
    commission: 0,
    commissionCurrency: 'USD',
    type: 'buy',
    source: 'espp',
    lotId,
    plan,
  });

  trades.push({
    symbol,
    currency: 'USD',
    datetime: executionDate,
    quantity: shares,
    price: salePrice,
    proceeds: totalValue,
    commission: totalFees,
    commissionCurrency: 'USD',
    type: 'sell',
    source: 'espp',
    lotId,
    plan,
  });

  return buildStatement({
    trades,
    warnings,
    year: executionDate.getFullYear(),
  });
}
