import type {
  CarryInPosition,
  CorporateAction,
  ParsedStatement,
  ParseWarning,
  RawDividend,
  RawWithholdingTax,
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
  private lineNumber = 0;

  /** Returns the broker identifier string */
  protected abstract getBrokerId(): string;

  /**
   * Process a single data row. Called only for rows where column 2 is "Data".
   * @param args - The section name (column 1) and all CSV fields for this row
   */
  protected abstract processRow(args: {
    section: string;
    fields: string[];
  }): void;

  /** Feed a single CSV line to the parser */
  feed(args: { line: string }): void {
    this.lineNumber++;
    const { line } = args;

    // Skip empty lines
    if (line.trim() === '') return;

    const fields = parseCsvLine({ line });
    if (fields.length < 2) return;

    const section = fields[0];
    const rowType = fields[1];

    // Only process Data rows — skip Header, SubTotal, Total rows
    if (rowType !== 'Data') return;

    this.processRow({ section, fields });
  }

  /** Assemble the final ParsedStatement from accumulated state */
  finish(): ParsedStatement {
    // Backfill ISINs on trades, dividends, and withholding taxes from the
    // symbolToIsin map. The Financial Instrument Information section may
    // appear AFTER other sections in the CSV, so ISINs might be missing
    // at parse time but available now.
    for (const t of this.trades) {
      if (!t.isin) t.isin = this.symbolToIsin.get(t.symbol);
    }
    for (const d of this.dividends) {
      if (!d.isin) d.isin = this.symbolToIsin.get(d.symbol);
    }
    for (const w of this.withholdingTaxes) {
      if (!w.isin) w.isin = this.symbolToIsin.get(w.symbol);
    }
    for (const ca of this.corporateActions) {
      if (!ca.isin) ca.isin = this.symbolToIsin.get(ca.symbol);
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
}
