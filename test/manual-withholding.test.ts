import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

(globalThis as unknown as { $state: <T>(value: T) => T }).$state = (value) =>
  value;

const [
  { db },
  data,
  { resolveDividendCountry, setSymbolCountryOverride },
  { createSession },
  { validateDividendInput, sharedIsin },
] = await Promise.all([
  import('../src/lib/db.js'),
  import('../src/lib/services/data.js'),
  import('../src/lib/services/country-overrides.js'),
  import('../src/lib/services/session.js'),
  import('../src/lib/utils/dividend-input.js'),
]);
const {
  saveDividend,
  addDividend,
  updateDividend,
  deleteDividend,
  addWithholdingTax,
  updateWithholdingTax,
  listDividendWithholding,
  ManualEntryValidationError,
} = data;

const day = new Date(2024, 2, 15);
const AAPL_ISIN = 'US0378331005';

async function newSession(): Promise<string> {
  return (await createSession({ year: 2024 })).id;
}

const linkedRows = (sessionId: string) =>
  db.withholdingTaxes
    .where('sessionId')
    .equals(sessionId)
    .filter((r) => r.dividendId !== undefined)
    .toArray();

async function rejects(p: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(p, (e: unknown) => {
    assert.ok(e instanceof ManualEntryValidationError);
    assert.equal(e.code, code);
    return true;
  });
}

