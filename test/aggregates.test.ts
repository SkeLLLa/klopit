import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  capitalGainsTax,
  groupByCountry,
  roundedCapitalGainsBase,
  roundedCapitalGainsTaxDue,
  roundedDividendCredit,
  roundedDividendDifference,
  roundedDividendTax,
  roundedTotalTaxToPay,
  sumCost,
  sumCreditInterestForeignTax,
  sumCreditInterestIncome,
  sumDeductibleWithholding,
  sumDividendIncome,
  sumDividendTaxGross,
  sumDividendTaxToPay,
  sumGainLoss,
  sumProceeds,
  sumTradeTaxPreLcf,
  sumWithholding,
} from '../src/core/tax/aggregates.js';
import type {
  CreditInterestResult,
  DividendResult,
  TradeResult,
} from '../src/core/types.js';

function makeDivResult(
  overrides: Partial<DividendResult> = {},
): DividendResult {
  return {
    symbol: 'AAPL',
    currency: 'USD',
    date: new Date(2024, 2, 15),
    amountOriginal: 50,
    withholdingTaxOriginal: 7.5,
    amountPln: 200,
    withholdingTaxPln: 30,
    exchangeRate: 4.0,
    rateUnavailable: false,
    country: 'US',
    creditCapRate: 0.15,
    deductibleWithholdingPln: 30,
    taxPlnGross: 38,
    taxToPayPln: 8,
    ...overrides,
  };
}

function makeSellResult(overrides: Partial<TradeResult> = {}): TradeResult {
  return {
    symbol: 'AAPL',
    datetime: new Date(2024, 6, 15),
    type: 'sell',
    source: 'trade',
    quantity: 100,
    price: 180,
    proceeds: 18000,
    commission: 10,
    currency: 'USD',
    exchangeRate: 4.0,
    proceedsPln: 71960,
    costPln: 60000,
    gainLossPln: 11960,
    rateUnavailable: false,
    country: 'US',
    taxPln: 2272.4,
    foreignTaxPln: 0,
    foreignTaxOriginal: 0,
    ...overrides,
  };
}

function makeCreditInterestResult(
  overrides: Partial<CreditInterestResult> = {},
): CreditInterestResult {
  return {
    currency: 'USD',
    date: new Date(2024, 3, 5),
    description: 'USD Credit Interest for Mar-2024',
    amountOriginal: 10,
    amountPln: 40,
    exchangeRate: 4.0,
    fxDate: '2024-04-04',
    rateUnavailable: false,
    taxPlnGross: 7.6,
    foreignTaxOriginal: 0,
    foreignTaxPln: 0,
    foreignTaxExchangeRate: 0,
    ...overrides,
  };
}

// ---- Dividend sums ----

void describe('sumDividendIncome', () => {
  void it('returns 0 for empty array', () => {
    assert.equal(sumDividendIncome({ rows: [] }), 0);
  });

  void it('sums amountPln across rows', () => {
    const rows = [
      makeDivResult({ amountPln: 100 }),
      makeDivResult({ amountPln: 200 }),
    ];
    assert.equal(sumDividendIncome({ rows }), 300);
  });
});

void describe('sumWithholding', () => {
  void it('returns 0 for empty array', () => {
    assert.equal(sumWithholding({ rows: [] }), 0);
  });

  void it('sums withholdingTaxPln', () => {
    const rows = [
      makeDivResult({ withholdingTaxPln: 10 }),
      makeDivResult({ withholdingTaxPln: 20 }),
    ];
    assert.equal(sumWithholding({ rows }), 30);
  });
});

void describe('sumDeductibleWithholding', () => {
  void it('returns 0 for empty array', () => {
    assert.equal(sumDeductibleWithholding({ rows: [] }), 0);
  });

  void it('sums deductibleWithholdingPln', () => {
    const rows = [
      makeDivResult({ deductibleWithholdingPln: 15 }),
      makeDivResult({ deductibleWithholdingPln: 20 }),
    ];
    assert.equal(sumDeductibleWithholding({ rows }), 35);
  });
});

