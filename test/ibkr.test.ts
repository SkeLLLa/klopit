import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ibkrDefinition } from '../src/core/parsers/ibkr/index.js';
import { calculateCapitalGains } from '../src/core/tax/capital-gains.js';

const fixturesDir = join(import.meta.dirname, 'fixtures', 'ib');

function parseFixture(filename: string) {
  const text = readFileSync(join(fixturesDir, filename), 'utf-8');
  const parser = ibkrDefinition.createParser();
  for (const line of text.split('\n')) {
    parser.feed({ line });
  }
  return parser.finish();
}

function parseLines(lines: string[]) {
  const parser = ibkrDefinition.createParser();
  for (const line of lines) parser.feed({ line });
  return parser.finish();
}

function enrich(statement: ReturnType<typeof parseLines>) {
  return statement.trades.map((t) => ({
    ...t,
    exchangeRate: 4,
    commissionExchangeRate: 4,
    rateUnavailable: false,
  }));
}

function enrichCarryIns(statement: ReturnType<typeof parseLines>) {
  return statement.carryInPositions.map((p) => ({
    ...p,
    costPln: 0,
    rateUnavailable: false,
    costMissing: true,
  }));
}

void describe('InteractiveBrokersParser', () => {
  void describe('Statement year extraction', () => {
    void it('extracts year from Period field', () => {
      const result = parseFixture('trades-basic.csv');
      assert.equal(result.year, 2024);
    });
  });

  void describe('Financial Instrument Information', () => {
    void it('builds symbol to ISIN map for Stocks only', () => {
      const result = parseFixture('financial-instruments.csv');
      assert.equal(result.symbolToIsin.size, 3);
      assert.equal(result.symbolToIsin.get('AAPL'), 'US0378331005');
      assert.equal(result.symbolToIsin.get('MSFT'), 'US5949181045');
      assert.equal(result.symbolToIsin.get('TSLA'), 'US88160R1014');
      // Bonds should be excluded
      assert.equal(result.symbolToIsin.has('SP 0 08/15/53'), false);
    });
  });

  void describe('Trades', () => {
    void it('parses buy and sell trades', () => {
      const result = parseFixture('trades-basic.csv');
      assert.equal(result.trades.length, 5);
    });

    void it('correctly identifies buy trades (positive quantity)', () => {
      const result = parseFixture('trades-basic.csv');
      const buys = result.trades.filter((t) => t.type === 'buy');
      assert.equal(buys.length, 3);
    });

    void it('correctly identifies sell trades (negative quantity)', () => {
      const result = parseFixture('trades-basic.csv');
      const sells = result.trades.filter((t) => t.type === 'sell');
      assert.equal(sells.length, 2);
    });

    void it('normalizes quantity and proceeds to absolute values', () => {
      const result = parseFixture('trades-basic.csv');
      for (const trade of result.trades) {
        assert.ok(
          trade.quantity > 0,
          `quantity should be positive: ${String(trade.quantity)}`,
        );
        assert.ok(
          trade.proceeds >= 0,
          `proceeds should be non-negative: ${String(trade.proceeds)}`,
        );
      }
    });

    void it('skips SubTotal and Total rows', () => {
      const result = parseFixture('trades-basic.csv');
      assert.equal(result.trades.length, 5);
    });

    void it('parses trade datetime correctly', () => {
      const result = parseFixture('trades-basic.csv');
      const first = result.trades[0];
      assert.equal(first.datetime.getFullYear(), 2024);
      assert.equal(first.datetime.getMonth(), 2); // March
      assert.equal(first.datetime.getDate(), 15);
      assert.equal(first.datetime.getHours(), 10);
      assert.equal(first.datetime.getMinutes(), 30);
    });

    void it('populates ISIN from symbol map', () => {
      const result = parseFixture('trades-basic.csv');
      const aaplTrade = result.trades.find((t) => t.symbol === 'AAPL');
      assert.equal(aaplTrade?.isin, 'US0378331005');
    });

    void it('parses commission as absolute value', () => {
      const result = parseFixture('trades-basic.csv');
      for (const trade of result.trades) {
        assert.ok(
          trade.commission >= 0,
          `commission should be non-negative: ${String(trade.commission)}`,
        );
      }
    });
  });

  void describe('Dividends', () => {
    void it('parses dividend entries', () => {
      const result = parseFixture('dividends.csv');
      assert.equal(result.dividends.length, 4);
    });

    void it('extracts symbol and ISIN from description via regex', () => {
      const result = parseFixture('dividends.csv');
      const aaplDiv = result.dividends.find((d) => d.symbol === 'AAPL');
      assert.ok(aaplDiv);
      assert.equal(aaplDiv.isin, 'US0378331005');
    });

    void it('parses dividend amounts correctly', () => {
      const result = parseFixture('dividends.csv');
      const first = result.dividends[0];
      assert.equal(first.amount, 2.4);
    });

    void it('skips Total rows', () => {
      const result = parseFixture('dividends.csv');
      assert.equal(result.dividends.length, 4);
    });
  });

  void describe('Withholding Tax', () => {
    void it('parses withholding tax entries', () => {
      const result = parseFixture('dividends.csv');
      assert.equal(result.withholdingTaxes.length, 4);
    });

    void it('stores negative amounts as-is from CSV', () => {
      const result = parseFixture('dividends.csv');
      for (const wt of result.withholdingTaxes) {
        assert.ok(
          wt.amount < 0,
          `withholding tax should be negative: ${String(wt.amount)}`,
        );
      }
    });

    void it('extracts symbol and ISIN from description', () => {
      const result = parseFixture('dividends.csv');
      const msftTax = result.withholdingTaxes.find((w) => w.symbol === 'MSFT');
      assert.ok(msftTax);
      assert.equal(msftTax.isin, 'US5949181045');
    });

    void it('keeps signs of dividend reversals and WHT refunds unchanged', () => {
      const result = parseFixture('dividend-reversal.csv');
      assert.deepEqual(
        result.dividends.map((d) => d.amount),
        [100, -100, 100],
      );
      assert.deepEqual(
        result.withholdingTaxes.map((w) => w.amount),
        [-15, 15, -15],
      );
    });
  });

  void describe('Interest', () => {
    void it('parses only positive credit-interest rows', () => {
      const result = parseFixture('interest.csv');
      assert.equal(result.creditInterests.length, 3);
      assert.deepEqual(
        result.creditInterests.map((row) => row.description),
        [
          'USD Credit Interest for Dec-2024',
          'USD Credit Interest for Jan-2025',
          'EUR Credit Interest for Apr-2025',
        ],
      );
      assert.ok(result.creditInterests.every((row) => row.amount > 0));
    });

    void it('captures broker country from BrokerName', () => {
      const result = parseFixture('interest.csv');
      assert.equal(result.brokerCountry, 'US');
    });

    void it('skips Purchase Accrued Interest as known unsupported', () => {
      const result = parseFixture('interest.csv');
      const skipped = result.skippedRows.find(
        (row) =>
          row.section === 'Interest' &&
          row.description === 'Purchase Accrued Interest ROMANI 3 3/8 01/28/50',
      );
      assert.ok(skipped);
      assert.equal(skipped.kind, 'known-unsupported');
      assert.equal(skipped.currency, 'EUR');
      assert.equal(skipped.datetime, '2025-05-21');
    });

    void it('records Debit Interest as known-unsupported skipped row', () => {
      const result = parseFixture('interest.csv');
      const debitRow = result.skippedRows.find(
        (row) =>
          row.section === 'Interest' &&
          row.description?.includes('Debit Interest'),
      );
      assert.ok(debitRow, 'Debit Interest row should appear in skippedRows');
      assert.equal(debitRow.kind, 'known-unsupported');
    });
  });

  void describe('Corporate Actions', () => {
    void it('parses forward split', () => {
      const result = parseFixture('corporate-actions.csv');
      const splits = result.corporateActions.filter(
        (ca) => ca.type === 'stock-split',
      );
      assert.ok(splits.length >= 1);
      const nvdaSplit = splits.find((s) => s.symbol === 'NVDA');
      assert.ok(nvdaSplit);
      assert.equal(nvdaSplit.numerator, 10);
      assert.equal(nvdaSplit.denominator, 1);
    });

    void it('parses reverse split', () => {
      const result = parseFixture('corporate-actions.csv');
      const tslaSplit = result.corporateActions.find(
        (ca) => ca.symbol === 'TSLA',
      );
      assert.ok(tslaSplit);
      assert.equal(tslaSplit.numerator, 1);
      assert.equal(tslaSplit.denominator, 3);
    });

    void it('parses cash-and-stock merger', () => {
      const result = parseFixture('corporate-actions.csv');
      const merger = result.corporateActions.find((ca) => ca.type === 'merger');
      assert.ok(merger, 'should find a merger corporate action');
      assert.equal(merger.symbol, 'MAG');
      assert.equal(merger.isin, 'CA55903Q1046');
      assert.equal(merger.targetIsin, 'CA6979001089');
      assert.equal(merger.targetSymbol, 'PAAS');
      assert.equal(merger.numerator, 58844257);
      assert.equal(merger.denominator, 100000000);
      assert.ok(
        Math.abs((merger.conversionRatio ?? 0) - 0.58844257) < 0.0001,
        'conversion ratio should be ~0.5884',
      );
      assert.equal(merger.cashPerShare, 4.52847757);
      assert.equal(merger.cashCurrency, 'USD');
    });

    void it('creates only one corporate action per merger (skips positive-qty row)', () => {
      const result = parseFixture('corporate-actions.csv');
      const mergers = result.corporateActions.filter(
        (ca) => ca.type === 'merger',
      );
      assert.equal(mergers.length, 1, 'should have exactly 1 merger, not 2');
    });

    void it('does not warn for recognized merger rows', () => {
      const result = parseFixture('corporate-actions.csv');
      const mergerWarnings = result.warnings.filter(
        (w) =>
          w.section === 'Corporate Actions' &&
          w.message.includes('Cash and Stock Merger'),
      );
      assert.equal(
        mergerWarnings.length,
        0,
        'should not warn for parsed merger rows',
      );
    });
  });

  void describe('Carry-in positions (MTM)', () => {
    void it('extracts positions with prior quantity > 0', () => {
      const result = parseFixture('carry-in.csv');
      assert.equal(result.carryInPositions.length, 2);
    });

    void it('includes AAPL and MSFT but not TSLA (prior qty 0)', () => {
      const result = parseFixture('carry-in.csv');
      const symbols = new Set(result.carryInPositions.map((p) => p.symbol));
      assert.ok(symbols.has('AAPL'));
      assert.ok(symbols.has('MSFT'));
      assert.ok(!symbols.has('TSLA'));
    });

    void it('parses prior quantity correctly', () => {
      const result = parseFixture('carry-in.csv');
      const aapl = result.carryInPositions.find((p) => p.symbol === 'AAPL');
      assert.equal(aapl?.quantity, 25);
    });
  });

  void describe('Edge cases', () => {
    void it('returns empty results for file with no data rows', () => {
      const result = parseFixture('empty-sections.csv');
      assert.equal(result.trades.length, 0);
      assert.equal(result.dividends.length, 0);
      assert.equal(result.creditInterests.length, 0);
      assert.equal(result.year, 2024);
    });

    void it('collects warnings for malformed rows', () => {
      const result = parseFixture('malformed-rows.csv');
      assert.ok(result.warnings.length > 0);
      assert.ok(result.skippedRows.length > 0);
      assert.ok(result.trades.length >= 1);
    });

    void it('extracts skipped row fields by header column name (Trades-like layout)', () => {
      const parser = ibkrDefinition.createParser();
      for (const line of [
        'Statement,Header,Field Name,Field Value',
        'Statement,Data,Period,"January 1, 2025 - December 31, 2025"',
        'Transaction Fees,Header,Asset Category,Currency,Date/Time,Symbol,Description,Quantity,Trade Price,Amount,Code',
        'Transaction Fees,Data,Stocks,EUR,"2025-06-05, 20:20:00",ALO,French Daily Trade Charge Tax,40,19.29,-3.09,',
      ]) {
        parser.feed({ line });
      }
      const result = parser.finish();
      const row = result.skippedRows.find(
        (r) => r.section === 'Transaction Fees',
      );
      assert.ok(row, 'expected a Transaction Fees skipped row');
      assert.equal(row.assetCategory, 'Stocks');
      assert.equal(row.currency, 'EUR');
      assert.equal(row.symbol, 'ALO');
      assert.equal(row.datetime, '2025-06-05, 20:20:00');
      assert.equal(row.description, 'French Daily Trade Charge Tax');
    });

    void it('extracts skipped row fields by header column name (Interest layout)', () => {
      const parser = ibkrDefinition.createParser();
      for (const line of [
        'Statement,Header,Field Name,Field Value',
        'Statement,Data,Period,"January 1, 2025 - December 31, 2025"',
        'Interest,Header,Currency,Date,Description,Amount',
        'Interest,Data,EUR,2025-05-21,Purchase Accrued Interest ROMANI 3 3/8 01/28/50,-42.53',
      ]) {
        parser.feed({ line });
      }
      const result = parser.finish();
      const row = result.skippedRows.find((r) => r.section === 'Interest');
      assert.ok(row, 'expected an Interest skipped row');
      assert.equal(row.assetCategory, undefined);
      assert.equal(row.symbol, undefined);
      assert.equal(row.currency, 'EUR');
      assert.equal(row.datetime, '2025-05-21');
      assert.equal(
        row.description,
        'Purchase Accrued Interest ROMANI 3 3/8 01/28/50',
      );
    });

    void it('parses ADR/GDR fee accrual rows as transaction fees', () => {
      const result = parseFixture('adr-fees.csv');
      const rows = result.transactionFees.filter(
        (row) => row.description === 'ADR/GDR Fee Accrual',
      );

      assert.equal(rows.length, 2);
      assert.deepEqual(
        rows.map((row) => ({
          symbol: row.symbol,
          amount: row.amount,
          day: row.datetime.getDate(),
          isin: row.isin,
        })),
        [
          { symbol: 'MHPC', amount: 4, day: 22, isin: 'US55302T2042' },
          { symbol: 'BP', amount: 2.5, day: 15, isin: 'US0556221044' },
        ],
      );
      assert.equal(
        result.skippedRows.filter(
          (row) => row.section === 'Change in Dividend Accruals',
        ).length,
        0,
      );
    });

    void it('keeps non-ADR dividend accrual rows visible as not-yet-supported', () => {
      const parser = ibkrDefinition.createParser();
      for (const line of [
        'Statement,Header,Field Name,Field Value',
        'Statement,Data,Period,"January 1, 2025 - December 31, 2025"',
        'Change in Dividend Accruals,Header,Asset Category,Currency,Symbol,Date,Ex Date,Pay Date,Quantity,Tax,Fee,Gross Rate,Gross Amount,Net Amount,Code',
        'Change in Dividend Accruals,Data,Stocks,USD,BP,2025-03-10,2025-02-20,2025-03-15,100,0,0,0.42,42,42,Re',
      ]) {
        parser.feed({ line });
      }
      const result = parser.finish();
      const rows = result.skippedRows.filter(
        (row) => row.section === 'Change in Dividend Accruals',
      );

      assert.equal(rows.length, 1);
      assert.ok(rows.every((row) => row.kind === 'known-unsupported'));
    });

    void it('ignores unknown sections silently', () => {
      const result = parseFixture('full-statement.csv');
      assert.equal(
        result.warnings.filter((w) => w.section === 'Account Information')
          .length,
        0,
      );
      assert.equal(
        result.skippedRows.filter(
          (row) => row.section === 'Account Information',
        ).length,
        0,
      );
    });
  });

  void describe('Full statement integration', () => {
    void it('parses complete statement correctly', () => {
      const result = parseFixture('full-statement.csv');
      assert.equal(result.broker, 'ibkr');
      assert.equal(result.year, 2024);
      assert.equal(result.trades.length, 5);
      assert.equal(result.dividends.length, 3);
      assert.equal(result.withholdingTaxes.length, 3);
      assert.equal(result.creditInterests.length, 0);
      assert.equal(result.corporateActions.length, 1);
      assert.equal(result.symbolToIsin.size, 3);
      assert.ok(result.carryInPositions.length >= 1);
      assert.equal(result.skippedRows.length, 0);
    });
  });

  void describe('ISIN backfill', () => {
    void it('backfills ISINs on trades when FII section comes after Trades', () => {
      const parser = ibkrDefinition.createParser();
      // Feed statement period first
      parser.feed({
        line: 'Statement,Data,Period,"January 1, 2024 - December 31, 2024"',
      });
      // Feed a trade BEFORE Financial Instrument Information
      parser.feed({
        line: 'Trades,Data,Order,Stocks,USD,AAPL,"2024-03-15, 10:30:00",10,175.50,175.50,0,-1.00,0,0,0,O',
      });
      // Feed FII AFTER the trade
      parser.feed({
        line: 'Financial Instrument Information,Data,Stocks,AAPL,APPLE INC,265598,US0378331005,AAPL,NASDAQ,1,COMMON,',
      });
      const result = parser.finish();
      assert.equal(
        result.trades[0].isin,
        'US0378331005',
        'Trade ISIN should be backfilled from FII section',
      );
    });

    void it('backfills ISINs on dividends when FII section comes after Dividends', () => {
      const parser = ibkrDefinition.createParser();
      parser.feed({
        line: 'Statement,Data,Period,"January 1, 2024 - December 31, 2024"',
      });
      // Feed a dividend BEFORE FII — uses ISIN from description regex
      parser.feed({
        line: 'Dividends,Data,USD,2024-06-15,AAPL(US0378331005) Cash Dividend USD 0.25 per Share (Ordinary Dividend),2.50',
      });
      // Feed FII AFTER
      parser.feed({
        line: 'Financial Instrument Information,Data,Stocks,AAPL,APPLE INC,265598,US0378331005,AAPL,NASDAQ,1,COMMON,',
      });
      const result = parser.finish();
      assert.equal(result.dividends[0].isin, 'US0378331005');
    });

    void it('backfills ISIN on carry-in positions from FII', () => {
      const parser = ibkrDefinition.createParser();
      parser.feed({
        line: 'Statement,Data,Period,"January 1, 2024 - December 31, 2024"',
      });
      parser.feed({
        line: 'Mark-to-Market Performance Summary,Data,Stocks,AAPL,25,30,175.50,195.20,492.50,0,-1.00,0,491.50,',
      });
      parser.feed({
        line: 'Financial Instrument Information,Data,Stocks,AAPL,APPLE INC,265598,US0378331005,AAPL,NASDAQ,1,COMMON,',
      });
      const result = parser.finish();
      assert.equal(result.carryInPositions[0].isin, 'US0378331005');
    });
  });

  void describe('Header-based column resolution', () => {
    const stmt = [
      'Statement,Data,Period,"January 1, 2024 - December 31, 2024"',
      'Financial Instrument Information,Header,Asset Category,Symbol,Description,Conid,Security ID,Underlying,Listing Exch,Multiplier,Type,Code',
      'Financial Instrument Information,Data,Stocks,AAPL,APPLE INC,265598,US0378331005,AAPL,NASDAQ,1,COMMON,',
    ];
    const standard = [
      ...stmt,
      'Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee,Basis',
      'Trades,Data,Order,Stocks,USD,AAPL,"2024-06-20, 14:15:00",-8,195.20,195.20,1561.60,-1.00,0',
    ];

    void it('produces identical results for shuffled columns', () => {
      const shuffled = [
        ...stmt,
        'Trades,Header,Comm/Fee,Proceeds,Symbol,Asset Category,Quantity,DataDiscriminator,T. Price,Date/Time,Currency',
        'Trades,Data,-1.00,1561.60,AAPL,Stocks,-8,Order,195.20,"2024-06-20, 14:15:00",USD',
      ];
      const a = parseLines(standard);
      const b = parseLines(shuffled);
      assert.equal(b.trades.length, 1);
      assert.deepEqual(b.trades, a.trades);
      assert.equal(b.warnings.length, 0);
    });

    void it('handles an extra Account column', () => {
      const result = parseLines([
        ...stmt,
        'Trades,Header,DataDiscriminator,Asset Category,Currency,Account,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee',
        'Trades,Data,Order,Stocks,USD,U123,AAPL,"2024-06-20, 14:15:00",-8,195.20,195.20,1561.60,-1.00',
      ]);
      assert.equal(result.trades.length, 1);
      assert.equal(result.trades[0].symbol, 'AAPL');
      assert.equal(result.trades[0].proceeds, 1561.6);
      assert.equal(result.trades[0].commission, 1);
    });

    void it('accepts the Comm in USD alias', () => {
      const result = parseLines([
        ...stmt,
        'Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm in USD',
        'Trades,Data,Order,Stocks,USD,AAPL,"2024-06-20, 14:15:00",-8,195.20,195.20,1561.60,-2.50',
      ]);
      assert.equal(result.trades.length, 1);
      assert.equal(result.trades[0].commission, 2.5);
    });

    void it('fails loudly when a required column is missing', () => {
      const result = parseLines([
        ...stmt,
        'Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Comm/Fee',
        'Trades,Data,Order,Stocks,USD,AAPL,"2024-06-20, 14:15:00",-8,195.20,195.20,-1.00',
        'Trades,Data,Order,Stocks,USD,AAPL,"2024-06-21, 14:15:00",-2,195.20,195.20,-1.00',
      ]);
      assert.equal(result.trades.length, 0);
      assert.equal(result.warnings.length, 1);
      assert.match(result.warnings[0].message, /Proceeds/);
      const failures = result.skippedRows.filter(
        (r) => r.kind === 'parse-failure' && r.section === 'Trades',
      );
      assert.equal(failures.length, 2);
    });

    void it('rejects trades when Comm/Fee is missing', () => {
      const result = parseLines([
        ...stmt,
        'Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds',
        'Trades,Data,Order,Stocks,USD,AAPL,"2024-06-20, 14:15:00",-8,195.20,195.20,1561.60',
      ]);
      assert.equal(result.trades.length, 0);
      assert.equal(result.warnings.length, 1);
      assert.match(result.warnings[0].message, /Comm\/Fee\/Comm in USD/);
      assert.equal(
        result.skippedRows.filter((r) => r.kind === 'parse-failure').length,
        1,
      );
    });

    void it('rejects trades when DataDiscriminator is missing', () => {
      const result = parseLines([
        ...stmt,
        'Trades,Header,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee',
        'Trades,Data,Stocks,USD,AAPL,"2024-06-20, 14:15:00",-8,195.20,195.20,1561.60,-1.00',
      ]);
      assert.equal(result.trades.length, 0);
      assert.match(result.warnings[0].message, /DataDiscriminator/);
      assert.equal(
        result.skippedRows.filter((r) => r.kind === 'parse-failure').length,
        1,
      );
    });

    void it('attributes Comm in USD to USD for non-USD trades', () => {
      const result = parseLines([
        ...stmt,
        'Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm in USD',
        'Trades,Data,Order,Stocks,EUR,AAPL,"2024-06-20, 14:15:00",-8,195.20,195.20,1561.60,-2.50',
      ]);
      assert.equal(result.trades.length, 1);
      assert.equal(result.trades[0].currency, 'EUR');
      assert.equal(result.trades[0].commissionCurrency, 'USD');
    });

    void it('rejects Financial Instrument Information without Asset Category', () => {
      const result = parseLines([
        'Financial Instrument Information,Header,Symbol,Description,Conid,Security ID',
        'Financial Instrument Information,Data,AAPL,APPLE INC,265598,US0378331005',
      ]);
      assert.equal(result.symbolToIsin.size, 0);
      assert.match(result.warnings[0].message, /Asset Category/);
      assert.equal(
        result.skippedRows.filter((r) => r.kind === 'parse-failure').length,
        1,
      );
    });

    void it('does not reject Options headers lacking Security ID', () => {
      const result = parseLines([
        'Financial Instrument Information,Header,Asset Category,Symbol,Description,Conid',
        'Financial Instrument Information,Data,Equity and Index Options,AAPL 240621C00200000,APPLE,1234',
      ]);
      assert.equal(result.warnings.length, 0);
      assert.equal(result.skippedRows.length, 0);
    });

    void it('rejects carry-in rows when Prior Quantity is missing', () => {
      const result = parseLines([
        'Mark-to-Market Performance Summary,Header,Asset Category,Symbol,Current Quantity',
        'Mark-to-Market Performance Summary,Data,Stocks,AAPL,30',
      ]);
      assert.equal(result.carryInPositions.length, 0);
      assert.match(result.warnings[0].message, /Prior Quantity/);
      assert.equal(
        result.skippedRows.filter((r) => r.kind === 'parse-failure').length,
        1,
      );
    });

    void it('rejects corporate actions when Quantity is missing', () => {
      const result = parseLines([
        'Corporate Actions,Header,Asset Category,Currency,Report Date,Date/Time,Description,Proceeds,Value',
        'Corporate Actions,Data,Stocks,USD,2024-06-10,"2024-06-09, 20:25:00","NVDA(US67066G1040) Split 10 for 1 (NVDA, NVIDIA CORP, US67066G1040)",0,0',
      ]);
      assert.equal(result.corporateActions.length, 0);
      assert.match(result.warnings[0].message, /Quantity/);
      assert.equal(
        result.skippedRows.filter((r) => r.kind === 'parse-failure').length,
        1,
      );
    });

    void it('rejects dividend accruals when Code is missing', () => {
      const result = parseLines([
        'Change in Dividend Accruals,Header,Asset Category,Currency,Symbol,Date,Ex Date,Pay Date,Quantity,Tax,Fee',
        'Change in Dividend Accruals,Data,Stocks,USD,MHPC,2025-12-25,2025-12-26,2026-01-22,200,0,4',
      ]);
      assert.equal(result.transactionFees.length, 0);
      assert.match(result.warnings[0].message, /Code/);
      assert.equal(
        result.skippedRows.filter((r) => r.kind === 'parse-failure').length,
        1,
      );
    });
  });

  void describe('carry-in end-to-end', () => {
    const MTM_LINE =
      'Mark-to-Market Performance Summary,Data,Stocks,AAPL,25,30,175.50,195.20,492.50,0,-1.00,0,491.50,';
    const FII_LINE =
      'Financial Instrument Information,Data,Stocks,AAPL,APPLE INC,265598,US0378331005,AAPL,NASDAQ,1,COMMON,';
    const SELL_LINE =
      'Trades,Data,Order,Stocks,USD,AAPL,"2024-03-15, 10:30:00",-10,200,200,2000,-1.00,0,0,0,C';
    const PERIOD_LINE =
      'Statement,Data,Period,"January 1, 2024 - December 31, 2024"';

    const taxPeriod = {
      year: 2024,
      from: new Date(2024, 0, 1),
      to: new Date(2024, 11, 31),
    };

    void it('never emits a carry-in with year 0', () => {
      // No Statement period: the year is inferred from the trade dates.
      const inferred = parseLines([MTM_LINE, SELL_LINE]);
      assert.equal(inferred.year, 2024);
      assert.equal(inferred.carryInPositions[0].year, 2023);
      assert.ok(
        inferred.warnings.some((w) => w.section === 'Carry-in positions'),
      );

      // No year at all: the position is skipped with a warning.
      const unknown = parseLines([MTM_LINE]);
      assert.equal(unknown.carryInPositions.length, 0);
      assert.ok(
        unknown.warnings.some((w) => w.section === 'Carry-in positions'),
      );
    });

    void it('calculates an MTM carry-in sold in-year without "No buy lots available"', () => {
      const statement = parseLines([
        PERIOD_LINE,
        MTM_LINE,
        SELL_LINE,
        FII_LINE,
      ]);
      const result = calculateCapitalGains({
        trades: enrich(statement),
        corporateActions: [],
        carryInPositions: enrichCarryIns(statement),
        taxPeriod,
      });
      assert.equal(result.length, 1);
      assert.equal(result[0].type, 'sell');
      assert.equal(result[0].costBasisMissing, true);
    });

    void it('matches a carry-in from a file without FII to a sell from another file', () => {
      const carryInFile = parseLines([PERIOD_LINE, MTM_LINE]);
      const tradesFile = parseLines([PERIOD_LINE, SELL_LINE, FII_LINE]);
      assert.equal(carryInFile.carryInPositions[0].isin, undefined);
      const result = calculateCapitalGains({
        trades: enrich(tradesFile),
        corporateActions: [],
        carryInPositions: enrichCarryIns(carryInFile),
        taxPeriod,
      });
      assert.equal(result.length, 1);
    });
  });
});

