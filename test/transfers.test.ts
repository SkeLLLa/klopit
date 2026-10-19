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
import { isCarryInIgnored } from '../src/lib/services/carry-in.js';

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

const buy = (
  account: string | undefined,
  quantity: number,
  price: number,
  datetime: Date,
  overrides: Partial<EnrichedTrade> = {},
) => trade({ account, quantity, price, datetime, ...overrides });

const sell = (
  account: string | undefined,
  quantity: number,
  datetime: Date,
  overrides: Partial<EnrichedTrade> = {},
) =>
  trade({
    type: 'sell',
    account,
    quantity,
    price: 100,
    proceeds: quantity * 100,
    datetime,
    ...overrides,
  });

function action(
  overrides: Partial<EnrichedCorporateAction>,
): EnrichedCorporateAction {
  return {
    type: 'stock-split',
    symbol: 'AAPL',
    isin: ISIN,
    datetime: new Date(2024, 2, 1),
    numerator: 1,
    denominator: 1,
    cashExchangeRate: 1,
    cashRateUnavailable: false,
    ...overrides,
  };
}

const transfer = (
  quantity: number,
  datetime: Date,
  overrides: Partial<EnrichedCorporateAction> = {},
) =>
  action({
    type: 'transfer',
    fromAccount: A,
    toAccount: B,
    quantity,
    datetime,
    ...overrides,
  });

const split = (overrides: Partial<EnrichedCorporateAction> = {}) =>
  action({ numerator: 2, denominator: 1, ...overrides });

const merger = (overrides: Partial<EnrichedCorporateAction> = {}) =>
  action({
    type: 'merger',
    datetime: new Date(2024, 4, 1),
    numerator: 0,
    denominator: 0,
    conversionRatio: 2,
    cashPerShare: 0,
    cashCurrency: 'PLN',
    targetSymbol: 'NEW',
    targetIsin: 'NEWISIN0000',
    ...overrides,
  });

function run(args: {
  trades: EnrichedTrade[];
  corporateActions?: EnrichedCorporateAction[];
  carryInPositions?: EnrichedCarryInPosition[];
}) {
  const warnings: CarryInWarning[] = [];
  const results = calculateCapitalGains({
    trades: args.trades,
    corporateActions: args.corporateActions ?? [],
    carryInPositions: args.carryInPositions ?? [],
    taxPeriod,
    onWarning: (w) => warnings.push(w),
  });
  return { results, warnings };
}

const sells = (results: ReturnType<typeof run>['results']) =>
  results.filter((r) => r.type === 'sell');

const D = (month: number, day = 1) => new Date(2024, month, day);

const snapshot = (
  account: string,
  quantity: number,
  costPln: number,
  costMissing = false,
): EnrichedCarryInPosition => ({
  symbol: 'AAPL',
  isin: ISIN,
  quantity,
  year: 2023,
  costPln,
  rateUnavailable: false,
  costMissing,
  account,
  acquisitionDate: new Date(2020, 0, 1),
});

const isDraft = (r: ReturnType<typeof run>) =>
  sells(r.results).some((x) => x.costBasisMissing) ||
  r.warnings.some((w) => w.kind === 'carry-in-inconsistent');

const costs = (r: ReturnType<typeof run>) =>
  sells(r.results).map((x) => x.costPln);