void describe('sumDividendTaxGross', () => {
  void it('returns 0 for empty array', () => {
    assert.equal(sumDividendTaxGross({ rows: [] }), 0);
  });

  void it('sums taxPlnGross', () => {
    const rows = [
      makeDivResult({ taxPlnGross: 19 }),
      makeDivResult({ taxPlnGross: 38 }),
    ];
    assert.equal(sumDividendTaxGross({ rows }), 57);
  });
});

void describe('sumCreditInterestIncome', () => {
  void it('returns 0 for empty array', () => {
    assert.equal(sumCreditInterestIncome({ rows: [] }), 0);
  });

  void it('sums amountPln across rows', () => {
    const rows = [
      makeCreditInterestResult({ amountPln: 40 }),
      makeCreditInterestResult({ amountPln: 12.5 }),
    ];
    assert.equal(sumCreditInterestIncome({ rows }), 52.5);
  });
});

void describe('sumCreditInterestForeignTax', () => {
  void it('returns 0 for empty array', () => {
    assert.equal(sumCreditInterestForeignTax({ rows: [] }), 0);
  });

  void it('sums foreignTaxPln across rows', () => {
    const rows = [
      makeCreditInterestResult({ foreignTaxPln: 0 }),
      makeCreditInterestResult({ foreignTaxPln: 3.25 }),
    ];
    assert.equal(sumCreditInterestForeignTax({ rows }), 3.25);
  });
});

void describe('sumDividendTaxToPay', () => {
  void it('returns 0 for empty array', () => {
    assert.equal(sumDividendTaxToPay({ rows: [] }), 0);
  });

  void it('sums taxToPayPln', () => {
    const rows = [
      makeDivResult({ taxToPayPln: 4 }),
      makeDivResult({ taxToPayPln: 18 }),
    ];
    assert.equal(sumDividendTaxToPay({ rows }), 22);
  });
});

// ---- Trade sums ----

void describe('sumProceeds', () => {
  void it('returns 0 for empty array', () => {
    assert.equal(sumProceeds({ rows: [] }), 0);
  });

  void it('sums only sell trades', () => {
    const rows = [
      makeSellResult({ proceedsPln: 1000 }),
      makeSellResult({ type: 'buy', proceedsPln: 500 }),
      makeSellResult({ proceedsPln: 2000 }),
    ];
    assert.equal(sumProceeds({ rows }), 3000);
  });
});

void describe('sumCost', () => {
  void it('returns 0 for empty array', () => {
    assert.equal(sumCost({ rows: [] }), 0);
  });

  void it('sums only sell trades', () => {
    const rows = [
      makeSellResult({ costPln: 800 }),
      makeSellResult({ type: 'buy', costPln: 100 }),
    ];
    assert.equal(sumCost({ rows }), 800);
  });
});

void describe('sumGainLoss', () => {
  void it('returns 0 for empty array', () => {
    assert.equal(sumGainLoss({ rows: [] }), 0);
  });

  void it('sums positive and negative gain/loss', () => {
    const rows = [
      makeSellResult({ gainLossPln: 500 }),
      makeSellResult({ gainLossPln: -200 }),
    ];
    assert.equal(sumGainLoss({ rows }), 300);
  });
});

void describe('sumTradeTaxPreLcf', () => {
  void it('returns 0 for empty array', () => {
    assert.equal(sumTradeTaxPreLcf({ rows: [] }), 0);
  });

  void it('sums taxPln across sells only', () => {
    const rows = [
      makeSellResult({ taxPln: 95 }),
      makeSellResult({ taxPln: 0 }),
      makeSellResult({ type: 'buy', taxPln: 0 }),
    ];
    assert.equal(sumTradeTaxPreLcf({ rows }), 95);
  });
});

// ---- groupByCountry ----

