import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  capitalGainsTax,
  roundedCapitalGainsBase,
  roundedDividendCredit,
  roundedDividendTax,
  sumCost,
  sumDeductibleWithholding,
  sumDividendIncome,
  sumDividendTaxToPay,
  sumGainLoss,
  sumProceeds,
  sumWithholding,
} from '../src/core/tax/aggregates.js';
import { calculateTaxes } from '../src/core/tax/calculator.js';
import type {
  EnrichedRawDividend,
  EnrichedTrade,
  EnrichedWithholdingTax,
  TaxPeriod,
} from '../src/core/types.js';

const taxPeriod2024: TaxPeriod = {
  year: 2024,
  from: new Date(2024, 0, 1),
  to: new Date(2024, 11, 31),
};

function makeTrade(overrides: Partial<EnrichedTrade>): EnrichedTrade {
  return {
    symbol: 'AAPL',
    currency: 'USD',
    datetime: new Date(2024, 5, 15),
    quantity: 100,
    price: 150,
    proceeds: 0,
    commission: 0,
    commissionCurrency: 'USD',
    type: 'buy',
    exchangeRate: 4.0,
    commissionExchangeRate: 4.0,
    rateUnavailable: false,
    ...overrides,
  };
}

function makeDiv(overrides: Partial<EnrichedRawDividend>): EnrichedRawDividend {
  return {
    symbol: 'AAPL',
    currency: 'USD',
    date: new Date(2024, 1, 15),
    amount: 100,
    exchangeRate: 4.0,
    rateUnavailable: false,
    ...overrides,
  };
}

function makeTax(
  overrides: Partial<EnrichedWithholdingTax>,
): EnrichedWithholdingTax {
  return {
    symbol: 'AAPL',
    currency: 'USD',
    date: new Date(2024, 1, 15),
    amount: -15,
    exchangeRate: 4.0,
    rateUnavailable: false,
    ...overrides,
  };
}

void describe('summary <-> per-row invariants', () => {
  void it('dividend sums match summary fields', () => {
    const result = calculateTaxes({
      trades: [],
      dividends: [
        makeDiv({ symbol: 'AAPL', amount: 100 }),
        makeDiv({ symbol: 'MSFT', amount: 50, date: new Date(2024, 3, 10) }),
      ],
      creditInterests: [],
      withholdingTaxes: [
        makeTax({ symbol: 'AAPL', amount: -15 }),
        makeTax({ symbol: 'MSFT', amount: -7.5, date: new Date(2024, 3, 10) }),
      ],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: new Map([
        ['AAPL', 'US'],
        ['MSFT', 'US'],
      ]),
    });

    const { dividends, summary } = result;

    assert.ok(
      Math.abs(
        sumDividendIncome({ rows: dividends }) - summary.totalDividendsPln,
      ) < 0.01,
      'sumDividendIncome === summary.totalDividendsPln',
    );
    assert.ok(
      Math.abs(
        sumWithholding({ rows: dividends }) - summary.totalWithholdingPln,
      ) < 0.01,
      'sumWithholding === summary.totalWithholdingPln',
    );
    assert.ok(
      Math.abs(
        sumDeductibleWithholding({ rows: dividends }) -
          summary.totalDeductibleWithholdingPln,
      ) < 0.01,
      'sumDeductibleWithholding === summary.totalDeductibleWithholdingPln',
    );
    assert.ok(
      Math.abs(
        sumDividendTaxToPay({ rows: dividends }) - summary.dividendTaxOwedPln,
      ) < 0.01,
      'sumDividendTaxToPay === summary.dividendTaxOwedPln',
    );
  });

  void it('trade sums match summary fields', () => {
    const result = calculateTaxes({
      trades: [
        makeTrade({
          datetime: new Date(2024, 0, 15),
          quantity: 100,
          price: 150,
          type: 'buy',
        }),
        makeTrade({
          datetime: new Date(2024, 6, 15),
          quantity: 100,
          price: 180,
          proceeds: 18000,
          type: 'sell',
        }),
      ],
      dividends: [],
      creditInterests: [],
      withholdingTaxes: [],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    const { trades, summary } = result;

    assert.ok(
      Math.abs(sumProceeds({ rows: trades }) - summary.totalProceedsPln) < 0.01,
      'sumProceeds === summary.totalProceedsPln',
    );
    assert.ok(
      Math.abs(sumCost({ rows: trades }) - summary.totalCostPln) < 0.01,
      'sumCost === summary.totalCostPln',
    );
    assert.ok(
      Math.abs(sumGainLoss({ rows: trades }) - summary.capitalGainPln) < 0.01,
      'sumGainLoss === summary.capitalGainPln',
    );
  });

  void it('PIT-38 dividend positions match aggregate helpers', () => {
    const result = calculateTaxes({
      trades: [],
      dividends: [makeDiv({ amount: 100 })],
      creditInterests: [],
      withholdingTaxes: [makeTax({ amount: -15 })],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: new Map([['AAPL', 'US']]),
    });

    const divIncome = sumDividendIncome({ rows: result.dividends });
    const divDeductible = sumDeductibleWithholding({
      rows: result.dividends,
    });

    const expectedPoz47 = roundedDividendTax({ totalIncomePln: divIncome });
    const expectedPoz48 = roundedDividendCredit({
      deductiblePln: divDeductible,
      dividendTax: expectedPoz47,
    });

    assert.equal(result.pit38[47], expectedPoz47);
    assert.equal(result.pit38[48], expectedPoz48);
  });

  void it('PIT-38 capital gains positions match aggregate helpers', () => {
    const result = calculateTaxes({
      trades: [
        makeTrade({
          datetime: new Date(2024, 0, 15),
          quantity: 100,
          price: 150,
          type: 'buy',
        }),
        makeTrade({
          datetime: new Date(2024, 6, 15),
          quantity: 100,
          price: 180,
          proceeds: 18000,
          type: 'sell',
        }),
      ],
      dividends: [],
      creditInterests: [],
      withholdingTaxes: [],
      corporateActions: [],
      carryInPositions: [],
      taxPeriod: taxPeriod2024,
    });

    const gain = sumGainLoss({ rows: result.trades });
    const base = roundedCapitalGainsBase({ gainPostLcfPln: gain });
    const tax = capitalGainsTax({ base });

    assert.equal(result.pit38[31], base);
    assert.ok(Math.abs(result.pit38[33] - tax) < 0.01);
  });

  void it('post-LCF summary fields reflect loss deduction', () => {
    const result = calculateTaxes({
      trades: [
        makeTrade({
          datetime: new Date(2024, 0, 15),
          quantity: 100,
          price: 100,
          type: 'buy',
        }),
        makeTrade({
          datetime: new Date(2024, 6, 15),
          quantity: 100,
          price: 200,
          proceeds: 20000,
          type: 'sell',
        }),
      ],
      dividends: [],
      creditInterests: [],
      withholdingTaxes: [],
      corporateActions: [],
      carryInPositions: [],
      priorLosses: [{ year: 2023, totalLossPln: 10000, alreadyDeductedPln: 0 }],
      taxPeriod: taxPeriod2024,
    });

    assert.ok(
      result.summary.capitalGainAfterLcfPln <
        Math.max(result.summary.capitalGainPln, 0),
    );
    assert.ok(result.summary.capitalGainAfterLcfPln >= 0);
    assert.ok(
      Math.abs(
        result.summary.capitalGainTaxPostLcfPln -
          result.summary.capitalGainAfterLcfPln * 0.19,
      ) < 0.01,
    );
  });
});
