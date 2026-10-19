import {
  TAX_RATE,
  type DividendResult,
  type DividendWarning,
  type EnrichedRawDividend,
  type EnrichedWithholdingTax,
  type PaymentKind,
  type TaxPeriod,
  type TransactionFee,
} from '../types.js';
import { isInTaxPeriod } from './period.js';
import { getDividendCreditCapRate } from './treaty-rates.js';

export interface CalculateDividendsArgs {
  dividends: EnrichedRawDividend[];
  withholdingTaxes: EnrichedWithholdingTax[];
  transactionFees?: TransactionFee[] | undefined;
  reduceAdrFeesFromDividends?: boolean | undefined;
  taxPeriod: TaxPeriod;
  symbolCountryMap?: Map<string, string> | undefined;
  /** ADR symbols whose rows disagree on the issuer country (no user override). */
  adrCountryConflicts?: ReadonlySet<string> | undefined;
  /**
   * Symbol → country by ISIN prefix (no ADR issuer country). Fallback for a
   * payment-in-lieu event that has no withholding row to name its country.
   */
  isinCountryMap?: Map<string, string> | undefined;
  /**
   * Sells (symbol, date). Used only to hint that an unmatched withholding row
   * is probably tax on a sale (US §1446(f)), not dividend tax.
   */
  sells?: readonly { symbol: string; date: Date }[] | undefined;
}

function toDateString(args: { date: Date }): string {
  const year = args.date.getFullYear();
  const month = String(args.date.getMonth() + 1).padStart(2, '0');
  const day = String(args.date.getDate()).padStart(2, '0');
  return `${String(year)}-${month}-${day}`;
}

function instrumentId(args: { isin?: string | undefined; symbol: string }) {
  return (args.isin ?? args.symbol).toUpperCase();
}

function eventKey(args: {
  id: string;
  currency: string;
  date: Date;
  kind: PaymentKind;
}): string {
  // An ordinary dividend and a payment in lieu on the same day are separate events.
  return `${toDateString({ date: args.date })}:${args.id}:${args.currency.toUpperCase()}:${args.kind}`;
}

function matchKey(args: {
  isin?: string | undefined;
  symbol: string;
  currency: string;
  date: Date;
  kind?: PaymentKind | undefined;
}): string {
  return eventKey({
    id: instrumentId(args),
    currency: args.currency,
    date: args.date,
    kind: args.kind ?? 'dividend',
  });
}

