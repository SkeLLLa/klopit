/**
 * IBKR Activity Statement section classification.
 *
 * Every section header the parser encounters falls into exactly one of four
 * buckets. The parser uses the bucket to decide whether to parse, silently
 * skip, or record a warning.
 */

export const SUPPORTED_SECTIONS: ReadonlySet<string> = new Set([
  'Statement',
  'Financial Instrument Information',
  'Trades',
  'Dividends',
  'Withholding Tax',
  'Corporate Actions',
  'Mark-to-Market Performance Summary',
  'Interest',
  'Change in Dividend Accruals',
]);

export const IGNORABLE_SECTIONS: ReadonlySet<string> = new Set([
  'Account Information',
  'Net Asset Value',
  'Change in NAV',
  'Cash Report',
  'Open Positions',
  'Closed Lot Performance Summary',
  'Codes',
  'Disclaimer',
  // IBKR emits notes as the combined header `Notes/Legal Notes`; the split
  // forms are kept as aliases in case other statement variants emit them.
  'Notes/Legal Notes',
  'Legal Notes',
  'Notes',
  'Trade Confirmation Flags',
  // Cash movements between the user's bank and IBKR — not a taxable event.
  'Deposits & Withdrawals',
  // End-of-period FX balance snapshot per currency — balance-sheet, no tax event.
  'Forex Balances',
  // Accrued-but-unpaid interest. The taxable event lives in `Interest` (known
  // unsupported), so the user is still warned once where it actually matters.
  'Interest Accruals',
  // Per-symbol P/L summary derived from Trades — redundant view of data we
  // already parse.
  'Realized & Unrealized Performance Summary',
  // Statement-level P/L summary row — redundant.
  'Total P/L for Statement Period',
]);

export const KNOWN_UNSUPPORTED_SECTIONS: ReadonlySet<string> = new Set([
  'Options',
  'Futures',
  'Forex P/L',
  'Fees',
  'Bond Interest Received',
  'Transaction Fees',
  'Commission Detail',
]);

export type SectionClassification =
  | 'supported'
  | 'ignorable'
  | 'known-unsupported'
  | 'unknown';

export function classifySection(args: {
  section: string;
}): SectionClassification {
  const section = args.section.trim();
  if (SUPPORTED_SECTIONS.has(section)) return 'supported';
  if (IGNORABLE_SECTIONS.has(section)) return 'ignorable';
  if (KNOWN_UNSUPPORTED_SECTIONS.has(section)) return 'known-unsupported';
  return 'unknown';
}
