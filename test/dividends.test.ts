import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  dividendBreakdown,
  sectionGForeignFlatTax,
  sumDeductibleWithholding,
  sumDividendAddBack,
  sumDividendIncome,
} from '../src/core/tax/aggregates.js';
import {
  calculateDividends,
  pairReversals,
} from '../src/core/tax/dividends.js';
import { buildSymbolCountryMaps } from '../src/core/tax/symbol-country.js';
import type {
  DividendResult,
  EnrichedRawDividend,
  EnrichedWithholdingTax,
  TaxPeriod,
  TransactionFee,
} from '../src/core/types.js';

const taxPeriod2024: TaxPeriod = {
  year: 2024,
  from: new Date(2024, 0, 1),
  to: new Date(2024, 11, 31),
};

function makeDiv(overrides: Partial<EnrichedRawDividend>): EnrichedRawDividend {
  return {
    symbol: 'AAPL',
    currency: 'USD',
    date: new Date(2024, 1, 15),
    amount: 2.4,
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
    amount: -0.36,
    exchangeRate: 4.0,
    rateUnavailable: false,
    ...overrides,
  };
}

function makeFee(overrides: Partial<TransactionFee>): TransactionFee {
  return {
    symbol: 'AAPL',
    currency: 'USD',
    datetime: new Date(2024, 1, 15),
    amount: 2.5,
    description: 'ADR/GDR Fee Accrual',
    ...overrides,
  };
}

