import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { ibkrDefinition } from '../src/core/parsers/ibkr/index.js';
import { deriveImportWarnings } from '../src/lib/services/import-warnings.js';

function parseText(text: string) {
  const parser = ibkrDefinition.createParser();
  for (const line of text.split('\n')) parser.feed({ line });
  return parser.finish();
}

const fixture = readFileSync(
  join(import.meta.dirname, 'fixtures', 'ib', 'full-statement.csv'),
  'utf-8',
);

void describe('IBKR account stamping', () => {
  void it('stamps the statement account on trades, carry-ins and corporate actions', () => {
    const result = parseText(fixture);
    assert.ok(result.trades.length > 0);
    assert.ok(result.carryInPositions.length > 0);
    assert.ok(result.corporateActions.length > 0);
    for (const row of [
      ...result.trades,
      ...result.carryInPositions,
      ...result.corporateActions,
    ]) {
      assert.equal(row.account, 'ibkr:U0000000');
    }
    assert.equal(
      result.skippedRows.filter((r) => r.section === 'Account Information')
        .length,
      0,
    );
  });

  void it('prefers a per-row Account column', () => {
    const result = parseText(
      [
        'Account Information,Header,Field Name,Field Value',
        'Account Information,Data,Account,U1111111',
        'Account Information,Data,Account,U2222222',
        'Trades,Header,DataDiscriminator,Asset Category,Currency,Account,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee',
        'Trades,Data,Order,Stocks,USD,U2222222,AAPL,"2024-03-15, 10:30:00",10,175.50,175.50,-1755,-1',
        'Trades,Data,Order,Stocks,USD,U1111111,MSFT,"2024-03-16, 10:30:00",5,400,400,-2000,-1',
      ].join('\n'),
    );
    assert.deepEqual(
      result.trades.map((t) => t.account),
      ['ibkr:U2222222', 'ibkr:U1111111'],
    );
    assert.equal(result.warnings.length, 0);
  });

  void it('uses the first account and warns when several are listed without a column', () => {
    const result = parseText(
      [
        'Account Information,Header,Field Name,Field Value',
        'Account Information,Data,Account,U1111111',
        'Account Information,Data,Account,U2222222',
        'Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee',
        'Trades,Data,Order,Stocks,USD,AAPL,"2024-03-15, 10:30:00",10,175.50,175.50,-1755,-1',
      ].join('\n'),
    );
    assert.equal(result.trades[0]?.account, 'ibkr:U1111111');
    assert.equal(
      result.warnings.filter((w) => w.section === 'Account Information').length,
      1,
    );
  });

  void it('leaves account unset when the statement has none', () => {
    const result = parseText(
      [
        'Trades,Header,DataDiscriminator,Asset Category,Currency,Symbol,Date/Time,Quantity,T. Price,C. Price,Proceeds,Comm/Fee',
        'Trades,Data,Order,Stocks,USD,AAPL,"2024-03-15, 10:30:00",10,175.50,175.50,-1755,-1',
      ].join('\n'),
    );
    assert.equal(result.trades[0]?.account, undefined);
  });

  void it('reports stock transfers with a specific warning', () => {
    const result = parseText(
      [
        'Transfers,Header,Asset Category,Currency,Symbol,Date,Type,Direction,Description,Quantity',
        'Transfers,Data,Stocks,USD,AAPL,2024-05-01,ACATS,In,"AAPL transfer",10',
        'Transfers,Data,Stocks,USD,MSFT,2024-05-02,ACATS,Out,"MSFT transfer",5',
        'Transfers,Data,Forex,USD,EUR.USD,2024-05-02,Internal,In,"fx",5',
      ].join('\n'),
    );
    assert.equal(result.skippedRows.length, 2);
    assert.ok(
      result.skippedRows.every(
        (r) => r.section === 'Transfers' && r.kind === 'known-unsupported',
      ),
    );
    const [warning] = deriveImportWarnings({ skippedRows: result.skippedRows });
    assert.equal(
      warning.message,
      '2 stock transfers found — add a transfer on the Data page (art. 24 ust. 10)',
    );
  });
});
