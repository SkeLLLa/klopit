import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildPit38 } from '../src/core/tax/pit38.js';
import type {
  CreditInterestResult,
  DividendResult,
  PriorYearLoss,
  TaxSummary,
  TradeResult,
} from '../src/core/types.js';

function makeSummary(overrides: Partial<TaxSummary> = {}): TaxSummary {
  return {
    year: 2024,
    totalProceedsPln: 0,
    totalCostPln: 0,
    capitalGainPln: 0,
    capitalGainTaxPln: 0,
    totalDividendsPln: 0,
    totalWithholdingPln: 0,
    totalDeductibleWithholdingPln: 0,
    dividendTaxOwedPln: 0,
    totalCreditInterestPln: 0,
    totalCreditInterestForeignTaxPln: 0,
    capitalGainAfterLcfPln: 0,
    capitalGainTaxPostLcfPln: 0,
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
    proceedsPln: 0,
    costPln: 0,
    gainLossPln: 0,
    rateUnavailable: false,
    country: 'US',
    taxPln: 0,
    foreignTaxPln: 0,
    foreignTaxOriginal: 0,
    ...overrides,
  };
}

function makeDivResult(
  overrides: Partial<DividendResult> = {},
): DividendResult {
  return {
    symbol: 'AAPL',
    currency: 'USD',
    date: new Date(2024, 2, 15),
    amountOriginal: 0,
    withholdingTaxOriginal: 0,
    amountPln: 0,
    withholdingTaxPln: 0,
    exchangeRate: 4.0,
    rateUnavailable: false,
    country: 'US',
    creditCapRate: 0.15,
    deductibleWithholdingPln: 0,
    taxPlnGross: 0,
    taxToPayPln: 0,
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
    amountPln: 42,
    exchangeRate: 4.2,
    fxDate: '2024-04-04',
    rateUnavailable: false,
    taxPlnGross: 7.98,
    foreignTaxOriginal: 0,
    foreignTaxPln: 0,
    foreignTaxExchangeRate: 0,
    ...overrides,
  };
}