void describe('calculateDividends', () => {
  void it('returns empty array for empty inputs', () => {
    const result = calculateDividends({
      dividends: [],
      withholdingTaxes: [],
      taxPeriod: taxPeriod2024,
    });
    assert.deepEqual(result, []);
  });

  void it('calculates single dividend with withholding', () => {
    const div = makeDiv({ amount: 2.4 });
    const tax = makeTax({ amount: -0.36 });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [tax],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].amountOriginal, 2.4);
    assert.equal(result[0].withholdingTaxOriginal, 0.36); // abs(-0.36)
    assert.ok(
      Math.abs(result[0].amountPln - 9.6) < 0.01,
      `amountPln: ${String(result[0].amountPln)}`,
    ); // 2.4 * 4.0
    assert.ok(
      Math.abs(result[0].withholdingTaxPln - 1.44) < 0.01,
      `withholdingPln: ${String(result[0].withholdingTaxPln)}`,
    ); // 0.36 * 4.0
    assert.equal(result[0].rateUnavailable, false);
    // creditCapRate defaults to 0.19 (XX country = fallback)
    assert.equal(result[0].creditCapRate, 0.19);
    assert.ok(result[0].deductibleWithholdingPln >= 0);
    assert.ok(
      Math.abs(result[0].taxPlnGross - result[0].amountPln * 0.19) < 0.001,
      `taxPlnGross: ${String(result[0].taxPlnGross)}`,
    );
    assert.ok(result[0].taxToPayPln >= 0);
  });

  void it('handles dividend with no withholding', () => {
    const div = makeDiv({ amount: 5.0 });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].withholdingTaxOriginal, 0);
    assert.equal(result[0].withholdingTaxPln, 0);
  });

  void it('does not reduce dividends by ADR fees by default', () => {
    const div = makeDiv({ symbol: 'BP', amount: 42 });
    const fee = makeFee({ symbol: 'BP', amount: 2.5 });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [],
      transactionFees: [fee],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].amountOriginal, 42);
    assert.equal(result[0].amountPln, 168);
    assert.equal(result[0].adrFeeOriginal, 0);
  });

  void it('reduces matched dividends by ADR fees when enabled', () => {
    const div = makeDiv({ symbol: 'BP', amount: 42 });
    const matchedFee = makeFee({ symbol: 'BP', amount: 2.5 });
    const unmatchedFee = makeFee({
      symbol: 'MHPC',
      amount: 4,
      datetime: new Date(2024, 1, 16),
    });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [],
      transactionFees: [matchedFee, unmatchedFee],
      reduceAdrFeesFromDividends: true,
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].amountOriginal, 39.5);
    assert.equal(result[0].adrFeeOriginal, 2.5);
    assert.equal(result[0].adrFeePln, 10);
    assert.equal(result[0].amountPln, 158);
    assert.ok(Math.abs(result[0].taxPlnGross - 30.02) < 0.001);
  });

  void it('sums multiple withholding entries for one dividend', () => {
    const div = makeDiv({
      date: new Date(2024, 4, 15),
      amount: 10.0,
    });
    const tax1 = makeTax({
      date: new Date(2024, 4, 15),
      amount: -1.0,
    });
    const tax2 = makeTax({
      date: new Date(2024, 4, 15),
      amount: -0.5,
    });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [tax1, tax2],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result.length, 1);
    assert.ok(
      Math.abs(result[0].withholdingTaxOriginal - 1.5) < 0.01,
      `withholdingOriginal: ${String(result[0].withholdingTaxOriginal)}`,
    );
  });

  void it('matches by ISIN when present', () => {
    const div = makeDiv({
      symbol: 'AAPL',
      isin: 'US0378331005',
      date: new Date(2024, 1, 15),
    });
    const taxMatch = makeTax({
      symbol: 'DIFFERENT',
      isin: 'US0378331005', // Same ISIN
      date: new Date(2024, 1, 15),
    });
    const taxNoMatch = makeTax({
      symbol: 'AAPL',
      isin: 'OTHERIS1N', // Different ISIN
      date: new Date(2024, 1, 15),
      amount: -99,
    });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [taxMatch, taxNoMatch],
      taxPeriod: taxPeriod2024,
    });

    // The other-ISIN withholding is not silently dropped: it is reported as an
    // unmatched row that credits nothing (plan 13, 2b).
    const events = result.filter(
      (r) => !r.warnings?.some((w) => w.kind === 'wht-unmatched'),
    );
    assert.equal(events.length, 1);
    assert.equal(result.length, 2);
    // Only taxMatch should match (by ISIN)
    assert.ok(
      Math.abs(events[0].withholdingTaxOriginal - 0.36) < 0.01,
      `Should match by ISIN, got: ${String(events[0].withholdingTaxOriginal)}`,
    );
  });

  void it('falls back to symbol matching when no ISIN', () => {
    const div = makeDiv({ symbol: 'AAPL', date: new Date(2024, 3, 10) });
    const tax = makeTax({
      symbol: 'AAPL',
      date: new Date(2024, 3, 10),
      amount: -0.5,
    });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [tax],
      taxPeriod: taxPeriod2024,
    });

    assert.ok(
      Math.abs(result[0].withholdingTaxOriginal - 0.5) < 0.01,
      `withholdingOriginal: ${String(result[0].withholdingTaxOriginal)}`,
    );
  });

  void it('matches case-insensitively', () => {
    const div = makeDiv({ symbol: 'aapl', date: new Date(2024, 3, 10) });
    const tax = makeTax({
      symbol: 'AAPL',
      date: new Date(2024, 3, 10),
      amount: -0.5,
    });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [tax],
      taxPeriod: taxPeriod2024,
    });

    assert.ok(
      Math.abs(result[0].withholdingTaxOriginal - 0.5) < 0.01,
      'Should match case-insensitively',
    );
  });

  void it('excludes dividends outside tax period', () => {
    const divIn = makeDiv({ date: new Date(2024, 5, 15) });
    const divOut = makeDiv({ date: new Date(2023, 5, 15) }); // Before 2024

    const result = calculateDividends({
      dividends: [divIn, divOut],
      withholdingTaxes: [],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].date.getFullYear(), 2024);
  });

  void it('propagates rateUnavailable from dividend', () => {
    const div = makeDiv({ rateUnavailable: true, exchangeRate: 0 });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result[0].rateUnavailable, true);
  });

  void it('propagates rateUnavailable from withholding', () => {
    const div = makeDiv({});
    const tax = makeTax({ rateUnavailable: true });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [tax],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result[0].rateUnavailable, true);
  });

  void it('handles negative withholding amounts with Math.abs', () => {
    const div = makeDiv({ amount: 10 });
    const tax = makeTax({ amount: -1.5 });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [tax],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result[0].withholdingTaxOriginal, 1.5);
    assert.ok(
      Math.abs(result[0].withholdingTaxPln - 6) < 0.01,
      `withholdingPln: ${String(result[0].withholdingTaxPln)}`,
    ); // 1.5 * 4.0
  });

  void it('handles EUR dividend with EUR withholding', () => {
    const div = makeDiv({
      symbol: 'RHM',
      currency: 'EUR',
      amount: 8.1,
      exchangeRate: 4.3, // EUR rate
    });
    const tax = makeTax({
      symbol: 'RHM',
      currency: 'EUR',
      amount: -2.14,
      exchangeRate: 4.3,
    });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [tax],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result.length, 1);
    assert.ok(Math.abs(result[0].amountPln - 34.83) < 0.01); // 8.1 * 4.3
    assert.ok(Math.abs(result[0].withholdingTaxPln - 9.202) < 0.01); // 2.14 * 4.3
  });

  void it('handles NOK dividend', () => {
    const div = makeDiv({
      symbol: 'SOC',
      currency: 'NOK',
      amount: 325,
      exchangeRate: 0.38, // NOK rate
    });

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [],
      taxPeriod: taxPeriod2024,
    });

    assert.equal(result.length, 1);
    assert.ok(Math.abs(result[0].amountPln - 123.5) < 0.01); // 325 * 0.38
  });

  void it('warns when US dividend has 30% withholding vs 15% treaty rate', () => {
    const div = makeDiv({
      symbol: 'AAPL',
      amount: 100,
      exchangeRate: 4.0,
    });
    // 30 USD withheld on 100 USD = 30% effective rate
    const tax = makeTax({
      amount: -30,
      exchangeRate: 4.0,
    });

    const symbolMap = new Map([['AAPL', 'US']]);

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [tax],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: symbolMap,
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].country, 'US');
    assert.ok(result[0].warnings?.length === 1);
    const whtLapseWarning = result[0].warnings[0];
    assert.ok(whtLapseWarning);
    assert.equal(whtLapseWarning.kind, 'wht-lapse');
    assert.equal(result[0].creditCapRate, 0.15);
    assert.ok(result[0].deductibleWithholdingPln >= 0);
    assert.ok(
      Math.abs(result[0].taxPlnGross - result[0].amountPln * 0.19) < 0.001,
    );
    assert.ok(result[0].taxToPayPln >= 0);
  });

  void it('does not warn for US dividend with 15% withholding (matches treaty)', () => {
    const div = makeDiv({
      symbol: 'AAPL',
      amount: 100,
      exchangeRate: 4.0,
    });
    // 15 USD withheld on 100 USD = 15% effective rate (matches treaty)
    const tax = makeTax({
      amount: -15,
      exchangeRate: 4.0,
    });

    const symbolMap = new Map([['AAPL', 'US']]);

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [tax],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: symbolMap,
    });

    assert.equal(result.length, 1);
    assert.ok(
      !result[0].warnings || result[0].warnings.length === 0,
      'Should not warn when withheld rate matches treaty rate',
    );
  });

  void it('does not warn for US dividend with 15.05% withholding (within tolerance)', () => {
    const div = makeDiv({
      symbol: 'AAPL',
      amount: 100,
      exchangeRate: 4.0,
    });
    // 15.05 USD withheld on 100 USD = 15.05% effective rate (within tolerance of 15%)
    const tax = makeTax({
      amount: -15.05,
      exchangeRate: 4.0,
    });

    const symbolMap = new Map([['AAPL', 'US']]);

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [tax],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: symbolMap,
    });

    assert.equal(result.length, 1);
    assert.ok(
      !result[0].warnings || result[0].warnings.length === 0,
      'Should not warn when withheld rate is within tolerance',
    );
  });

  void it('adds unknown-country warning when country mapping is unavailable', () => {
    const div = makeDiv({
      symbol: 'UNKNOWN',
      amount: 100,
      exchangeRate: 4.0,
    });
    // 19 USD withheld on 100 USD = 19% (matches fallback domestic rate)
    const tax = makeTax({
      symbol: 'UNKNOWN',
      amount: -19,
      exchangeRate: 4.0,
    });

    const symbolMap = new Map(); // No country mapping provided

    const result = calculateDividends({
      dividends: [div],
      withholdingTaxes: [tax],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: symbolMap,
    });

    assert.equal(result.length, 1);
    assert.ok(result[0].warnings?.some((w) => w.kind === 'unknown-country'));
    assert.ok(
      !result[0].warnings?.some((w) => w.kind === 'wht-lapse'),
      'Should not add wht-lapse warning for 19% fallback case',
    );
    // Unknown country uses 0.19 fallback
    assert.equal(result[0].creditCapRate, 0.19);
    assert.ok(result[0].deductibleWithholdingPln >= 0);
    assert.ok(
      Math.abs(result[0].taxPlnGross - result[0].amountPln * 0.19) < 0.001,
    );
    assert.ok(result[0].taxToPayPln >= 0);
  });
});

function sum(rs: DividendResult[], k: keyof DividendResult): number {
  return rs.reduce((s, r) => s + (r[k] as number), 0);
}