void describe('groupByCountry', () => {
  void it('returns empty map for empty input', () => {
    const map = groupByCountry({ rows: [] });
    assert.equal(map.size, 0);
  });

  void it('groups rows by country', () => {
    const rows = [
      makeDivResult({ country: 'US' }),
      makeDivResult({ country: 'DE' }),
      makeDivResult({ country: 'US' }),
    ];
    const map = groupByCountry({ rows });
    assert.equal(map.size, 2);
    assert.equal(map.get('US')?.length, 2);
    assert.equal(map.get('DE')?.length, 1);
  });
});

// ---- Rounded helpers ----

void describe('roundedDividendTax', () => {
  void it('returns exact value for clean amount (PIT-38 poz 47)', () => {
    assert.equal(roundedDividendTax({ totalIncomePln: 1000 }), 190);
  });

  void it('ceils fractional grosze', () => {
    assert.equal(roundedDividendTax({ totalIncomePln: 33.33 }), 6.34);
  });

  void it('returns 0 for zero income', () => {
    assert.equal(roundedDividendTax({ totalIncomePln: 0 }), 0);
  });
});

void describe('roundedDividendCredit', () => {
  void it('caps at dividend tax (PIT-38 poz 48)', () => {
    assert.equal(
      roundedDividendCredit({ deductiblePln: 200, dividendTax: 190 }),
      190,
    );
  });

  void it('returns deductible when less than tax', () => {
    assert.equal(
      roundedDividendCredit({ deductiblePln: 150, dividendTax: 190 }),
      150,
    );
  });

  void it('rounds to 2 decimal places', () => {
    assert.equal(
      roundedDividendCredit({ deductiblePln: 15.005, dividendTax: 20 }),
      15.01,
    );
  });
});

void describe('roundedDividendDifference', () => {
  void it('ceils to grosz (PIT-38 poz 49)', () => {
    assert.equal(
      roundedDividendDifference({ dividendTax: 190, credit: 150 }),
      40,
    );
  });

  void it('returns 0 when credit >= tax', () => {
    assert.equal(roundedDividendDifference({ dividendTax: 19, credit: 19 }), 0);
  });
});

void describe('roundedCapitalGainsBase', () => {
  void it('rounds to full PLN (PIT-38 poz 31)', () => {
    assert.equal(roundedCapitalGainsBase({ gainPostLcfPln: 1000.5 }), 1001);
  });

  void it('returns 0 for negative gain', () => {
    assert.equal(roundedCapitalGainsBase({ gainPostLcfPln: -500 }), 0);
  });
});

void describe('capitalGainsTax', () => {
  void it('computes 19% of base (PIT-38 poz 33)', () => {
    assert.equal(capitalGainsTax({ base: 20000 }), 3800);
  });

  void it('returns 0 for zero base', () => {
    assert.equal(capitalGainsTax({ base: 0 }), 0);
  });
});

void describe('roundedCapitalGainsTaxDue', () => {
  void it('rounds to full PLN (PIT-38 poz 35)', () => {
    assert.equal(
      roundedCapitalGainsTaxDue({ tax: 3800.6, foreignCredit: 0 }),
      3801,
    );
  });

  void it('subtracts foreign credit', () => {
    assert.equal(
      roundedCapitalGainsTaxDue({ tax: 3800, foreignCredit: 100 }),
      3700,
    );
  });

  void it('returns 0 when credit exceeds tax', () => {
    assert.equal(
      roundedCapitalGainsTaxDue({ tax: 100, foreignCredit: 200 }),
      0,
    );
  });
});

void describe('roundedTotalTaxToPay', () => {
  void it('rounds to full PLN (PIT-38 poz 51)', () => {
    assert.equal(roundedTotalTaxToPay({ totalRawPln: 3840.4 }), 3840);
  });

  void it('returns 0 for negative', () => {
    assert.equal(roundedTotalTaxToPay({ totalRawPln: -100 }), 0);
  });
});
