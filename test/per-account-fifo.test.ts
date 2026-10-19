import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  calculateCapitalGains,
  type CarryInWarning,
} from '../src/core/tax/capital-gains.js';
import type {
  EnrichedCarryInPosition,
  EnrichedCorporateAction,
  EnrichedTrade,
  TaxPeriod,
} from '../src/core/types.js';

const taxPeriod: TaxPeriod = {
  year: 2024,
  from: new Date(2024, 0, 1),
  to: new Date(2024, 11, 31),
};
const ISIN = 'US0378331005';
const A = 'ibkr:U123';
const B = 'schwab:default';

function trade(overrides: Partial<EnrichedTrade>): EnrichedTrade {
  return {
    symbol: 'AAPL',
    isin: ISIN,
    currency: 'PLN',
    datetime: new Date(2024, 0, 10),
    quantity: 10,
    price: 10,
    proceeds: 0,
    commission: 0,
    commissionCurrency: 'PLN',
    type: 'buy',
    exchangeRate: 1,
    commissionExchangeRate: 1,
    rateUnavailable: false,
    ...overrides,
  };
}

function sell(quantity: number, datetime: Date, account?: string) {
  return trade({
    type: 'sell',
    quantity,
    price: 100,
    proceeds: quantity * 100,
    datetime,
    account,
  });
}

function split(overrides: Partial<EnrichedCorporateAction>) {
  return {
    type: 'stock-split',
    symbol: 'AAPL',
    isin: ISIN,
    datetime: new Date(2024, 2, 1),
    numerator: 2,
    denominator: 1,
    cashExchangeRate: 1,
    cashRateUnavailable: false,
    ...overrides,
  } as EnrichedCorporateAction;
}

function carryIn(
  overrides: Partial<EnrichedCarryInPosition>,
): EnrichedCarryInPosition {
  return {
    symbol: 'AAPL',
    isin: ISIN,
    quantity: 10,
    year: 2023,
    costPln: 100,
    rateUnavailable: false,
    costMissing: false,
    ...overrides,
  };
}

function run(args: {
  trades?: EnrichedTrade[];
  corporateActions?: EnrichedCorporateAction[];
  carryInPositions?: EnrichedCarryInPosition[];
}) {
  const warnings: CarryInWarning[] = [];
  const results = calculateCapitalGains({
    trades: args.trades ?? [],
    corporateActions: args.corporateActions ?? [],
    carryInPositions: args.carryInPositions ?? [],
    taxPeriod,
    onWarning: (w) => warnings.push(w),
  });
  return { results, warnings };
}

