import {
  BrokerId,
  type ParsedStatement,
  type ParseWarning,
  type Trade,
} from '../../types.js';
import type { PdfParserDefinition } from '../types.js';
import { extractPdfText } from './pdf-extract.js';

/**
 * Regex: "Order Number: 1234567" — appears once in the page header. The
 * order number uniquely identifies a single ESPP grant-purchase + sell
 * pair; we use it as the trade's `lotId` so the FIFO engine isolates each
 * order into its own queue. This matches IBI's legal reality: ESPP grants
 * don't commingle, they're tracked per-grant at the broker. Without this
 * partition, grants bought-and-sold in arbitrary interleavings produce
 * misleading per-transaction P&L — see `plans/ibi-espp-fifo-mismatch.md`.
 */
const ORDER_NUMBER_RE = /Order Number:\s*(\S+)/;

/** Regex: "Grant Date: August 31, 2025" — matches label and date value. */
const GRANT_DATE_RE = /Grant Date:\s*([A-Za-z]+\s+\d+,\s+\d{4})/;

/** Regex: "Execution Date: March 30, 2026" — matches label and date value. */
const EXECUTION_DATE_RE = /Execution Date:\s*([A-Za-z]+\s+\d+,\s+\d{4})/;

/** Regex: "Price For Tax: USD 119.92" — matches per-share cost basis. */
const PRICE_FOR_TAX_RE = /Price For Tax:\s*USD\s+([\d,]+\.\d+|\d+)/;

/**
 * Regex: "Total Amount Due to Order 71 USD 87.2100 USD 6,191.91" —
 * captures shares, sale price per share, and the total USD value. The
 * label appears twice on the page (header + data row); we rely on the
 * row that has three numeric columns.
 */
const ORDER_LINE_RE =
  /Total Amount Due to Order\s+(\d+(?:\.\d+)?)\s+USD\s+([\d,]+\.\d+|\d+)\s+USD\s+([\d,]+\.\d+|\d+)/;

/**
 * Regex: "Total Fees (THE ABOVE FEES DO NOT INCLUDE TRANSFER FEES) USD 10.19".
 * The parenthesised note anchors the data row so it can't match the
 * standalone "Total Fees ... USD 10.19" summary line elsewhere in the PDF.
 */
const TOTAL_FEES_RE = /Total Fees\s+\([^)]+\)\s+USD\s+([\d,]+\.\d+|\d+)/;

/** Regex: "Company: Company name" — used to derive the ticker symbol. */
const COMPANY_RE = /Company:\s*(\S+)/;

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

export function parseLongDate(value: string): Date | undefined {
  const match = /^([A-Za-z]+)\s+(\d+),\s+(\d{4})$/.exec(value.trim());
  if (!match) return undefined;
  const monthName = match[1].toLowerCase();
  if (!(monthName in MONTHS)) return undefined;
  const month = MONTHS[monthName];
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isFinite(day) || !Number.isFinite(year)) return undefined;
  return new Date(year, month, day);
}

export function parseAmount(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

/**
 * Parse the flat text of a single IBI Capital "Sale Of Stock Activity
 * Statement" PDF into a ParsedStatement with two synthetic trades: a buy
 * on Grant Date at Price For Tax (the ESPP cost basis for PL FIFO) and a
 * sell on Execution Date at Sale Price.
 */
export function parseIbiText(args: { text: string }): ParsedStatement {
  const warnings: ParseWarning[] = [];
  const trades: Trade[] = [];

  const grantDateMatch = GRANT_DATE_RE.exec(args.text);
  const executionDateMatch = EXECUTION_DATE_RE.exec(args.text);
  const priceForTaxMatch = PRICE_FOR_TAX_RE.exec(args.text);
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
  const priceForTax = priceForTaxMatch
    ? parseAmount(priceForTaxMatch[1])
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
  });

  return buildStatement({
    trades,
    warnings,
    year: executionDate.getFullYear(),
  });
}

function buildStatement(args: {
  trades: Trade[];
  warnings: ParseWarning[];
  year: number;
}): ParsedStatement {
  return {
    broker: 'ibi',
    brokerCountry: 'IL',
    year: args.year,
    trades: args.trades,
    dividends: [],
    withholdingTaxes: [],
    corporateActions: [],
    carryInPositions: [],
    transactionFees: [],
    creditInterests: [],
    symbolToIsin: new Map(),
    warnings: args.warnings,
    skippedRows: [],
  };
}

export const ibiDefinition: PdfParserDefinition = {
  kind: 'pdf',
  brokerId: BrokerId.IbiCapital,
  brokerName: 'IBI Capital',
  fileExtensions: ['.pdf'],
  async parse(args: { buffer: ArrayBuffer }): Promise<ParsedStatement> {
    const text = await extractPdfText({ buffer: args.buffer });
    return parseIbiText({ text });
  },
};