void describe('calculateDividends — reversals & refunds', () => {
  const us = new Map([['AAPL', 'US']]);

  void it('nets a reversed and re-posted dividend instead of double counting', () => {
    const r = calculateDividends({
      dividends: [
        makeDiv({ amount: 100 }),
        makeDiv({ amount: -100 }),
        makeDiv({ amount: 100 }),
      ],
      withholdingTaxes: [makeTax({ amount: -15 })],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: us,
    });
    assert.equal(r.length, 1);
    assert.equal(sum(r, 'amountOriginal'), 100);
    assert.equal(sum(r, 'withholdingTaxOriginal'), 15);
    assert.equal(sum(r, 'amountPln'), 400);
  });

  void it('treats a positive withholding row as a refund (-15, +15 => 0)', () => {
    const r = calculateDividends({
      dividends: [makeDiv({ amount: 100 })],
      withholdingTaxes: [makeTax({ amount: -15 }), makeTax({ amount: 15 })],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: us,
    });
    assert.equal(r[0].withholdingTaxOriginal, 0);
    assert.equal(r[0].deductibleWithholdingPln, 0);
    assert.equal(r[0].warnings, undefined);
  });

  void it('nets -15, +15, -15 to 15 withheld with no W-8BEN warning', () => {
    const r = calculateDividends({
      dividends: [makeDiv({ amount: 100 })],
      withholdingTaxes: [
        makeTax({ amount: -15 }),
        makeTax({ amount: 15 }),
        makeTax({ amount: -15 }),
      ],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: us,
    });
    assert.equal(r[0].withholdingTaxOriginal, 15);
    assert.ok(Math.abs(r[0].withholdingTaxPln - 60) < 1e-9);
    assert.equal(r[0].warnings, undefined);
  });

  void it('attributes WHT and ADR fees once when a key has several dividend rows', () => {
    const r = calculateDividends({
      dividends: [makeDiv({ amount: 50 }), makeDiv({ amount: 50 })],
      withholdingTaxes: [makeTax({ amount: -15 })],
      transactionFees: [makeFee({ amount: 2 })],
      reduceAdrFeesFromDividends: true,
      taxPeriod: taxPeriod2024,
      symbolCountryMap: us,
    });
    assert.equal(sum(r, 'withholdingTaxOriginal'), 15);
    assert.equal(sum(r, 'adrFeeOriginal'), 2);
    assert.equal(sum(r, 'amountOriginal'), 98);
  });

  void it('floors a net-negative group to 0 and warns', () => {
    const r = calculateDividends({
      dividends: [makeDiv({ amount: -100 })],
      withholdingTaxes: [],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: us,
    });
    assert.equal(r[0].amountOriginal, 0);
    assert.equal(r[0].amountPln, 0);
    assert.ok(r[0].warnings?.some((w) => w.kind === 'net-negative'));
  });

  void it('warns when refunds exceed withholding', () => {
    const r = calculateDividends({
      dividends: [makeDiv({ amount: 100 })],
      withholdingTaxes: [makeTax({ amount: 15 })],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: us,
    });
    assert.equal(r[0].withholdingTaxOriginal, 0);
    assert.equal(r[0].withholdingTaxPln, 0);
    assert.ok(r[0].warnings?.some((w) => w.kind === 'wht-net-refund'));
  });

  void it('does not merge same-day same-symbol rows in different currencies', () => {
    const r = calculateDividends({
      dividends: [
        makeDiv({ amount: 10 }),
        makeDiv({ amount: 10, currency: 'EUR', exchangeRate: 4.3 }),
      ],
      withholdingTaxes: [],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: us,
    });
    assert.equal(r.length, 2);
  });

  void it('sums PLN per row when rows in one group have different rates', () => {
    const r = calculateDividends({
      dividends: [
        makeDiv({ amount: 100, exchangeRate: 4.0 }),
        makeDiv({ amount: 50, exchangeRate: 4.2 }),
      ],
      withholdingTaxes: [],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: us,
    });
    assert.equal(r.length, 1);
    assert.equal(r[0].amountOriginal, 150);
    assert.ok(Math.abs(r[0].amountPln - 610) < 1e-9);
  });

  void it('ORs rateUnavailable across all dividend rows in a group', () => {
    const r = calculateDividends({
      dividends: [
        makeDiv({ amount: 100 }),
        makeDiv({ amount: 1, rateUnavailable: true }),
      ],
      withholdingTaxes: [],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: us,
    });
    assert.equal(r[0].rateUnavailable, true);
  });
});

void describe('calculateDividends ADR country', () => {
  const adrDiv = makeDiv({ symbol: 'TSM', isAdr: true, amount: 10 });
  // 21% withheld by Taiwan: above the 10% treaty cap but not a W-8BEN issue.
  const wht = makeTax({ symbol: 'TSM', amount: -2.1 });

  void it('caps credit by the issuer-country treaty and skips the W-8BEN warning', () => {
    const [r] = calculateDividends({
      dividends: [adrDiv],
      withholdingTaxes: [wht],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: new Map([['TSM', 'TW']]),
    });
    assert.equal(r.country, 'TW');
    assert.equal(r.creditCapRate, 0.1);
    assert.equal(
      r.warnings?.some((w) => w.kind === 'wht-lapse') ?? false,
      false,
    );
  });

  void it('still warns about a W-8BEN lapse for an ADR resolved to US', () => {
    const [r] = calculateDividends({
      dividends: [adrDiv],
      withholdingTaxes: [wht],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: new Map([['TSM', 'US']]),
    });
    assert.equal(
      r.warnings?.some((w) => w.kind === 'wht-lapse'),
      true,
    );
  });

  void it('still warns about a lapse for a non-ADR non-US row', () => {
    const [r] = calculateDividends({
      dividends: [makeDiv({ symbol: 'X', amount: 10 })],
      withholdingTaxes: [makeTax({ symbol: 'X', amount: -2.1 })],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: new Map([['X', 'TW']]),
    });
    assert.equal(
      r.warnings?.some((w) => w.kind === 'wht-lapse'),
      true,
    );
  });
});

void describe('calculateDividends ADR country conflict', () => {
  void it('flags a conflicting ADR symbol', () => {
    const [r] = calculateDividends({
      dividends: [makeDiv({ symbol: 'TSM', isAdr: true, amount: 10 })],
      withholdingTaxes: [],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: new Map([['TSM', 'US']]),
      adrCountryConflicts: new Set(['TSM']),
    });
    assert.equal(
      r.warnings?.some((w) => w.kind === 'adr-country-conflict'),
      true,
    );
  });

  void it('does not flag other symbols', () => {
    const [r] = calculateDividends({
      dividends: [makeDiv({ symbol: 'AAPL', amount: 10 })],
      withholdingTaxes: [],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: new Map([['AAPL', 'US']]),
      adrCountryConflicts: new Set(['TSM']),
    });
    assert.equal(r.warnings, undefined);
  });
});

