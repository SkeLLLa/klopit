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
        sell(10, new Date(2024, 1, 2)),
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

void describe('per-account FIFO: unstamped rows', () => {
  void it('an unstamped carry-in joins the only account that holds the instrument', () => {
    const { results, warnings } = run({
      trades: [
        sell(10, new Date(2024, 3, 1), A),
        trade({
          account: B,
          symbol: 'MSFT',
          isin: 'US5949181045',
          datetime: new Date(2024, 0, 2),
        }),
      ],
      carryInPositions: [carryIn({ quantity: 10, costPln: 100 })],
    });
    const s = results.find((r) => r.type === 'sell');
    assert.equal(s?.costPln, 100);
    assert.equal(s.costBasisMissing, undefined);
    assert.deepEqual(warnings, [
      {
        kind: 'account-assumed',
        symbol: 'AAPL',
        isin: ISIN,
        account: A,
        rows: 1,
      },
    ]);
  });

  void it('matches an unstamped symbol-only carry-in to the account keyed by ISIN', () => {
    const { results } = run({
      trades: [
        trade({
          account: A,
          quantity: 5,
          price: 10,
          datetime: new Date(2023, 5, 1),
        }),
        trade({ account: B, symbol: 'MSFT', isin: 'US5949181045' }),
        sell(10, new Date(2024, 3, 1), A),
      ],
      carryInPositions: [
        carryIn({ isin: undefined, quantity: 10, year: 2022, costPln: 100 }),
      ],
    });
    const s = results.find((r) => r.type === 'sell');
    assert.equal(s?.costBasisMissing, undefined);
  });

  void it('stays apart, without drafting, when no sell is affected', () => {
    const { results, warnings } = run({
      trades: [trade({ account: A }), trade({ account: B })],
      carryInPositions: [carryIn({ quantity: 5 })],
    });
    assert.equal(results.length, 2);
    assert.deepEqual(warnings, [
      {
        kind: 'account-unassigned',
        symbol: 'AAPL',
        isin: ISIN,
        overlap: false,
      },
    ]);
  });

  void it('does not draw transfers into or out of the unassigned account', () => {
    const { warnings } = run({
      trades: [
        trade({ account: A }),
        trade({ account: B }),
        sell(30, new Date(2024, 3, 1)),
      ],
    });
    assert.deepEqual(
      warnings.map((w) => w.kind),
      ['account-unassigned'],
    );
  });
});

void describe('per-account FIFO: shortfall taint (F2)', () => {
  void it('Q4a: a 2023 shortfall drafts the later 2024 sell', () => {
    const { results } = run({
      trades: [
        trade({
          account: A,
          quantity: 5,
          price: 40,
          datetime: new Date(2023, 2, 1),
        }),
        sell(8, new Date(2023, 5, 1), A),
        trade({
          account: A,
          quantity: 10,
          price: 50,
          datetime: new Date(2023, 8, 1),
        }),
        sell(7, new Date(2024, 3, 1), A),
      ],
    });
    assert.equal(results.length, 1);
    assert.equal(results[0].costPln, 350);
    assert.equal(results[0].costBasisMissing, true);
  });

  void it('Q4c: a 2023 cross-account shortfall drafts the later sell too', () => {
    const { results, warnings } = run({
      trades: [
        trade({ account: B, quantity: 10, datetime: new Date(2023, 0, 1) }),
        sell(5, new Date(2023, 5, 1), A),
        trade({
          account: A,
          quantity: 10,
          price: 50,
          datetime: new Date(2023, 8, 1),
        }),
        sell(7, new Date(2024, 3, 1), A),
      ],
    });
    assert.equal(results[0].costBasisMissing, true);
    assert.equal(warnings[0].kind, 'transfer-suggested');
  });

  void it('does not taint other accounts or instruments', () => {
    const { results } = run({
      trades: [
        sell(5, new Date(2023, 5, 1), A),
        trade({ account: B, quantity: 10 }),
        sell(7, new Date(2024, 3, 1), B),
      ],
    });
    assert.equal(results[0].costBasisMissing, undefined);
  });
});