void describe('transfers between accounts', () => {
  void it('moves lots with their cost and is not a disposal', () => {
    const { results, warnings } = run({
      trades: [buy(A, 10, 10, D(0)), sell(B, 10, D(3))],
      corporateActions: [transfer(10, D(2))],
    });
    // Only the buy and the sell: the transfer adds no proceeds or income.
    assert.equal(results.length, 2);
    const [s] = sells(results);
    assert.equal(s.costPln, 100);
    assert.equal(s.costBasisMissing, undefined);
    assert.deepEqual(warnings, []);
  });

  void it('moves the oldest lots first and keeps the rest at the source', () => {
    const { results, warnings } = run({
      trades: [
        buy(A, 5, 10, D(0)),
        buy(A, 5, 20, D(1)),
        sell(B, 7, D(3)),
        sell(A, 3, D(4)),
      ],
      corporateActions: [transfer(7, D(2))],
    });
    const [atB, atA] = sells(results);
    assert.equal(atB.costPln, 5 * 10 + 2 * 20);
    assert.equal(atA.costPln, 3 * 20);
    assert.equal(atB.costBasisMissing, undefined);
    assert.equal(atA.costBasisMissing, undefined);
    assert.deepEqual(warnings, []);
  });

  void it('inserts moved lots by their acquisition date, before newer lots', () => {
    const older = run({
      trades: [
        buy(B, 10, 50, D(0, 20)),
        buy(A, 10, 10, D(0, 5)),
        sell(B, 10, D(3)),
      ],
      corporateActions: [transfer(10, D(2))],
    });
    // The moved lot is older than B's own lot: it is sold first.
    assert.equal(sells(older.results)[0].costPln, 100);

    const newer = run({
      trades: [
        buy(B, 10, 50, D(0, 5)),
        buy(A, 10, 10, D(0, 20)),
        sell(B, 10, D(3)),
      ],
      corporateActions: [transfer(10, D(2))],
    });
    assert.equal(sells(newer.results)[0].costPln, 500);
  });

  void it('carries incentive cost and a missing cost over', () => {
    const taxed = run({
      trades: [
        buy(A, 10, 10, D(0), {
          source: 'rsu',
          incentive: { regime: 'taxed-at-acquisition', taxedIncomePln: 50 },
        }),
        sell(B, 10, D(3)),
      ],
      corporateActions: [transfer(10, D(2))],
    });
    const [taxedSell] = sells(taxed.results);
    assert.equal(taxedSell.costPln, 150);
    assert.equal(taxedSell.costBasisMissing, undefined);

    // No regime chosen: the lot's cost is missing, and stays so after the move.
    const missing = run({
      trades: [buy(A, 10, 10, D(0), { source: 'rsu' }), sell(B, 10, D(3))],
      corporateActions: [transfer(10, D(2))],
    });
    assert.equal(sells(missing.results)[0].costBasisMissing, true);
  });

  void it('drops the IBI lot id at the destination', () => {
    const { results, warnings } = run({
      trades: [
        buy(A, 10, 10, D(0), { lotId: 'L1' }),
        buy(A, 10, 20, D(1), { lotId: 'L2' }),
        // No lot id at B: it only finds the lots if the move dropped it.
        sell(B, 15, D(3)),
        sell(A, 5, D(4), { lotId: 'L2' }),
      ],
      corporateActions: [transfer(15, D(2))],
    });
    const [atB, atA] = sells(results);
    assert.equal(atB.costPln, 10 * 10 + 5 * 20);
    assert.equal(atB.costBasisMissing, undefined);
    // The rest stays in the source's lot queue.
    assert.equal(atA.costPln, 5 * 20);
    assert.equal(atA.costBasisMissing, undefined);
    assert.deepEqual(warnings, []);
  });

  void it('moves what exists, never invents cost, and drafts on a source shortfall', () => {
    const { results, warnings } = run({
      trades: [buy(A, 5, 10, D(0)), sell(B, 5, D(3))],
      corporateActions: [transfer(8, D(2))],
    });
    // Five shares moved with cost, three are missing.
    const [s] = sells(results);
    assert.equal(s.costPln, 50);
    assert.equal(s.costBasisMissing, true);
    assert.deepEqual(warnings, [
      {
        kind: 'transfer-shortfall',
        instrument: 'AAPL',
        isin: ISIN,
        fromAccount: A,
        toAccount: B,
        quantity: 3,
        before: D(2),
      },
    ]);
  });

  void it('a transfer from an empty source moves nothing', () => {
    const { results, warnings } = run({
      trades: [buy(B, 5, 10, D(0)), sell(B, 5, D(3))],
      corporateActions: [transfer(2, D(2))],
    });
    assert.equal(sells(results)[0].costBasisMissing, true);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].kind, 'transfer-shortfall');
  });

  void it('resolves a transfer-suggested case: final result, no warnings', () => {
    const trades = [buy(B, 10, 10, D(0)), sell(A, 10, D(3))];
    const before = run({ trades });
    assert.equal(
      before.warnings.some((w) => w.kind === 'transfer-suggested'),
      true,
    );
    assert.equal(sells(before.results)[0].costBasisMissing, true);

    const after = run({
      trades,
      corporateActions: [transfer(10, D(2), { fromAccount: B, toAccount: A })],
    });
    const [s] = sells(after.results);
    assert.equal(s.costPln, 100);
    assert.equal(s.costBasisMissing, undefined);
    assert.deepEqual(after.warnings, []);
  });

  void it('a split before the transfer moves split-adjusted lots', () => {
    const { results } = run({
      trades: [buy(A, 10, 20, D(0)), sell(B, 20, D(4))],
      corporateActions: [split(), transfer(20, D(2, 15))],
    });
    const [s] = sells(results);
    assert.equal(s.costPln, 200);
    assert.equal(s.costBasisMissing, undefined);
  });

  void it('a split after the transfer applies to the destination', () => {
    const unscoped = run({
      trades: [buy(A, 10, 20, D(0)), sell(B, 20, D(4))],
      corporateActions: [transfer(10, D(1)), split()],
    });
    assert.equal(sells(unscoped.results)[0].costPln, 200);
    assert.equal(sells(unscoped.results)[0].costBasisMissing, undefined);

    // A split scoped to the source no longer touches the moved lots.
    const scopedAtSource = run({
      trades: [buy(A, 10, 20, D(0)), sell(B, 20, D(4))],
      corporateActions: [transfer(10, D(1)), split({ account: A })],
    });
    assert.equal(sells(scopedAtSource.results)[0].costBasisMissing, true);

    const scopedAtDest = run({
      trades: [buy(A, 10, 20, D(0)), sell(B, 20, D(4))],
      corporateActions: [transfer(10, D(1)), split({ account: B })],
    });
    assert.equal(sells(scopedAtDest.results)[0].costBasisMissing, undefined);
    assert.equal(sells(scopedAtDest.results)[0].costPln, 200);
  });

  void it('a merger after the transfer converts the moved lots at the destination', () => {
    const { results, warnings } = run({
      trades: [
        buy(A, 10, 10, D(0)),
        sell(B, 20, D(5), { symbol: 'NEW', isin: 'NEWISIN0000' }),
      ],
      corporateActions: [transfer(10, D(2)), merger()],
    });
    const [s] = sells(results);
    assert.equal(s.costPln, 100);
    assert.equal(s.costBasisMissing, undefined);
    assert.deepEqual(warnings, []);
  });

  void it('keys the destination like its own trades (symbol-only account)', () => {
    const { results } = run({
      trades: [
        buy(A, 10, 10, D(0)),
        // Schwab rows carry no ISIN.
        buy(B, 5, 30, D(0, 5), { isin: undefined }),
        sell(B, 15, D(4), { isin: undefined }),
      ],
      corporateActions: [transfer(10, D(2))],
    });
    const [s] = sells(results);
    assert.equal(s.costPln, 100 + 150);
    assert.equal(s.costBasisMissing, undefined);
  });

  void it('legacy unstamped rows join the source account a transfer needs', () => {
    const { results, warnings } = run({
      trades: [
        buy(A, 5, 20, D(0)),
        buy(B, 5, 30, D(0, 5)),
        // Legacy rows without an account.
        buy(undefined, 10, 10, D(0, 2)),
        sell(B, 10, D(4)),
      ],
      corporateActions: [transfer(12, D(2))],
    });
    // The dry runs see the transfer row: only account A can cover it.
    assert.deepEqual(
      warnings.map((w) => w.kind),
      ['account-assumed'],
    );
    assert.equal(
      warnings[0].kind === 'account-assumed' && warnings[0].account,
      A,
    );
    const [s] = sells(results);
    // Moved: 5 @ 20 (Jan 1) and 7 @ 10 (Jan 2), ahead of B's own 5 @ 30.
    assert.equal(s.costPln, 100 + 50);
    assert.equal(s.costBasisMissing, undefined);
  });

  void it('legacy unstamped rows stay a draft when the transfer is short and nothing resolves it', () => {
    const { results, warnings } = run({
      trades: [
        buy(A, 5, 20, D(0)),
        buy(B, 5, 30, D(0, 5)),
        buy(undefined, 1, 10, D(0, 2)),
        sell(B, 10, D(4)),
      ],
      corporateActions: [transfer(12, D(2))],
    });
    assert.equal(sells(results)[0].costBasisMissing, true);
    assert.ok(warnings.some((w) => w.kind === 'transfer-shortfall'));
  });

  void it('moves a carry-in lot with its cost', () => {
    const { results, warnings } = run({
      trades: [sell(B, 10, D(3))],
      carryInPositions: [
        {
          symbol: 'AAPL',
          isin: ISIN,
          quantity: 10,
          year: 2023,
          costPln: 400,
          rateUnavailable: false,
          costMissing: false,
          account: A,
        },
      ],
      corporateActions: [transfer(10, D(2))],
    });
    const [s] = sells(results);
    assert.equal(s.costPln, 400);
    assert.equal(s.costBasisMissing, undefined);
    assert.deepEqual(warnings, []);
  });

  void it('ignores unusable transfer rows', () => {
    const trades = [buy(A, 10, 10, D(0)), sell(A, 10, D(3))];
    const plain = run({ trades });
    for (const bad of [
      transfer(10, D(2), { toAccount: A }),
      transfer(0, D(2)),
      transfer(10, D(2), { fromAccount: undefined }),
    ]) {
      const withBad = run({ trades, corporateActions: [bad] });
      assert.deepEqual(withBad.results, plain.results);
      assert.deepEqual(withBad.warnings, [
        { kind: 'transfer-invalid', instrument: 'AAPL', date: D(2) },
      ]);
    }
  });

  void it('leaves other instruments untouched', () => {
    const other = { symbol: 'MSFT', isin: 'US5949181045' };
    const trades = [
      buy(A, 10, 10, D(0), other),
      sell(A, 10, D(3), other),
      buy(A, 10, 10, D(0)),
    ];
    const plain = run({ trades });
    const withTransfer = run({
      trades,
      corporateActions: [transfer(10, D(2))],
    });
    assert.deepEqual(
      withTransfer.results.filter((r) => r.symbol === 'MSFT'),
      plain.results.filter((r) => r.symbol === 'MSFT'),
    );
  });

  void describe('carry-in snapshots and transfers in the same year', () => {
    const T23 = new Date(2023, 2, 1);

    void it('K7: the source snapshot is the holding after the transfer', () => {
      const { results, warnings } = run({
        trades: [sell(B, 5, D(5))],
        carryInPositions: [snapshot(A, 5, 200)],
        corporateActions: [transfer(5, T23)],
      });
      // The 5 moved shares had unknown cost: the destination sale is a draft.
      assert.equal(sells(results)[0].costBasisMissing, true);
      assert.ok(warnings.some((w) => w.kind === 'transfer-shortfall'));
      assert.ok(!warnings.some((w) => w.kind === 'carry-in-overlap'));
      assert.ok(!warnings.some((w) => w.kind === 'carry-in-inconsistent'));
    });

    void it('K7b: the source still holds the snapshot and sells it at cost', () => {
      const { results } = run({
        trades: [sell(B, 5, D(5)), sell(A, 5, D(6))],
        carryInPositions: [snapshot(A, 5, 200)],
        corporateActions: [transfer(5, T23)],
      });
      const source = sells(results)[1];
      assert.equal(source.costPln, 200);
      assert.equal(source.costBasisMissing, undefined);
    });

    void it('K8: a snapshot without cost is still asked for', () => {
      const row = snapshot(A, 5, 0, true);
      const { results, warnings } = run({
        trades: [sell(B, 5, D(5))],
        carryInPositions: [row],
        corporateActions: [transfer(5, T23)],
      });
      assert.equal(sells(results)[0].costBasisMissing, true);
      assert.equal(isCarryInIgnored(row, warnings), false);
    });

    void it('K1: snapshots at both ends never give a final cost', () => {
      const { results } = run({
        trades: [buy(B, 5, 20, new Date(2023, 4, 1)), sell(B, 10, D(5))],
        carryInPositions: [snapshot(A, 5, 200), snapshot(B, 10, 300)],
        corporateActions: [transfer(5, T23)],
      });
      assert.equal(sells(results)[0].costBasisMissing, true);
    });

    void it('a transfer after the snapshot year moves the snapshot lot', () => {
      const { results, warnings } = run({
        trades: [sell(B, 5, D(5))],
        carryInPositions: [snapshot(A, 5, 200)],
        corporateActions: [transfer(5, D(2))],
      });
      assert.equal(sells(results)[0].costPln, 200);
      assert.deepEqual(warnings, []);
    });
  });

  void describe('IBKR-style snapshots and unexplained transfers', () => {
    const auto = (year: number, quantity: number): EnrichedCarryInPosition => ({
      symbol: 'AAPL',
      quantity,
      year,
      costPln: 0,
      rateUnavailable: false,
      costMissing: true,
      account: A,
    });
    const T23 = new Date(2023, 2, 1);
    const ibkr = {
      trades: [
        buy(A, 10, 40, new Date(2020, 0, 1)),
        buy(A, 2, 45, new Date(2023, 6, 1)),
        sell(B, 5, D(5)),
        sell(A, 7, D(8)),
      ],
      corporateActions: [transfer(5, T23)],
    };

    void it('R1: consistent auto snapshots stay final', () => {
      const r = run({
        ...ibkr,
        carryInPositions: [auto(2022, 10), auto(2023, 7)],
      });
      assert.deepEqual(costs(r), [200, 290]);
      assert.equal(isDraft(r), false);
    });

    void it('R2: a single auto snapshot stays final', () => {
      const r = run({ ...ibkr, carryInPositions: [auto(2023, 7)] });
      assert.deepEqual(costs(r), [200, 290]);
      assert.equal(isDraft(r), false);
    });

    void it('A3: snapshots at both ends of a consistent transfer', () => {
      const r = run({
        trades: [
          buy(A, 10, 40, new Date(2020, 0, 1)),
          buy(B, 5, 20, new Date(2023, 5, 1)),
          sell(B, 10, D(5)),
        ],
        carryInPositions: [snapshot(A, 5, 200), snapshot(B, 10, 300)],
        corporateActions: [transfer(5, T23)],
      });
      assert.equal(isDraft(r), false);
    });

    void it('A4: source snapshot explained by imports stays final', () => {
      const r = run({
        trades: [
          buy(A, 10, 40, new Date(2020, 0, 1)),
          sell(B, 5, D(5)),
          sell(A, 5, D(8)),
        ],
        carryInPositions: [snapshot(A, 5, 200)],
        corporateActions: [transfer(5, T23)],
      });
      assert.deepEqual(costs(r), [200, 200]);
      assert.equal(isDraft(r), false);
    });

    void it('B3/B3x: the snapshot shares stay at the source and are final', () => {
      const r = run({
        trades: [
          buy(A, 8, 30, new Date(2019, 0, 1)),
          sell(A, 3, new Date(2023, 1, 1)),
          sell(B, 5, D(5)),
          sell(A, 5, D(8)),
        ],
        carryInPositions: [snapshot(A, 5, 200)],
        corporateActions: [transfer(5, T23)],
      });
      const [dest, source] = sells(r.results);
      assert.equal(dest.costPln, 150);
      assert.equal(dest.costBasisMissing, undefined);
      // Shares the imports do not explain count as older than every import
      // (as without transfers): the Feb 2023 sell took 3 of them, so the
      // source's last 5 are 2@40 (snapshot) + 3@30.
      assert.equal(source.costPln, 170);
      assert.equal(source.costBasisMissing, undefined);
      assert.equal(isDraft(r), false);
    });

    const IBI = 'ibi:default';
    const donor = [
      buy(IBI, 10, 30, new Date(2020, 0, 1)),
      buy(IBI, 3, 50, new Date(2022, 0, 1)),
      sell(IBI, 10, D(8)),
    ];

    void it('S1: a short transfer still taints a third-account donor', () => {
      const r = run({
        trades: [
          buy(A, 2, 40, new Date(2020, 0, 1)),
          sell(B, 5, new Date(2023, 8, 1)),
          ...donor,
        ],
        corporateActions: [transfer(5, T23)],
      });
      const ibi = sells(r.results).at(-1);
      assert.equal(ibi?.costBasisMissing, true);
      // The shortfall is the transfer's: no extra suggestion for it.
      assert.ok(!r.warnings.some((w) => w.kind === 'transfer-suggested'));
    });

    void it('S3: a shortfall beyond the transfer is still suggested', () => {
      const r = run({
        trades: [
          buy(A, 2, 40, new Date(2020, 0, 1)),
          sell(B, 8, new Date(2023, 8, 1)),
          ...donor,
        ],
        corporateActions: [transfer(5, T23)],
      });
      const suggested = r.warnings.filter(
        (w) => w.kind === 'transfer-suggested',
      );
      assert.equal(suggested.length, 1);
      assert.equal(suggested[0].quantity, 3);
      assert.equal(sells(r.results).at(-1)?.costBasisMissing, true);
    });
  });
});