const kinds = (r: DividendResult) => r.warnings?.map((w) => w.kind) ?? [];

void describe('calculateDividends payment in lieu', () => {
  const ordinary = makeDiv({ symbol: 'TSM', isAdr: true, amount: 10 });
  const pil = makeDiv({
    symbol: 'TSM',
    isAdr: true,
    amount: 10,
    kind: 'payment-in-lieu',
  });
  const dividendsMap = new Map([['TSM', 'TW']]);
  const isinMap = new Map([['TSM', 'US']]);

  void it('keeps same-day ordinary and PIL events separate with their own caps', () => {
    const results = calculateDividends({
      dividends: [ordinary, pil],
      withholdingTaxes: [
        makeTax({ symbol: 'TSM', amount: -1, taxCountry: 'TW' }),
        makeTax({
          symbol: 'TSM',
          amount: -1.5,
          kind: 'payment-in-lieu',
          taxCountry: 'US',
        }),
      ],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: dividendsMap,
      isinCountryMap: isinMap,
    });
    assert.equal(results.length, 2);
    const ord = results.find((r) => r.country === 'TW');
    const lieu = results.find((r) => r.country === 'US');
    assert.ok(ord && lieu);
    assert.equal(ord.creditCapRate, 0.1);
    assert.equal(ord.withholdingTaxOriginal, 1);
    assert.equal(lieu.creditCapRate, 0.15);
    assert.equal(lieu.withholdingTaxOriginal, 1.5);
    assert.deepEqual(kinds(ord), []);
    assert.deepEqual(kinds(lieu), ['pil-substitute']);
  });

  void it('warns that PIL excess is not credited instead of a W-8BEN lapse', () => {
    const [r] = calculateDividends({
      dividends: [pil],
      withholdingTaxes: [
        makeTax({
          symbol: 'TSM',
          amount: -3,
          kind: 'payment-in-lieu',
          taxCountry: 'US',
        }),
      ],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: dividendsMap,
      isinCountryMap: isinMap,
    });
    assert.deepEqual(kinds(r), ['pil-excess-not-credited', 'pil-substitute']);
  });

  void it('falls back to the ISIN country for a PIL without withholding', () => {
    const [r] = calculateDividends({
      dividends: [pil],
      withholdingTaxes: [],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: dividendsMap,
      isinCountryMap: isinMap,
    });
    assert.equal(r.country, 'US');
  });
});

void describe('calculateDividends legacy rows and PIL overrides', () => {
  void it('matches a legacy dividend row (no kind) with a WHT row of kind dividend', () => {
    const [r] = calculateDividends({
      dividends: [makeDiv({ amount: 10 })],
      withholdingTaxes: [makeTax({ amount: -1.5, kind: 'dividend' })],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: new Map([['AAPL', 'US']]),
    });
    assert.equal(r.withholdingTaxOriginal, 1.5);
  });

  void it('keeps a PIL event in the withholding country despite a both-scope override', () => {
    const maps = buildSymbolCountryMaps({
      trades: [],
      dividends: [{ symbol: 'TSM', isin: 'US8740391003' }],
      overrides: [{ symbol: 'TSM', country: 'TW', scope: 'both' }],
    });
    const results = calculateDividends({
      dividends: [
        makeDiv({ symbol: 'TSM', amount: 10 }),
        makeDiv({ symbol: 'TSM', amount: 10, kind: 'payment-in-lieu' }),
      ],
      withholdingTaxes: [
        makeTax({ symbol: 'TSM', amount: -1, taxCountry: 'TW' }),
        makeTax({
          symbol: 'TSM',
          amount: -1.5,
          kind: 'payment-in-lieu',
          taxCountry: 'US',
        }),
      ],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: maps.dividends,
      isinCountryMap: maps.gains,
    });
    const countries = results.map((r) => r.country).toSorted();
    assert.deepEqual(countries, ['TW', 'US']);
    const lieu = results.find((r) =>
      r.warnings?.some((w) => w.kind === 'pil-substitute'),
    );
    assert.ok(lieu);
    assert.equal(lieu.country, 'US');
    assert.equal(lieu.creditCapRate, 0.15);
  });

  void it('does not flag an ADR country conflict on a PIL event', () => {
    const [r] = calculateDividends({
      dividends: [
        makeDiv({ symbol: 'TSM', amount: 10, kind: 'payment-in-lieu' }),
      ],
      withholdingTaxes: [],
      taxPeriod: taxPeriod2024,
      symbolCountryMap: new Map([['TSM', 'US']]),
      adrCountryConflicts: new Set(['TSM']),
    });
    assert.equal(
      r.warnings?.some((w) => w.kind === 'adr-country-conflict'),
      false,
    );
  });
});

const d = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day);

const taxPeriod2025: TaxPeriod = {
  year: 2025,
  from: new Date(2025, 0, 1),
  to: new Date(2025, 11, 31),
};

function run(args: {
  divs?: EnrichedRawDividend[];
  taxes?: EnrichedWithholdingTax[];
  period?: TaxPeriod;
  sells?: { symbol: string; date: Date }[];
}): DividendResult[] {
  return calculateDividends({
    dividends: args.divs ?? [],
    withholdingTaxes: args.taxes ?? [],
    taxPeriod: args.period ?? taxPeriod2024,
    symbolCountryMap: new Map([
      ['AAPL', 'US'],
      ['XYZ', 'US'],
    ]),
    sells: args.sells,
  });
}

function sectionG(rows: DividendResult[]) {
  return sectionGForeignFlatTax({
    dividendIncomePln: sumDividendIncome({ rows }),
    dividendDeductiblePln: sumDeductibleWithholding({ rows }),
    dividendAddBackPln: sumDividendAddBack({ rows }),
    interestIncomePln: 0,
    interestForeignTaxPln: 0,
  });
}

function near(actual: number, expected: number, message?: string) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    message ?? `${String(actual)} !== ${String(expected)}`,
  );
}
const row = (date: Date, amount: number, id = 'AAPL') => ({
  id,
  currency: 'USD',
  kind: 'dividend' as const,
  date,
  amount,
});

