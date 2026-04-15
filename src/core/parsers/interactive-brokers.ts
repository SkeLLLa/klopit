import type { BrokerId } from '../types.js';
import { CsvStatementParser } from './csv-parser.js';
import { cleanField, parseDateTime, parseDecimal } from './csv-utils.js';
import { classifySection } from './interactive-brokers/sections.js';
import type { ParserDefinition, StatementParser } from './types.js';

/** Regex to extract symbol and ISIN from dividend/tax descriptions: "AAPL(US0378331005) ..." */
const SYMBOL_ISIN_RE = /^\s*(\S+)\s*\(([^)]+)\)/;

/**
 * IBKR marks per-section summary rows with column 2 starting with "Total"
 * (e.g. "Total", "Total in EUR", "Total Dividends in EUR",
 * "Total (All Assets)"). These rows are aggregates of surrounding Data rows
 * and are always redundant for a per-row tax calculation.
 */
function isSummaryRow(fields: string[]): boolean {
  const discriminator = fields[2]?.trim() ?? '';
  return discriminator === 'Total' || discriminator.startsWith('Total ');
}

/** Regex to match split descriptions: "NVDA(...) Split 10 for 1" or "TSLA(...) Reverse Split 1 for 3" */
const SPLIT_RE =
  /^\s*(\S+)\s*\(([^)]+)\)\s+(?:Reverse\s+)?Split\s+(\d+(?:\.\d+)?)\s+for\s+(\d+(?:\.\d+)?)/;

/**
 * Regex to match cash-and-stock merger descriptions:
 * "MAG(CA55903Q1046) Cash and Stock Merger (Acquisition) CA6979001089 58844257 for 100000000 and USD 4.52847757 (...)"
 * Groups: 1=source symbol, 2=source ISIN, 3=target ISIN, 4=numerator, 5=denominator, 6=cash currency, 7=cash per share
 */
const MERGER_RE =
  /^\s*(\S+)\s*\(([^)]+)\)\s+Cash and Stock Merger\s+\(Acquisition\)\s+(\S+)\s+(\d+(?:\.\d+)?)\s+for\s+(\d+(?:\.\d+)?)\s+and\s+(\S+)\s+(\d+(?:\.\d+)?)/;

class InteractiveBrokersParser extends CsvStatementParser {
  protected getBrokerId(): string {
    return 'interactive-brokers';
  }

  protected processRow(args: {
    section: string;
    fields: string[];
    rawLine: string;
  }): void {
    const { section, fields, rawLine } = args;

    // IBKR convention: within a Data row, column 2 labeled "Total" or
    // "Total <…>" (e.g. "Total in EUR", "Total (All Assets)") is a
    // per-section summary row, not a transaction. We calculate per-row, so
    // these are always redundant — drop them before section dispatch so
    // known-unsupported and unknown sections don't inflate their skipped
    // counts.
    if (isSummaryRow(fields)) return;

    const classification = classifySection({ section });

    switch (classification) {
      case 'supported':
        switch (section) {
          case 'Statement':
            this.parseStatement(fields);
            break;
          case 'Financial Instrument Information':
            this.parseFinancialInstrument(fields);
            break;
          case 'Trades':
            this.parseTrade({ fields, rawLine });
            break;
          case 'Dividends':
            this.parseDividend({ fields, rawLine });
            break;
          case 'Withholding Tax':
            this.parseWithholdingTax({ fields, rawLine });
            break;
          case 'Corporate Actions':
            this.parseCorporateAction({ fields, rawLine });
            break;
          case 'Mark-to-Market Performance Summary':
            this.parseCarryInPosition({ fields, rawLine });
            break;
        }
        break;
      case 'ignorable':
        return;
      case 'known-unsupported':
      case 'unknown':
        this.addSkippedRow({
          section,
          kind: classification,
          rawLine,
          ...this.extractBestEffortSkippedFields({ section, fields }),
        });
        break;
    }
  }

  private parseStatement(fields: string[]): void {
    const fieldName = cleanField({ value: fields[2] ?? '' });
    if (fieldName !== 'Period') return;

    const periodValue = cleanField({ value: fields[3] ?? '' });
    // Extract year from end date: "... - December 31, 2024"
    const yearMatch = /(\d{4})\s*$/.exec(periodValue);
    if (yearMatch) {
      this.year = Number(yearMatch[1]);
    }
  }

  private parseFinancialInstrument(fields: string[]): void {
    const assetCategory = cleanField({ value: fields[2] ?? '' });
    if (assetCategory !== 'Stocks') return;

    const symbol = cleanField({ value: fields[3] ?? '' });
    const securityId = cleanField({ value: fields[6] ?? '' });
    if (symbol && securityId) {
      this.symbolToIsin.set(symbol, securityId);
    }
  }

