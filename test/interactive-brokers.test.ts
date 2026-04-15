import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { interactiveBrokersDefinition } from '../src/core/parsers/interactive-brokers.js';

const fixturesDir = join(import.meta.dirname, 'fixtures', 'ib');

function parseFixture(filename: string) {
  const text = readFileSync(join(fixturesDir, filename), 'utf-8');
  const parser = interactiveBrokersDefinition.createParser();
  for (const line of text.split('\n')) {
    parser.feed({ line });
  }
  return parser.finish();
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
      const symbols = result.carryInPositions.map((p) => p.symbol);
      assert.ok(symbols.includes('AAPL'));
      assert.ok(symbols.includes('MSFT'));
      assert.ok(!symbols.includes('TSLA'));
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
      assert.equal(result.year, 2024);
    });

    void it('collects warnings for malformed rows', () => {
      const result = parseFixture('malformed-rows.csv');
      assert.ok(result.warnings.length > 0);
      assert.ok(result.skippedRows.length > 0);
      assert.ok(result.trades.length >= 1);
    });

    void it('extracts skipped row fields by header column name (Trades-like layout)', () => {
      const parser = interactiveBrokersDefinition.createParser();
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
      const parser = interactiveBrokersDefinition.createParser();
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
      assert.equal(result.broker, 'interactive-brokers');
      assert.equal(result.year, 2024);
      assert.equal(result.trades.length, 5);
      assert.equal(result.dividends.length, 3);
      assert.equal(result.withholdingTaxes.length, 3);
      assert.equal(result.corporateActions.length, 1);
      assert.equal(result.symbolToIsin.size, 3);
      assert.ok(result.carryInPositions.length >= 1);
      assert.equal(result.skippedRows.length, 0);
    });
  });

  void describe('ISIN backfill', () => {
    void it('backfills ISINs on trades when FII section comes after Trades', () => {
      const parser = interactiveBrokersDefinition.createParser();
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
      const parser = interactiveBrokersDefinition.createParser();
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
  });
});