void describe('pairReversals', () => {
  void it('pairs only exact opposite amounts', () => {
    const pairs = pairReversals({
      rows: [row(d(2024, 1, 1), 100), row(d(2024, 2, 1), -99)],
      originalSign: 1,
    });
    assert.deepEqual(pairs, []);
  });

  void it('prefers the most recent original, then input order', () => {
    const rows = [
      row(d(2024, 3, 1), 10),
      row(d(2024, 4, 1), 10),
      row(d(2024, 4, 1), 10),
      row(d(2024, 4, 10), -10),
    ];
    assert.deepEqual(pairReversals({ rows, originalSign: 1 }), [
      { original: 1, reversal: 3 },
    ]);
  });

  void it('never pairs with a later original, another id, or beyond 366 days', () => {
    assert.deepEqual(
      pairReversals({
        rows: [row(d(2024, 5, 1), 10), row(d(2024, 4, 1), -10)],
        originalSign: 1,
      }),
      [],
    );
    assert.deepEqual(
      pairReversals({
        rows: [row(d(2024, 4, 1), 10, 'MSFT'), row(d(2024, 4, 2), -10)],
        originalSign: 1,
      }),
      [],
    );
    assert.deepEqual(
      pairReversals({
        rows: [row(d(2023, 1, 10), 10), row(d(2024, 1, 12), -10)],
        originalSign: 1,
      }).length,
      0,
    );
    assert.equal(
      pairReversals({
        rows: [row(d(2023, 1, 10), 10), row(d(2024, 1, 11), -10)],
        originalSign: 1,
      }).length,
      1,
    );
  });

  void it('consumes each original once and honors rank and sign', () => {
    const rows = [
      row(d(2024, 1, 1), -5),
      row(d(2024, 2, 1), -5),
      row(d(2024, 3, 1), 5),
    ];
    assert.deepEqual(
      pairReversals({
        rows,
        originalSign: -1,
        rank: (original) => (original.date.getMonth() === 0 ? 0 : 1),
      }),
      [{ original: 0, reversal: 2 }],
    );
    assert.deepEqual(pairReversals({ rows, originalSign: -1 }), [
      { original: 1, reversal: 2 },
    ]);
  });
});