  private parseTrade(args: { fields: string[]; rawLine: string }): void {
    const { fields, rawLine } = args;
    const discriminator = cleanField({ value: fields[2] ?? '' });
    // Only process Order and Trade rows (Total rows are filtered upstream in processRow).
    if (discriminator !== 'Order' && discriminator !== 'Trade') return;

    const assetCategory = cleanField({ value: fields[3] ?? '' });
    if (assetCategory !== 'Stocks') return;

    try {
      const currency = cleanField({ value: fields[4] ?? '' });
      const symbol = cleanField({ value: fields[5] ?? '' });
      const datetime = parseDateTime({
        value: cleanField({ value: fields[6] ?? '' }),
      });
      const rawQuantity = parseDecimal({ value: fields[7] ?? '' });
      const price = parseDecimal({ value: fields[8] ?? '' });
      const rawProceeds = parseDecimal({ value: fields[10] ?? '' });
      const rawCommission = parseDecimal({ value: fields[11] ?? '' });

      if (!datetime || rawQuantity === undefined || price === undefined) {
        this.reportParseFailure({
          section: 'Trades',
          rawLine,
          message: `Could not parse trade row for ${symbol}: missing datetime, quantity, or price`,
          assetCategory,
          currency: currency || undefined,
          symbol: symbol || undefined,
          datetime: cleanField({ value: fields[6] ?? '' }) || undefined,
          description: this.joinTail(fields, 7),
        });
        return;
      }

      const type = rawQuantity >= 0 ? 'buy' : 'sell';
      const quantity = Math.abs(rawQuantity);
      const proceeds = Math.abs(rawProceeds ?? 0);
      const commission = Math.abs(rawCommission ?? 0);

      this.trades.push({
        symbol,
        isin: this.symbolToIsin.get(symbol),
        currency,
        datetime,
        quantity,
        price,
        proceeds,
        commission,
        commissionCurrency: currency,
        type,
      });
    } catch {
      this.reportParseFailure({
        section: 'Trades',
        rawLine,
        message: `Failed to parse trade row: ${rawLine}`,
        assetCategory: cleanField({ value: fields[3] ?? '' }) || undefined,
        currency: cleanField({ value: fields[4] ?? '' }) || undefined,
        symbol: cleanField({ value: fields[5] ?? '' }) || undefined,
        datetime: cleanField({ value: fields[6] ?? '' }) || undefined,
        description: this.joinTail(fields, 7),
      });
    }
  }

  private parseDividend(args: { fields: string[]; rawLine: string }): void {
    const { fields, rawLine } = args;
    const currency = cleanField({ value: fields[2] ?? '' });

    try {
      const date = parseDateTime({
        value: cleanField({ value: fields[3] ?? '' }),
      });
      const description = cleanField({ value: fields[4] ?? '' });
      const amount = parseDecimal({ value: fields[5] ?? '' });

      if (!date || amount === undefined) {
        const description = cleanField({ value: fields[4] ?? '' });
        const match = SYMBOL_ISIN_RE.exec(description);
        this.reportParseFailure({
          section: 'Dividends',
          rawLine,
          message: `Could not parse dividend row: missing date or amount`,
          currency: currency || undefined,
          symbol: match?.[1] ?? undefined,
          datetime: cleanField({ value: fields[3] ?? '' }) || undefined,
          description: description || undefined,
        });
        return;
      }

      const match = SYMBOL_ISIN_RE.exec(description);
      const symbol = match?.[1] ?? '';
      const isin = match?.[2];

      this.dividends.push({ symbol, isin, currency, date, amount });
    } catch {
      const description = cleanField({ value: fields[4] ?? '' });
      const match = SYMBOL_ISIN_RE.exec(description);
      this.reportParseFailure({
        section: 'Dividends',
        rawLine,
        message: `Failed to parse dividend row: ${rawLine}`,
        currency: currency || undefined,
        symbol: match?.[1] ?? undefined,
        datetime: cleanField({ value: fields[3] ?? '' }) || undefined,
        description: description || undefined,
      });
    }
  }

