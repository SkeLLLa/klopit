import { BrokerId } from '../../types.js';
import { CsvStatementParser } from '../shared/csv-parser.js';
import {
  cleanField,
  parseDateTime,
  parseDecimal,
} from '../shared/csv-utils.js';
import type { CsvParserDefinition, StatementParser } from '../types.js';
import { ibkrEntityToCountry } from './entity-country.js';
import { classifySection } from './sections.js';

/**
 * Regex to extract symbol and ISIN from dividend/tax descriptions:
 * "AAPL(US0378331005) ..."
 */
const SYMBOL_ISIN_RE = /^\s*(\S+)\s*\(([^)]+)\)/;

/**
 * IBKR marks per-section summary rows with column 2 starting with "Total" (e.g.
 * "Total", "Total in EUR", "Total Dividends in EUR", "Total (All Assets)").
 * These rows are aggregates of surrounding Data rows and are always redundant
 * for a per-row tax calculation.
 */
function isSummaryRow(fields: string[]): boolean {
  const discriminator = fields[2]?.trim() ?? '';
  return discriminator === 'Total' || discriminator.startsWith('Total ');
}

/**
 * Regex to match split descriptions: "NVDA(...) Split 10 for 1" or "TSLA(...)
 * Reverse Split 1 for 3"
 */
const SPLIT_RE =
  /^\s*(\S+)\s*\(([^)]+)\)\s+(?:Reverse\s+)?Split\s+(\d+(?:\.\d+)?)\s+for\s+(\d+(?:\.\d+)?)/;

/**
 * Regex to match cash-and-stock merger descriptions: "MAG(CA55903Q1046) Cash
 * and Stock Merger (Acquisition) CA6979001089 58844257 for 100000000 and USD
 * 4.52847757 (...)"
 *
 * Groups: 1=source symbol, 2=source ISIN, 3=target ISIN, 4=numerator,
 * 5=denominator, 6=cash currency, 7=cash per share
 */
const MERGER_RE =
  /^\s*(\S+)\s*\(([^)]+)\)\s+Cash and Stock Merger\s+\(Acquisition\)\s+(\S+)\s+(\d+(?:\.\d+)?)\s+for\s+(\d+(?:\.\d+)?)\s+and\s+(\S+)\s+(\d+(?:\.\d+)?)/;

class InteractiveBrokersParser extends CsvStatementParser {
  private warnedHeaders = new Set<string>();