void describe('calculateDividends — cross-date matching (plan 13)', () => {
  void it('D1: cross-date full reversal nets to zero', () => {
    const rows = run({
      divs: [
        makeDiv({ date: d(2024, 2, 15), amount: 100, exchangeRate: 4.0 }),
        makeDiv({ date: d(2024, 3, 20), amount: -100, exchangeRate: 4.1 }),
      ],
      taxes: [
        makeTax({ date: d(2024, 2, 15), amount: -15, exchangeRate: 4.0 }),
        makeTax({ date: d(2024, 3, 20), amount: 15, exchangeRate: 4.1 }),
      ],
    });
    assert.equal(rows.length, 1);
    near(rows[0].amountPln, 0);
    near(rows[0].withholdingTaxPln, 0);
    near(rows[0].deductibleWithholdingPln, 0);
    assert.deepEqual(rows[0].warnings, [
      { kind: 'reversed-later', reversalDate: '2024-03-20', crossYear: false },
    ]);
    const g = sectionG(rows);
    assert.deepEqual([g.poz47, g.poz48, g.poz49], [0, 0, 0]);
  });

  void it('D2: reversal plus re-post of a different amount', () => {
    const rows = run({
      divs: [
        makeDiv({ date: d(2024, 2, 15), amount: 100, exchangeRate: 4.0 }),
        makeDiv({ date: d(2024, 3, 20), amount: -100, exchangeRate: 4.1 }),
        makeDiv({ date: d(2024, 3, 20), amount: 90, exchangeRate: 4.1 }),
      ],
      taxes: [
        makeTax({ date: d(2024, 2, 15), amount: -15, exchangeRate: 4.0 }),
        makeTax({ date: d(2024, 3, 20), amount: 15, exchangeRate: 4.1 }),
        makeTax({ date: d(2024, 3, 20), amount: -13.5, exchangeRate: 4.1 }),
      ],
    });
    assert.equal(rows.length, 2);
    near(rows[0].amountPln, 0);
    near(rows[0].withholdingTaxPln, 0);
    near(rows[1].amountPln, 369);
    near(rows[1].withholdingTaxPln, 55.35);
    near(rows[1].deductibleWithholdingPln, 55.35);
    near(rows[1].taxPlnGross, 70.11);
    near(rows[1].taxToPayPln, 14.76);
    const g = sectionG(rows);
    assert.deepEqual([g.poz47, g.poz48, g.poz49], [70.11, 55.35, 15]);
  });

  void it('D3: pure WHT refund later pairs at the withholding rate', () => {
    const rows = run({
      divs: [makeDiv({ date: d(2024, 2, 15), amount: 100, exchangeRate: 4.0 })],
      taxes: [
        makeTax({ date: d(2024, 2, 15), amount: -15, exchangeRate: 4.0 }),
        makeTax({ date: d(2024, 4, 10), amount: 15, exchangeRate: 4.08 }),
      ],
    });
    assert.equal(rows.length, 1);
    near(rows[0].withholdingTaxPln, 0);
    near(rows[0].deductibleWithholdingPln, 0);
    assert.ok(kinds(rows[0]).includes('reversed-later'));
    const g = sectionG(rows);
    assert.deepEqual([g.poz47, g.poz48, g.poz49], [76, 0, 76]);
  });

  void it('D4: W-8BEN fix as WHT-only rows attaches by symbol', () => {
    const rows = run({
      divs: [makeDiv({ date: d(2024, 2, 15), amount: 100, exchangeRate: 4.0 })],
      taxes: [
        makeTax({ date: d(2024, 2, 15), amount: -30, exchangeRate: 4.0 }),
        makeTax({ date: d(2024, 3, 20), amount: 30, exchangeRate: 4.1 }),
        makeTax({ date: d(2024, 3, 20), amount: -15, exchangeRate: 4.1 }),
      ],
    });
    assert.equal(rows.length, 1);
    near(rows[0].withholdingTaxPln, 61.5);
    near(rows[0].deductibleWithholdingPln, 60);
    assert.ok(kinds(rows[0]).includes('wht-matched-by-symbol'));
    assert.ok(!kinds(rows[0]).includes('wht-lapse'));
    const g = sectionG(rows);
    assert.deepEqual([g.poz47, g.poz48, g.poz49], [76, 60, 16]);
  });

  void it('D5: partial refund attaches at the event withholding rate', () => {
    const rows = run({
      divs: [makeDiv({ date: d(2024, 2, 15), amount: 100, exchangeRate: 4.0 })],
      taxes: [
        makeTax({ date: d(2024, 2, 15), amount: -15, exchangeRate: 4.0 }),
        makeTax({ date: d(2024, 6, 3), amount: 5, exchangeRate: 3.95 }),
      ],
    });
    assert.equal(rows.length, 1);
    near(rows[0].withholdingTaxPln, 40);
    near(rows[0].deductibleWithholdingPln, 40);
    near(rows[0].taxToPayPln, 36);
    assert.ok(kinds(rows[0]).includes('wht-matched-by-symbol'));
    const g = sectionG(rows);
    assert.deepEqual([g.poz47, g.poz48, g.poz49], [76, 40, 36]);
  });

  void it('D6: unmatched WHT becomes an explicit row', () => {
    const taxes = [
      makeTax({
        symbol: 'XYZ',
        date: d(2024, 5, 10),
        amount: -20,
        exchangeRate: 3.95,
      }),
    ];
    const rows = run({ taxes });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].symbol, 'XYZ');
    near(rows[0].amountPln, 0);
    near(rows[0].withholdingTaxPln, 79);
    near(rows[0].deductibleWithholdingPln, 0);
    assert.deepEqual(rows[0].warnings, [{ kind: 'wht-unmatched' }]);
    const g = sectionG(rows);
    assert.deepEqual([g.poz47, g.poz48, g.poz49], [0, 0, 0]);

    const hinted = run({
      taxes,
      sells: [{ symbol: 'XYZ', date: d(2024, 5, 9) }],
    });
    assert.deepEqual(hinted[0].warnings, [
      { kind: 'wht-unmatched', likelySaleTax: true },
    ]);
  });

  void it('D7: ambiguous reversal pairs with the most recent original', () => {
    const rows = run({
      divs: [
        makeDiv({ date: d(2024, 3, 1), amount: 10, exchangeRate: 4.0 }),
        makeDiv({ date: d(2024, 4, 1), amount: 10, exchangeRate: 4.05 }),
        makeDiv({ date: d(2024, 4, 10), amount: -10, exchangeRate: 4.06 }),
      ],
    });
    assert.equal(rows.length, 2);
    near(rows[0].amountPln, 40);
    near(rows[1].amountPln, 0);
  });

  void it('D8: no pairing beyond 366 days', () => {
    const rows = run({
      divs: [
        makeDiv({ date: d(2023, 1, 10), amount: 100, exchangeRate: 4.4 }),
        makeDiv({ date: d(2024, 3, 1), amount: -100, exchangeRate: 4.3 }),
      ],
    });
    assert.equal(rows.length, 1);
    near(rows[0].amountPln, 0);
    assert.ok(kinds(rows[0]).includes('net-negative'));
  });

  const d9Divs = [
    makeDiv({ date: d(2024, 12, 16), amount: 100, exchangeRate: 4.05 }),
    makeDiv({ date: d(2025, 1, 14), amount: -100, exchangeRate: 4.12 }),
  ];
  const d9Taxes = [
    makeTax({ date: d(2024, 12, 16), amount: -15, exchangeRate: 4.05 }),
    makeTax({ date: d(2025, 1, 14), amount: 15, exchangeRate: 4.12 }),
  ];

  void it('D9: January reversal of a December dividend (both years)', () => {
    const y2024 = run({ divs: d9Divs, taxes: d9Taxes });
    assert.equal(y2024.length, 1);
    near(y2024[0].amountPln, 0);
    near(y2024[0].withholdingTaxPln, 0);
    assert.deepEqual(y2024[0].warnings, [
      { kind: 'reversed-later', reversalDate: '2025-01-14', crossYear: true },
    ]);
    const g = sectionG(y2024);
    assert.deepEqual([g.poz47, g.poz48, g.poz49], [0, 0, 0]);

    const y2025 = run({ divs: d9Divs, taxes: d9Taxes, period: taxPeriod2025 });
    assert.equal(y2025.length, 1);
    near(y2025[0].amountPln, 0);
    near(y2025[0].withholdingTaxPln, 0);
    assert.deepEqual(y2025[0].warnings, [
      { kind: 'reverses-prior-year', originalDate: '2024-12-16' },
    ]);
  });

  void it('D9: Y+1 reversal without the Y row stays floored', () => {
    const rows = run({
      divs: [d9Divs[1]],
      taxes: [d9Taxes[1]],
      period: taxPeriod2025,
    });
    assert.ok(kinds(rows[0]).includes('net-negative'));
  });

  void it('D10: WHT refunded next year adds back the credit (art. 45 ust. 3a)', () => {
    const divs = [
      makeDiv({ date: d(2024, 12, 16), amount: 100, exchangeRate: 4.05 }),
    ];
    const taxes = [
      makeTax({ date: d(2024, 12, 16), amount: -15, exchangeRate: 4.05 }),
      makeTax({ date: d(2025, 2, 20), amount: 15, exchangeRate: 4.2 }),
    ];
    const y2024 = run({ divs, taxes });
    assert.equal(y2024.length, 1);
    near(y2024[0].withholdingTaxPln, 60.75);
    assert.deepEqual(
      y2024[0].warnings?.filter((w) => w.kind === 'wht-refunded-later'),
      [{ kind: 'wht-refunded-later', refundDate: '2025-02-20' }],
    );
    const g24 = sectionG(y2024);
    assert.deepEqual([g24.poz47, g24.poz48, g24.poz49], [76.95, 60.75, 16]);

    const y2025 = run({ divs, taxes, period: taxPeriod2025 });
    assert.equal(y2025.length, 1);
    near(y2025[0].addBackPln ?? -1, 60.75);
    assert.deepEqual(y2025[0].warnings, [
      { kind: 'wht-refund-add-back', originalDate: '2024-12-16' },
    ]);
    const g25 = sectionG(y2025);
    assert.deepEqual([g25.poz47, g25.poz48, g25.poz49], [60.75, 0, 61]);
  });

  void it('D10b: refund of the excess above the treaty cap adds back 0', () => {
    const divs = [
      makeDiv({ date: d(2024, 12, 16), amount: 100, exchangeRate: 4.05 }),
    ];
    const taxes = [
      makeTax({ date: d(2024, 12, 16), amount: -30, exchangeRate: 4.05 }),
      makeTax({ date: d(2025, 2, 20), amount: 15, exchangeRate: 4.2 }),
    ];
    const y2024 = run({ divs, taxes });
    near(y2024[0].deductibleWithholdingPln, 60.75);
    const y2025 = run({ divs, taxes, period: taxPeriod2025 });
    near(y2025[0].addBackPln ?? -1, 0);
    const g = sectionG(y2025);
    assert.deepEqual([g.poz47, g.poz48, g.poz49], [0, 0, 0]);
  });

  void it('add-back reduces the credit before raising the dividend tax', () => {
    const g = sectionGForeignFlatTax({
      dividendIncomePln: 1000,
      dividendDeductiblePln: 100,
      dividendAddBackPln: 30,
      interestIncomePln: 0,
      interestForeignTaxPln: 0,
    });
    assert.deepEqual([g.poz47, g.poz48, g.poz49], [190, 70, 120]);
    const over = sectionGForeignFlatTax({
      dividendIncomePln: 1000,
      dividendDeductiblePln: 20,
      dividendAddBackPln: 50,
      interestIncomePln: 0,
      interestForeignTaxPln: 0,
    });
    assert.deepEqual([over.poz47, over.poz48, over.poz49], [220, 0, 220]);
  });

  void it('same-day [100, -100, 100] still nets to one payment', () => {
    const rows = run({
      divs: [
        makeDiv({ amount: 100 }),
        makeDiv({ amount: -100 }),
        makeDiv({ amount: 100 }),
      ],
    });
    assert.equal(rows.length, 1);
    near(rows[0].amountPln, 400);
  });
});

