import type {
  CarryInPosition,
  CorporateAction,
  ParsedStatement,
  ParseWarning,
  RawDividend,
  RawWithholdingTax,
  SkippedRowKind,
  Trade,
  TransactionFee,
} from '../types.js';
import { parseCsvLine } from './csv-utils.js';
import type { StatementParser } from './types.js';

/**
 * Abstract base class for CSV-based broker parsers.
 * Handles CSV splitting, row filtering (Header vs Data), state accumulation, and finish() assembly.
 * Subclasses implement processRow() for section-specific parsing and getBrokerId() for identity.
 */
export abstract class CsvStatementParser implements StatementParser {
  protected year = 0;
  protected trades: Trade[] = [];
  protected dividends: RawDividend[] = [];
  protected withholdingTaxes: RawWithholdingTax[] = [];
  protected corporateActions: CorporateAction[] = [];
  protected carryInPositions: CarryInPosition[] = [];
  protected transactionFees: TransactionFee[] = [];
  protected symbolToIsin = new Map<string, string>();
  protected warnings: ParseWarning[] = [];
  protected skippedRows: ParsedStatement['skippedRows'] = [];
  private lineNumber = 0;
  /**
   * Most recent Header row seen per section. Captured so subclasses can map
   * Data row columns by name (sections vary in column order — e.g. Trades has
   * `DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,...` while
   * Interest has `Currency,Date,Description,Amount`).
   */
  private sectionHeaders = new Map<string, string[]>();

  /** Returns the broker identifier string */
  protected abstract getBrokerId(): string;

  /**
   * Process a single data row. Called only for rows where column 2 is "Data".
   * @param args - The section name (column 1) and all CSV fields for this row
   */
  protected abstract processRow(args: {
    section: string;
    fields: string[];
    rawLine: string;
  }): void;

  /** Feed a single CSV line to the parser */
  feed(args: { line: string }): void {
    this.lineNumber++;
    const rawLine = args.line;

    // Skip empty lines
    if (rawLine.trim() === '') return;

    const fields = parseCsvLine({ line: rawLine });
    if (fields.length < 2) return;

    const section = fields[0];
    const rowType = fields[1];

    // Capture headers per section so subclasses can do name-based column lookup.
    if (rowType === 'Header') {
      this.sectionHeaders.set(section, fields);
      return;
    }

    // Only process Data rows — skip SubTotal, Total rows
    if (rowType !== 'Data') return;

    this.processRow({ section, fields, rawLine });
  }

  /** Returns the most recent Header row recorded for a section, if any. */
  protected getSectionHeader(section: string): string[] | undefined {
    return this.sectionHeaders.get(section);
  }

  /** Assemble the final ParsedStatement from accumulated state */
  finish(): ParsedStatement {
    // Backfill ISINs on trades, dividends, and withholding taxes from the
    // symbolToIsin map. The Financial Instrument Information section may
    // appear AFTER other sections in the CSV, so ISINs might be missing
    // at parse time but available now.
    for (const t of this.trades) {
      t.isin ??= this.symbolToIsin.get(t.symbol);
    }
    for (const d of this.dividends) {
      d.isin ??= this.symbolToIsin.get(d.symbol);
    }
    for (const w of this.withholdingTaxes) {
      w.isin ??= this.symbolToIsin.get(w.symbol);
    }
    for (const ca of this.corporateActions) {
      ca.isin ??= this.symbolToIsin.get(ca.symbol);
    }

    // Year inference fallback — max year from all parsed dates
    if (this.year === 0) {
      const allDates = [
        ...this.trades.map((t) => t.datetime),
        ...this.dividends.map((d) => d.date),
        ...this.withholdingTaxes.map((w) => w.date),
      ];
      for (const d of allDates) {
        const y = d.getFullYear();
        if (y > this.year) this.year = y;
      }
    }

    return {
      broker: this.getBrokerId(),
      year: this.year,
      trades: this.trades,
      dividends: this.dividends,
      withholdingTaxes: this.withholdingTaxes,
      corporateActions: this.corporateActions,
      carryInPositions: this.carryInPositions,
      transactionFees: this.transactionFees,
      symbolToIsin: this.symbolToIsin,
      warnings: this.warnings,
      skippedRows: this.skippedRows,
    };
  }

  /** Add a non-fatal warning */
  protected addWarning(args: { section: string; message: string }): void {
    this.warnings.push({
      line: this.lineNumber,
      section: args.section,
      message: args.message,
    });
  }

  /** Add a skipped row for post-import inspection. */
  protected addSkippedRow(args: {
    section: string;
    kind: SkippedRowKind;
    rawLine: string;
    assetCategory?: string;
    currency?: string;
    symbol?: string;
    datetime?: string;
    description?: string;
  }): void {
    this.skippedRows.push({
      line: this.lineNumber,
      section: args.section,
      kind: args.kind,
      rawLine: args.rawLine,
      assetCategory: args.assetCategory,
      currency: args.currency,
      symbol: args.symbol,
      datetime: args.datetime,
      description: args.description,
    });
  }
}