void describe('manual withholding service (plan 14)', () => {
  afterEach(async () => {
    await Promise.all([
      db.sessions.clear(),
      db.dividends.clear(),
      db.withholdingTaxes.clear(),
      db.symbolCountryOverrides.clear(),
      db.trades.clear(),
    ]);
  });

  void it('adds a dividend with one linked withholding row copying its key', async () => {
    const sessionId = await newSession();
    const id = await saveDividend({
      sessionId,
      dividend: {
        symbol: 'AAPL',
        isin: 'US0378331005',
        currency: 'USD',
        date: day,
        amount: 100,
      },
      withholding: 15,
    });
    const rows = await linkedRows(sessionId);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].dividendId, id);
    assert.equal(rows[0].amount, -15);
    assert.equal(rows[0].symbol, 'AAPL');
    assert.equal(rows[0].isin, 'US0378331005');
    assert.equal(rows[0].currency, 'USD');
    assert.equal(rows[0].date.getTime(), day.getTime());
  });

  void it('adds no row without withholding, and 0 deletes the linked row', async () => {
    const sessionId = await newSession();
    const id = await saveDividend({
      sessionId,
      dividend: {
        symbol: 'AAPL',
        isin: AAPL_ISIN,
        currency: 'USD',
        date: day,
        amount: 100,
      },
    });
    assert.equal((await linkedRows(sessionId)).length, 0);
    await saveDividend({ sessionId, id, dividend: {}, withholding: 15 });
    assert.equal((await linkedRows(sessionId)).length, 1);
    await saveDividend({ sessionId, id, dividend: {}, withholding: 0 });
    assert.equal((await linkedRows(sessionId)).length, 0);
  });

  void it('syncs key fields (date, ISIN, currency, kind) after a dividend edit', async () => {
    const sessionId = await newSession();
    const id = await db.dividends.add({
      sessionId,
      symbol: 'TSM',
      currency: 'USD',
      date: day,
      amount: 100,
      withholdingTax: 0,
      kind: 'payment-in-lieu',
    });
    assert.ok(id !== undefined);
    await setSymbolCountryOverride({
      sessionId,
      symbol: 'TSM',
      country: 'TW',
      scope: 'dividends',
    });
    await saveDividend({ sessionId, id, dividend: {}, withholding: 10 });
    const date = new Date(2024, 3, 2);
    await updateDividend({
      id,
      changes: { date, isin: 'TW0002330008', currency: 'EUR' },
    });
    const [row] = await linkedRows(sessionId);
    assert.equal(row.date.getTime(), date.getTime());
    assert.equal(row.isin, 'TW0002330008');
    assert.equal(row.currency, 'EUR');
    assert.equal(row.kind, 'payment-in-lieu');
    assert.equal(row.amount, -10);
  });

  void it('keeps one linked row per dividend', async () => {
    const sessionId = await newSession();
    const id = await saveDividend({
      sessionId,
      dividend: {
        symbol: 'AAPL',
        isin: AAPL_ISIN,
        currency: 'USD',
        date: day,
        amount: 100,
      },
      withholding: 15,
    });
    await db.withholdingTaxes.add({
      sessionId,
      symbol: 'AAPL',
      currency: 'USD',
      date: day,
      amount: -5,
      dividendId: id,
    });
    await saveDividend({ sessionId, id, dividend: {}, withholding: 12 });
    const rows = await linkedRows(sessionId);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].amount, -12);
  });

  void it('deleteDividend removes the linked rows but not free-standing ones', async () => {
    const sessionId = await newSession();
    const id = await saveDividend({
      sessionId,
      dividend: {
        symbol: 'AAPL',
        isin: AAPL_ISIN,
        currency: 'USD',
        date: day,
        amount: 100,
      },
      withholding: 15,
    });
    await addWithholdingTax({
      sessionId,
      withholding: { symbol: 'AAPL', currency: 'USD', date: day, amount: 5 },
    });
    await deleteDividend({ id });
    assert.equal(await db.dividends.count(), 0);
    const rest = await db.withholdingTaxes.toArray();
    assert.equal(rest.length, 1);
    assert.equal(rest[0].dividendId, undefined);
  });

  void it('rejects withholding above gross, negative or not finite', async () => {
    const sessionId = await newSession();
    const dividend = {
      symbol: 'AAPL',
      isin: AAPL_ISIN,
      currency: 'USD',
      date: day,
      amount: 100,
    };
    await rejects(
      saveDividend({ sessionId, dividend, withholding: 100.01 }),
      'withholding-exceeds-gross',
    );
    await rejects(
      saveDividend({ sessionId, dividend, withholding: -1 }),
      'withholding-negative',
    );
    await rejects(
      saveDividend({ sessionId, dividend, withholding: NaN }),
      'withholding-not-finite',
    );
    assert.equal(await db.dividends.count(), 0);
    await saveDividend({ sessionId, dividend, withholding: 100 });
    assert.equal((await linkedRows(sessionId)).length, 1);
  });

  void it('rejects lowering the amount below an existing linked withholding', async () => {
    const sessionId = await newSession();
    const id = await saveDividend({
      sessionId,
      dividend: {
        symbol: 'AAPL',
        isin: AAPL_ISIN,
        currency: 'USD',
        date: day,
        amount: 100,
      },
      withholding: 15,
    });
    await rejects(
      updateDividend({ id, changes: { amount: 10 } }),
      'withholding-exceeds-gross',
    );
    assert.equal((await db.dividends.get(id))?.amount, 100);
  });

  void it('rejects invalid linked-row updates', async () => {
    const sessionId = await newSession();
    await saveDividend({
      sessionId,
      dividend: {
        symbol: 'AAPL',
        isin: AAPL_ISIN,
        currency: 'USD',
        date: day,
        amount: 100,
      },
      withholding: 15,
    });
    const [row] = await linkedRows(sessionId);
    const rowId = row.id as number;
    await rejects(
      updateWithholdingTax({ id: rowId, changes: { currency: 'EUR' } }),
      'linked-key-change',
    );
    await rejects(
      updateWithholdingTax({
        id: rowId,
        changes: { date: new Date(2024, 3, 1) },
      }),
      'linked-key-change',
    );
    await rejects(
      updateWithholdingTax({ id: rowId, changes: { amount: 5 } }),
      'linked-amount-sign',
    );
    await rejects(
      updateWithholdingTax({ id: rowId, changes: { amount: -101 } }),
      'withholding-exceeds-gross',
    );
    await updateWithholdingTax({ id: rowId, changes: { amount: -20 } });
    assert.equal((await db.withholdingTaxes.get(rowId))?.amount, -20);
  });

  void it('addWithholdingTax validates and stores a free-standing row', async () => {
    const sessionId = await newSession();
    const base = { symbol: 'aapl', currency: 'usd', date: day, amount: -3 };
    await rejects(
      addWithholdingTax({ sessionId, withholding: { ...base, amount: 0 } }),
      'amount-invalid',
    );
    await rejects(
      addWithholdingTax({ sessionId, withholding: { ...base, symbol: ' ' } }),
      'symbol-required',
    );
    await rejects(
      addWithholdingTax({ sessionId, withholding: { ...base, currency: '' } }),
      'currency-required',
    );
    await rejects(
      addWithholdingTax({
        sessionId,
        withholding: { ...base, date: new Date(NaN) },
      }),
      'date-invalid',
    );
    const id = await addWithholdingTax({ sessionId, withholding: base });
    const row = await db.withholdingTaxes.get(id);
    assert.ok(row);
    assert.equal(row.symbol, 'AAPL');
    assert.equal(row.currency, 'USD');
    assert.equal(row.dividendId, undefined);
  });

  void it('writes a dividends-scope country override only when unknown and unset', async () => {
    const sessionId = await newSession();
    const dividend = { symbol: 'XYZ', currency: 'USD', date: day, amount: 100 };
    await saveDividend({ sessionId, dividend, withholding: 15, country: 'us' });
    const overrides = await db.symbolCountryOverrides.toArray();
    assert.equal(overrides.length, 1);
    assert.equal(overrides[0].country, 'US');
    assert.equal(overrides[0].scope, 'dividends');

    // The symbol now has an override: a different country is not written.
    await saveDividend({ sessionId, dividend, withholding: 1, country: 'DE' });
    assert.equal((await db.symbolCountryOverrides.toArray())[0].country, 'US');

    // A known ISIN country is not overridden.
    await saveDividend({
      sessionId,
      dividend: { ...dividend, symbol: 'KO', isin: 'US1912161007' },
      withholding: 1,
      country: 'DE',
    });
    assert.equal(await db.symbolCountryOverrides.count(), 1);
  });

  void it('does not override a symbol that has a gains-only override', async () => {
    const sessionId = await newSession();
    await setSymbolCountryOverride({
      sessionId,
      symbol: 'XYZ',
      country: 'GB',
      scope: 'gains',
    });
    await saveDividend({
      sessionId,
      dividend: { symbol: 'XYZ', currency: 'USD', date: day, amount: 100 },
      country: 'US',
    });
    const [o] = await db.symbolCountryOverrides.toArray();
    assert.equal(o.country, 'GB');
    assert.equal(o.scope, 'gains');
  });

  void it('rejects withholding when the country stays unknown (XX)', async () => {
    const sessionId = await newSession();
    const dividend = { symbol: 'XYZ', currency: 'USD', date: day, amount: 100 };
    await rejects(
      saveDividend({ sessionId, dividend, withholding: 15 }),
      'country-required',
    );
    // An explicit XX is still unknown and would credit at 19%.
    await rejects(
      saveDividend({ sessionId, dividend, withholding: 15, country: 'XX' }),
      'country-required',
    );
    assert.equal(await db.dividends.count(), 0);
    assert.equal(await db.withholdingTaxes.count(), 0);
    assert.equal(await db.symbolCountryOverrides.count(), 0);
    // Without withholding the dividend saves as before.
    await saveDividend({ sessionId, dividend });
    assert.equal(await db.dividends.count(), 1);
  });

  void it('rejects withholding after the only ISIN of the symbol is removed', async () => {
    const sessionId = await newSession();
    const id = await saveDividend({
      sessionId,
      dividend: {
        symbol: 'XYZ',
        isin: 'DE0007164600',
        currency: 'EUR',
        date: day,
        amount: 100,
      },
      withholding: 10,
    });
    await rejects(
      saveDividend({
        sessionId,
        id,
        dividend: { isin: undefined },
        withholding: 10,
      }),
      'country-required',
    );
    assert.equal((await db.dividends.get(id))?.isin, 'DE0007164600');
    // The form's resolver must not count the edited row's stored ISIN.
    const info = await resolveDividendCountry({
      sessionId,
      symbol: 'XYZ',
      excludeDividendId: id,
    });
    assert.equal(info.source, 'unknown');
  });

  void it('is transactional: a failing save leaves no partial rows', async () => {
    const sessionId = await newSession();
    const id = await saveDividend({
      sessionId,
      dividend: {
        symbol: 'AAPL',
        isin: AAPL_ISIN,
        currency: 'USD',
        date: day,
        amount: 100,
      },
      withholding: 15,
    });
    // Change the date and force the link check to fail afterwards.
    await db.withholdingTaxes.where('sessionId').equals(sessionId).modify({
      amount: 5,
    });
    await rejects(
      saveDividend({
        sessionId,
        id,
        dividend: { date: new Date(2024, 5, 1) },
      }),
      'linked-amount-sign',
    );
    assert.equal((await db.dividends.get(id))?.date.getTime(), day.getTime());
  });

  void it('marks a calculated session stale on every manual write', async () => {
    const sessionId = await newSession();
    const calculatedAt = new Date(Date.now() - 60_000);
    await db.sessions.update(sessionId, {
      status: 'calculated',
      calculatedAt,
      dataUpdatedAt: calculatedAt,
    });
    await addWithholdingTax({
      sessionId,
      withholding: { symbol: 'AAPL', currency: 'USD', date: day, amount: -1 },
    });
    await new Promise((r) => setTimeout(r, 20));
    const after = await db.sessions.get(sessionId);
    assert.ok((after?.dataUpdatedAt?.getTime() ?? 0) > calculatedAt.getTime());
  });

  void it('listDividendWithholding splits linked and unlinked rows', async () => {
    const sessionId = await newSession();
    const id = await saveDividend({
      sessionId,
      dividend: {
        symbol: 'AAPL',
        isin: AAPL_ISIN,
        currency: 'USD',
        date: day,
        amount: 100,
      },
      withholding: 15,
    });
    await addWithholdingTax({
      sessionId,
      withholding: { symbol: 'KO', currency: 'USD', date: day, amount: -2 },
    });
    const { linkedByDividendId, unlinkedKeys } = await listDividendWithholding({
      sessionId,
    });
    assert.equal(linkedByDividendId.get(id)?.amount, -15);
    assert.equal(unlinkedKeys.size, 1);
    assert.ok([...unlinkedKeys][0].includes(':KO:USD:'));
  });

  void it('addDividend still works as before (no withholding row)', async () => {
    const sessionId = await newSession();
    const id = await addDividend({
      sessionId,
      dividend: { symbol: 'AAPL', currency: 'USD', date: day, amount: 1 },
    });
    assert.equal((await db.dividends.get(id))?.withholdingTax, 0);
    assert.equal(await db.withholdingTaxes.count(), 0);
  });
});