void describe('per-account FIFO', () => {
  void it('a sell at B consumes B lots even if A lots are older', () => {
    const { results, warnings } = run({
      trades: [
        trade({ account: A, datetime: new Date(2024, 0, 1), price: 10 }),
        trade({ account: B, datetime: new Date(2024, 0, 5), price: 50 }),
        sell(10, new Date(2024, 1, 1), B),
      ],
    });
    const soldAtB = results.find((r) => r.type === 'sell');
    assert.ok(soldAtB);
    assert.equal(soldAtB.costPln, 500);
    assert.equal(soldAtB.costBasisMissing, undefined);
    assert.deepEqual(warnings, []);
  });

  void it('legacy unstamped rows in a single account give identical results', () => {
    const rows = [
      trade({ datetime: new Date(2024, 0, 1), price: 10 }),
      trade({ datetime: new Date(2024, 0, 5), price: 50 }),
      sell(15, new Date(2024, 1, 1)),
    ];
    const legacy = run({ trades: rows });
    const stamped = run({
      trades: rows.map((t) => ({ ...t, account: A })),
    });
    const mixed = run({
      trades: [{ ...rows[0], account: A }, rows[1], rows[2]],
    });
    assert.deepEqual(stamped.results, legacy.results);
    assert.deepEqual(mixed.results, legacy.results);
    assert.deepEqual(mixed.warnings, []);
  });

  void it('unassigned rows with two accounts warn, drafting only on overlap', () => {
    const overlap = run({
      trades: [
        trade({ account: A }),
        trade({ account: B }),
        trade({ datetime: new Date(2024, 0, 2) }),
      ],
    });
    assert.deepEqual(
      overlap.warnings.filter((w) => w.kind === 'account-unassigned'),
      [
        {
          kind: 'account-unassigned',
          symbol: 'AAPL',
          isin: ISIN,
          overlap: true,
        },
      ],
    );

    const disjoint = run({
      trades: [
        trade({ account: A }),
        trade({ account: B }),
        trade({ symbol: 'MSFT', isin: 'US5949181045' }),
      ],
    });
    const unassigned = disjoint.warnings.filter(
      (w) => w.kind === 'account-unassigned',
    );
    assert.equal(unassigned.length, 1);
    assert.equal('overlap' in unassigned[0] && unassigned[0].overlap, false);
  });

  void it('unassigned rows do not join an assigned account queue', () => {
    const { results } = run({
      trades: [
        trade({ account: A, price: 10 }),
        trade({ account: B, price: 20 }),
        trade({ price: 99 }),
        sell(10, new Date(2024, 3, 1), A),
      ],
    });
    assert.equal(results.find((r) => r.type === 'sell')?.costPln, 100);
  });

  void it('an account-scoped split touches only that account', () => {
    const { results } = run({
      trades: [
        trade({ account: A, quantity: 10, price: 10 }),
        trade({ account: B, quantity: 10, price: 10 }),
        sell(20, new Date(2024, 4, 1), A),
        sell(20, new Date(2024, 4, 2), B),
      ],
      corporateActions: [split({ account: A })],
    });
    const sells = results.filter((r) => r.type === 'sell');
    assert.equal(sells[0].costBasisMissing, undefined);
    assert.equal(sells[0].costPln, 100);
    // B was not split: 10 shares only, 10 missing.
    assert.equal(sells[1].costBasisMissing, true);
  });

  void it('an unscoped split applies to every account holding the instrument', () => {
    const { results } = run({
      trades: [
        trade({ account: A }),
        trade({ account: B }),
        sell(20, new Date(2024, 4, 1), A),
        sell(20, new Date(2024, 4, 2), B),
      ],
      corporateActions: [split({})],
    });
    assert.equal(results.filter((r) => r.costBasisMissing).length, 0);
  });

  void it('a split reported by two sources is applied once per account', () => {
    const { results } = run({
      trades: [
        trade({ account: A }),
        trade({ account: B }),
        sell(20, new Date(2024, 4, 1), A),
        sell(20, new Date(2024, 4, 2), B),
      ],
      corporateActions: [
        split({ account: A }),
        split({}),
        split({ account: B }),
      ],
    });
    const sells = results.filter((r) => r.type === 'sell');
    assert.equal(sells.length, 2);
    for (const s of sells) {
      assert.equal(s.costBasisMissing, undefined);
      assert.equal(s.costPln, 100);
    }
    // Selling 21 would need a second (double) split.
    const over = run({
      trades: [trade({ account: A }), sell(21, new Date(2024, 4, 1), A)],
      corporateActions: [split({ account: A }), split({})],
    });
    assert.equal(
      over.results.find((r) => r.type === 'sell')?.costBasisMissing,
      true,
    );
  });

  void it('a snapshot is not explained by another account buys', () => {
    // IBKR holds 10 at the end of 2023; Schwab bought 10 in 2023.
    const { results, warnings } = run({
      trades: [
        trade({ account: B, datetime: new Date(2023, 5, 1), quantity: 10 }),
        sell(20, new Date(2024, 3, 1), A),
      ],
      carryInPositions: [carryIn({ account: A, quantity: 10, costPln: 100 })],
    });
    assert.equal(
      warnings.some((w) => w.kind === 'carry-in-overlap'),
      false,
    );
    assert.equal(
      warnings.some((w) => w.kind === 'carry-in-inconsistent'),
      false,
    );
    const s = results.find((r) => r.type === 'sell');
    assert.equal(s?.costPln, 100);
    assert.equal(s.costBasisMissing, true); // only 10 in A
  });

  void it('a manual carry-in without ISIN does not net into another account ISIN queue', () => {
    const { results, warnings } = run({
      trades: [
        trade({ account: A, datetime: new Date(2023, 5, 1), quantity: 10 }),
        sell(10, new Date(2024, 3, 1), A),
        sell(5, new Date(2024, 4, 1), B),
      ],
      carryInPositions: [
        carryIn({ account: B, isin: undefined, quantity: 5, costPln: 50 }),
      ],
    });
    assert.deepEqual(warnings, []);
    const sells = results.filter((r) => r.type === 'sell');
    assert.equal(sells[0].costPln, 100);
    assert.equal(sells[1].costPln, 50);
    assert.equal(sells[1].costBasisMissing, undefined);
  });
});

void describe('per-account FIFO shortfall', () => {
  void it('does not throw; missing shares cost 0 and the sell is flagged', () => {
    const { results, warnings } = run({
      trades: [
        trade({ account: A, quantity: 4, price: 10 }),
        sell(10, new Date(2024, 2, 1), A),
      ],
    });
    const s = results.find((r) => r.type === 'sell');
    assert.equal(s?.costBasisMissing, true);
    assert.equal(s.costPln, 40);
    assert.deepEqual(warnings, [
      {
        kind: 'shortfall-add-carry-in',
        instrument: 'AAPL',
        isin: ISIN,
        account: A,
        quantity: 6,
        before: new Date(2024, 2, 1),
      },
    ]);
  });

  void it('suggests a transfer when another account holds the instrument', () => {
    const { results, warnings } = run({
      trades: [
        trade({ account: B, quantity: 10, datetime: new Date(2024, 0, 1) }),
        sell(10, new Date(2024, 2, 1), A),
      ],
    });
    assert.equal(
      results.find((r) => r.type === 'sell')?.costBasisMissing,
      true,
    );
    assert.deepEqual(warnings, [
      {
        kind: 'transfer-suggested',
        instrument: 'AAPL',
        isin: ISIN,
        fromAccount: B,
        toAccount: A,
        quantity: 10,
        before: new Date(2024, 2, 1),
      },
    ]);
  });

  void it('does not suggest a transfer from an account that already sold out', () => {
    const { warnings } = run({
      trades: [
        trade({ account: B, quantity: 10, datetime: new Date(2024, 0, 1) }),
        sell(10, new Date(2024, 1, 1), B),
        sell(10, new Date(2024, 2, 1), A),
      ],
    });
    assert.deepEqual(
      warnings.map((w) => w.kind),
      ['shortfall-add-carry-in'],
    );
  });

  void it('keeps the epsilon tolerance for float drift', () => {
    const { results, warnings } = run({
      trades: [
        trade({ account: A, quantity: 0.1 }),
        trade({ account: A, quantity: 0.2 }),
        sell(0.1 + 0.2, new Date(2024, 2, 1), A),
      ],
    });
    assert.equal(
      results.find((r) => r.type === 'sell')?.costBasisMissing,
      undefined,
    );
    assert.deepEqual(warnings, []);
  });
});
