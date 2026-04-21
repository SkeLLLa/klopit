import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { schwabDefinition } from '../src/core/parsers/schwab/index.js';

const fixturesDir = join(import.meta.dirname, 'fixtures', 'schwab');

function parseFixture(filename: string) {
  const text = readFileSync(join(fixturesDir, filename), 'utf-8');
  const parser = schwabDefinition.createParser();
  for (const line of text.split('\n')) {
    parser.feed({ line });
  }
  return parser.finish();
}

void describe('SchwabParser', () => {
  void it('parses equity award activity into buys and sells', () => {
    const result = parseFixture('equity-awards.csv');

    assert.equal(result.broker, 'schwab');
    assert.equal(result.year, 2025);
    assert.equal(result.trades.length, 4);
    assert.equal(
      result.trades.filter((trade) => trade.type === 'buy').length,
      3,
    );
    assert.equal(
      result.trades.filter((trade) => trade.type === 'sell').length,
      1,
    );
    assert.equal(result.warnings.length, 0);
  });

  void it('uses continuation-row fields for lapse and deposit cost basis', () => {
    const result = parseFixture('equity-awards.csv');
    const lapse = result.trades.find(
      (trade) =>
        trade.type === 'buy' && trade.symbol === 'XYZ' && trade.quantity === 41,
    );
    const juneDeposit = result.trades.find(
      (trade) =>
        trade.type === 'buy' && trade.symbol === 'XYZ' && trade.quantity === 55,
    );

    if (!lapse) {
      throw new Error('expected lapse trade');
    }
    assert.equal(lapse.price, 12.34);
    assert.equal(lapse.datetime.getMonth(), 11);
    assert.equal(lapse.datetime.getDate(), 12);

    if (!juneDeposit) {
      throw new Error('expected June ESPP deposit');
    }
    assert.equal(juneDeposit.price, 45.67);
    assert.equal(juneDeposit.datetime.getMonth(), 4);
    assert.equal(juneDeposit.datetime.getDate(), 31);
  });

  void it('parses sale proceeds as gross and keeps commission separate', () => {
    const result = parseFixture('equity-awards.csv');
    const sale = result.trades.find((trade) => trade.type === 'sell');

    if (!sale) {
      throw new Error('expected sale trade');
    }
    assert.equal(sale.price, 50.12);
    assert.equal(sale.quantity, 55);
    assert.equal(sale.proceeds, 2756.6);
    assert.equal(sale.commission, 0.01);
  });

  void it('ignores summary-only individual account rows without creating trades', () => {
    const result = parseFixture('individual-transactions.csv');

    assert.equal(result.year, 0);
    assert.equal(result.trades.length, 0);
    assert.equal(result.warnings.length, 0);
  });
});