/** Whole days since the epoch for the local calendar day of `date`. */
function dayNumber(date: Date): number {
  return Math.round(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
}

/** Longest gap between an original posting and its reversal (art. 81 OP window). */
const PAIRING_WINDOW_DAYS = 366;
/** WHT posted before its dividend is attached only within this many days. */
const WHT_BEFORE_DIVIDEND_DAYS = 7;
const AMOUNT_TOLERANCE = 0.005;
/** A sale this close to unmatched WHT hints at US §1446(f) tax on the sale. */
const SALE_TAX_HINT_DAYS = 3;

export interface PairableRow {
  id: string;
  currency: string;
  kind: PaymentKind;
  date: Date;
  amount: number;
}

export interface ReversalPair {
  /** Index of the original row in the input. */
  original: number;
  /** Index of the reversal row in the input. */
  reversal: number;
}

const cents = (amount: number) => Math.round(Math.abs(amount) * 100);

/**
 * Pair each reversal with one unconsumed original of the same instrument,
 * currency and kind that is dated on or before it (at most 366 days earlier)
 * and has the exact opposite amount. Rows with `amount * originalSign > 0` are
 * originals, the rest are reversals. Among candidates the lowest `rank` wins,
 * then the most recent date, then input order. Never pairs on approximate
 * amounts.
 */
export function pairReversals<T extends PairableRow>(args: {
  rows: readonly T[];
  originalSign: 1 | -1;
  rank?: ((original: T, reversal: T) => number) | undefined;
}): ReversalPair[] {
  const { rows, originalSign } = args;
  const groupKey = (row: T) =>
    `${row.id}|${row.currency.toUpperCase()}|${row.kind}`;
  const days = rows.map((row) => dayNumber(row.date));

  // Originals bucketed by instrument group and amount in cents; each bucket is
  // sorted most recent first, then input order.
  const buckets = new Map<string, number[]>();
  const reversals: number[] = [];
  rows.forEach((row, index) => {
    if (row.amount * originalSign > 0) {
      const key = `${groupKey(row)}|${String(cents(row.amount))}`;
      const list = buckets.get(key);
      if (list) list.push(index);
      else buckets.set(key, [index]);
    } else if (row.amount * originalSign < 0) {
      reversals.push(index);
    }
  });
  for (const list of buckets.values()) {
    list.sort((a, b) => days[b] - days[a] || a - b);
  }
  reversals.sort((a, b) => days[a] - days[b] || a - b);

  const consumed = new Set<number>();
  const pairs: ReversalPair[] = [];
  for (const reversalIndex of reversals) {
    const reversal = rows[reversalIndex];
    const reversalDay = days[reversalIndex];
    const group = groupKey(reversal);
    const reversalCents = cents(reversal.amount);
    let best: { index: number; rank: number; day: number } | undefined;
    // The tolerance can straddle a cent boundary, so look at the neighbours.
    for (const bucketCents of [
      reversalCents,
      reversalCents - 1,
      reversalCents + 1,
    ]) {
      for (const index of buckets.get(`${group}|${String(bucketCents)}`) ??
        []) {
        const day = days[index];
        if (reversalDay - day > PAIRING_WINDOW_DAYS) break;
        if (day > reversalDay || consumed.has(index)) continue;
        const original = rows[index];
        if (Math.abs(original.amount + reversal.amount) > AMOUNT_TOLERANCE) {
          continue;
        }
        const rank = args.rank?.(original, reversal) ?? 0;
        if (
          !best ||
          rank < best.rank ||
          (rank === best.rank &&
            (day > best.day || (day === best.day && index < best.index)))
        ) {
          best = { index, rank, day };
        }
        // Unranked: the first valid entry is the most recent one.
        if (!args.rank) break;
      }
    }
    if (best) {
      consumed.add(best.index);
      pairs.push({ original: best.index, reversal: reversalIndex });
    }
  }
  return pairs;
}

function feeMatchKey(args: {
  isin?: string | undefined;
  symbol: string;
  currency: string;
  datetime: Date;
}): string {
  return matchKey({
    isin: args.isin,
    symbol: args.symbol,
    currency: args.currency,
    date: args.datetime,
  });
}

function isAdrFee(fee: TransactionFee): boolean {
  const normalized = fee.description.toUpperCase().replace(/[-_/]+/g, ' ');
  return (
    normalized.includes('ADR') ||
    normalized.includes('GDR') ||
    normalized.includes('CDI')
  );
}

interface DivLeg {
  row: EnrichedRawDividend;
  id: string;
  kind: PaymentKind;
  eventDate: Date;
  rate: number;
  rateUnavailable: boolean;
  /** Set on a reversal paired with an original (1a). */
  pairedOriginal?: DivLeg | undefined;
  /** Own dates of reversals paired with this original. */
  reversalDates: Date[];
}

interface WhtLeg {
  row: EnrichedWithholdingTax;
  id: string;
  kind: PaymentKind;
  eventDate: Date;
  rate: number;
  rateUnavailable: boolean;
  /** Set on a refund paired with a withholding (1f). */
  pairedWithholding?: WhtLeg | undefined;
  /** Attached to an event by symbol because its own date had no dividend. */
  attachedBySymbol: boolean;
}

interface DividendEvent {
  key: string;
  id: string;
  currency: string;
  kind: PaymentKind;
  date: Date;
  divLegs: DivLeg[];
  whtLegs: WhtLeg[];
  /** Refunds received in a later year than the event (art. 45 ust. 3a). */
  detached: WhtLeg[];
  /** Own dates of WHT rows attached by symbol (2a). */
  matchedBySymbol: Date[];
}

interface ComputeArgs {
  event: DividendEvent;
  whtLegs: readonly WhtLeg[];
  adrFees: readonly TransactionFee[];
  symbolCountryMap: Map<string, string>;
  args: CalculateDividendsArgs;
}

const isRefund = (leg: WhtLeg) => leg.row.amount > 0;

const dividendNet = (event: DividendEvent) =>
  event.divLegs.reduce((sum, leg) => sum + leg.row.amount, 0);

/**
 * Compute the result row of one event from its legs (netting, ADR fees, treaty
 * cap, warnings).
 */
function computeEvent(input: ComputeArgs): DividendResult {
  const { event, whtLegs, adrFees, symbolCountryMap, args } = input;
  const divRows = event.divLegs;
  const div = divRows[0].row;
  const first = divRows[0];
  const kind = event.kind;

  const grossOriginal = divRows.reduce((sum, leg) => sum + leg.row.amount, 0);
  const grossPln = divRows.reduce(
    (sum, leg) => sum + leg.row.amount * leg.rate,
    0,
  );
  const ratesAgree = divRows.every((leg) => leg.rate === first.rate);
  const exchangeRate = ratesAgree
    ? first.rate
    : (divRows.find((leg) => leg.row.amount > 0) ?? first).rate;

  const adrFeeOriginal = adrFees.reduce((sum, fee) => sum + fee.amount, 0);
  const taxableAmountOriginal = Math.max(grossOriginal - adrFeeOriginal, 0);

  // Convert dividend to PLN
  const amountPln = ratesAgree
    ? taxableAmountOriginal * exchangeRate
    : Math.max(grossPln - adrFeeOriginal * exchangeRate, 0);
  const adrFeePln = adrFeeOriginal * exchangeRate;

  // Withholding sign convention: negative = tax withheld, positive =
  // refund/reversal. Net per event, floored at 0 (art. 30a ust. 9 updof
  // credits only tax actually paid). Each entry may have its own rate.
  const netWithholdingOriginal = whtLegs.reduce(
    (sum, leg) => sum + leg.row.amount,
    0,
  );
  const withholdingTaxOriginal = Math.max(-netWithholdingOriginal, 0);
  const withholdingTaxPln = Math.max(
    -whtLegs.reduce((sum, leg) => sum + leg.row.amount * leg.rate, 0),
    0,
  );

  const rateUnavailable =
    divRows.some((leg) => leg.rateUnavailable) ||
    whtLegs.some((leg) => leg.rateUnavailable);

  const isPil = kind === 'payment-in-lieu';
  // A payment in lieu is taxed where it was withheld (e.g. US on lent ADRs),
  // regardless of the ADR issuer country.
  const country = isPil
    ? (whtLegs.find((leg) => leg.row.taxCountry)?.row.taxCountry ??
      args.isinCountryMap?.get(div.symbol) ??
      symbolCountryMap.get(div.symbol) ??
      'XX')
    : (symbolCountryMap.get(div.symbol) ?? 'XX');
  const warnings: DividendWarning[] = [];

  if (country === 'XX') {
    warnings.push({ kind: 'unknown-country' });
  }

  if (!isPil && args.adrCountryConflicts?.has(div.symbol)) {
    warnings.push({ kind: 'adr-country-conflict' });
  }

  if (grossOriginal < 0) {
    warnings.push({ kind: 'net-negative' });
  }

  if (netWithholdingOriginal > 0) {
    warnings.push({ kind: 'wht-net-refund' });
  }

  // W-8BEN lapse (withheld rate above treaty rate). W-8BEN is a US form, so it
  // cannot lapse for an ADR whose issuer is not US.
  const isNonUsAdr = divRows.some((leg) => leg.row.isAdr) && country !== 'US';
  if (taxableAmountOriginal > 0 && withholdingTaxOriginal > 0) {
    const withheldRate = withholdingTaxOriginal / taxableAmountOriginal;
    const treatyRate = getDividendCreditCapRate({ country });
    const tolerance = 0.005; // ±0.5% tolerance for rounding

    if (withheldRate > treatyRate + tolerance) {
      if (isPil) {
        warnings.push({ kind: 'pil-excess-not-credited' });
      } else if (!isNonUsAdr) {
        warnings.push({ kind: 'wht-lapse' });
      }
    }
  }

  if (isPil) {
    warnings.push({ kind: 'pil-substitute' });
  }

  const creditCapRate = getDividendCreditCapRate({ country });
  const deductibleWithholdingPln = Math.min(
    withholdingTaxPln,
    amountPln * creditCapRate,
  );
  const taxPlnGross = amountPln * TAX_RATE;
  const taxToPayPln = Math.max(taxPlnGross - deductibleWithholdingPln, 0);

  return {
    symbol: div.symbol,
    currency: div.currency,
    date: first.eventDate,
    amountOriginal: taxableAmountOriginal,
    withholdingTaxOriginal,
    adrFeeOriginal,
    adrFeePln,
    amountPln,
    withholdingTaxPln,
    exchangeRate,
    rateUnavailable,
    country,
    creditCapRate,
    deductibleWithholdingPln,
    taxPlnGross,
    taxToPayPln,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Result row that carries no income, only a warning (and optionally an
 * add-back).
 */
function infoRow(args: {
  base: DividendResult;
  date: Date;
  warning: DividendWarning;
  addBackPln?: number;
  rateUnavailable?: boolean;
}): DividendResult {
  return {
    symbol: args.base.symbol,
    currency: args.base.currency,
    date: args.date,
    amountOriginal: 0,
    withholdingTaxOriginal: 0,
    adrFeeOriginal: 0,
    adrFeePln: 0,
    amountPln: 0,
    withholdingTaxPln: 0,
    exchangeRate: args.base.exchangeRate,
    rateUnavailable: args.rateUnavailable ?? false,
    country: args.base.country,
    creditCapRate: args.base.creditCapRate,
    deductibleWithholdingPln: 0,
    taxPlnGross: 0,
    taxToPayPln: 0,
    ...(args.addBackPln === undefined ? {} : { addBackPln: args.addBackPln }),
    isInfo: true,
    warnings: [args.warning],
  };
}

/** Match dividends with withholding taxes and convert to PLN */
export function calculateDividends(
  args: CalculateDividendsArgs,
): DividendResult[] {
  const { dividends, withholdingTaxes, taxPeriod } = args;
  const symbolCountryMap = args.symbolCountryMap ?? new Map<string, string>();
  const inPeriod = (date: Date) => isInTaxPeriod({ date, taxPeriod });

  const divLegs: DivLeg[] = dividends.map((row) => ({
    row,
    id: instrumentId(row),
    kind: row.kind ?? 'dividend',
    eventDate: row.date,
    rate: row.exchangeRate,
    rateUnavailable: row.rateUnavailable,
    reversalDates: [],
  }));
  const whtLegs: WhtLeg[] = withholdingTaxes.map((row) => ({
    row,
    id: instrumentId(row),
    kind: row.kind ?? 'dividend',
    eventDate: row.date,
    rate: row.exchangeRate,
    rateUnavailable: row.rateUnavailable,
    attachedBySymbol: false,
  }));

  const adrFeeMap = new Map<string, TransactionFee[]>();
  if (args.reduceAdrFeesFromDividends) {
    for (const fee of args.transactionFees ?? []) {
      if (!isAdrFee(fee)) continue;
      const key = feeMatchKey(fee);
      let group = adrFeeMap.get(key);
      if (!group) {
        group = [];
        adrFeeMap.set(key, group);
      }
      group.push(fee);
    }
  }

  // 1a/1c: pair each dividend reversal with its original. The reversal takes
  // the original's date and rate so the pair cancels to exactly 0 PLN.
  for (const pair of pairReversals({
    rows: divLegs.map((leg) => ({
      id: leg.id,
      currency: leg.row.currency,
      kind: leg.kind,
      date: leg.row.date,
      amount: leg.row.amount,
    })),
    originalSign: 1,
  })) {
    const original = divLegs[pair.original];
    const reversal = divLegs[pair.reversal];
    reversal.pairedOriginal = original;
    reversal.eventDate = original.eventDate;
    reversal.rate = original.rate;
    reversal.rateUnavailable = original.rateUnavailable;
    original.reversalDates.push(reversal.row.date);
  }

  // 1f: pair each WHT refund with its withholding. Refunds of a withholding
  // whose dividend was reversed rank first so the credit follows the income.
  const divNetByKey = new Map<string, number>();
  const reversalDaysByKey = new Map<string, Set<number>>();
  for (const leg of divLegs) {
    const key = eventKey({
      id: leg.id,
      currency: leg.row.currency,
      kind: leg.kind,
      date: leg.eventDate,
    });
    divNetByKey.set(key, (divNetByKey.get(key) ?? 0) + leg.row.amount);
    if (leg.reversalDates.length > 0) {
      const days = reversalDaysByKey.get(key) ?? new Set<number>();
      for (const date of leg.reversalDates) days.add(dayNumber(date));
      reversalDaysByKey.set(key, days);
    }
  }
  const whtKeyOf = (leg: WhtLeg, date: Date) =>
    eventKey({
      id: leg.id,
      currency: leg.row.currency,
      kind: leg.kind,
      date,
    });
  const whtRows = whtLegs.map((leg) => ({
    id: leg.id,
    currency: leg.row.currency,
    kind: leg.kind,
    date: leg.row.date,
    amount: leg.row.amount,
    leg,
  }));
  for (const pair of pairReversals({
    rows: whtRows,
    originalSign: -1,
    rank: (original, reversal) => {
      const key = whtKeyOf(original.leg, original.date);
      if (reversalDaysByKey.get(key)?.has(dayNumber(reversal.date))) return 0;
      const net = divNetByKey.get(key);
      return net !== undefined && net <= AMOUNT_TOLERANCE ? 1 : 2;
    },
  })) {
    const withholding = whtLegs[pair.original];
    const refund = whtLegs[pair.reversal];
    refund.pairedWithholding = withholding;
    refund.eventDate = withholding.eventDate;
    refund.rate = withholding.rate;
    refund.rateUnavailable = withholding.rateUnavailable;
  }

  // Group by event key (effective date).
  const events = new Map<string, DividendEvent>();
  const eventFor = (
    leg: { id: string; kind: PaymentKind; eventDate: Date },
    currency: string,
  ) => {
    const key = eventKey({
      id: leg.id,
      currency,
      kind: leg.kind,
      date: leg.eventDate,
    });
    let event = events.get(key);
    if (!event) {
      event = {
        key,
        id: leg.id,
        currency,
        kind: leg.kind,
        date: leg.eventDate,
        divLegs: [],
        whtLegs: [],
        detached: [],
        matchedBySymbol: [],
      };
      events.set(key, event);
    }
    return event;
  };
  for (const leg of divLegs) eventFor(leg, leg.row.currency).divLegs.push(leg);
  for (const leg of whtLegs) eventFor(leg, leg.row.currency).whtLegs.push(leg);

  // 2a: WHT groups whose key has no dividend event attach to the most recent
  // prior event of the same instrument (within 366 days), else the earliest
  // later one (within 7 days).
  const dividendEventsByInstrument = new Map<string, DividendEvent[]>();
  for (const event of events.values()) {
    if (event.divLegs.length === 0) continue;
    const key = `${event.id}|${event.currency.toUpperCase()}|${event.kind}`;
    const list = dividendEventsByInstrument.get(key);
    if (list) list.push(event);
    else dividendEventsByInstrument.set(key, [event]);
  }
  const whtOnlyEvents = [...events.values()]
    .filter((event) => event.divLegs.length === 0)
    .toSorted((a, b) => dayNumber(a.date) - dayNumber(b.date));
  const unmatchedEvents: DividendEvent[] = [];
  for (const group of whtOnlyEvents) {
    const candidates =
      dividendEventsByInstrument.get(
        `${group.id}|${group.currency.toUpperCase()}|${group.kind}`,
      ) ?? [];
    const groupDay = dayNumber(group.date);
    const select = (pool: readonly DividendEvent[]) => {
      let target: DividendEvent | undefined;
      for (const candidate of pool) {
        const day = dayNumber(candidate.date);
        if (
          day <= groupDay &&
          groupDay - day <= PAIRING_WINDOW_DAYS &&
          (!target || day > dayNumber(target.date))
        ) {
          target = candidate;
        }
      }
      if (target) return target;
      for (const candidate of pool) {
        const day = dayNumber(candidate.date);
        if (
          day > groupDay &&
          day - groupDay <= WHT_BEFORE_DIVIDEND_DAYS &&
          (!target || day < dayNumber(target.date))
        ) {
          target = candidate;
        }
      }
      return target;
    };
    // Prefer an event that still pays something: credit on a reversed event
    // would be capped at 0 and lost.
    const target =
      select(candidates.filter((c) => dividendNet(c) > AMOUNT_TOLERANCE)) ??
      select(candidates);
    if (!target) {
      unmatchedEvents.push(group);
      continue;
    }
    events.delete(group.key);
    // Withholdings first, so a refund can take the event's withholding rate.
    const ordered = group.whtLegs.toSorted(
      (a, b) => Number(isRefund(a)) - Number(isRefund(b)),
    );
    for (const leg of ordered) {
      leg.attachedBySymbol = true;
      if (isRefund(leg) && !leg.pairedWithholding) {
        // 1g: a refund takes the event's withholding rate, else the dividend's.
        const reference =
          target.whtLegs.find((w) => w.row.amount < 0) ?? target.divLegs[0];
        leg.rate = reference.rate;
        leg.rateUnavailable = reference.rateUnavailable;
      }
      target.whtLegs.push(leg);
    }
    target.matchedBySymbol.push(group.date);
  }

  // 1g: a refund received in a later year than a still-valid dividend is not
  // netted into the event (art. 45 ust. 3a adds it back in its own year).
  for (const event of events.values()) {
    if (event.divLegs.length === 0) continue;
    if (dividendNet(event) <= 0) continue;
    const eventYear = event.date.getFullYear();
    const kept: WhtLeg[] = [];
    for (const leg of event.whtLegs) {
      if (isRefund(leg) && leg.row.date.getFullYear() > eventYear) {
        event.detached.push(leg);
      } else {
        kept.push(leg);
      }
    }
    event.whtLegs = kept;
    event.detached.sort(
      (a, b) => dayNumber(a.row.date) - dayNumber(b.row.date),
    );
  }

  // An ADR fee posted on the day of a payment that was later reversed to 0
  // belongs to the re-post of the same instrument made on the reversal day.
  for (const event of events.values()) {
    const fees = adrFeeMap.get(event.key);
    if (!fees || event.divLegs.length === 0) continue;
    if (Math.abs(dividendNet(event)) > AMOUNT_TOLERANCE) continue;
    const reversalDays = new Set(
      event.divLegs.flatMap((leg) => leg.reversalDates.map(dayNumber)),
    );
    if (reversalDays.size === 0) continue;
    const repost = [...events.values()].find(
      (other) =>
        other !== event &&
        other.id === event.id &&
        other.currency === event.currency &&
        other.kind === event.kind &&
        dividendNet(other) > AMOUNT_TOLERANCE &&
        reversalDays.has(dayNumber(other.date)),
    );
    if (!repost) continue;
    adrFeeMap.delete(event.key);
    adrFeeMap.set(repost.key, [...(adrFeeMap.get(repost.key) ?? []), ...fees]);
  }

  const compute = (event: DividendEvent, legs: readonly WhtLeg[]) =>
    computeEvent({
      event,
      whtLegs: legs,
      adrFees: adrFeeMap.get(event.key) ?? [],
      symbolCountryMap,
      args,
    });

  const results: DividendResult[] = [];
  const infoRows: DividendResult[] = [];
  const seenInfo = new Set<string>();
  let addBackCount = 0;
  const pushInfo = (dedupeKey: string, row: () => DividendResult) => {
    if (seenInfo.has(dedupeKey)) return;
    seenInfo.add(dedupeKey);
    infoRows.push(row());
  };

  for (const event of events.values()) {
    if (event.divLegs.length === 0) continue;
    const eventInPeriod = inPeriod(event.date);
    const base = compute(event, event.whtLegs);
    const originalDate = toDateString({ date: event.date });

    // Legs of this event that were posted in the period but belong to an
    // event outside it are reported as info rows (amounts 0).
    const ownDateRows = (): void => {
      const dividendReversals = event.divLegs.filter(
        (leg) => leg.pairedOriginal,
      );
      for (const leg of dividendReversals) {
        if (!inPeriod(leg.row.date) || eventInPeriod) continue;
        pushInfo(
          `rev:${event.key}:${toDateString({ date: leg.row.date })}`,
          () =>
            infoRow({
              base,
              date: leg.row.date,
              warning: { kind: 'reverses-prior-year', originalDate },
            }),
        );
      }
      for (const leg of event.whtLegs) {
        if (!inPeriod(leg.row.date) || eventInPeriod) continue;
        const ownDate = toDateString({ date: leg.row.date });
        if (isRefund(leg)) {
          pushInfo(`rev:${event.key}:${ownDate}`, () =>
            infoRow({
              base,
              date: leg.row.date,
              warning: { kind: 'reverses-prior-year', originalDate },
            }),
          );
        } else if (leg.attachedBySymbol) {
          pushInfo(`sym:${event.key}:${ownDate}`, () =>
            infoRow({
              base,
              date: leg.row.date,
              warning: { kind: 'wht-matched-by-symbol', whtDate: ownDate },
            }),
          );
        }
      }
    };
    ownDateRows();

    // Art. 45 ust. 3a add-back: how much credit taken for the event disappears
    // once each later-year refund is netted in.
    const running: WhtLeg[] = [...event.whtLegs];
    let previous = base.deductibleWithholdingPln;
    const refundedLater: Date[] = [];
    for (const leg of event.detached) {
      running.push(leg);
      const computed = compute(event, running);
      const after = computed.deductibleWithholdingPln;
      const addBackPln = Math.max(previous - after, 0);
      previous = after;
      refundedLater.push(leg.row.date);
      if (inPeriod(leg.row.date)) {
        pushInfo(`addback:${event.key}:${String(addBackCount++)}`, () =>
          infoRow({
            base,
            date: leg.row.date,
            warning: { kind: 'wht-refund-add-back', originalDate },
            addBackPln,
            rateUnavailable: computed.rateUnavailable,
          }),
        );
      }
    }

    if (!eventInPeriod) continue;

    const extra: DividendWarning[] = [];
    const reversalDates = new Map<string, Date>();
    for (const date of event.divLegs.flatMap((leg) => leg.reversalDates)) {
      reversalDates.set(toDateString({ date }), date);
    }
    for (const leg of event.whtLegs) {
      if (leg.pairedWithholding) {
        reversalDates.set(toDateString({ date: leg.row.date }), leg.row.date);
      }
    }
    for (const [dateString, date] of reversalDates) {
      if (dateString === originalDate) continue;
      extra.push({
        kind: 'reversed-later',
        reversalDate: dateString,
        crossYear: date.getFullYear() !== event.date.getFullYear(),
      });
    }
    for (const date of event.matchedBySymbol) {
      extra.push({
        kind: 'wht-matched-by-symbol',
        whtDate: toDateString({ date }),
      });
    }
    for (const date of refundedLater) {
      extra.push({
        kind: 'wht-refunded-later',
        refundDate: toDateString({ date }),
      });
    }
    results.push(
      extra.length > 0
        ? { ...base, warnings: [...(base.warnings ?? []), ...extra] }
        : base,
    );
  }

  // 2b: withholding with no dividend to attach to. Shown, never credited. Only
  // the legs posted in the period are reported, so a pair that spans two years
  // shows each year its own leg.
  for (const group of unmatchedEvents) {
    const legs = group.whtLegs.filter((leg) => inPeriod(leg.row.date));
    if (legs.length === 0) continue;
    const sample = legs[0];
    const date =
      legs.length === group.whtLegs.length ? group.date : sample.row.date;
    const taxCountry = legs.find((leg) => leg.row.taxCountry)?.row.taxCountry;
    const country =
      taxCountry ?? symbolCountryMap.get(sample.row.symbol) ?? 'XX';
    const groupDay = dayNumber(date);
    const likelySaleTax = (args.sells ?? []).some(
      (sell) =>
        sell.symbol.toUpperCase() === sample.row.symbol.toUpperCase() &&
        Math.abs(dayNumber(sell.date) - groupDay) <= SALE_TAX_HINT_DAYS,
    );
    const netOriginal = legs.reduce((sum, leg) => sum + leg.row.amount, 0);
    const netPln = legs.reduce(
      (sum, leg) => sum + leg.row.amount * leg.rate,
      0,
    );
    // A net refund has nothing to credit, but an earlier year's credit for it
    // may need adding back (art. 45 ust. 3a).
    const warning: DividendWarning =
      netOriginal > 0
        ? { kind: 'wht-refund-unmatched' }
        : likelySaleTax
          ? { kind: 'wht-unmatched', likelySaleTax: true }
          : { kind: 'wht-unmatched' };
    infoRows.push({
      symbol: sample.row.symbol,
      currency: sample.row.currency,
      date,
      amountOriginal: 0,
      withholdingTaxOriginal: Math.abs(netOriginal),
      adrFeeOriginal: 0,
      adrFeePln: 0,
      amountPln: 0,
      withholdingTaxPln: Math.abs(netPln),
      exchangeRate: sample.rate,
      rateUnavailable: legs.some((leg) => leg.rateUnavailable),
      country,
      creditCapRate: getDividendCreditCapRate({ country }),
      deductibleWithholdingPln: 0,
      taxPlnGross: 0,
      taxToPayPln: 0,
      isInfo: true,
      warnings: [warning],
    });
  }

  return [...results, ...infoRows];
}