void describe('calculateDividends — WHT accounting invariant (plan 13)', () => {
  // Every in-period WHT row is netted into an event, or reported as an
  // unmatched / info row. Single currency, no cross-year, so net withheld in
  // the input equals the net the results show.
  const scenarios: {
    name: string;
    divs: EnrichedRawDividend[];
    taxes: EnrichedWithholdingTax[];
  }[] = [
    {
      name: 'same-day net',
      divs: [makeDiv({ date: d(2024, 2, 15), amount: 100 })],
      taxes: [makeTax({ date: d(2024, 2, 15), amount: -15 })],
    },
    {
      name: 'W-8BEN fix and partial refund',
      divs: [makeDiv({ date: d(2024, 2, 15), amount: 100 })],
      taxes: [
        makeTax({ date: d(2024, 2, 15), amount: -30 }),
        makeTax({ date: d(2024, 3, 20), amount: 30 }),
        makeTax({ date: d(2024, 3, 20), amount: -15 }),
        makeTax({ date: d(2024, 6, 3), amount: 5 }),
      ],
    },
    {
      name: 'WHT posted a day before its dividend',
      divs: [makeDiv({ date: d(2024, 2, 16), amount: 100 })],
      taxes: [makeTax({ date: d(2024, 2, 15), amount: -15 })],
    },
    {
      name: 'unmatched symbol and unmatched far-away WHT',
      divs: [makeDiv({ date: d(2024, 2, 15), amount: 100 })],
      taxes: [
        makeTax({ date: d(2024, 2, 15), amount: -15 }),
        makeTax({ symbol: 'XYZ', date: d(2024, 5, 10), amount: -20 }),
        makeTax({ symbol: 'XYZ', date: d(2024, 7, 10), amount: -4 }),
      ],
    },
    {
      name: 'reversal with refund and re-post',
      divs: [
        makeDiv({ date: d(2024, 2, 15), amount: 100 }),
        makeDiv({ date: d(2024, 3, 20), amount: -100 }),
        makeDiv({ date: d(2024, 3, 20), amount: 90 }),
      ],
      taxes: [
        makeTax({ date: d(2024, 2, 15), amount: -15 }),
        makeTax({ date: d(2024, 3, 20), amount: 15 }),
        makeTax({ date: d(2024, 3, 20), amount: -13.5 }),
      ],
    },
  ];

  for (const scenario of scenarios) {
    void it(`accounts for all withholding: ${scenario.name}`, () => {
      const rows = calculateDividends({
        dividends: scenario.divs,
        withholdingTaxes: scenario.taxes,
        taxPeriod: taxPeriod2024,
        symbolCountryMap: new Map([
          ['AAPL', 'US'],
          ['XYZ', 'US'],
        ]),
      });
      const inputNet = scenario.taxes.reduce((s, t) => s - t.amount, 0);
      const outputNet = rows.reduce((s, r) => s + r.withholdingTaxOriginal, 0);
      near(outputNet, inputNet);
    });
  }

  void it('reports every in-period WHT row of a cross-year refund', () => {
    const rows = run({
      divs: [
        makeDiv({ date: d(2024, 12, 16), amount: 100, exchangeRate: 4.05 }),
      ],
      taxes: [
        makeTax({ date: d(2024, 12, 16), amount: -15, exchangeRate: 4.05 }),
        makeTax({ date: d(2025, 2, 20), amount: 15, exchangeRate: 4.2 }),
      ],
      period: taxPeriod2025,
    });
    assert.ok(rows.some((r) => r.date.getTime() === d(2025, 2, 20).getTime()));
  });
});

