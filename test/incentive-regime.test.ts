import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { calculateTaxes } from '../src/core/tax/calculator.js';
import { calculateCapitalGains } from '../src/core/tax/capital-gains.js';
import type {
  EnrichedCorporateAction,
  EnrichedTrade,
  TaxPeriod,
  TradeIncentive,
} from '../src/core/types.js';

const taxPeriod2024: TaxPeriod = {
  year: 2024,
  from: new Date(2024, 0, 1),
  to: new Date(2024, 11, 31),
};

function makeTrade(overrides: Partial<EnrichedTrade>): EnrichedTrade {
  return {
    symbol: 'ACME',
    currency: 'USD',
    datetime: new Date(2024, 0, 15),
    quantity: 10,
    price: 0,
    proceeds: 0,
    commission: 0,
    commissionCurrency: 'USD',
    type: 'buy',
    exchangeRate: 4,
    commissionExchangeRate: 4,
    rateUnavailable: false,
    ...overrides,
  };
}

function rsuBuy(
  incentive?: TradeIncentive,
  overrides?: Partial<EnrichedTrade>,
) {
  return makeTrade({ source: 'rsu', incentive, ...overrides });
}

function sell(overrides?: Partial<EnrichedTrade>) {
  return makeTrade({
    type: 'sell',
    datetime: new Date(2024, 5, 1),
    price: 100,
    proceeds: 1000,
    exchangeRate: 5,
    ...overrides,
  });
}

function run(
  trades: EnrichedTrade[],
  corporateActions: EnrichedCorporateAction[] = [],
) {
  return calculateCapitalGains({
    trades,
    corporateActions,
    carryInPositions: [],
    taxPeriod: taxPeriod2024,
  }).filter((r) => r.type === 'sell');
}

void describe('incentive shares cost basis', () => {
  void it('qualifying RSU: cost is the price paid (0)', () => {
    const [result] = run([rsuBuy({ regime: 'qualifying' }), sell()]);
    assert.equal(result.costPln, 0);
    assert.equal(result.gainLossPln, 5000);
    assert.equal(result.costBasisMissing, undefined);
  });

  void it('qualifying ESPP: cost is the discounted price plus commission', () => {
    const [result] = run([
      makeTrade({
        source: 'espp',
        price: 40,
        commission: 2,
        incentive: { regime: 'qualifying', fmvPerShare: 50 },
      }),
      sell(),
    ]);
    // 10 * 40 * 4 + 2 * 4
    assert.equal(result.costPln, 1608);
    assert.equal(result.costBasisMissing, undefined);
  });

  void it('taxed-at-acquisition: adds the taxed income PLN', () => {
    const [result] = run([
      rsuBuy({ regime: 'taxed-at-acquisition', taxedIncomePln: 2000 }),
      sell(),
    ]);
    assert.equal(result.costPln, 2000);
    assert.equal(result.costBasisMissing, undefined);
  });

  void it('taxed-at-acquisition: derives the income from FMV at the buy rate', () => {
    const [result] = run([
      makeTrade({
        source: 'espp',
        price: 40,
        incentive: { regime: 'taxed-at-acquisition', fmvPerShare: 50 },
      }),
      sell(),
    ]);
    // paid 10 * 40 * 4 = 1600, taxed income (50 - 40) * 10 * 4 = 400
    assert.equal(result.costPln, 2000);
  });

  void it('explicit taxedIncomePln wins over the FMV derivation', () => {
    const [result] = run([
      rsuBuy({
        regime: 'taxed-at-acquisition',
        taxedIncomePln: 100,
        fmvPerShare: 50,
      }),
      sell(),
    ]);
    assert.equal(result.costPln, 100);
  });

  void it('taxed-at-acquisition without income or FMV is cost-missing', () => {
    const [result] = run([rsuBuy({ regime: 'taxed-at-acquisition' }), sell()]);
    assert.equal(result.costPln, 0);
    assert.equal(result.costBasisMissing, true);
  });

  void it('unset regime: price paid, cost-missing', () => {
    const [result] = run([
      makeTrade({ source: 'espp', price: 40, incentive: { fmvPerShare: 50 } }),
      sell(),
    ]);
    assert.equal(result.costPln, 1600);
    assert.equal(result.costBasisMissing, true);
  });

  void it('legacy rsu row without incentive data is cost-missing', () => {
    const [result] = run([rsuBuy(), sell()]);
    assert.equal(result.costBasisMissing, true);
  });

  void it('regular trades are unaffected', () => {
    const [result] = run([makeTrade({ price: 40 }), sell()]);
    assert.equal(result.costPln, 1600);
    assert.equal(result.costBasisMissing, undefined);
  });

  void it('regime and cost survive a split', () => {
    const split: EnrichedCorporateAction = {
      type: 'stock-split',
      symbol: 'ACME',
      datetime: new Date(2024, 2, 1),
      numerator: 2,
      denominator: 1,
      cashExchangeRate: 0,
      cashRateUnavailable: false,
    };
    const [taxed] = run(
      [
        rsuBuy({ regime: 'taxed-at-acquisition', taxedIncomePln: 2000 }),
        sell({ quantity: 20 }),
      ],
      [split],
    );
    assert.equal(taxed.costPln, 2000);
    assert.equal(taxed.costBasisMissing, undefined);

    const [unset] = run([rsuBuy(), sell({ quantity: 20 })], [split]);
    assert.equal(unset.costBasisMissing, true);
  });

  void it('unset regime marks the summary as incomplete (form draft gate)', () => {
    const result = calculateTaxes({
      trades: [rsuBuy(), sell()],
      dividends: [],
      creditInterests: [],
      withholdingTaxes: [],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });
    assert.equal(result.summary.missingCostCount, 1);

    const chosen = calculateTaxes({
      trades: [rsuBuy({ regime: 'qualifying' }), sell()],
      dividends: [],
      creditInterests: [],
      withholdingTaxes: [],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });
    assert.equal(chosen.summary.missingCostCount, 0);
  });
});
