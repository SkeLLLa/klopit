import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Trade } from '../src/core/types.js';
import {
  incentiveRegimeUpdates,
  needsSchwabFmvNotice,
  symbolsMissingIncentiveRegime,
  withIncentiveRegime,
  withTaxedIncomePln,
} from '../src/lib/services/incentive.js';

function trade(overrides: Partial<Trade> & { id?: number }) {
  return {
    symbol: 'ACME',
    currency: 'USD',
    datetime: new Date(2024, 0, 15),
    quantity: 10,
    price: 0,
    proceeds: 0,
    commission: 0,
    commissionCurrency: 'USD',
    type: 'buy' as const,
    ...overrides,
  };
}

void describe('incentive service helpers', () => {
  void it('bulk update targets only rsu/espp buys of the symbol', () => {
    const updates = incentiveRegimeUpdates({
      trades: [
        trade({ id: 1, source: 'rsu', incentive: { fmvPerShare: 5 } }),
        trade({ id: 2, source: 'espp' }),
        trade({ id: 3 }),
        trade({ id: 4, source: 'rsu', type: 'sell' }),
        trade({ id: 5, source: 'rsu', symbol: 'OTHER' }),
      ],
      symbol: 'acme',
      regime: 'qualifying',
    });
    assert.deepEqual(updates, [
      { id: 1, incentive: { fmvPerShare: 5, regime: 'qualifying' } },
      { id: 2, incentive: { regime: 'qualifying' } },
    ]);
  });

  void it('clearing the regime keeps other fields and drops empty data', () => {
    assert.deepEqual(
      withIncentiveRegime({ regime: 'qualifying', fmvPerShare: 5 }, undefined),
      { fmvPerShare: 5 },
    );
    assert.equal(
      withIncentiveRegime({ regime: 'qualifying' }, undefined),
      undefined,
    );
    assert.deepEqual(
      withTaxedIncomePln(
        { regime: 'taxed-at-acquisition', taxedIncomePln: 1 },
        undefined,
      ),
      { regime: 'taxed-at-acquisition' },
    );
  });

  void it('lists symbols whose incentive lots lack a regime', () => {
    assert.deepEqual(
      symbolsMissingIncentiveRegime([
        trade({ source: 'rsu' }),
        trade({
          symbol: 'B',
          source: 'espp',
          incentive: { regime: 'qualifying' },
        }),
        trade({ symbol: 'C' }),
      ]),
      ['ACME'],
    );
  });

  void it('shows the Schwab FMV notice only for legacy Schwab rows', () => {
    const files = [{ broker: 'schwab' }];
    assert.equal(
      needsSchwabFmvNotice({
        files,
        trades: [trade({ account: 'schwab:default' })],
      }),
      true,
    );
    assert.equal(
      needsSchwabFmvNotice({
        files,
        trades: [trade({ account: 'schwab:default', source: 'rsu' })],
      }),
      false,
    );
    assert.equal(
      needsSchwabFmvNotice({
        files: [{ broker: 'ibkr' }],
        trades: [trade({})],
      }),
      false,
    );
  });
});