void describe('calculateDividends — plan 13 review fixes', () => {
  void it('M-1: fallback WHT skips an event reversed to zero', () => {
    const rows = run({
      divs: [
        makeDiv({ date: d(2024, 1, 15), amount: 100, exchangeRate: 4.0 }),
        makeDiv({ date: d(2024, 2, 15), amount: 100, exchangeRate: 4.0 }),
        makeDiv({ date: d(2024, 2, 20), amount: -100, exchangeRate: 4.0 }),
      ],
      taxes: [makeTax({ date: d(2024, 3, 1), amount: -15, exchangeRate: 4.0 })],
    });
    const jan = rows.find((r) => r.date.getTime() === d(2024, 1, 15).getTime());
    assert.ok(jan);
    near(jan.amountPln, 400);
    near(jan.deductibleWithholdingPln, 60);
    near(jan.taxPlnGross, 76);
    near(jan.taxToPayPln, 16);
    const feb = rows.find((r) => r.date.getTime() === d(2024, 2, 15).getTime());
    near(feb?.withholdingTaxPln ?? -1, 0);
  });

  void it('M-1: falls back to a reversed event when nothing else exists', () => {
    const rows = run({
      divs: [
        makeDiv({ date: d(2024, 2, 15), amount: 100 }),
        makeDiv({ date: d(2024, 2, 20), amount: -100 }),
      ],
      taxes: [makeTax({ date: d(2024, 3, 1), amount: -15 })],
    });
    assert.equal(rows.length, 1);
    assert.ok(kinds(rows[0]).includes('wht-matched-by-symbol'));
  });

  void it('M-2: a refund with no earlier-year data warns about the add-back', () => {
    const rows = run({
      taxes: [makeTax({ date: d(2025, 2, 20), amount: 15, exchangeRate: 4.2 })],
      period: taxPeriod2025,
    });
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].warnings, [{ kind: 'wht-refund-unmatched' }]);
    assert.equal(rows[0].isInfo, true);
    near(rows[0].deductibleWithholdingPln, 0);
    assert.equal(rows[0].addBackPln, undefined);
  });

  void it('minor 2: a cross-year WHT-only pair is reported in both years', () => {
    const taxes = [
      makeTax({ date: d(2024, 12, 20), amount: -15 }),
      makeTax({ date: d(2025, 1, 10), amount: 15 }),
    ];
    for (const period of [taxPeriod2024, taxPeriod2025]) {
      const rows = run({ taxes, period });
      assert.equal(rows.length, 1);
      const inPeriod = taxes.filter(
        (t) => t.date.getFullYear() === period.year,
      );
      near(
        rows.reduce((s, r) => s + r.withholdingTaxOriginal, 0),
        inPeriod.reduce((s, t) => s + Math.abs(t.amount), 0),
      );
      assert.equal(rows[0].date.getFullYear(), period.year);
    }
  });

  void it('minor 5: an ADR fee on a reversed event moves to the re-post', () => {
    const rows = calculateDividends({
      dividends: [
        makeDiv({ date: d(2024, 2, 15), amount: 100, exchangeRate: 4.0 }),
        makeDiv({ date: d(2024, 3, 20), amount: -100, exchangeRate: 4.1 }),
        makeDiv({ date: d(2024, 3, 20), amount: 90, exchangeRate: 4.1 }),
      ],
      withholdingTaxes: [],
      transactionFees: [makeFee({ datetime: d(2024, 2, 15), amount: 2.5 })],
      reduceAdrFeesFromDividends: true,
      taxPeriod: taxPeriod2024,
      symbolCountryMap: new Map([['AAPL', 'US']]),
    });
    const repost = rows.find(
      (r) => r.date.getTime() === d(2024, 3, 20).getTime(),
    );
    const zeroed = rows.find(
      (r) => r.date.getTime() === d(2024, 2, 15).getTime(),
    );
    near(repost?.amountPln ?? -1, (90 - 2.5) * 4.1);
    near(repost?.adrFeeOriginal ?? -1, 2.5);
    near(zeroed?.adrFeeOriginal ?? -1, 0);
  });

  void it('minor 6: pairs 9000 rows of one symbol quickly', () => {
    const rows = [];
    for (let i = 0; i < 6000; i++) {
      rows.push(row(d(2024, 1, 1 + (i % 28)), 100));
    }
    for (let i = 0; i < 3000; i++) {
      rows.push(row(d(2024, 6, 1 + (i % 28)), -100));
    }
    const start = performance.now();
    const pairs = pairReversals({ rows, originalSign: 1 });
    const elapsed = performance.now() - start;
    assert.equal(pairs.length, 3000);
    assert.equal(new Set(pairs.map((p) => p.original)).size, 3000);
    assert.ok(elapsed < 500, `took ${String(elapsed)} ms`);
  });

  void it('minor 6: pairs amounts across a cent bucket boundary', () => {
    const pairs = pairReversals({
      rows: [row(d(2024, 1, 1), 10.004), row(d(2024, 1, 2), -10.0)],
      originalSign: 1,
    });
    assert.equal(pairs.length, 1);
  });

  void it('minor 7: add-back row carries rateUnavailable', () => {
    const rows = run({
      divs: [
        makeDiv({ date: d(2024, 12, 16), amount: 100, exchangeRate: 4.05 }),
      ],
      taxes: [
        makeTax({
          date: d(2024, 12, 16),
          amount: -15,
          exchangeRate: 0,
          rateUnavailable: true,
        }),
        makeTax({ date: d(2025, 2, 20), amount: 15, exchangeRate: 4.2 }),
      ],
      period: taxPeriod2025,
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].rateUnavailable, true);
  });

  void it('minor 9: D3 reports the reversal date', () => {
    const rows = run({
      divs: [makeDiv({ date: d(2024, 2, 15), amount: 100 })],
      taxes: [
        makeTax({ date: d(2024, 2, 15), amount: -15 }),
        makeTax({ date: d(2024, 4, 10), amount: 15 }),
      ],
    });
    assert.deepEqual(
      rows[0].warnings?.filter((w) => w.kind === 'reversed-later'),
      [
        {
          kind: 'reversed-later',
          reversalDate: '2024-04-10',
          crossYear: false,
        },
      ],
    );
  });

  void it('B-1 engine: several same-kind warnings on one event are all kept', () => {
    const rows = run({
      divs: [makeDiv({ date: d(2024, 2, 15), amount: 100 })],
      taxes: [
        makeTax({ date: d(2024, 2, 15), amount: -10 }),
        makeTax({ date: d(2024, 3, 20), amount: -3 }),
        makeTax({ date: d(2024, 4, 10), amount: -2 }),
      ],
    });
    assert.deepEqual(
      rows[0].warnings?.filter((w) => w.kind === 'wht-matched-by-symbol'),
      [
        { kind: 'wht-matched-by-symbol', whtDate: '2024-03-20' },
        { kind: 'wht-matched-by-symbol', whtDate: '2024-04-10' },
      ],
    );
    const reversed = run({
      divs: [
        makeDiv({ date: d(2024, 2, 15), amount: 100 }),
        makeDiv({ date: d(2024, 3, 20), amount: -100 }),
      ],
      taxes: [
        makeTax({ date: d(2024, 2, 15), amount: -15 }),
        makeTax({ date: d(2024, 3, 22), amount: 15 }),
      ],
    });
    assert.equal(
      reversed[0].warnings?.filter((w) => w.kind === 'reversed-later').length,
      2,
    );
  });
});

void describe('dividendBreakdown', () => {
  void it('keeps the add-back apart so the parts add up to income + add-back', () => {
    const rows = run({
      divs: [
        makeDiv({ date: d(2024, 12, 16), amount: 100, exchangeRate: 4.05 }),
      ],
      taxes: [
        makeTax({ date: d(2024, 12, 16), amount: -15, exchangeRate: 4.05 }),
        makeTax({ date: d(2025, 2, 20), amount: 15, exchangeRate: 4.2 }),
      ],
    });
    const y2024 = dividendBreakdown({ rows });
    near(y2024.net + y2024.withholding + y2024.taxOwed, y2024.income);
    near(y2024.addBack, 0);
    const y2025 = dividendBreakdown({
      rows: run({
        divs: [
          makeDiv({ date: d(2024, 12, 16), amount: 100, exchangeRate: 4.05 }),
        ],
        taxes: [
          makeTax({ date: d(2024, 12, 16), amount: -15, exchangeRate: 4.05 }),
          makeTax({ date: d(2025, 2, 20), amount: 15, exchangeRate: 4.2 }),
        ],
        period: taxPeriod2025,
      }),
    });
    near(y2025.income, 0);
    near(y2025.net + y2025.withholding + y2025.taxOwed, 0);
    near(y2025.addBack, 60.75);
  });
});