void describe('buildPit38', () => {
  void it('calculates profitable year with dividends', () => {
    const summary = makeSummary({
      totalProceedsPln: 50000,
      totalCostPln: 30000,
      totalDividendsPln: 1000,
      totalWithholdingPln: 150,
      totalDeductibleWithholdingPln: 150, // 15% < 19%, fully deductible
    });
    const trades = [
      makeSellResult({
        proceedsPln: 50000,
        costPln: 30000,
        gainLossPln: 20000,
        taxPln: 3800,
      }),
    ];
    const dividends = [
      makeDivResult({
        amountPln: 1000,
        withholdingTaxPln: 150,
        deductibleWithholdingPln: 150,
        taxPlnGross: 190,
        taxToPayPln: 40,
      }),
    ];

    const result = buildPit38({
      trades,
      dividends,
      creditInterests: [],
      summary,
    });

    // Section C
    assert.equal(result[20], 0);
    assert.equal(result[21], 0);
    assert.equal(result[22], 50000);
    assert.equal(result[23], 30000);
    assert.equal(result[24], 0);
    assert.equal(result[25], 0);
    assert.equal(result[26], 50000);
    assert.equal(result[27], 30000);
    assert.equal(result[28], 20000);
    assert.equal(result[29], 0);

    // Section D
    assert.equal(result[30], 0);
    assert.equal(result[31], 20000);
    assert.equal(result[33], 3800);
    assert.equal(result[34], 0);
    assert.equal(result[35], 3800);

    // Section G
    assert.equal(result[47], 190);
    assert.equal(result[48], 150);
    assert.equal(result[49], 40);
    assert.equal(result[51], 3840);
    assert.equal(result[52], 0);
  });

  void it('handles loss year', () => {
    const summary = makeSummary({
      totalProceedsPln: 10000,
      totalCostPln: 15000,
    });
    const trades = [
      makeSellResult({
        proceedsPln: 10000,
        costPln: 15000,
        gainLossPln: -5000,
        taxPln: 0,
      }),
    ];

    const result = buildPit38({
      trades,
      dividends: [],
      creditInterests: [],
      summary,
    });

    assert.equal(result[28], 0);
    assert.equal(result[29], 5000);
    assert.equal(result[31], 0);
    assert.equal(result[33], 0);
    assert.equal(result[35], 0);
    assert.equal(result[51], 0);
  });

  void it('rounds gain from section C totals to grosz precision', () => {
    const result = buildPit38({
      trades: [
        makeSellResult({
          proceedsPln: 1234.37,
          costPln: 231.39,
          gainLossPln: 1002.98,
        }),
      ],
      dividends: [],
      creditInterests: [],
      summary: makeSummary(),
    });

    assert.equal(result[26], 1234.37);
    assert.equal(result[27], 231.39);
    assert.equal(result[28], 1002.98);
    assert.equal(result[29], 0);
  });

  void it('reduces tax base by prior year loss', () => {
    const summary = makeSummary({
      year: 2024,
      totalProceedsPln: 50000,
      totalCostPln: 30000,
    });
    const trades = [
      makeSellResult({
        proceedsPln: 50000,
        costPln: 30000,
        gainLossPln: 20000,
        taxPln: 3800,
      }),
    ];
    // 10 000 PLN loss → 50% cap = 5 000.
    const priorLosses: PriorYearLoss[] = [
      { year: 2023, totalLossPln: 10000, alreadyDeductedPln: 0 },
    ];

    const result = buildPit38({
      trades,
      dividends: [],
      creditInterests: [],
      summary,
      priorLosses,
    });

    assert.equal(result[28], 20000);
    assert.equal(result[30], 5000);
    assert.equal(result[31], 15000);
    assert.ok(
      Math.abs(result[33] - 2850) < 0.01,
      `poz33: ${String(result[33])}`,
    );
    assert.equal(result[35], 2850);
  });

  void it('clamps prior year loss at 50% per-year cap', () => {
    const summary = makeSummary({
      year: 2024,
      totalProceedsPln: 50000,
      totalCostPln: 30000,
    });
    const trades = [
      makeSellResult({
        proceedsPln: 50000,
        costPln: 30000,
        gainLossPln: 20000,
        taxPln: 3800,
      }),
    ];
    // 50 000 PLN loss → 50% cap = 25 000 (still ≤ gain 20 000? No: 25k > 20k).
    // Cap min(50% × 50 000, gain) = min(25 000, 20 000) = 20 000.
    const priorLosses: PriorYearLoss[] = [
      { year: 2023, totalLossPln: 50000, alreadyDeductedPln: 0 },
    ];

    const result = buildPit38({
      trades,
      dividends: [],
      creditInterests: [],
      summary,
      priorLosses,
    });

    assert.equal(result[30], 20000);
    assert.equal(result[31], 0);
    assert.equal(result[35], 0);
  });

  void it('excludes losses outside the 5-year carry-forward window', () => {
    const summary = makeSummary({
      year: 2024,
      totalProceedsPln: 50000,
      totalCostPln: 30000,
    });
    const trades = [
      makeSellResult({
        proceedsPln: 50000,
        costPln: 30000,
        gainLossPln: 20000,
        taxPln: 3800,
      }),
    ];
    // 2018 loss is 6 years old → expired.
    const priorLosses: PriorYearLoss[] = [
      { year: 2018, totalLossPln: 10000, alreadyDeductedPln: 0 },
    ];

    const result = buildPit38({
      trades,
      dividends: [],
      creditInterests: [],
      summary,
      priorLosses,
    });

    assert.equal(result[30], 0);
    assert.equal(result[31], 20000);
  });

  void it('honours residual after prior deductions', () => {
    const summary = makeSummary({
      year: 2024,
      totalProceedsPln: 50000,
      totalCostPln: 30000,
    });
    const trades = [
      makeSellResult({
        proceedsPln: 50000,
        costPln: 30000,
        gainLossPln: 20000,
        taxPln: 3800,
      }),
    ];
    // 10 000 loss already exhausted in prior years → 0 residual.
    const priorLosses: PriorYearLoss[] = [
      { year: 2022, totalLossPln: 10000, alreadyDeductedPln: 10000 },
    ];

    const result = buildPit38({
      trades,
      dividends: [],
      creditInterests: [],
      summary,
      priorLosses,
    });

    assert.equal(result[30], 0);
  });

  void it('caps withholding credit at dividend tax', () => {
    const summary = makeSummary({
      totalDividendsPln: 100,
      totalWithholdingPln: 50,
      totalDeductibleWithholdingPln: 19, // capped at 19% of 100
    });
    const dividends = [
      makeDivResult({
        amountPln: 100,
        withholdingTaxPln: 50,
        deductibleWithholdingPln: 19,
        taxPlnGross: 19,
        taxToPayPln: 0,
      }),
    ];

    const result = buildPit38({
      trades: [],
      dividends,
      creditInterests: [],
      summary,
    });

    assert.equal(result[47], 19);
    assert.equal(result[48], 19);
    assert.equal(result[49], 0);
  });

  void it('combines dividends and credit interest in section G', () => {
    const summary = makeSummary({
      totalDividendsPln: 100,
      totalWithholdingPln: 15,
      totalDeductibleWithholdingPln: 15,
      totalCreditInterestPln: 42,
      totalCreditInterestForeignTaxPln: 0,
    });
    const dividends = [
      makeDivResult({
        amountPln: 100,
        withholdingTaxPln: 15,
        deductibleWithholdingPln: 15,
        taxPlnGross: 19,
        taxToPayPln: 4,
      }),
    ];
    const creditInterests = [makeCreditInterestResult()];

    const result = buildPit38({
      trades: [],
      dividends,
      creditInterests,
      summary,
    });

    assert.equal(result[47], 26.98);
    assert.equal(result[48], 15);
    assert.equal(result[49], 11.98);
    assert.equal(result[51], 11.98);
  });

  void it('returns all zeros for empty summary', () => {
    const summary = makeSummary();
    const result = buildPit38({
      trades: [],
      dividends: [],
      creditInterests: [],
      summary,
    });

    assert.equal(result[22], 0);
    assert.equal(result[26], 0);
    assert.equal(result[27], 0);
    assert.equal(result[28], 0);
    assert.equal(result[29], 0);
    assert.equal(result[31], 0);
    assert.equal(result[35], 0);
    assert.equal(result[47], 0);
    assert.equal(result[49], 0);
    assert.equal(result[51], 0);
    assert.equal(result[52], 0);
  });

  void it('applies rounding correctly at boundaries', () => {
    const summary = makeSummary({
      totalProceedsPln: 2000.5,
      totalCostPln: 1000,
    });
    const trades = [
      makeSellResult({
        proceedsPln: 2000.5,
        costPln: 1000,
        gainLossPln: 1000.5,
        taxPln: 190.095,
      }),
    ];

    const result = buildPit38({
      trades,
      dividends: [],
      creditInterests: [],
      summary,
    });

    assert.equal(result[28], 1000.5);
    assert.equal(result[31], 1001);
    assert.ok(
      Math.abs(result[33] - 190.19) < 0.01,
      `poz33: ${String(result[33])}`,
    );
    assert.equal(result[35], 190);
  });

  void it('keeps poz33 in grosze and rounds poz35 to full PLN', () => {
    const summary = makeSummary({
      totalProceedsPln: 1003,
      totalCostPln: 0,
    });
    const trades = [
      makeSellResult({
        proceedsPln: 1003,
        costPln: 0,
        gainLossPln: 1003,
        taxPln: 190.57,
      }),
    ];

    const result = buildPit38({
      trades,
      dividends: [],
      creditInterests: [],
      summary,
    });

    assert.equal(result[31], 1003);
    assert.equal(result[33], 190.57);
    assert.equal(result[34], 0);
    assert.equal(result[35], 191);
  });

  void it('maintains invariant poz51 = poz35 + poz49', () => {
    const summary = makeSummary({
      totalProceedsPln: 100000,
      totalCostPln: 50000,
      totalDividendsPln: 5000,
      totalWithholdingPln: 750,
      totalDeductibleWithholdingPln: 750,
    });
    const trades = [
      makeSellResult({
        proceedsPln: 100000,
        costPln: 50000,
        gainLossPln: 50000,
        taxPln: 9500,
      }),
    ];
    const dividends = [
      makeDivResult({
        amountPln: 5000,
        withholdingTaxPln: 750,
        deductibleWithholdingPln: 750,
        taxPlnGross: 950,
        taxToPayPln: 200,
      }),
    ];

    const result = buildPit38({
      trades,
      dividends,
      creditInterests: [],
      summary,
    });

    assert.equal(result[51], result[35] + result[49]);
  });

  void it('handles no dividends (Section G dividend fields zero)', () => {
    const summary = makeSummary({
      totalProceedsPln: 50000,
      totalCostPln: 30000,
    });
    const trades = [
      makeSellResult({
        proceedsPln: 50000,
        costPln: 30000,
        gainLossPln: 20000,
        taxPln: 3800,
      }),
    ];

    const result = buildPit38({
      trades,
      dividends: [],
      creditInterests: [],
      summary,
    });

    assert.equal(result[47], 0);
    assert.equal(result[48], 0);
    assert.equal(result[49], 0);
    assert.equal(result[51], result[35]);
  });

  void it('handles no trades (Sections C/D all zeros)', () => {
    const summary = makeSummary({
      totalDividendsPln: 1000,
      totalWithholdingPln: 150,
      totalDeductibleWithholdingPln: 150,
    });
    const dividends = [
      makeDivResult({
        amountPln: 1000,
        withholdingTaxPln: 150,
        deductibleWithholdingPln: 150,
        taxPlnGross: 190,
        taxToPayPln: 40,
      }),
    ];

    const result = buildPit38({
      trades: [],
      dividends,
      creditInterests: [],
      summary,
    });

    assert.equal(result[22], 0);
    assert.equal(result[26], 0);
    assert.equal(result[27], 0);
    assert.equal(result[35], 0);
    assert.equal(result[51], result[49]);
  });

  void it('sets all placeholder sections to zero', () => {
    const summary = makeSummary({
      totalProceedsPln: 50000,
      totalCostPln: 30000,
    });
    const trades = [
      makeSellResult({
        proceedsPln: 50000,
        costPln: 30000,
        gainLossPln: 20000,
        taxPln: 3800,
      }),
    ];

    const result = buildPit38({
      trades,
      dividends: [],
      creditInterests: [],
      summary,
    });

    // Section E
    assert.equal(result[36], 0);
    assert.equal(result[37], 0);
    assert.equal(result[38], 0);
    assert.equal(result[39], 0);
    assert.equal(result[40], 0);

    // Section F
    assert.equal(result[41], 0);
    assert.equal(result[43], 0);
    assert.equal(result[44], 0);
    assert.equal(result[45], 0);

    // Section H
    for (const poz of [
      53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64,
    ] as const) {
      assert.equal(result[poz], 0, `poz${String(poz)} should be 0`);
    }

    // Section I
    assert.equal(result[65], 0);
  });
});