  protected getBrokerId(): string {
    return 'ibkr';
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
            this.parseFinancialInstrument({ fields, rawLine });
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
          case 'Interest':
            this.parseInterest({ fields, rawLine });
            break;
          case 'Change in Dividend Accruals':
            this.parseDividendAccrual({ fields, rawLine });
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

  /**
   * Resolves a column index by header name. Header indices line up with Data
   * row fields (both include the section name and Header/Data columns). Falls
   * back to the historical fixed index when no header was captured, and returns
   * -1 when a header exists but lacks every candidate name.
   */
  private col(args: {
    section: string;
    names: string[];
    fallbackIdx: number;
  }): number {
    const header = this.getSectionHeader(args.section);
    if (!header) return args.fallbackIdx;
    return header.findIndex((name) => args.names.includes(name.trim()));
  }

  private field(fields: string[], idx: number): string {
    return cleanField({ value: fields[idx] ?? '' });
  }

  /**
   * Returns true (and records a parse-failure skipped row) when the section
   * header exists but lacks a required column. Warns once per distinct header.
   */
  private rejectMissingColumns(args: {
    section: string;
    required: string[];
    fields: string[];
    rawLine: string;
  }): boolean {
    const { section, required, fields, rawLine } = args;
    const header = this.getSectionHeader(section);
    if (!header) return false;
    const names = new Set(header.map((name) => name.trim()));
    const missing = required.filter((name) => !names.has(name));
    if (missing.length === 0) return false;

    const key = `${section}\u0000${header.join('\u0000')}`;
    if (!this.warnedHeaders.has(key)) {
      this.warnedHeaders.add(key);
      this.addWarning({
        section,
        message: `${section} section is missing required column(s): ${missing.join(', ')} — rows skipped`,
      });
    }
    this.addSkippedRow({
      section,
      kind: 'parse-failure',
      rawLine,
      ...this.extractBestEffortSkippedFields({ section, fields }),
    });
    return true;
  }

  private parseStatement(fields: string[]): void {
    const fieldName = cleanField({ value: fields[2] ?? '' });
    if (fieldName === 'BrokerName') {
      const brokerName = cleanField({ value: fields[3] ?? '' });
      if (brokerName !== '') {
        const country = ibkrEntityToCountry({ brokerName });
        if (country !== undefined) {
          this.brokerCountry = country;
        } else {
          this.addWarning({
            section: 'Statement',
            message: `Unrecognised IBKR entity: "${brokerName}" — broker country not set`,
          });
        }
      }
      return;
    }

    if (fieldName !== 'Period') return;

    const periodValue = cleanField({ value: fields[3] ?? '' });
    // Extract year from end date: "... - December 31, 2024"
    const yearMatch = /(\d{4})\s*$/.exec(periodValue);
    if (yearMatch) {
      this.year = Number(yearMatch[1]);
    }
  }

  private parseFinancialInstrument(args: {
    fields: string[];
    rawLine: string;
  }): void {
    const { fields, rawLine } = args;
    const section = 'Financial Instrument Information';
    const assetCategory = this.field(
      fields,
      this.col({ section, names: ['Asset Category'], fallbackIdx: 2 }),
    );
    if (assetCategory !== 'Stocks') return;
    if (
      this.rejectMissingColumns({
        section,
        required: ['Symbol', 'Security ID'],
        fields,
        rawLine,
      })
    ) {
      return;
    }

    const symbol = this.field(
      fields,
      this.col({ section, names: ['Symbol'], fallbackIdx: 3 }),
    );
    const securityId = this.field(
      fields,
      this.col({ section, names: ['Security ID'], fallbackIdx: 6 }),
    );
    if (symbol && securityId) {
      this.symbolToIsin.set(symbol, securityId);
    }
  }

  private parseTrade(args: { fields: string[]; rawLine: string }): void {
    const { fields, rawLine } = args;
    const section = 'Trades';
    const c = (names: string[], fallbackIdx: number) =>
      this.col({ section, names, fallbackIdx });
    const discriminator = this.field(fields, c(['DataDiscriminator'], 2));
    // Only process Order and Trade rows (Total rows are filtered upstream in processRow).
    if (discriminator !== 'Order' && discriminator !== 'Trade') return;

    const assetCategory = this.field(fields, c(['Asset Category'], 3));
    if (assetCategory !== 'Stocks') return;

    if (
      this.rejectMissingColumns({
        section,
        required: ['Date/Time', 'Symbol', 'Quantity', 'Proceeds', 'Currency'],
        fields,
        rawLine,
      })
    ) {
      return;
    }

    const currencyIdx = c(['Currency'], 4);
    const symbolIdx = c(['Symbol'], 5);
    const datetimeIdx = c(['Date/Time'], 6);
    const quantityIdx = c(['Quantity'], 7);

    try {
      const currency = this.field(fields, currencyIdx);
      const symbol = this.field(fields, symbolIdx);
      const datetime = parseDateTime({
        value: this.field(fields, datetimeIdx),
      });
      const rawQuantity = parseDecimal({ value: fields[quantityIdx] ?? '' });
      const price = parseDecimal({
        value: fields[c(['T. Price'], 8)] ?? '',
      });
      const rawProceeds = parseDecimal({
        value: fields[c(['Proceeds'], 10)] ?? '',
      });
      const rawCommission = parseDecimal({
        value: fields[c(['Comm/Fee', 'Comm in USD'], 11)] ?? '',
      });

      if (!datetime || rawQuantity === undefined || price === undefined) {
        this.reportParseFailure({
          section,
          rawLine,
          message: `Could not parse trade row for ${symbol}: missing datetime, quantity, or price`,
          assetCategory,
          currency: currency || undefined,
          symbol: symbol || undefined,
          datetime: this.field(fields, datetimeIdx) || undefined,
          description: this.joinTail(fields, quantityIdx),
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
        section,
        rawLine,
        message: `Failed to parse trade row: ${rawLine}`,
        assetCategory,
        currency: this.field(fields, currencyIdx) || undefined,
        symbol: this.field(fields, symbolIdx) || undefined,
        datetime: this.field(fields, datetimeIdx) || undefined,
        description: this.joinTail(fields, quantityIdx),
      });
    }
  }

  private parseDividend(args: { fields: string[]; rawLine: string }): void {
    const { fields, rawLine } = args;
    const section = 'Dividends';
    if (
      this.rejectMissingColumns({
        section,
        required: ['Currency', 'Date', 'Description', 'Amount'],
        fields,
        rawLine,
      })
    ) {
      return;
    }
    const c = (names: string[], fallbackIdx: number) =>
      this.col({ section, names, fallbackIdx });
    const dateIdx = c(['Date'], 3);
    const descriptionIdx = c(['Description'], 4);
    const currency = this.field(fields, c(['Currency'], 2));

    try {
      const date = parseDateTime({
        value: cleanField({ value: fields[dateIdx] ?? '' }),
      });
      const description = cleanField({ value: fields[descriptionIdx] ?? '' });
      const amount = parseDecimal({ value: fields[c(['Amount'], 5)] ?? '' });

      if (!date || amount === undefined) {
        const match = SYMBOL_ISIN_RE.exec(description);
        this.reportParseFailure({
          section: 'Dividends',
          rawLine,
          message: `Could not parse dividend row: missing date or amount`,
          currency: currency || undefined,
          symbol: match?.[1] ?? undefined,
          datetime: cleanField({ value: fields[dateIdx] ?? '' }) || undefined,
          description: description || undefined,
        });
        return;
      }

      const match = SYMBOL_ISIN_RE.exec(description);
      const symbol = match?.[1] ?? '';
      const isin = match?.[2];

      this.dividends.push({ symbol, isin, currency, date, amount });
    } catch {
      const description = cleanField({ value: fields[descriptionIdx] ?? '' });
      const match = SYMBOL_ISIN_RE.exec(description);
      this.reportParseFailure({
        section: 'Dividends',
        rawLine,
        message: `Failed to parse dividend row: ${rawLine}`,
        currency: currency || undefined,
        symbol: match?.[1] ?? undefined,
        datetime: cleanField({ value: fields[dateIdx] ?? '' }) || undefined,
        description: description || undefined,
      });
    }
  }

  private parseWithholdingTax(args: {
    fields: string[];
    rawLine: string;
  }): void {
    const { fields, rawLine } = args;
    const section = 'Withholding Tax';
    if (
      this.rejectMissingColumns({
        section,
        required: ['Currency', 'Date', 'Description', 'Amount'],
        fields,
        rawLine,
      })
    ) {
      return;
    }
    const c = (names: string[], fallbackIdx: number) =>
      this.col({ section, names, fallbackIdx });
    const dateIdx = c(['Date'], 3);
    const descriptionIdx = c(['Description'], 4);
    const currency = this.field(fields, c(['Currency'], 2));

    try {
      const date = parseDateTime({
        value: cleanField({ value: fields[dateIdx] ?? '' }),
      });
      const description = cleanField({ value: fields[descriptionIdx] ?? '' });
      const amount = parseDecimal({ value: fields[c(['Amount'], 5)] ?? '' });

      if (!date || amount === undefined) {
        const match = SYMBOL_ISIN_RE.exec(description);
        this.reportParseFailure({
          section: 'Withholding Tax',
          rawLine,
          message: `Could not parse withholding tax row: missing date or amount`,
          currency: currency || undefined,
          symbol: match?.[1] ?? undefined,
          datetime: cleanField({ value: fields[dateIdx] ?? '' }) || undefined,
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
      const description = cleanField({ value: fields[descriptionIdx] ?? '' });
      const match = SYMBOL_ISIN_RE.exec(description);
      this.reportParseFailure({
        section: 'Withholding Tax',
        rawLine,
        message: `Failed to parse withholding tax row: ${rawLine}`,
        currency: currency || undefined,
        symbol: match?.[1] ?? undefined,
        datetime: cleanField({ value: fields[dateIdx] ?? '' }) || undefined,
        description: description || undefined,
      });
    }
  }

  private parseCorporateAction(args: {
    fields: string[];
    rawLine: string;
  }): void {
    const { fields, rawLine } = args;
    const section = 'Corporate Actions';
    const c = (names: string[], fallbackIdx: number) =>
      this.col({ section, names, fallbackIdx });
    const currencyIdx = c(['Currency'], 3);
    const datetimeIdx = c(['Date/Time'], 5);
    const descriptionIdx = c(['Description'], 6);
    const assetCategory = this.field(fields, c(['Asset Category'], 2));
    let description = '';

    try {
      const datetime = parseDateTime({
        value: cleanField({ value: fields[datetimeIdx] ?? '' }),
      });
      description = cleanField({ value: fields[descriptionIdx] ?? '' });

      if (!datetime) {
        this.reportParseFailure({
          section: 'Corporate Actions',
          rawLine,
          message: `Could not parse corporate action: missing datetime`,
          assetCategory: assetCategory || undefined,
          currency:
            cleanField({ value: fields[currencyIdx] ?? '' }) || undefined,
          datetime:
            cleanField({ value: fields[datetimeIdx] ?? '' }) || undefined,
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
        const quantity = parseDecimal({
          value: fields[c(['Quantity'], 7)] ?? '',
        });
        const targetIsin = mergerMatch[3];

        // IB produces two rows per merger: negative qty (source removed) and positive qty (target received).
        // Negative-qty row: create the corporate action.
        // Positive-qty row: extract new shares FMV (Value column) and attach to the last merger.
        if (quantity !== undefined && quantity >= 0) {
          const value = parseDecimal({ value: fields[c(['Value'], 9)] ?? '' });
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
        const proceeds = parseDecimal({
          value: fields[c(['Proceeds'], 8)] ?? '',
        });

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
        currency: cleanField({ value: fields[currencyIdx] ?? '' }) || undefined,
        datetime: cleanField({ value: fields[datetimeIdx] ?? '' }) || undefined,
        description: description || undefined,
      });
    } catch {
      this.reportParseFailure({
        section: 'Corporate Actions',
        rawLine,
        message: `Failed to parse corporate action row: ${rawLine}`,
        assetCategory: assetCategory || undefined,
        currency: cleanField({ value: fields[currencyIdx] ?? '' }) || undefined,
        symbol: this.extractSymbolFromDescription(description),
        datetime: cleanField({ value: fields[datetimeIdx] ?? '' }) || undefined,
        description: description || undefined,
      });
    }
  }

  private parseCarryInPosition(args: {
    fields: string[];
    rawLine: string;
  }): void {
    const { fields, rawLine } = args;
    const section = 'Mark-to-Market Performance Summary';
    const c = (names: string[], fallbackIdx: number) =>
      this.col({ section, names, fallbackIdx });
    const symbolIdx = c(['Symbol'], 3);
    const priorQuantityIdx = c(['Prior Quantity'], 4);
    const assetCategory = this.field(fields, c(['Asset Category'], 2));

    // Only process Stocks (Total rows are filtered upstream in processRow).
    if (assetCategory !== 'Stocks') return;

    try {
      const symbol = cleanField({ value: fields[symbolIdx] ?? '' });
      const priorQuantity = parseDecimal({
        value: fields[priorQuantityIdx] ?? '',
      });

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
        symbol: cleanField({ value: fields[symbolIdx] ?? '' }) || undefined,
        description: this.joinTail(fields, priorQuantityIdx),
      });
    }
  }

  private parseInterest(args: { fields: string[]; rawLine: string }): void {
    const { fields, rawLine } = args;
    const section = 'Interest';
    if (
      this.rejectMissingColumns({
        section,
        required: ['Currency', 'Date', 'Description', 'Amount'],
        fields,
        rawLine,
      })
    ) {
      return;
    }
    const c = (names: string[], fallbackIdx: number) =>
      this.col({ section, names, fallbackIdx });
    const currency = this.field(fields, c(['Currency'], 2));
    const rawDate = this.field(fields, c(['Date'], 3));
    const description = this.field(fields, c(['Description'], 4));

    // Check description-based skips before attempting date/amount parse
    if (description.startsWith('Purchase Accrued Interest')) {
      this.addSkippedRow({
        section: 'Interest',
        kind: 'known-unsupported',
        rawLine,
        currency: currency || undefined,
        datetime: rawDate || undefined,
        description: description || undefined,
      });
      return;
    }

    try {
      const date = parseDateTime({ value: rawDate });
      const amount = parseDecimal({ value: fields[c(['Amount'], 5)] ?? '' });

      if (!date || amount === undefined) {
        this.reportParseFailure({
          section: 'Interest',
          rawLine,
          message: 'Could not parse interest row: missing date or amount',
          currency: currency || undefined,
          datetime: rawDate || undefined,
          description: description || undefined,
        });
        return;
      }

      if (amount <= 0 || !description.includes('Credit Interest for')) {
        this.addSkippedRow({
          section: 'Interest',
          kind: 'known-unsupported',
          rawLine,
          currency: currency || undefined,
          datetime: rawDate || undefined,
          description: description || undefined,
        });
        return;
      }

      this.creditInterests.push({
        currency,
        date,
        amount,
        description,
      });
    } catch {
      this.reportParseFailure({
        section: 'Interest',
        rawLine,
        message: `Failed to parse interest row: ${rawLine}`,
        currency: currency || undefined,
        datetime: rawDate || undefined,
        description: description || undefined,
      });
    }
  }

  private parseDividendAccrual(args: {
    fields: string[];
    rawLine: string;
  }): void {
    const { fields, rawLine } = args;
    const section = 'Change in Dividend Accruals';
    const c = (names: string[], fallbackIdx: number) =>
      this.col({ section, names, fallbackIdx });
    const assetCategory = this.field(fields, c(['Asset Category'], 2));
    const currency = this.field(fields, c(['Currency'], 3));
    const symbol = this.field(fields, c(['Symbol'], 4));
    const rawDate = this.field(fields, c(['Date'], 5));
    const rawPayDate = this.field(fields, c(['Pay Date'], 7));
    const code = this.field(fields, c(['Code'], 14));

    if (assetCategory !== 'Stocks' || !code.split(';').includes('ADR')) {
      this.addSkippedRow({
        section: 'Change in Dividend Accruals',
        kind: 'known-unsupported',
        rawLine,
        assetCategory: assetCategory || undefined,
        currency: currency || undefined,
        symbol: symbol || undefined,
        datetime: rawDate || undefined,
        description: code || undefined,
      });
      return;
    }

    const fee = parseDecimal({ value: fields[c(['Fee'], 10)] ?? '' });
    const datetime = parseDateTime({ value: rawPayDate || rawDate });

    if (!datetime || fee === undefined || fee <= 0) {
      this.reportParseFailure({
        section: 'Change in Dividend Accruals',
        rawLine,
        message: 'Could not parse ADR/GDR fee accrual: missing pay date or fee',
        assetCategory,
        currency: currency || undefined,
        symbol: symbol || undefined,
        datetime: rawPayDate || rawDate || undefined,
        description: code || undefined,
      });
      return;
    }

    this.transactionFees.push({
      symbol,
      isin: this.symbolToIsin.get(symbol),
      currency,
      datetime,
      amount: fee,
      description: 'ADR/GDR Fee Accrual',
    });
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
   * Best-effort extraction of structured fields from a skipped Data row. Uses
   * the section's captured Header row to map columns by name, since IBKR
   * sections vary in column order (e.g. Trades has DataDiscriminator at col 2,
   * Transaction Fees has Asset Category at col 2, Interest has Currency at col
   * 2). Falls back to a tail join when no header was captured.
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
export const ibkrDefinition: CsvParserDefinition = {
  kind: 'csv',
  brokerId: BrokerId.InteractiveBrokers,
  brokerName: 'Interactive Brokers',
  fileExtensions: ['.csv'],
  createParser(): StatementParser {
    return new InteractiveBrokersParser();
  },
};