  private parseWithholdingTax(args: {
    fields: string[];
    rawLine: string;
  }): void {
    const { fields, rawLine } = args;
    const currency = cleanField({ value: fields[2] ?? '' });

    try {
      const date = parseDateTime({
        value: cleanField({ value: fields[3] ?? '' }),
      });
      const description = cleanField({ value: fields[4] ?? '' });
      const amount = parseDecimal({ value: fields[5] ?? '' });

      if (!date || amount === undefined) {
        const description = cleanField({ value: fields[4] ?? '' });
        const match = SYMBOL_ISIN_RE.exec(description);
        this.reportParseFailure({
          section: 'Withholding Tax',
          rawLine,
          message: `Could not parse withholding tax row: missing date or amount`,
          currency: currency || undefined,
          symbol: match?.[1] ?? undefined,
          datetime: cleanField({ value: fields[3] ?? '' }) || undefined,
          description: description || undefined,
        });
        return;
      }

      const match = SYMBOL_ISIN_RE.exec(description);
      const symbol = match?.[1] ?? '';
      const isin = match?.[2];

      // Amount is negative in the CSV — keep as-is
      this.withholdingTaxes.push({ symbol, isin, currency, date, amount });
    } catch {
      const description = cleanField({ value: fields[4] ?? '' });
      const match = SYMBOL_ISIN_RE.exec(description);
      this.reportParseFailure({
        section: 'Withholding Tax',
        rawLine,
        message: `Failed to parse withholding tax row: ${rawLine}`,
        currency: currency || undefined,
        symbol: match?.[1] ?? undefined,
        datetime: cleanField({ value: fields[3] ?? '' }) || undefined,
        description: description || undefined,
      });
    }
  }

  private parseCorporateAction(args: {
    fields: string[];
    rawLine: string;
  }): void {
    const { fields, rawLine } = args;
    const assetCategory = cleanField({ value: fields[2] ?? '' });
    let description = '';

    try {
      const datetime = parseDateTime({
        value: cleanField({ value: fields[5] ?? '' }),
      });
      description = cleanField({ value: fields[6] ?? '' });

      if (!datetime) {
        this.reportParseFailure({
          section: 'Corporate Actions',
          rawLine,
          message: `Could not parse corporate action: missing datetime`,
          assetCategory: assetCategory || undefined,
          currency: cleanField({ value: fields[3] ?? '' }) || undefined,
          datetime: cleanField({ value: fields[5] ?? '' }) || undefined,
          description: description || undefined,
        });
        return;
      }

      const splitMatch = SPLIT_RE.exec(description);
      if (splitMatch) {
        const symbol = splitMatch[1];
        const isin = splitMatch[2];
        const numerator = Number(splitMatch[3]);
        const denominator = Number(splitMatch[4]);

        this.corporateActions.push({
          type: 'stock-split',
          symbol,
          isin,
          datetime,
          numerator,
          denominator,
        });
        return;
      }

      const mergerMatch = MERGER_RE.exec(description);
      if (mergerMatch) {
        const quantity = parseDecimal({ value: fields[7] ?? '' });
        const targetIsin = mergerMatch[3];

        // IB produces two rows per merger: negative qty (source removed) and positive qty (target received).
        // Negative-qty row: create the corporate action.
        // Positive-qty row: extract new shares FMV (Value column) and attach to the last merger.
        if (quantity !== undefined && quantity >= 0) {
          const value = parseDecimal({ value: fields[9] ?? '' });
          if (value !== undefined && value > 0) {
            const lastCA = this.corporateActions.at(-1);
            if (lastCA?.type === 'merger' && lastCA.targetIsin === targetIsin) {
              lastCA.newSharesValue = value;
            }
          }
          return;
        }

        const symbol = mergerMatch[1];
        const isin = mergerMatch[2];
        const numerator = Number(mergerMatch[4]);
        const denominator = Number(mergerMatch[5]);
        const cashCurrency = mergerMatch[6];
        const cashPerShare = Number(mergerMatch[7]);
        const proceeds = parseDecimal({ value: fields[8] ?? '' });

        // Reverse-lookup target symbol from symbolToIsin map
        let targetSymbol: string | undefined;
        for (const [sym, symIsin] of this.symbolToIsin) {
          if (symIsin === targetIsin) {
            targetSymbol = sym;
            break;
          }
        }

        this.corporateActions.push({
          type: 'merger',
          symbol,
          isin,
          datetime,
          numerator,
          denominator,
          targetSymbol,
          targetIsin,
          conversionRatio: numerator / denominator,
          cashPerShare,
          cashCurrency,
          cashTotalProceeds:
            proceeds !== undefined ? Math.abs(proceeds) : undefined,
        });
        return;
      }

      // Unsupported corporate action type — warn but don't fail
      this.reportParseFailure({
        section: 'Corporate Actions',
        rawLine,
        message: `Unsupported corporate action: ${description}`,
        assetCategory: assetCategory || undefined,
        currency: cleanField({ value: fields[3] ?? '' }) || undefined,
        datetime: cleanField({ value: fields[5] ?? '' }) || undefined,
        description: description || undefined,
      });
    } catch {
      this.reportParseFailure({
        section: 'Corporate Actions',
        rawLine,
        message: `Failed to parse corporate action row: ${rawLine}`,
        assetCategory: assetCategory || undefined,
        currency: cleanField({ value: fields[3] ?? '' }) || undefined,
        symbol: this.extractSymbolFromDescription(description),
        datetime: cleanField({ value: fields[5] ?? '' }) || undefined,
        description: description || undefined,
      });
    }
  }

