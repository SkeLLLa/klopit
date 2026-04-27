import {
  calculateTaxes,
  type TaxCalculationResult,
} from '../../core/tax/calculator.js';
import { isinToCountry } from '../../core/tax/country.js';
import type {
  EnrichedCorporateAction,
  EnrichedCreditInterest,
  EnrichedRawDividend,
  EnrichedTrade,
  EnrichedWithholdingTax,
  TaxPeriod,
} from '../../core/types.js';
import { db } from '../db.js';
import { createLogger } from '../state/logger.svelte.js';
import { fetchRatesForSession, getFixingRate } from './rates.js';
import { updateSession } from './session.js';

const log = createLogger('tax');

/** Format a Date as YYYY-MM-DD for rate lookups */
function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${String(year)}-${month}-${day}`;
}

/**
 * Resolve NBP fixing rate for a given currency/date, logging any error
 * before returning a sentinel. Centralizes the `rateUnavailable` fallback
 * so failures show up in the console instead of silently producing 0 PLN.
 */
async function tryGetFixingRate(args: {
  currency: string;
  date: string;
  scope: string;
}): Promise<{ rate: number; date: string } | undefined> {
  try {
    const rate = await getFixingRate({
      currency: args.currency,
      date: args.date,
    });
    return { rate: rate.rate, date: rate.date };
  } catch (e) {
    log.warn(
      `tryGetFixingRate(${args.scope}): no rate for ${args.currency} on ${args.date}`,
      e,
    );
    return undefined;
  }
}

/** Run tax calculation for a session and persist results */
export async function calculateSessionTaxes(args: {
  sessionId: string;
}): Promise<TaxCalculationResult> {
  const startedAt = performance.now();
  log.info('calculateSessionTaxes:start', { sessionId: args.sessionId });

  // 1. Load session
  const session = await db.sessions.get(args.sessionId);
  if (!session) {
    log.error('calculateSessionTaxes: session not found', args.sessionId);
    throw new Error(`Session ${args.sessionId} not found`);
  }

  // 2. Load parsed data from DB
  const [
    trades,
    dividends,
    creditInterests,
    withholdingTaxes,
    corporateActions,
    carryInPositions,
  ] = await Promise.all([
    db.trades.where('sessionId').equals(args.sessionId).toArray(),
    db.dividends.where('sessionId').equals(args.sessionId).toArray(),
    db.creditInterests.where('sessionId').equals(args.sessionId).toArray(),
    db.withholdingTaxes.where('sessionId').equals(args.sessionId).toArray(),
    db.corporateActions.where('sessionId').equals(args.sessionId).toArray(),
    db.carryInPositions.where('sessionId').equals(args.sessionId).toArray(),
  ]);

  log.debug('calculateSessionTaxes: loaded', {
    trades: trades.length,
    dividends: dividends.length,
    creditInterests: creditInterests.length,
    withholdingTaxes: withholdingTaxes.length,
    corporateActions: corporateActions.length,
    carryInPositions: carryInPositions.length,
  });

  // 3. Build symbol → country map
  const overrides = await db.symbolCountryOverrides
    .where('sessionId')
    .equals(args.sessionId)
    .toArray();

  const symbolCountryMap = new Map<string, string>();

  // Start with ISIN-based detection from trades
  for (const trade of trades) {
    if (trade.isin && !symbolCountryMap.has(trade.symbol)) {
      symbolCountryMap.set(trade.symbol, isinToCountry({ isin: trade.isin }));
    }
  }

  // Add from dividends (in case a symbol only has dividends)
  for (const div of dividends) {
    if (div.isin && !symbolCountryMap.has(div.symbol)) {
      symbolCountryMap.set(div.symbol, isinToCountry({ isin: div.isin }));
    }
  }

  // Apply manual overrides (highest priority)
  for (const override of overrides) {
    symbolCountryMap.set(override.symbol, override.country);
  }

  // 4. Prefetch and cache NBP rates
  log.info('calculateSessionTaxes: prefetching NBP rates');
  const ratesStart = performance.now();
  await fetchRatesForSession({ sessionId: args.sessionId });
  log.debug(
    `calculateSessionTaxes: NBP prefetch done in ${String(Math.round(performance.now() - ratesStart))}ms`,
  );

  // 5. Enrich trades with fixing rates
  const enrichedTrades: EnrichedTrade[] = await Promise.all(
    trades.map(async (trade) => {
      const dateStr = toDateString(trade.datetime);
      const rate = await tryGetFixingRate({
        currency: trade.currency,
        date: dateStr,
        scope: 'trade',
      });
      const comRate = await tryGetFixingRate({
        currency: trade.commissionCurrency,
        date: dateStr,
        scope: 'trade.commission',
      });
      return {
        ...trade,
        exchangeRate: rate?.rate ?? 0,
        commissionExchangeRate: comRate?.rate ?? 0,
        rateUnavailable: rate === undefined || comRate === undefined,
      };
    }),
  );

  // 6. Enrich dividends with fixing rates
  const enrichedDividends: EnrichedRawDividend[] = await Promise.all(
    dividends.map(async (div) => {
      const rate = await tryGetFixingRate({
        currency: div.currency,
        date: toDateString(div.date),
        scope: 'dividend',
      });
      return {
        ...div,
        exchangeRate: rate?.rate ?? 0,
        rateUnavailable: rate === undefined,
      };
    }),
  );

  // 7. Enrich credit interest with fixing rates
  const enrichedCreditInterests: (EnrichedCreditInterest & {
    fxDate: string;
  })[] = await Promise.all(
    creditInterests.map(async (interest) => {
      const rate = await tryGetFixingRate({
        currency: interest.currency,
        date: toDateString(interest.date),
        scope: 'creditInterest',
      });
      return {
        ...interest,
        exchangeRate: rate?.rate ?? 0,
        fxDate: rate?.date ?? '',
        rateUnavailable: rate === undefined,
      };
    }),
  );

  // 8. Enrich withholding taxes with fixing rates
  const enrichedWithholding: EnrichedWithholdingTax[] = await Promise.all(
    withholdingTaxes.map(async (tax) => {
      const rate = await tryGetFixingRate({
        currency: tax.currency,
        date: toDateString(tax.date),
        scope: 'withholding',
      });
      return {
        ...tax,
        exchangeRate: rate?.rate ?? 0,
        rateUnavailable: rate === undefined,
      };
    }),
  );

  // 9. Enrich corporate actions with fixing rates for cash component
  const enrichedCorporateActions: EnrichedCorporateAction[] = await Promise.all(
    corporateActions.map(async (ca) => {
      if (!ca.cashPerShare || ca.cashPerShare <= 0 || !ca.cashCurrency) {
        return { ...ca, cashExchangeRate: 0, cashRateUnavailable: false };
      }
      const rate = await tryGetFixingRate({
        currency: ca.cashCurrency,
        date: toDateString(ca.datetime),
        scope: 'corporateAction',
      });
      return {
        ...ca,
        cashExchangeRate: rate?.rate ?? 0,
        cashRateUnavailable: rate === undefined,
      };
    }),
  );

  // 10. Build tax period
  const taxPeriod: TaxPeriod = {
    year: session.year,
    from: new Date(session.year, 0, 1),
    to: new Date(session.year, 11, 31),
  };

  // Load prior-year losses (art. 9 ust. 3 updof). Each entry tracks its
  // own residual via `alreadyDeductedPln`.
  const priorLosses = await db.priorLosses
    .where('sessionId')
    .equals(args.sessionId)
    .toArray();

  // 11. Calculate taxes
  log.info('calculateSessionTaxes: running calculator', {
    enrichedTrades: enrichedTrades.length,
    enrichedDividends: enrichedDividends.length,
    priorLosses: priorLosses.length,
  });
  let result: TaxCalculationResult;
  try {
    result = calculateTaxes({
      trades: enrichedTrades,
      dividends: enrichedDividends,
      creditInterests: enrichedCreditInterests,
      withholdingTaxes: enrichedWithholding,
      corporateActions: enrichedCorporateActions,
      carryInPositions,
      priorLosses: priorLosses.map((p) => ({
        year: p.year,
        totalLossPln: p.totalLossPln,
        alreadyDeductedPln: p.alreadyDeductedPln,
      })),
      taxPeriod,
      symbolCountryMap,
      includeAllInPitZg: session.includeAllInPitZg ?? false,
    });
  } catch (e) {
    log.error('calculateSessionTaxes: calculator threw', e);
    throw e;
  }

  // 12. Persist results
  log.debug('calculateSessionTaxes: persisting results');
  await db.transaction(
    'rw',
    [
      db.tradeResults,
      db.dividendResults,
      db.creditInterestResults,
      db.taxSummaries,
      db.sessions,
    ],
    async () => {
      // Clear previous results
      await Promise.all([
        db.tradeResults.where('sessionId').equals(args.sessionId).delete(),
        db.dividendResults.where('sessionId').equals(args.sessionId).delete(),
        db.creditInterestResults
          .where('sessionId')
          .equals(args.sessionId)
          .delete(),
        db.taxSummaries.delete(args.sessionId),
      ]);

      // Store new results
      await db.tradeResults.bulkAdd(
        result.trades.map((t) => ({ ...t, sessionId: args.sessionId })),
      );
      await db.dividendResults.bulkAdd(
        result.dividends.map((d) => ({ ...d, sessionId: args.sessionId })),
      );
      await db.creditInterestResults.bulkAdd(
        result.creditInterests.map((row) => ({
          ...row,
          sessionId: args.sessionId,
        })),
      );
      await db.taxSummaries.put({
        sessionId: args.sessionId,
        ...result.summary,
        pit38: result.pit38,
        pitZg: result.pitZg,
        lossDeduction: result.lossDeduction,
      });

      // 13. Update session status
      await updateSession({
        id: args.sessionId,
        changes: {
          status: 'calculated',
          calculatedAt: new Date(),
        },
      });
    },
  );

  log.info(
    `calculateSessionTaxes:done in ${String(Math.round(performance.now() - startedAt))}ms`,
  );
  return result;
}

/** Clear calculated results for a session (keep parsed data) */
export async function clearSessionResults(args: {
  sessionId: string;
}): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.tradeResults,
      db.dividendResults,
      db.creditInterestResults,
      db.taxSummaries,
      db.sessions,
    ],
    async () => {
      await Promise.all([
        db.tradeResults.where('sessionId').equals(args.sessionId).delete(),
        db.dividendResults.where('sessionId').equals(args.sessionId).delete(),
        db.creditInterestResults
          .where('sessionId')
          .equals(args.sessionId)
          .delete(),
        db.taxSummaries.delete(args.sessionId),
      ]);
      await updateSession({
        id: args.sessionId,
        changes: {
          status: 'draft',
          calculatedAt: undefined,
        },
      });
    },
  );
}
