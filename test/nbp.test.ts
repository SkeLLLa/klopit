import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';
import { fetchRate, fetchRates, NbpFetchError } from '../src/core/nbp.js';

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Not Found',
    json: async () => body,
  } as Response;
}

function nbpResponse(
  code: string,
  rates: { no: string; effectiveDate: string; mid: number }[],
) {
  return {
    table: 'A',
    currency: 'dolar amerykanski',
    code,
    rates,
  };
}

void describe('nbp', () => {
  let fetchMock: ReturnType<typeof mock.fn<typeof globalThis.fetch>>;

  before(() => {
    fetchMock = mock.fn<typeof globalThis.fetch>();
    globalThis.fetch = fetchMock;
  });

  after(() => {
    mock.restoreAll();
  });

  void describe('fetchRate', () => {
    void it('returns rate for a weekday with data', async () => {
      fetchMock.mock.mockImplementation(async () =>
        mockResponse(
          nbpResponse('USD', [
            { no: '001/A/NBP/2025', effectiveDate: '2025-01-02', mid: 4.123 },
          ]),
        ),
      );

      const result = await fetchRate({ currency: 'USD', date: '2025-01-02' });

      assert.equal(result.size, 1);
      const rate = result.get('2025-01-02');
      assert.ok(rate);
      assert.equal(rate.rate, 4.123);
      assert.equal(rate.currency, 'USD');
      assert.equal(rate.table, '001/A/NBP/2025');
      assert.equal(rate.date, '2025-01-02');
    });

    void it('returns undefined for a weekend day (404)', async () => {
      fetchMock.mock.mockImplementation(async () => mockResponse(null, 404));

      const result = await fetchRate({ currency: 'USD', date: '2025-01-04' });

      assert.equal(result.size, 1);
      assert.equal(result.get('2025-01-04'), undefined);
    });

    void it('returns PLN rate 1 without API call', async () => {
      fetchMock.mock.resetCalls();
      const result = await fetchRate({ currency: 'PLN', date: '2025-06-15' });

      assert.equal(result.size, 1);
      const rate = result.get('2025-06-15');
      assert.ok(rate);
      assert.equal(rate.rate, 1);
      assert.equal(rate.currency, 'PLN');
      assert.equal(fetchMock.mock.callCount(), 0);
    });

    void it('handles case-insensitive PLN', async () => {
      fetchMock.mock.resetCalls();
      const result = await fetchRate({ currency: 'pln', date: '2025-06-15' });

      assert.equal(result.size, 1);
      assert.ok(result.get('2025-06-15'));
      assert.equal(fetchMock.mock.callCount(), 0);
    });

    void it('throws on non-404 HTTP errors', async () => {
      fetchMock.mock.mockImplementation(async () => mockResponse(null, 500));

      await assert.rejects(
        () => fetchRate({ currency: 'USD', date: '2025-01-02' }),
        { message: /NBP API error: 500/ },
      );
    });
  });

  void describe('fetchRates', () => {
    void it('returns rates for a short range', async () => {
      fetchMock.mock.mockImplementation(async () =>
        mockResponse(
          nbpResponse('USD', [
            { no: '001/A/NBP/2025', effectiveDate: '2025-01-02', mid: 4.1 },
            { no: '002/A/NBP/2025', effectiveDate: '2025-01-03', mid: 4.2 },
          ]),
        ),
      );

      const result = await fetchRates({
        currency: 'USD',
        startDate: '2025-01-01',
        endDate: '2025-01-04',
      });

      assert.equal(result.size, 4);
      assert.equal(result.get('2025-01-01'), undefined);
      assert.equal(result.get('2025-01-02')?.rate, 4.1);
      assert.equal(result.get('2025-01-03')?.rate, 4.2);
      assert.equal(result.get('2025-01-04'), undefined);
    });

    void it('splits ranges longer than 93 days into chunks', async () => {
      fetchMock.mock.resetCalls();
      fetchMock.mock.mockImplementation(async () =>
        mockResponse(nbpResponse('USD', [])),
      );

      // 100 days: should be split into 2 chunks
      await fetchRates({
        currency: 'USD',
        startDate: '2025-01-01',
        endDate: '2025-04-10',
      });

      assert.equal(fetchMock.mock.callCount(), 2);
    });

    void it('handles exactly 93 days in a single request', async () => {
      fetchMock.mock.resetCalls();
      fetchMock.mock.mockImplementation(async () =>
        mockResponse(nbpResponse('USD', [])),
      );

      // 92 days between = 93 day range (inclusive)
      await fetchRates({
        currency: 'USD',
        startDate: '2025-01-01',
        endDate: '2025-04-03',
      });

      assert.equal(fetchMock.mock.callCount(), 1);
    });

    void it('returns PLN map for entire range without API calls', async () => {
      fetchMock.mock.resetCalls();
      const result = await fetchRates({
        currency: 'PLN',
        startDate: '2025-01-01',
        endDate: '2025-01-03',
      });

      assert.equal(result.size, 3);
      assert.equal(result.get('2025-01-01')?.rate, 1);
      assert.equal(result.get('2025-01-02')?.rate, 1);
      assert.equal(result.get('2025-01-03')?.rate, 1);
      assert.equal(fetchMock.mock.callCount(), 0);
    });

    void it('throws if startDate is after endDate', async () => {
      await assert.rejects(
        () =>
          fetchRates({
            currency: 'USD',
            startDate: '2025-06-01',
            endDate: '2025-01-01',
          }),
        { message: /Invalid date range/ },
      );
    });

    void it('uppercases currency code in API requests', async () => {
      fetchMock.mock.resetCalls();
      fetchMock.mock.mockImplementation(async () =>
        mockResponse(nbpResponse('EUR', [])),
      );

      await fetchRates({
        currency: 'eur',
        startDate: '2025-01-02',
        endDate: '2025-01-02',
      });

      const url = fetchMock.mock.calls[0]?.arguments[0] as string;
      assert.ok(url.includes('/EUR/'));
    });
  });
});

void describe('NbpFetchError', () => {
  let savedFetch: typeof globalThis.fetch;

  before(() => {
    savedFetch = globalThis.fetch;
  });

  after(() => {
    globalThis.fetch = savedFetch;
  });

  void it('wraps AbortError as NbpFetchError', async () => {
    globalThis.fetch = (() =>
      Promise.reject(
        new DOMException('signal timed out', 'TimeoutError'),
      )) as typeof fetch;

    await assert.rejects(
      fetchRates({
        currency: 'USD',
        startDate: '2024-01-02',
        endDate: '2024-01-02',
      }),
      (err: unknown) =>
        err instanceof NbpFetchError && err.message.includes('timed out'),
    );
  });
});
