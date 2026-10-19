import { isinToCountry } from '../../tax/country.js';
import { BrokerId } from '../../types.js';
import type { ParsedStatement, PaymentKind, RawDividend } from '../../types.js';
import { CsvStatementParser } from '../shared/csv-parser.js';
import {
  cleanField,
  parseDateTime,
  parseDecimal,
} from '../shared/csv-utils.js';
import type { CsvParserDefinition, StatementParser } from '../types.js';
import { ibkrEntityToCountry } from './entity-country.js';
import { classifySection } from './sections.js';

/** Source-state suffix IBKR appends to withholding descriptions: "... - TW Tax". */
const WHT_COUNTRY_RE = /\s-\s([A-Z]{2})\s+Tax\s*$/;

/**
 * Payment-in-lieu rows (lent shares) are substitute payments: their withholding
 * suffix says nothing about the ADR issuer country, so they never feed it.
 */
const PAYMENT_IN_LIEU_RE = /payment in lieu of dividend/i;

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
  private trimmedHeaders = new WeakMap<string[], string[]>();
  /** Symbols the Financial Instrument Information `Type` column marks as ADR. */
  private adrSymbols = new Set<string>();
  /**
   * Source countries parsed from the "- XX Tax" suffix of non-PIL withholding
   * rows.
   */
  private whtCountriesBySymbol = new Map<string, Set<string>>();
  /** Symbols with a non-PIL withholding row (with or without a usable suffix). */
  private whtSymbols = new Set<string>();

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
          case 'Account Information':
            this.parseAccountInformation(fields);
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
        // Only stock transfers matter (and are warned about specifically).
        if (section === 'Transfers' && !this.isStockTransfer(fields)) return;
        this.addSkippedRow({
          section,
          kind: classification,
          rawLine,
          ...this.extractBestEffortSkippedFields({ section, fields }),
        });
        break;
    }
  }

  /** Trimmed header row for a section (cached per captured header). */
  private headerFor(section: string): string[] | undefined {
    const raw = this.getSectionHeader(section);
    if (!raw) return undefined;
    let header = this.trimmedHeaders.get(raw);
    if (!header) {
      header = raw.map((name) => name.trim());
      this.trimmedHeaders.set(raw, header);
    }
    return header;
  }

  /**
   * Resolves a column index by header name. Header indices line up with Data
   * row fields (both include the section name and Header/Data columns). Returns
   * -1 when a header exists but lacks every candidate name. The fixed fallback
   * index exists only for header-less input (a Data row with no preceding
   * Header row); it is never used once a header has been captured.
   */
  private col(args: {
    section: string;
    names: string[];
    fallbackIdx: number;
  }): number {
    const header = this.headerFor(args.section);
    if (!header) return args.fallbackIdx;
    return header.findIndex((name) => args.names.includes(name));
  }

  /**
   * Resolves a `{ headerName: fallbackIdx }` map once per row and returns a
   * lookup from header name to column index (-1 when the column is missing).
   */
  private cols<K extends string>(
    section: string,
    spec: Record<K, number>,
  ): (name: K) => number {
    const cache = new Map<K, number>();
    return (name) => {
      let idx = cache.get(name);
      if (idx === undefined) {
        idx = this.col({ section, names: [name], fallbackIdx: spec[name] });
        cache.set(name, idx);
      }
      return idx;
    };
  }

  private field(fields: string[], idx: number): string {
    return cleanField({ value: fields[idx] ?? '' });
  }

  private num(fields: string[], idx: number): number | undefined {
    return parseDecimal({ value: fields[idx] ?? '' });
  }

  /**
   * Returns true (and records a parse-failure skipped row) when the section
   * header exists but lacks a required column. Each entry is a column name or a
   * list of accepted aliases. Warns once per distinct header and missing set.
   */
  private rejectMissingColumns(args: {
    section: string;
    required: (string | string[])[];
    fields: string[];
    rawLine: string;
  }): boolean {
    const { section, required, fields, rawLine } = args;
    const header = this.headerFor(section);
    if (!header) return false;
    const missing = required
      .map((entry) => (Array.isArray(entry) ? entry : [entry]))
      .filter((names) => !names.some((name) => header.includes(name)))
      .map((names) => names.join('/'));
    if (missing.length === 0) return false;

    const key = [section, ...header, '|', ...missing].join('\u0000');
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

  /** Account ids from Account Information, in statement order. */
  private accounts: string[] = [];

  /** Account stamped on rows that carry none of their own. */
  private defaultAccount(): string | undefined {
    const first = this.accounts[0];
    return first ? `ibkr:${first}` : undefined;
  }

  /**
   * Per-row account from an `Account` column (consolidated statements), or
   * undefined when the section has no such column or the cell is empty.
   */
  private rowAccount(section: string, fields: string[]): string | undefined {
    const idx = this.headerFor(section)?.indexOf('Account') ?? -1;
    if (idx < 0) return undefined;
    const id = this.field(fields, idx);
    return id ? `ibkr:${id}` : undefined;
  }

  private isStockTransfer(fields: string[]): boolean {
    const idx = this.headerFor('Transfers')?.indexOf('Asset Category') ?? -1;
    return idx < 0 || this.field(fields, idx) === 'Stocks';
  }

  private parseAccountInformation(fields: string[]): void {
    if (cleanField({ value: fields[2] ?? '' }) !== 'Account') return;
    const id = cleanField({ value: fields[3] ?? '' });
    if (id !== '' && !this.accounts.includes(id)) this.accounts.push(id);
  }

  /**
   * Stamps ADR dividends with the issuer country (art. 30a ust. 9 updof credits
   * tax by the treaty with the source state, which for an ADR is the issuer's
   * residence, not the US listing). Without a suffix the ISIN country stays and
   * the user is warned.
   */
  private stampAdrDividends(): void {
    const warned = new Set<string>();
    for (const div of this.dividends) {
      if (!this.adrSymbols.has(div.symbol)) continue;
      div.isAdr = true;
      const countries = this.whtCountriesBySymbol.get(div.symbol);
      if (countries?.size === 1) {
        if (div.kind !== 'payment-in-lieu') div.adrCountry = [...countries][0];
        continue;
      }
      if (warned.has(div.symbol)) continue;
      if (countries && countries.size > 1) {
        warned.add(div.symbol);
        this.addWarning({
          section: 'Dividends',
          message: `ADR ${div.symbol} has conflicting withholding countries (${[...countries].toSorted().join(', ')}) — set the issuer country on the country mapping page`,
        });
      } else if (this.whtSymbols.has(div.symbol)) {
        // Only warn when withholding exists: without it no credit depends on the country.
        warned.add(div.symbol);
        const isin = div.isin ?? this.symbolToIsin.get(div.symbol);
        this.addWarning({
          section: 'Dividends',
          message: `ADR detected for ${div.symbol}, country assumed ${isinToCountry({ isin })} from ISIN — set the issuer country on the country mapping page`,
        });
      }
    }
  }

  override finish(): ParsedStatement {
    this.stampAdrDividends();
    const fallback = this.defaultAccount();
    if (fallback) {
      let fallbackRows = 0;
      for (const row of [
        ...this.trades,
        ...this.carryInPositions,
        ...this.corporateActions,
      ]) {
        if (row.account === undefined) {
          row.account = fallback;
          fallbackRows++;
        }
      }
      if (this.accounts.length > 1 && fallbackRows > 0) {
        this.addWarning({
          section: 'Account Information',
          message: `Statement lists ${this.accounts.length} accounts; ${fallbackRows} rows have no per-row account and were attributed to the first one — check account assignment`,
        });
      }
    }
    return super.finish();
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
    if (
      this.rejectMissingColumns({
        section,
        required: ['Asset Category', 'Symbol'],
        fields,
        rawLine,
      })
    ) {
      return;
    }
    const ix = this.cols(section, {
      'Asset Category': 2,
      'Symbol': 3,
      'Security ID': 6,
    });
    if (this.field(fields, ix('Asset Category')) !== 'Stocks') return;

    // Only Stocks need an ISIN; other categories (e.g. Options) may lack it.
    if (
      this.rejectMissingColumns({
        section,
        required: ['Security ID'],
        fields,
        rawLine,
      })
    ) {
      return;
    }

    const symbol = this.field(fields, ix('Symbol'));
    const securityId = this.field(fields, ix('Security ID'));
    if (symbol && securityId) {
      this.symbolToIsin.set(symbol, securityId);
    }

    // Optional column: absent in older statements, which means "not an ADR".
    const typeIdx = this.col({ section, names: ['Type'], fallbackIdx: -1 });
    if (symbol && this.field(fields, typeIdx).toUpperCase() === 'ADR') {
      this.adrSymbols.add(symbol);
    }
  }

  private parseTrade(args: { fields: string[]; rawLine: string }): void {
    const { fields, rawLine } = args;
    const section = 'Trades';
    const commissionNames = ['Comm/Fee', 'Comm in USD'];
    if (
      this.rejectMissingColumns({
        section,
        required: [
          'DataDiscriminator',
          'Asset Category',
          'Date/Time',
          'Symbol',
          'Quantity',
          'T. Price',
          'Proceeds',
          commissionNames,
          'Currency',
        ],
        fields,
        rawLine,
      })
    ) {
      return;
    }
    const ix = this.cols(section, {
      'DataDiscriminator': 2,
      'Asset Category': 3,
      'Currency': 4,
      'Symbol': 5,
      'Date/Time': 6,
      'Quantity': 7,
      'T. Price': 8,
      'Proceeds': 10,
    });
    const commissionIdx = this.col({
      section,
      names: commissionNames,
      fallbackIdx: 11,
    });

    const discriminator = this.field(fields, ix('DataDiscriminator'));
    // Only process Order and Trade rows (Total rows are filtered upstream in processRow).
    if (discriminator !== 'Order' && discriminator !== 'Trade') return;

    const assetCategory = this.field(fields, ix('Asset Category'));
    if (assetCategory !== 'Stocks') return;

    try {
      const currency = this.field(fields, ix('Currency'));
      const symbol = this.field(fields, ix('Symbol'));
      const datetime = parseDateTime({
        value: this.field(fields, ix('Date/Time')),
      });
      const rawQuantity = this.num(fields, ix('Quantity'));
      const price = this.num(fields, ix('T. Price'));
      const rawProceeds = this.num(fields, ix('Proceeds'));
      const rawCommission = this.num(fields, commissionIdx);
      // "Comm in USD" is denominated in USD regardless of the trade currency.
      const commissionCurrency =
        this.headerFor(section)?.[commissionIdx] === 'Comm in USD'
          ? 'USD'
          : currency;

      if (!datetime || rawQuantity === undefined || price === undefined) {
        this.reportParseFailure({
          section,
          rawLine,
          message: `Could not parse trade row for ${symbol}: missing datetime, quantity, or price`,
          assetCategory,
          currency: currency || undefined,
          symbol: symbol || undefined,
          datetime: this.field(fields, ix('Date/Time')) || undefined,
          description: this.joinTail(fields, ix('Quantity')),
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
        commissionCurrency,
        type,
        account: this.rowAccount(section, fields),
      });
    } catch {
      this.reportParseFailure({
        section,
        rawLine,
        message: `Failed to parse trade row: ${rawLine}`,
        assetCategory,
        currency: this.field(fields, ix('Currency')) || undefined,
        symbol: this.field(fields, ix('Symbol')) || undefined,
        datetime: this.field(fields, ix('Date/Time')) || undefined,
        description: this.joinTail(fields, ix('Quantity')),
      });
    }
  }

  private parseDividend(args: { fields: string[]; rawLine: string }): void {
    this.parseCashRow({
      ...args,
      section: 'Dividends',
      rowLabel: 'dividend',
      push: (record) => this.dividends.push(record),
    });
  }

  private parseWithholdingTax(args: {
    fields: string[];
    rawLine: string;
  }): void {
    // Amount is negative in the CSV — keep as-is
    this.parseCashRow({
      ...args,
      section: 'Withholding Tax',
      rowLabel: 'withholding tax',
      push: (record) => this.withholdingTaxes.push(record),
    });
  }

  /** Shared parsing for Dividends and Withholding Tax rows (same layout). */
  private parseCashRow(args: {
    section: string;
    rowLabel: string;
    fields: string[];
    rawLine: string;
    push: (record: RawDividend & { taxCountry?: string }) => void;
  }): void {
    const { section, rowLabel, fields, rawLine, push } = args;
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
    const ix = this.cols(section, {
      Currency: 2,
      Date: 3,
      Description: 4,
      Amount: 5,
    });
    const currency = this.field(fields, ix('Currency'));
    const rawDate = this.field(fields, ix('Date'));
    const description = this.field(fields, ix('Description'));
    const match = SYMBOL_ISIN_RE.exec(description);
    const kind: PaymentKind = PAYMENT_IN_LIEU_RE.test(description)
      ? 'payment-in-lieu'
      : 'dividend';
    const taxCountry =
      section === 'Withholding Tax'
        ? WHT_COUNTRY_RE.exec(description)?.[1]
        : undefined;
    if (section === 'Withholding Tax' && match) {
      this.whtSymbols.add(match[1]);
      if (taxCountry && kind === 'dividend') {
        const countries =
          this.whtCountriesBySymbol.get(match[1]) ?? new Set<string>();
        countries.add(taxCountry);
        this.whtCountriesBySymbol.set(match[1], countries);
      }
    }
    const failure = {
      section,
      rawLine,
      currency: currency || undefined,
      symbol: match?.[1] ?? undefined,
      datetime: rawDate || undefined,
      description: description || undefined,
    };

    try {
      const date = parseDateTime({ value: rawDate });
      const amount = this.num(fields, ix('Amount'));

      if (!date || amount === undefined) {
        this.reportParseFailure({
          ...failure,
          message: `Could not parse ${rowLabel} row: missing date or amount`,
        });
        return;
      }

      push({
        symbol: match?.[1] ?? '',
        isin: match?.[2],
        currency,
        date,
        amount,
        kind,
        ...(taxCountry ? { taxCountry } : {}),
      });
    } catch {
      this.reportParseFailure({
        ...failure,
        message: `Failed to parse ${rowLabel} row: ${rawLine}`,
      });
    }
  }

  private parseCorporateAction(args: {
    fields: string[];
    rawLine: string;
  }): void {
    const { fields, rawLine } = args;
    const section = 'Corporate Actions';
    if (
      this.rejectMissingColumns({
        section,
        required: ['Date/Time', 'Description', 'Quantity', 'Proceeds', 'Value'],
        fields,
        rawLine,
      })
    ) {
      return;
    }
    const ix = this.cols(section, {
      'Asset Category': 2,
      'Currency': 3,
      'Date/Time': 5,
      'Description': 6,
      'Quantity': 7,
      'Proceeds': 8,
      'Value': 9,
    });
    const assetCategory = this.field(fields, ix('Asset Category'));
    const currencyIdx = ix('Currency');
    const datetimeIdx = ix('Date/Time');
    let description = '';

    try {
      const datetime = parseDateTime({
        value: cleanField({ value: fields[datetimeIdx] ?? '' }),
      });
      description = cleanField({ value: fields[ix('Description')] ?? '' });

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
          account: this.rowAccount(section, fields),
        });
        return;
      }

      const mergerMatch = MERGER_RE.exec(description);
      if (mergerMatch) {
        const quantity = parseDecimal({
          value: fields[ix('Quantity')] ?? '',
        });
        const targetIsin = mergerMatch[3];

        // IB produces two rows per merger: negative qty (source removed) and positive qty (target received).
        // Negative-qty row: create the corporate action.
        // Positive-qty row: extract new shares FMV (Value column) and attach to the last merger.
        if (quantity !== undefined && quantity >= 0) {
          const value = parseDecimal({ value: fields[ix('Value')] ?? '' });
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
          value: fields[ix('Proceeds')] ?? '',
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
          account: this.rowAccount(section, fields),
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
    if (
      this.rejectMissingColumns({
        section,
        required: ['Asset Category', 'Symbol', 'Prior Quantity'],
        fields,
        rawLine,
      })
    ) {
      return;
    }
    const ix = this.cols(section, {
      'Asset Category': 2,
      'Symbol': 3,
      'Prior Quantity': 4,
    });
    const symbolIdx = ix('Symbol');
    const priorQuantityIdx = ix('Prior Quantity');
    const assetCategory = this.field(fields, ix('Asset Category'));

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
        // 0 = statement year not known yet; resolved in finish().
        year: this.year > 0 ? this.year - 1 : 0,
        account: this.rowAccount(section, fields),
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
    const ix = this.cols(section, {
      Currency: 2,
      Date: 3,
      Description: 4,
      Amount: 5,
    });
    const currency = this.field(fields, ix('Currency'));
    const rawDate = this.field(fields, ix('Date'));
    const description = this.field(fields, ix('Description'));

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
      const amount = parseDecimal({ value: fields[ix('Amount')] ?? '' });

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
    if (
      this.rejectMissingColumns({
        section,
        required: ['Asset Category', 'Code', 'Fee'],
        fields,
        rawLine,
      })
    ) {
      return;
    }
    const ix = this.cols(section, {
      'Asset Category': 2,
      'Currency': 3,
      'Symbol': 4,
      'Date': 5,
      'Pay Date': 7,
      'Fee': 10,
      'Code': 14,
    });
    const assetCategory = this.field(fields, ix('Asset Category'));
    const currency = this.field(fields, ix('Currency'));
    const symbol = this.field(fields, ix('Symbol'));
    const rawDate = this.field(fields, ix('Date'));
    const rawPayDate = this.field(fields, ix('Pay Date'));
    const code = this.field(fields, ix('Code'));

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

    const fee = this.num(fields, ix('Fee'));
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
    const header = this.headerFor(section);

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