void describe('per-account FIFO: donors across key styles (F3)', () => {
  void it('IBKR (ISIN) buys, Schwab (symbol only) sells: transfer IBKR to Schwab', () => {
    const { warnings } = run({
      trades: [
        trade({ account: A, quantity: 10, datetime: new Date(2024, 0, 1) }),
        trade({
          account: B,
          isin: undefined,
          type: 'sell',
          quantity: 10,
          price: 100,
          proceeds: 1000,
          datetime: new Date(2024, 2, 1),
        }),
      ],
    });
    assert.equal(warnings.length, 1);
    assert.equal(
      warnings[0].kind === 'transfer-suggested' && warnings[0].fromAccount,
      A,
    );
  });

  void it('reverse: Schwab buys by symbol, IBKR sells by ISIN', () => {
    const { warnings } = run({
      trades: [
        trade({
          account: B,
          isin: undefined,
          quantity: 10,
          datetime: new Date(2024, 0, 1),
        }),
        trade({
          account: A,
          symbol: 'MSFT',
          isin: 'US5949181045',
          datetime: new Date(2023, 0, 1),
        }),
        sell(10, new Date(2024, 2, 1), A),
      ],
    });
    assert.deepEqual(
      warnings.map((w) => w.kind === 'transfer-suggested' && w.fromAccount),
      [B],
    );
  });

  void it('a carry-in without ISIN in an account with no trades is a donor', () => {
    const { warnings } = run({
      trades: [
        trade({
          account: B,
          symbol: 'MSFT',
          isin: 'US5949181045',
          datetime: new Date(2023, 0, 1),
        }),
        sell(10, new Date(2024, 2, 1), B),
      ],
      carryInPositions: [
        carryIn({ account: A, isin: undefined, quantity: 10 }),
      ],
    });
    assert.deepEqual(
      warnings.map((w) => w.kind === 'transfer-suggested' && w.fromAccount),
      [A],
    );
  });
});

void describe('per-account FIFO: warning aggregation (R1)', () => {
  void it('merges many short sells into one warning per account and instrument', () => {
    const trades: EnrichedTrade[] = [];
    for (let i = 0; i < 300; i++) {
      trades.push(sell(1, new Date(2024, 0, 1, 0, i), A));
    }
    const { warnings } = run({ trades });
    assert.equal(warnings.length, 1);
    const w = warnings[0];
    assert.equal(w.kind === 'shortfall-add-carry-in' && w.quantity, 300);
    assert.deepEqual(
      w.kind === 'shortfall-add-carry-in' && w.before,
      new Date(2024, 0, 1, 0, 0),
    );
  });

  void it('does not offer one donor holding twice', () => {
    const { warnings } = run({
      trades: [
        trade({ account: B, quantity: 10, datetime: new Date(2024, 0, 1) }),
        sell(10, new Date(2024, 1, 1), A),
        sell(10, new Date(2024, 2, 1), A),
      ],
    });
    assert.deepEqual(
      warnings.map((w) => [w.kind, 'quantity' in w && w.quantity]),
      [
        ['transfer-suggested', 10],
        ['shortfall-add-carry-in', 10],
      ],
    );
  });
});

void describe('per-account FIFO: split de-duplication by day', () => {
  void it('a midnight manual split and a timestamped import of the same day apply once', () => {
    const { results } = run({
      trades: [
        trade({ account: A, quantity: 10, price: 10 }),
        sell(20, new Date(2024, 4, 1), A),
        sell(1, new Date(2024, 4, 2), A),
      ],
      corporateActions: [
        split({ account: A, datetime: new Date(2024, 2, 1) }),
        split({ account: A, datetime: new Date(2024, 2, 1, 15, 30) }),
      ],
    });
    const sells = results.filter((r) => r.type === 'sell');
    assert.equal(sells[0].costBasisMissing, undefined);
    assert.equal(sells[1].costBasisMissing, true);
  });
});

const OTHER = { account: B, symbol: 'MSFT', isin: 'US5949181045' };
const priced = (
  price: number,
  datetime: Date,
  overrides: Partial<EnrichedTrade> = {},
) => trade({ price, datetime, ...overrides });

const assumedAccounts = (warnings: CarryInWarning[]) =>
  warnings.flatMap((w) => (w.kind === 'account-assumed' ? [w.account] : []));

