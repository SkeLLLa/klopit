import type { BrokerId } from '../types.js';
import { CsvStatementParser } from './csv-parser.js';
import { cleanField, parseDateTime, parseDecimal } from './csv-utils.js';
import type { ParserDefinition, StatementParser } from './types.js';

/** Regex to extract symbol and ISIN from dividend/tax descriptions: "AAPL(US0378331005) ..." */
const SYMBOL_ISIN_RE = /^\s*(\S+)\s*\(([^)]+)\)/;

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

  protected processRow(args: { section: string; fields: string[] }): void {
    const { section, fields } = args;

    switch (section) {
      case 'Statement':
        this.parseStatement(fields);
        break;
      case 'Financial Instrument Information':
        this.parseFinancialInstrument(fields);
        break;
      case 'Trades':
        this.parseTrade(fields);
        break;
      case 'Dividends':
        this.parseDividend(fields);
        break;
      case 'Withholding Tax':
        this.parseWithholdingTax(fields);
        break;
      case 'Corporate Actions':
        this.parseCorporateAction(fields);
        break;
      case 'Mark-to-Market Performance Summary':
        this.parseCarryInPosition(fields);
        break;
      // Unknown sections are silently ignored
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

  private parseTrade(fields: string[]): void {
    const discriminator = cleanField({ value: fields[2] ?? '' });
    // Only process Order and Trade rows — skip SubTotal, Total
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
        this.addWarning({
          section: 'Trades',
          message: `Could not parse trade row for ${symbol}: missing datetime, quantity, or price`,
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
      this.addWarning({
        section: 'Trades',
        message: `Failed to parse trade row: ${fields.join(',')}`,
      });
    }
  }

  private parseDividend(fields: string[]): void {
    const currency = cleanField({ value: fields[2] ?? '' });

    // Skip Total/SubTotal rows
    if (currency.startsWith('Total')) return;

    try {
      const date = parseDateTime({
        value: cleanField({ value: fields[3] ?? '' }),
      });
      const description = cleanField({ value: fields[4] ?? '' });
      const amount = parseDecimal({ value: fields[5] ?? '' });

      if (!date || amount === undefined) {
        this.addWarning({
          section: 'Dividends',
          message: `Could not parse dividend row: missing date or amount`,
        });
        return;
      }

      const match = SYMBOL_ISIN_RE.exec(description);
      const symbol = match?.[1] ?? '';
      const isin = match?.[2];

      this.dividends.push({ symbol, isin, currency, date, amount });
    } catch {
      this.addWarning({
        section: 'Dividends',
        message: `Failed to parse dividend row: ${fields.join(',')}`,
      });
    }
  }

  private parseWithholdingTax(fields: string[]): void {
    const currency = cleanField({ value: fields[2] ?? '' });

    // Skip Total/SubTotal rows
    if (currency.startsWith('Total')) return;

    try {
      const date = parseDateTime({
        value: cleanField({ value: fields[3] ?? '' }),
      });
      const description = cleanField({ value: fields[4] ?? '' });
      const amount = parseDecimal({ value: fields[5] ?? '' });

      if (!date || amount === undefined) {
        this.addWarning({
          section: 'Withholding Tax',
          message: `Could not parse withholding tax row: missing date or amount`,
        });
        return;
      }

      const match = SYMBOL_ISIN_RE.exec(description);
      const symbol = match?.[1] ?? '';
      const isin = match?.[2];

      // Amount is negative in the CSV — keep as-is
      this.withholdingTaxes.push({ symbol, isin, currency, date, amount });
    } catch {
      this.addWarning({
        section: 'Withholding Tax',
        message: `Failed to parse withholding tax row: ${fields.join(',')}`,
      });
    }
  }

  private parseCorporateAction(fields: string[]): void {
    const assetCategory = cleanField({ value: fields[2] ?? '' });

    // Skip Total rows
    if (assetCategory.startsWith('Total')) return;

    try {
      const datetime = parseDateTime({
        value: cleanField({ value: fields[5] ?? '' }),
      });
      const description = cleanField({ value: fields[6] ?? '' });

      if (!datetime) {
        this.addWarning({
          section: 'Corporate Actions',
          message: `Could not parse corporate action: missing datetime`,
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
      this.addWarning({
        section: 'Corporate Actions',
        message: `Unsupported corporate action: ${description}`,
      });
    } catch {
      this.addWarning({
        section: 'Corporate Actions',
        message: `Failed to parse corporate action row: ${fields.join(',')}`,
      });
    }
  }

  private parseCarryInPosition(fields: string[]): void {
    const assetCategory = cleanField({ value: fields[2] ?? '' });

    // Skip Total rows and non-stock categories
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
      this.addWarning({
        section: 'Mark-to-Market Performance Summary',
        message: `Failed to parse carry-in position: ${fields.join(',')}`,
      });
    }
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