void describe('IBKR ADR detection', () => {
  const header =
    'Financial Instrument Information,Header,Asset Category,Symbol,Description,Conid,Security ID,Listing Exch,Multiplier,Type,Code';
  const legacyHeader =
    'Financial Instrument Information,Header,Asset Category,Symbol,Description,Conid,Security ID,Listing Exch,Multiplier,Code';
  const period = 'Statement,Data,Period,"January 1, 2024 - December 31, 2024"';
  const divHeader = 'Dividends,Header,Currency,Date,Description,Amount';
  const whtHeader =
    'Withholding Tax,Header,Currency,Date,Description,Amount,Code';
  const tsmFii =
    'Financial Instrument Information,Data,Stocks,TSM,TSMC ADR,1,US8740391003,NYSE,1,ADR,';
  const tsmDiv =
    'Dividends,Data,USD,2024-06-15,TSM(US8740391003) Cash Dividend USD 0.5 per Share (Ordinary Dividend),5';

  void it('uses the WHT suffix country for an ADR', () => {
    const r = parseLines([
      period,
      header,
      tsmFii,
      divHeader,
      tsmDiv,
      whtHeader,
      'Withholding Tax,Data,USD,2024-06-15,TSM(US8740391003) Cash Dividend USD 0.5 per Share - TW Tax,-1.05,',
    ]);
    assert.equal(r.dividends[0].isAdr, true);
    assert.equal(r.dividends[0].adrCountry, 'TW');
    assert.equal(r.warnings.length, 0);
  });

  void it('warns and keeps the ISIN country when the ADR has no suffix', () => {
    const r = parseLines([period, header, tsmFii, divHeader, tsmDiv]);
    assert.equal(r.dividends[0].isAdr, true);
    assert.equal(r.dividends[0].adrCountry, undefined);
    assert.equal(r.warnings.length, 1);
    assert.match(
      r.warnings[0].message,
      /ADR detected for TSM, country assumed US from ISIN/,
    );
  });

  void it('rejects a malformed suffix', () => {
    const r = parseLines([
      period,
      header,
      tsmFii,
      divHeader,
      tsmDiv,
      whtHeader,
      'Withholding Tax,Data,USD,2024-06-15,TSM(US8740391003) Cash Dividend USD 0.5 per Share - tw Tax,-1.05,',
      'Withholding Tax,Data,USD,2024-06-16,TSM(US8740391003) Cash Dividend USD 0.5 per Share - TWN Tax,-1.05,',
    ]);
    assert.equal(r.dividends[0].adrCountry, undefined);
  });

  void it('does not mark non-ADR stocks', () => {
    const r = parseLines([
      period,
      header,
      'Financial Instrument Information,Data,Stocks,AAPL,APPLE,2,US0378331005,NASDAQ,1,COMMON,',
      divHeader,
      'Dividends,Data,USD,2024-06-15,AAPL(US0378331005) Cash Dividend USD 0.25 per Share (Ordinary Dividend),2.5',
    ]);
    assert.equal(r.dividends[0].isAdr, undefined);
    assert.equal(r.warnings.length, 0);
  });

  void it('treats statements without a Type column as non-ADR', () => {
    const r = parseLines([
      period,
      legacyHeader,
      'Financial Instrument Information,Data,Stocks,TSM,TSMC ADR,1,US8740391003,NYSE,1,ADR',
      divHeader,
      tsmDiv,
    ]);
    assert.equal(r.dividends[0].isAdr, undefined);
    assert.equal(r.warnings.length, 0);
  });
});