const noAssumption = (warnings: CarryInWarning[]) =>
  assert.ok(!warnings.some((w) => w.kind === 'account-assumed'));

const isDraft = (warnings: CarryInWarning[]) =>
  warnings.some((w) => w.kind === 'account-unassigned' && w.overlap);

function onlySell(results: ReturnType<typeof run>['results']) {
  const sells = results.filter((r) => r.type === 'sell');
  assert.equal(sells.length, 1);
  return sells[0];
}

void describe('per-account FIFO: joining unstamped rows only when needed', () => {
  void it('L1b: a legacy lot does not join a consistent account, and the guess drafts the form', () => {
    const { results, warnings } = run({
      trades: [
        priced(50, new Date(2021, 0, 1)),
        priced(40, new Date(2023, 0, 1), { account: B }),
        sell(10, new Date(2024, 5, 1), B),
        trade({ account: A, symbol: 'MSFT', isin: 'US5949181045' }),
      ],
    });
    const s = onlySell(results);
    assert.equal(s.costPln, 400);
    assert.equal(s.costBasisMissing, undefined);
    assert.ok(!warnings.some((w) => w.kind === 'account-assumed'));
    assert.ok(isDraft(warnings));
  });

  void it('L1c: same with symbol-only rows', () => {
    const noIsin = { isin: undefined };
    const { results, warnings } = run({
      trades: [
        priced(50, new Date(2021, 0, 1), noIsin),
        priced(40, new Date(2023, 0, 1), { account: B, ...noIsin }),
        { ...sell(10, new Date(2024, 5, 1), B), ...noIsin },
        trade({ account: A, symbol: 'MSFT', isin: 'US5949181045' }),
      ],
    });
    const s = onlySell(results);
    assert.equal(s.costPln, 400);
    assert.equal(s.costBasisMissing, undefined);
    assert.ok(isDraft(warnings));
  });

  void it('J1: manual rows that are consistent alone do not join a holder', () => {
    const { results, warnings } = run({
      trades: [
        priced(50, new Date(2022, 0, 1), { account: A }),
        priced(40, new Date(2023, 0, 1)),
        sell(10, new Date(2024, 5, 1)),
        trade(OTHER),
      ],
    });
    const s = onlySell(results);
    assert.equal(s.costPln, 400);
    assert.equal(s.costBasisMissing, undefined);
    assert.ok(isDraft(warnings));
  });

  void it('J2: a carry-in is not absorbed by an account that sold out', () => {
    const { results, warnings } = run({
      trades: [
        priced(50, new Date(2020, 0, 1), { account: A }),
        sell(10, new Date(2021, 0, 1), A),
        sell(10, new Date(2024, 5, 1)),
        trade(OTHER),
      ],
      carryInPositions: [carryIn({ quantity: 10, costPln: 400 })],
    });
    const s = onlySell(results);
    assert.equal(s.costPln, 400);
    assert.equal(s.costBasisMissing, undefined);
    assert.ok(
      !warnings.some(
        (w) => w.kind === 'carry-in-overlap' || w.kind === 'account-assumed',
      ),
    );
  });

  void it('M6a: unstamped buys fill an account that ran short', () => {
    const { results, warnings } = run({
      trades: [
        priced(40, new Date(2023, 0, 1)),
        sell(10, new Date(2024, 5, 1), A),
        trade(OTHER),
      ],
    });
    const s = onlySell(results);
    assert.equal(s.costPln, 400);
    assert.equal(s.costBasisMissing, undefined);
    assert.deepEqual(
      warnings.filter((w) => w.kind === 'account-assumed'),
      [
        {
          kind: 'account-assumed',
          symbol: 'AAPL',
          isin: ISIN,
          account: A,
          rows: 1,
        },
      ],
    );
  });

  void it('M6c: an account covers unstamped sells that ran short', () => {
    const { results, warnings } = run({
      trades: [
        priced(40, new Date(2023, 0, 1), { account: A }),
        sell(10, new Date(2024, 5, 1)),
        trade(OTHER),
      ],
    });
    const s = onlySell(results);
    assert.equal(s.costPln, 400);
    assert.equal(s.costBasisMissing, undefined);
    assert.ok(warnings.some((w) => w.kind === 'account-assumed'));
  });

  void it('M6d: of two holders only the one that ran short takes the rows', () => {
    const { results, warnings } = run({
      trades: [
        priced(50, new Date(2022, 0, 1), { account: A }),
        priced(40, new Date(2023, 0, 1)),
        sell(10, new Date(2024, 5, 1), B),
      ],
    });
    const s = onlySell(results);
    assert.equal(s.costPln, 400);
    assert.equal(s.costBasisMissing, undefined);
    assert.ok(
      warnings.some((w) => w.kind === 'account-assumed' && w.account === B),
    );
  });

  void it('keeps the draft when several accounts could resolve it', () => {
    const { results, warnings } = run({
      trades: [
        priced(50, new Date(2022, 0, 1), { account: A }),
        priced(40, new Date(2022, 0, 1), { account: B }),
        sell(10, new Date(2024, 5, 1)),
      ],
    });
    assert.equal(onlySell(results).costBasisMissing, true);
    assert.ok(
      warnings.some((w) => w.kind === 'account-unassigned' && w.overlap),
    );
    assert.ok(!warnings.some((w) => w.kind === 'account-assumed'));
  });
});

