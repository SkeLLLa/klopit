import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { calculateTaxes } from '../src/core/tax/calculator.js';
import type {
  EnrichedTrade,
  PriorYearLoss,
  TaxPeriod,
} from '../src/core/types.js';

const taxPeriod: TaxPeriod = {
  year: 2024,
  from: new Date(2024, 0, 1),
  to: new Date(2024, 11, 31),
};

function trade(overrides: Partial<EnrichedTrade>): EnrichedTrade {
  return {
    symbol: 'AAPL',
    currency: 'PLN',
    datetime: new Date(2024, 1, 1),
    quantity: 1,
    price: 0,
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

/** A buy (cost) and a later sell (gain = proceeds - cost) in PLN at rate 1. */
function position(args: {
  symbol: string;
  cost: number;
  proceeds: number;
  foreignTax?: number;
  foreignTaxExchangeRate?: number;
}): EnrichedTrade[] {
  return [
    trade({
      symbol: args.symbol,
      price: args.cost,
      proceeds: args.cost,
      type: 'buy',
    }),
    trade({
      symbol: args.symbol,
      datetime: new Date(2024, 5, 1),
      price: args.proceeds,
      proceeds: args.proceeds,
      type: 'sell',
      ...(args.foreignTax === undefined
        ? {}
        : {
            foreignTax: args.foreignTax,
            foreignTaxExchangeRate: args.foreignTaxExchangeRate ?? 1,
          }),
    }),
  ];
}

function run(args: {
  trades: EnrichedTrade[];
  countries: [string, string][];
  priorLosses?: PriorYearLoss[];
}) {
  return calculateTaxes({
    trades: args.trades,
    dividends: [],
    creditInterests: [],
    withholdingTaxes: [],
    corporateActions: [],
    carryInPositions: [],
    taxPeriod,
    ...(args.priorLosses ? { priorLosses: args.priorLosses } : {}),
    symbolCountryMap: new Map(args.countries),
  });
}

const pz = (r: ReturnType<typeof run>, country: string) =>
  r.pitZg.find((e) => e.country === country);

void describe('foreign tax on gains (PIT-38 poz. 34, PIT/ZG)', () => {
  void it('Z1: loss elsewhere, two taxed countries', () => {
    const r = run({
      trades: [
        ...position({
          symbol: 'DE1',
          cost: 1000,
          proceeds: 3000,
          foreignTax: 100,
        }),
        ...position({
          symbol: 'IL1',
          cost: 1000,
          proceeds: 2000,
          foreignTax: 150,
        }),
        ...position({ symbol: 'US1', cost: 2500, proceeds: 1000 }),
      ],
      countries: [
        ['DE1', 'DE'],
        ['IL1', 'IL'],
        ['US1', 'US'],
      ],
    });
    assert.equal(r.pit38[28], 1500);
    assert.equal(r.pit38[33], 285);
    assert.equal(r.pit38[34], 250);
    assert.equal(r.pit38[35], 35);
    assert.equal(pz(r, 'DE')?.required, true);
    assert.equal(pz(r, 'DE')?.tradeForeignTaxPln, 100);
    assert.equal(pz(r, 'IL')?.tradeForeignTaxPln, 150);
    assert.equal(pz(r, 'US')?.required, false);
  });

  void it('Z2: partly taxed country is limited to the taxed sells', () => {
    const r = run({
      trades: [
        ...position({
          symbol: 'PTP',
          cost: 1000,
          proceeds: 2000,
          foreignTax: 300,
        }),
        ...position({ symbol: 'AAPL', cost: 1000, proceeds: 5000 }),
      ],
      countries: [
        ['PTP', 'US'],
        ['AAPL', 'US'],
      ],
    });
    assert.equal(r.pit38[28], 5000);
    assert.equal(r.pit38[33], 950);
    assert.equal(r.pit38[34], 190);
    assert.equal(r.pit38[35], 760);
    assert.equal(pz(r, 'US')?.tradeForeignTaxPln, 300);
  });

  void it('Z3: loss carry-forward with a single taxed country', () => {
    const r = run({
      trades: position({
        symbol: 'DE1',
        cost: 1000,
        proceeds: 3000,
        foreignTax: 380,
      }),
      countries: [['DE1', 'DE']],
      priorLosses: [{ year: 2023, totalLossPln: 2000, alreadyDeductedPln: 0 }],
    });
    assert.equal(r.pit38[28], 2000);
    assert.equal(r.pit38[30], 1000);
    assert.equal(r.pit38[31], 1000);
    assert.equal(r.pit38[33], 190);
    assert.equal(r.pit38[34], 190);
    assert.equal(r.pit38[35], 0);
  });

  void it('Z4: domestic loss', () => {
    const r = run({
      trades: [
        ...position({ symbol: 'PL1', cost: 2000, proceeds: 1000 }),
        ...position({
          symbol: 'DE1',
          cost: 1000,
          proceeds: 3000,
          foreignTax: 300,
        }),
      ],
      countries: [
        ['PL1', 'PL'],
        ['DE1', 'DE'],
      ],
    });
    assert.equal(r.pit38[28], 1000);
    assert.equal(r.pit38[33], 190);
    assert.equal(r.pit38[34], 190);
    assert.equal(r.pit38[35], 0);
  });

  void it('Z5: credit caps at the rounded poz. 33', () => {
    const r = run({
      trades: position({
        symbol: 'DE1',
        cost: 1000,
        proceeds: 2000.4,
        foreignTax: 1000,
      }),
      countries: [['DE1', 'DE']],
    });
    assert.equal(r.pit38[28], 1000.4);
    assert.equal(r.pit38[31], 1000);
    assert.equal(r.pit38[33], 190);
    assert.equal(r.pit38[34], 190);
    assert.equal(r.pit38[35], 0);
  });

  void it('Z6: no foreign tax gives poz. 34 = 0 and no required PIT/ZG', () => {
    const r = run({
      trades: position({ symbol: 'DE1', cost: 1000, proceeds: 3000 }),
      countries: [['DE1', 'DE']],
    });
    assert.equal(r.pit38[34], 0);
    assert.equal(r.pit38[35], 380);
    assert.ok(r.pitZg.every((e) => !e.required));
  });

  void it('converts foreign tax at its own rate (art. 11a ust. 3)', () => {
    const r = run({
      trades: position({
        symbol: 'US1',
        cost: 1000,
        proceeds: 3000,
        foreignTax: 50,
        foreignTaxExchangeRate: 4,
      }),
      countries: [['US1', 'US']],
    });
    const sell = r.trades.find((t) => t.type === 'sell');
    assert.ok(sell);
    assert.equal(sell.foreignTaxOriginal, 50);
    assert.equal(sell.foreignTaxPln, 200);
    assert.equal(r.pit38[34], 200);
  });
});
