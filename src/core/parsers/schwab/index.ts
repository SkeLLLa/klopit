import {
  BrokerId,
  type ParsedStatement,
  type ParseWarning,
  type RawDividend,
  type RawWithholdingTax,
  type Trade,
} from '../../types.js';
import { cleanField, parseCsvLine } from '../shared/csv-utils.js';
import type { CsvParserDefinition, StatementParser } from '../types.js';

function parseUsDate(value: string): Date | undefined {
  const trimmed = cleanField({ value });
  if (trimmed === '') return undefined;

  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) return undefined;

  const [, month, day, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseMoney(value: string): number | undefined {
  const trimmed = cleanField({ value });
  if (trimmed === '') return undefined;

  const isNegative =
    trimmed.startsWith('-') ||
    (trimmed.startsWith('(') && trimmed.endsWith(')'));
  const normalized = trimmed.replace(/[$,()]/g, '').replace(/^\+/, '');
  const absolute = normalized.startsWith('-')
    ? normalized.slice(1)
    : normalized;
  const parsed = Number(absolute);
  if (Number.isNaN(parsed)) return undefined;

  return isNegative ? -parsed : parsed;
}

function firstDefined(...values: (number | undefined)[]): number | undefined {
  return values.find((value) => value !== undefined);
}

class SchwabParser implements StatementParser {
  private readonly trades: Trade[] = [];
  private readonly dividends: RawDividend[] = [];
  private readonly withholdingTaxes: RawWithholdingTax[] = [];
  private readonly warnings: ParseWarning[] = [];
  private readonly symbolToIsin = new Map<string, string>();
  private header: string[] | null = null;
  private pendingFields: string[] | null = null;
  private pendingStartLine = 0;
  private lineNumber = 0;
  private year = 0;

  feed(args: { line: string }): void {
    this.lineNumber++;

    if (args.line.trim() === '') return;

    const fields = parseCsvLine({ line: args.line });
    if (fields.length === 0) return;

    if (!this.header) {
      this.header = fields.map((field) => cleanField({ value: field }));
      return;
    }

    if (this.isContinuationRow(fields)) {
      if (!this.pendingFields) {
        this.addWarning({
          section: 'Schwab',
          line: this.lineNumber,
          message: 'Found continuation row without a preceding primary row',
        });
        return;
      }

      this.pendingFields = this.pendingFields.map((field, index) =>
        cleanField({ value: field }) !== '' ? field : (fields[index] ?? ''),
      );
      return;
    }

    if (this.pendingFields) {
      this.flushPendingRow();
    }

    this.pendingFields = fields;
    this.pendingStartLine = this.lineNumber;
  }

  finish(): ParsedStatement {
    if (this.pendingFields) {
      this.flushPendingRow();
    }

    if (this.year === 0) {
      for (const trade of this.trades) {
        const tradeYear = trade.datetime.getFullYear();
        if (tradeYear > this.year) this.year = tradeYear;
      }
    }

    return {
      broker: 'schwab',
      year: this.year,
      trades: this.trades,
      dividends: this.dividends,
      withholdingTaxes: this.withholdingTaxes,
      corporateActions: [],
      carryInPositions: [],
      transactionFees: [],
      creditInterests: [],
      symbolToIsin: this.symbolToIsin,
      warnings: this.warnings,
      skippedRows: [],
    };
  }

  private isContinuationRow(fields: string[]): boolean {
    return [0, 1, 2, 3].every(
      (index) => cleanField({ value: fields[index] ?? '' }) === '',
    );
  }

  private flushPendingRow(): void {
    const fields = this.pendingFields;
    const line = this.pendingStartLine;

    this.pendingFields = null;
    this.pendingStartLine = 0;

    if (!fields || !this.header) return;

    const row = new Map<string, string>();
    for (let i = 0; i < this.header.length; i++) {
      row.set(this.header[i], cleanField({ value: fields[i] ?? '' }));
    }

    const action = row.get('Action') ?? '';
    switch (action) {
      case 'Deposit':
        this.parseDeposit({ row, line });
        break;
      case 'Lapse':
        this.parseLapse({ row, line });
        break;
      case 'Sale':
        this.parseSale({ row, line });
        break;
      case 'Wire Transfer':
      case 'Stock Plan Activity':
        break;
      case '':
        break;
      default:
        this.addWarning({
          section: 'Schwab',
          line,
          message: `Unsupported Schwab action: ${action}`,
        });
    }
  }

  private parseDeposit(args: { row: Map<string, string>; line: number }): void {
    const quantity = parseMoney(args.row.get('Quantity') ?? '');
    const price = firstDefined(
      parseMoney(args.row.get('PurchasePrice') ?? ''),
      parseMoney(args.row.get('FairMarketValuePrice') ?? ''),
    );
    const datetime =
      parseUsDate(args.row.get('PurchaseDate') ?? '') ??
      parseUsDate(args.row.get('Date') ?? '');
    const symbol = args.row.get('Symbol') ?? '';

    if (!symbol || !datetime || quantity === undefined || price === undefined) {
      this.addWarning({
        section: 'Schwab',
        line: args.line,
        message: `Could not parse Schwab deposit row for ${symbol || 'unknown symbol'}`,
      });
      return;
    }

    this.pushTrade({
      symbol,
      datetime,
      quantity,
      price,
      commission: Math.abs(
        parseMoney(args.row.get('FeesAndCommissions') ?? '') ?? 0,
      ),
      type: 'buy',
    });
  }

  private parseLapse(args: { row: Map<string, string>; line: number }): void {
    const quantity = firstDefined(
      parseMoney(args.row.get('NetSharesDeposited') ?? ''),
      parseMoney(args.row.get('Quantity') ?? ''),
    );
    const price = firstDefined(
      parseMoney(args.row.get('FairMarketValuePrice') ?? ''),
      parseMoney(args.row.get('VestFairMarketValue') ?? ''),
    );
    const datetime =
      parseUsDate(args.row.get('VestDate') ?? '') ??
      parseUsDate(args.row.get('Date') ?? '');
    const symbol = args.row.get('Symbol') ?? '';

    if (!symbol || !datetime || quantity === undefined || price === undefined) {
      this.addWarning({
        section: 'Schwab',
        line: args.line,
        message: `Could not parse Schwab lapse row for ${symbol || 'unknown symbol'}`,
      });
      return;
    }

    this.pushTrade({
      symbol,
      datetime,
      quantity,
      price,
      commission: Math.abs(
        parseMoney(args.row.get('FeesAndCommissions') ?? '') ?? 0,
      ),
      type: 'buy',
    });
  }

  private parseSale(args: { row: Map<string, string>; line: number }): void {
    const quantity = firstDefined(
      parseMoney(args.row.get('Quantity') ?? ''),
      parseMoney(args.row.get('Shares') ?? ''),
    );
    const commission = Math.abs(
      parseMoney(args.row.get('FeesAndCommissions') ?? '') ?? 0,
    );
    const salePrice = parseMoney(args.row.get('SalePrice') ?? '');
    const amount = parseMoney(args.row.get('Amount') ?? '');
    const proceeds = firstDefined(
      parseMoney(args.row.get('GrossProceeds') ?? ''),
      salePrice !== undefined && quantity !== undefined
        ? salePrice * quantity
        : undefined,
      amount !== undefined ? Math.abs(amount) + commission : undefined,
    );
    const price =
      salePrice ??
      (proceeds !== undefined && quantity !== undefined && quantity !== 0
        ? proceeds / quantity
        : undefined);
    const datetime = parseUsDate(args.row.get('Date') ?? '');
    const symbol = args.row.get('Symbol') ?? '';

    if (
      !symbol ||
      !datetime ||
      quantity === undefined ||
      price === undefined ||
      proceeds === undefined
    ) {
      this.addWarning({
        section: 'Schwab',
        line: args.line,
        message: `Could not parse Schwab sale row for ${symbol || 'unknown symbol'}`,
      });
      return;
    }

    this.pushTrade({
      symbol,
      datetime,
      quantity,
      price,
      proceeds,
      commission,
      type: 'sell',
    });
  }

  private pushTrade(args: {
    symbol: string;
    datetime: Date;
    quantity: number;
    price: number;
    commission: number;
    type: 'buy' | 'sell';
    proceeds?: number;
  }): void {
    this.trades.push({
      symbol: args.symbol,
      currency: 'USD',
      datetime: args.datetime,
      quantity: Math.abs(args.quantity),
      price: args.price,
      proceeds: Math.abs(args.proceeds ?? args.price * args.quantity),
      commission: Math.abs(args.commission),
      commissionCurrency: 'USD',
      type: args.type,
    });

    const tradeYear = args.datetime.getFullYear();
    if (tradeYear > this.year) this.year = tradeYear;
  }

  private addWarning(args: {
    section: string;
    line: number;
    message: string;
  }): void {
    this.warnings.push({
      line: args.line,
      section: args.section,
      message: args.message,
    });
  }
}

export const schwabDefinition: CsvParserDefinition = {
  kind: 'csv',
  brokerId: BrokerId.Schwab,
  brokerName: 'Charles Schwab',
  fileExtensions: ['.csv'],
  createParser(): StatementParser {
    return new SchwabParser();
  },
};