void describe('per-account FIFO: donors', () => {
  void it('Q4c′: a suggested transfer drafts the donor’s later sells', () => {
    const { results, warnings } = run({
      trades: [
        priced(50, new Date(2022, 0, 1), { account: A }),
        priced(40, new Date(2023, 8, 1), { account: A }),
        sell(10, new Date(2023, 5, 1), B),
        sell(10, new Date(2024, 5, 1), A),
      ],
    });
    assert.ok(warnings.some((w) => w.kind === 'transfer-suggested'));
    const s = onlySell(results);
    assert.equal(s.costBasisMissing, true);
  });

  void it('does not draw the same donor shares for two receivers keyed differently', () => {
    const C = 'ibkr:U999';
    const { warnings } = run({
      trades: [
        priced(10, new Date(2022, 0, 1), { account: A }),
        sell(10, new Date(2024, 2, 1), B),
        { ...sell(10, new Date(2024, 3, 1), C), isin: undefined },
        trade({ account: B, symbol: 'MSFT', isin: 'US5949181045' }),
      ],
    });
    const transfers = warnings.filter((w) => w.kind === 'transfer-suggested');
    assert.equal(transfers.length, 1);
    assert.ok(
      warnings.some(
        (w) => w.kind === 'shortfall-add-carry-in' && w.account === C,
      ),
    );
  });
});