void describe('resolveDividendCountry', () => {
  afterEach(async () => {
    await Promise.all([
      db.sessions.clear(),
      db.dividends.clear(),
      db.symbolCountryOverrides.clear(),
      db.trades.clear(),
    ]);
  });

  void it('reports isin, session, override, gains-only and unknown', async () => {
    const sessionId = await newSession();
    const unknown = await resolveDividendCountry({ sessionId, symbol: 'XYZ' });
    assert.deepEqual([unknown.country, unknown.source], ['XX', 'unknown']);

    const fromIsin = await resolveDividendCountry({
      sessionId,
      symbol: 'XYZ',
      isin: 'DE0007164600',
    });
    assert.deepEqual([fromIsin.country, fromIsin.source], ['DE', 'isin']);

    await db.dividends.add({
      sessionId,
      symbol: 'KO',
      isin: 'US1912161007',
      currency: 'USD',
      date: day,
      amount: 1,
      withholdingTax: 0,
    });
    const fromSession = await resolveDividendCountry({
      sessionId,
      symbol: 'KO',
    });
    assert.deepEqual(
      [fromSession.country, fromSession.source],
      ['US', 'session'],
    );

    await setSymbolCountryOverride({
      sessionId,
      symbol: 'XYZ',
      country: 'gb',
      scope: 'dividends',
    });
    const overridden = await resolveDividendCountry({
      sessionId,
      symbol: 'XYZ',
    });
    assert.deepEqual(
      [overridden.country, overridden.source, overridden.overrideScope],
      ['GB', 'override', 'dividends'],
    );

    await setSymbolCountryOverride({
      sessionId,
      symbol: 'XYZ',
      country: 'GB',
      scope: 'gains',
    });
    const gainsOnly = await resolveDividendCountry({
      sessionId,
      symbol: 'XYZ',
    });
    assert.deepEqual(
      [gainsOnly.country, gainsOnly.source, gainsOnly.overrideScope],
      ['XX', 'unknown', 'gains'],
    );
  });
});