  private parseCarryInPosition(args: {
    fields: string[];
    rawLine: string;
  }): void {
    const { fields, rawLine } = args;
    const assetCategory = cleanField({ value: fields[2] ?? '' });

    // Only process Stocks (Total rows are filtered upstream in processRow).
    if (assetCategory !== 'Stocks') return;

    try {
      const symbol = cleanField({ value: fields[3] ?? '' });
      const priorQuantity = parseDecimal({ value: fields[4] ?? '' });

      if (priorQuantity === undefined || priorQuantity <= 0) return;

      this.carryInPositions.push({
        symbol,
        quantity: priorQuantity,
        year: this.year > 0 ? this.year - 1 : 0,
      });
    } catch {
      this.reportParseFailure({
        section: 'Mark-to-Market Performance Summary',
        rawLine,
        message: `Failed to parse carry-in position: ${rawLine}`,
        assetCategory,
        symbol: cleanField({ value: fields[3] ?? '' }) || undefined,
        description: this.joinTail(fields, 4),
      });
    }
  }

  private reportParseFailure(args: {
    section: string;
    rawLine: string;
    message: string;
    assetCategory?: string;
    currency?: string;
    symbol?: string;
    datetime?: string;
    description?: string;
  }): void {
    this.addWarning({ section: args.section, message: args.message });
    this.addSkippedRow({
      section: args.section,
      kind: 'parse-failure',
      rawLine: args.rawLine,
      assetCategory: args.assetCategory,
      currency: args.currency,
      symbol: args.symbol,
      datetime: args.datetime,
      description: args.description,
    });
  }

  /**
   * Best-effort extraction of structured fields from a skipped Data row.
   * Uses the section's captured Header row to map columns by name, since IBKR
   * sections vary in column order (e.g. Trades has DataDiscriminator at col 2,
   * Transaction Fees has Asset Category at col 2, Interest has Currency at
   * col 2). Falls back to a tail join when no header was captured.
   */
  private extractBestEffortSkippedFields(args: {
    section: string;
    fields: string[];
  }): {
    assetCategory?: string;
    currency?: string;
    symbol?: string;
    datetime?: string;
    description?: string;
  } {
    const { section, fields } = args;
    const header = this.getSectionHeader(section);

    if (!header) {
      return { description: this.joinTail(fields, 2) };
    }

    const get = (columnName: string): string | undefined => {
      const index = header.indexOf(columnName);
      if (index < 0) return undefined;
      return cleanField({ value: fields[index] ?? '' }) || undefined;
    };

    const assetCategory = get('Asset Category');
    const currency = get('Currency');
    const symbol = get('Symbol');
    const datetime =
      get('Date/Time') ??
      get('Date') ??
      get('Settle Date') ??
      get('Report Date');

    let description = get('Description');
    if (description === undefined) {
      // No Description column — join everything after the recognised columns
      // so the user still sees something meaningful in the table.
      const recognisedIndices = new Set(
        [
          'Asset Category',
          'Currency',
          'Symbol',
          'Date/Time',
          'Date',
          'Settle Date',
          'Report Date',
        ]
          .map((name) => header.indexOf(name))
          .filter((index) => index >= 0),
      );
      const tail = fields
        .map((value, index) =>
          index < 2 || recognisedIndices.has(index)
            ? ''
            : cleanField({ value }),
        )
        .filter((value) => value !== '')
        .join(', ');
      description = tail || undefined;
    }

    return { assetCategory, currency, symbol, datetime, description };
  }

  private extractSymbolFromDescription(
    description: string,
  ): string | undefined {
    const match = SYMBOL_ISIN_RE.exec(description);
    return match?.[1];
  }

  private joinTail(fields: string[], startIndex: number): string | undefined {
    if (fields.length <= startIndex) return undefined;
    const value = fields
      .slice(startIndex)
      .map((field) => cleanField({ value: field }))
      .filter((field) => field !== '')
      .join(',');
    return value || undefined;
  }
}

/** Parser definition for Interactive Brokers — the only public export */
export const interactiveBrokersDefinition: ParserDefinition = {
  brokerId: 'interactive-brokers' as BrokerId,
  brokerName: 'Interactive Brokers',
  createParser(): StatementParser {
    return new InteractiveBrokersParser();
  },
};