void describe('per-account FIFO: a join must resolve the shortfall', () => {
  void it('U1: legacy rows next to a stamped account are a draft, not final', () => {
    for (const legacy of [50, 30]) {
      const { results, warnings } = run({
        trades: [
          priced(legacy, new Date(2021, 0, 1)),
          sell(5, new Date(2022, 5, 1)),
          priced(40, new Date(2024, 0, 1), { account: A }),
          sell(10, new Date(2024, 5, 1), A),
          trade(OTHER),
        ],
      });
      assert.equal(onlySell(results).costPln, 400);
      assert.ok(isDraft(warnings));
      noAssumption(warnings);
    }
  });

  void it('N1: no join when the account stays short and the rows are consistent', () => {
    const { warnings } = run({
      trades: [
        priced(10, new Date(2023, 0, 1), { account: A, quantity: 5 }),
        sell(10, new Date(2024, 2, 1), A),
        priced(30, new Date(2023, 5, 1)),
        sell(10, new Date(2024, 0, 1)),
        trade(OTHER),
      ],
    });
    noAssumption(warnings);
    assert.ok(isDraft(warnings));
  });

  void it('N2: no join into an account that only held the instrument years ago', () => {
    const { results, warnings } = run({
      trades: [
        priced(50, new Date(2020, 0, 1), { account: A }),
        sell(10, new Date(2021, 0, 1), A),
        sell(10, new Date(2024, 0, 10)),
        priced(10, new Date(2024, 1, 1), { account: A }),
        sell(10, new Date(2024, 4, 1), A),
        trade(OTHER),
      ],
    });
    noAssumption(warnings);
    assert.ok(isDraft(warnings));
    const own = results.filter((r) => r.type === 'sell' && r.costPln === 100);
    assert.equal(own.length, 1);
    assert.equal(own[0].costBasisMissing, undefined);
  });

  void it('N3: no join when the shortfall only moves to a later sale', () => {
    const { warnings } = run({
      trades: [
        priced(10, new Date(2022, 0, 1), { account: A }),
        sell(10, new Date(2024, 5, 1), A),
        sell(5, new Date(2024, 0, 1)),
        trade(OTHER),
      ],
    });
    noAssumption(warnings);
    assert.ok(isDraft(warnings));
  });

  void it('N4: plain rows do not claim to fill a lot-id shortfall', () => {
    const ibi = 'ibi:default';
    const { warnings } = run({
      trades: [
        priced(10, new Date(2022, 0, 1), { account: ibi, lotId: 'L1' }),
        { ...sell(10, new Date(2024, 5, 1), ibi), lotId: 'L2' },
        priced(30, new Date(2022, 0, 1)),
        trade(OTHER),
      ],
    });
    noAssumption(warnings);
  });

  void it('N6: a carry-in netted against imported buys is not a join', () => {
    const { warnings } = run({
      trades: [
        priced(50, new Date(2022, 0, 1), { account: A }),
        sell(20, new Date(2024, 5, 1), A),
        trade(OTHER),
      ],
      carryInPositions: [carryIn({ quantity: 10, costPln: 400 })],
    });
    noAssumption(warnings);
    assert.ok(isDraft(warnings));
  });

  void it('L1d: ISIN-keyed legacy rows do not join a symbol-keyed account', () => {
    const noIsin = { isin: undefined };
    const { warnings } = run({
      trades: [
        priced(50, new Date(2021, 0, 1)),
        priced(40, new Date(2023, 0, 1), { account: B, ...noIsin }),
        { ...sell(15, new Date(2024, 5, 1), B), ...noIsin },
        trade({ account: A, symbol: 'MSFT', isin: 'US5949181045' }),
      ],
    });
    noAssumption(warnings);
  });

  void it('N11: groups are decided independently', () => {
    const { warnings } = run({
      trades: [
        sell(10, new Date(2024, 5, 1), A),
        priced(10, new Date(2022, 0, 1)),
        trade({ symbol: 'MSFT', isin: undefined, quantity: 3 }),
        trade(OTHER),
      ],
    });
    const assumed = warnings.filter((w) => w.kind === 'account-assumed');
    assert.equal(assumed.length, 1);
    assert.equal(assumed[0].symbol, 'AAPL');
  });
});

void describe('per-account FIFO: joins that resolve a shortfall stay', () => {
  void it('N5a: a scoped split makes the join cover the sale', () => {
    const { results, warnings } = run({
      trades: [
        priced(10, new Date(2022, 0, 1)),
        sell(20, new Date(2024, 5, 1)),
        trade({ account: A, quantity: 1, datetime: new Date(2024, 0, 1) }),
        trade(OTHER),
      ],
      corporateActions: [split({ account: A, datetime: new Date(2023, 5, 1) })],
    });
    assert.deepEqual(assumedAccounts(warnings), [A]);
    assert.equal(onlySell(results).costBasisMissing, undefined);
  });

  void it('N8: of two holders the one that ran short takes the rows', () => {
    const { warnings } = run({
      trades: [
        sell(5, new Date(2024, 1, 1), A),
        priced(10, new Date(2022, 0, 1), { account: B }),
        sell(5, new Date(2024, 2, 1), B),
        priced(30, new Date(2022, 0, 1)),
      ],
    });
    assert.deepEqual(assumedAccounts(warnings), [A]);
  });

  void it('N9: rows that fill an earlier, out-of-period shortfall join', () => {
    const { results, warnings } = run({
      trades: [
        priced(50, new Date(2022, 0, 1), { account: A, quantity: 5 }),
        sell(10, new Date(2023, 0, 1), A),
        priced(10, new Date(2023, 5, 1), { account: A }),
        sell(10, new Date(2024, 5, 1), A),
        priced(30, new Date(2021, 0, 1), { quantity: 5 }),
        trade(OTHER),
      ],
    });
    assert.deepEqual(assumedAccounts(warnings), [A]);
    assert.equal(onlySell(results).costBasisMissing, undefined);
  });
});
