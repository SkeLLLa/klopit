import {
  type ParsedStatement,
  type ParseWarning,
  type Trade,
} from '../../types.js';
import { buildStatement, parseAmount, parseLongDate } from './shared.js';

/**
 * Regexes for "Sale of Trustee Shares Activity Statement" (RSU). Field
 * labels differ from ESPP (no `Price For Tax`); `Order Number`, `Company`,
 * `Grant Date`, `Execution Date`, the total-amount row, and the total-fees
 * row share the same shape.
 */
const ORDER_NUMBER_RE = /Order Number:\s*(\S+)/;
const GRANT_DATE_RE = /Grant Date:\s*([A-Za-z]+\s+\d+,\s+\d{4})/;
const EXECUTION_DATE_RE = /Execution Date:\s*([A-Za-z]+\s+\d+,\s+\d{4})/;
const ORDER_LINE_RE =
  /Total Amount Due to Order\s+(\d+(?:\.\d+)?)\s+USD\s+([\d,]+\.\d+|\d+)\s+USD\s+([\d,]+\.\d+|\d+)/;
const TOTAL_FEES_RE = /Total Fees\s+\([^)]+\)\s+USD\s+([\d,]+\.\d+|\d+)/;
const COMPANY_RE = /Company:\s*(\S+)/;

/**
 * Parse the flat text of a single IBI Capital "Sale of Trustee Shares
 * Activity Statement" PDF into a ParsedStatement with two synthetic
 * trades: a buy on Grant Date at price 0 (qualifying-plan assumption —
 * vesting income deferred to sale, art. 24 ust. 11-12b PIT) and a sell
 * on Execution Date at Sale Price.
 */
export function parseIbiRsuText(args: { text: string }): ParsedStatement {
  const warnings: ParseWarning[] = [];
  const trades: Trade[] = [];

  const grantDateMatch = GRANT_DATE_RE.exec(args.text);
  const executionDateMatch = EXECUTION_DATE_RE.exec(args.text);
  const orderLineMatch = ORDER_LINE_RE.exec(args.text);
  const totalFeesMatch = TOTAL_FEES_RE.exec(args.text);
  const companyMatch = COMPANY_RE.exec(args.text);
  const orderNumberMatch = ORDER_NUMBER_RE.exec(args.text);

  const grantDate = grantDateMatch
    ? parseLongDate(grantDateMatch[1])
    : undefined;
  const executionDate = executionDateMatch
    ? parseLongDate(executionDateMatch[1])
    : undefined;

  const shares = orderLineMatch ? Number(orderLineMatch[1]) : undefined;
  const salePrice = orderLineMatch ? parseAmount(orderLineMatch[2]) : undefined;
  const totalValue = orderLineMatch
    ? parseAmount(orderLineMatch[3])
    : undefined;
  const totalFees = totalFeesMatch ? parseAmount(totalFeesMatch[1]) : undefined;
  const symbol = companyMatch ? companyMatch[1].toUpperCase() : undefined;

  const missing: string[] = [];
  if (!grantDate) missing.push('Grant Date');
  if (!executionDate) missing.push('Execution Date');
  if (shares === undefined) missing.push('Shares');
  if (salePrice === undefined) missing.push('Sale Price');
  if (totalValue === undefined) missing.push('Total Amount Due to Order');
  if (totalFees === undefined) missing.push('Total Fees');
  if (!symbol) missing.push('Company');

  if (
    missing.length > 0 ||
    !grantDate ||
    !executionDate ||
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
    price: 0,
    proceeds: 0,
    commission: 0,
    commissionCurrency: 'USD',
    type: 'buy',
    source: 'rsu',
    lotId,
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
    source: 'rsu',
    lotId,
  });

  return buildStatement({
    trades,
    warnings,
    year: executionDate.getFullYear(),
  });
}