void describe('validateDividendInput', () => {
  const ok = {
    symbol: 'AAPL',
    dateText: '2024-03-15',
    dateParsed: true,
    amount: '100',
    currency: 'USD',
    withholding: '15',
    withholdingLocked: false,
    country: '',
    countryInputShown: false,
    countryKnown: true,
  };

  void it('accepts a valid input', () => {
    assert.deepEqual(validateDividendInput(ok), {});
    assert.deepEqual(validateDividendInput({ ...ok, withholding: '' }), {});
  });

  void it('checks the withholding range', () => {
    assert.equal(
      validateDividendInput({ ...ok, withholding: '101' }).withholding,
      'withholding-exceeds-gross',
    );
    assert.equal(
      validateDividendInput({ ...ok, withholding: '-1' }).withholding,
      'must-be-non-negative',
    );
    assert.equal(
      validateDividendInput({ ...ok, withholding: 'abc' }).withholding,
      'must-be-non-negative',
    );
    assert.deepEqual(validateDividendInput({ ...ok, withholding: '100' }), {});
  });

  void it('requires a country when withholding > 0 and none is derivable', () => {
    const unknown = { ...ok, countryKnown: false, countryInputShown: true };
    assert.equal(
      validateDividendInput(unknown).country,
      'country-required-for-withholding',
    );
    assert.deepEqual(validateDividendInput({ ...unknown, country: 'us' }), {});
    assert.deepEqual(
      validateDividendInput({ ...unknown, withholding: '0' }),
      {},
    );
    assert.deepEqual(
      validateDividendInput({ ...unknown, withholding: '' }),
      {},
    );
    assert.equal(
      validateDividendInput({ ...unknown, country: 'USA' }).country,
      'country-code',
    );
  });

  void it('rejects XX as a source country', () => {
    const unknown = { ...ok, countryKnown: false, countryInputShown: true };
    assert.equal(
      validateDividendInput({ ...unknown, country: 'xx' }).country,
      'country-code',
    );
  });

  void it('ignores withholding when locked by imported rows', () => {
    assert.deepEqual(
      validateDividendInput({
        ...ok,
        withholding: '999',
        withholdingLocked: true,
        countryKnown: false,
      }),
      {},
    );
  });
});

void describe('sharedIsin', () => {
  void it('returns the ISIN only when all dividends of the symbol share it', () => {
    const a = { symbol: 'AAPL', isin: 'US0378331005' };
    assert.equal(sharedIsin([a, a, { symbol: 'KO' }], 'AAPL'), a.isin);
    assert.equal(sharedIsin([a, { symbol: 'AAPL' }], 'AAPL'), undefined);
    assert.equal(
      sharedIsin([a, { symbol: 'AAPL', isin: 'US0000000000' }], 'AAPL'),
      undefined,
    );
    assert.equal(sharedIsin([{ symbol: 'AAPL' }], 'AAPL'), undefined);
    assert.equal(sharedIsin([a], 'MSFT'), undefined);
  });
});
