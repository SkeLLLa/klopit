import {
  TAX_RATE,
  type EnrichedCarryInPosition,
  type EnrichedCorporateAction,
  type EnrichedTrade,
  type TaxPeriod,
  type TradeResult,
} from '../types.js';
import {
  applyMerger,
  applyStockSplit,
  type FifoLot,
} from './corporate-actions.js';
import { isInTaxPeriod } from './period.js';

export interface CalculateCapitalGainsArgs {
  trades: EnrichedTrade[];
  corporateActions: EnrichedCorporateAction[];
  carryInPositions: EnrichedCarryInPosition[];
  taxPeriod: TaxPeriod;
  symbolCountryMap?: Map<string, string>;
  /** Receives non-fatal carry-in reconciliation warnings. */
  onWarning?: (warning: CarryInWarning) => void;
}

/**
 * A carry-in position whose quantity is (partly) covered by imported prior-year
 * trades. Only the uncovered residual is seeded as a lot.
 */
export interface CarryInWarning {
  kind: 'carry-in-overlap';
  symbol: string;
  isin?: string;
  carryInQuantity: number;
  coveredQuantity: number;
}

type TimelineEvent =
  | { kind: 'trade'; datetime: Date; trade: EnrichedTrade }
  | { kind: 'action'; datetime: Date; action: EnrichedCorporateAction }
  | {
      kind: 'carry-in';
      datetime: Date;
      key: string;
      quantity: number;
      costPerSharePln: number;
      costMissing: boolean;
    };

/** Tie-break order on equal datetime: action, then carry-in, then trade. */
const KIND_ORDER: Record<TimelineEvent['kind'], number> = {
  'action': 0,
  'carry-in': 1,
  'trade': 2,
};

function lotKey(args: {
  isin?: string;
  symbol: string;
  lotId?: string;
}): string {
  const base = (args.isin ?? args.symbol).toUpperCase();
  return args.lotId ? `${base}::${args.lotId}` : base;
}

function isInPeriod(args: { datetime: Date; taxPeriod: TaxPeriod }): boolean {
  return isInTaxPeriod({ date: args.datetime, taxPeriod: args.taxPeriod });
}

function getOrCreateLots(
  lotQueues: Map<string, FifoLot[]>,
  key: string,
): FifoLot[] {
  let lots = lotQueues.get(key);
  if (!lots) {
    lots = [];
    lotQueues.set(key, lots);
  }
  return lots;
}

/** FIFO-based capital gains calculator */
export function calculateCapitalGains(
  args: CalculateCapitalGainsArgs,
): TradeResult[] {
  const { trades, corporateActions, carryInPositions, taxPeriod } = args;
  const symbolCountryMap = args.symbolCountryMap ?? new Map<string, string>();
  const lotQueues = new Map<string, FifoLot[]>();
  const results: TradeResult[] = [];

  // Build unified timeline (carry-ins are added below, after reconciliation)
  const timeline: TimelineEvent[] = [
    ...trades.map((trade): TimelineEvent => ({
      kind: 'trade',
      datetime: trade.datetime,
      trade,
    })),
    ...corporateActions.map((action): TimelineEvent => ({
      kind: 'action',
      datetime: action.datetime,
      action,
    })),
  ];
  timeline.sort(compareEvents);

  // Carry-ins are lots like any other buy: seeded at their real acquisition
  // date so FIFO (art. 24 ust. 10 updof) orders them against imported buys.
  timeline.push(
    ...buildCarryInEvents({
      carryInPositions,
      trades,
      priorEvents: timeline.filter(
        (e) => e.datetime.getTime() < taxPeriod.from.getTime(),
      ),
      taxPeriod,
      onWarning: args.onWarning,
    }),
  );
  timeline.sort(compareEvents);

  for (const event of timeline) {
    if (event.kind === 'carry-in') {
      getOrCreateLots(lotQueues, event.key).push({
        quantity: event.quantity,
        costPerSharePln: event.costPerSharePln,
        commissionPerSharePln: 0,
        ...(event.costMissing ? { costMissing: true } : {}),
      });
    } else if (event.kind === 'action') {
      processAction({
        action: event.action,
        lotQueues,
        results,
        taxPeriod,
        symbolCountryMap,
      });
    } else {
      processTrade({
        trade: event.trade,
        lotQueues,
        results,
        taxPeriod,
        symbolCountryMap,
      });
    }
  }

  return results;
}

/**
 * Sort by datetime; corporate actions, then carry-ins, then trades on the same
 * datetime. When two trades share a datetime, break ties by `lotId` so per-lot
 * output order is stable regardless of DB insertion / array order — the data
 * table is a stable sort by datetime, so this order flows through to display.
 */
function compareEvents(a: TimelineEvent, b: TimelineEvent): number {
  const timeDiff = a.datetime.getTime() - b.datetime.getTime();
  if (timeDiff !== 0) return timeDiff;
  if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  if (a.kind === 'trade' && b.kind === 'trade') {
    const aLot = a.trade.lotId ?? '';
    const bLot = b.trade.lotId ?? '';
    if (aLot !== bLot) return aLot < bLot ? -1 : 1;
  }
  return 0;
}

/**
 * Net quantity per lot key held at period start according to imported
 * prior-period trades, with splits and mergers applied in timeline order.
 */
function computeNetPriorQty(priorEvents: TimelineEvent[]): Map<string, number> {
  const net = new Map<string, number>();
  for (const event of priorEvents) {
    if (event.kind === 'trade') {
      const key = lotKey(event.trade);
      const sign = event.trade.type === 'buy' ? 1 : -1;
      net.set(key, (net.get(key) ?? 0) + sign * event.trade.quantity);
    } else if (event.kind === 'action') {
      const { action } = event;
      const key = lotKey(action);
      const qty = net.get(key);
      if (qty === undefined) continue;
      if (action.type === 'stock-split') {
        if (action.denominator !== 0) {
          net.set(key, (qty * action.numerator) / action.denominator);
        }
      } else {
        net.delete(key);
        const target = action.targetIsin ?? action.targetSymbol;
        const ratio = action.conversionRatio ?? 0;
        if (target && ratio > 0) {
          const targetKey = target.toUpperCase();
          net.set(targetKey, (net.get(targetKey) ?? 0) + qty * ratio);
        }
      }
    }
  }
  return net;
}

/**
 * Turn carry-in positions into timeline events.
 *
 * - Key: carry-ins often lack an ISIN (IBKR MTM has no ISIN column, old DB rows,
 *   cross-file imports), so fall back to the ISIN of a trade with the same
 *   symbol. Otherwise the sell (keyed by ISIN) finds no lots.
 * - Date: `acquisitionDate`, or the end of `year` when unknown (clamped to just
 *   before the period), so it lands before every in-period trade.
 * - Double count: a carry-in is the position held at the end of the prior year.
 *   If prior-year trades are imported too, their net quantity is already in the
 *   queues, so only the uncovered residual is seeded (latest-acquired carry-ins
 *   are reduced first) and a warning is emitted.
 * - Units: `quantity` is as of the end of `year`. The timeline applies splits
 *   dated after the acquisition date to the seeded lot, so the seeded quantity
 *   is pre-divided by those split factors.
 */
function buildCarryInEvents(args: {
  carryInPositions: EnrichedCarryInPosition[];
  trades: EnrichedTrade[];
  priorEvents: TimelineEvent[];
  taxPeriod: TaxPeriod;
  onWarning?: (warning: CarryInWarning) => void;
}): TimelineEvent[] {
  const { carryInPositions, priorEvents, taxPeriod } = args;
  if (carryInPositions.length === 0) return [];

  const symbolToIsin = new Map<string, string>();
  for (const trade of args.trades) {
    const symbol = trade.symbol.toUpperCase();
    if (trade.isin && !symbolToIsin.has(symbol)) {
      symbolToIsin.set(symbol, trade.isin);
    }
  }

  const netPriorQty = computeNetPriorQty(priorEvents);
  const periodStart = taxPeriod.from.getTime();
  const entries = carryInPositions.map((pos) => {
    const key = lotKey({
      isin: pos.isin ?? symbolToIsin.get(pos.symbol.toUpperCase()),
      symbol: pos.symbol,
    });
    let datetime =
      pos.acquisitionDate ?? new Date(pos.year, 11, 31, 23, 59, 59);
    if (!pos.acquisitionDate && datetime.getTime() >= periodStart) {
      datetime = new Date(periodStart - 1000);
    }
    return { pos, key, datetime, residual: pos.quantity };
  });

  const byLatest = entries.toSorted(
    (a, b) => b.datetime.getTime() - a.datetime.getTime(),
  );
  for (const entry of byLatest) {
    const covered = netPriorQty.get(entry.key) ?? 0;
    if (covered <= 0 || entry.residual <= 0) continue;
    const used = Math.min(covered, entry.residual);
    entry.residual -= used;
    netPriorQty.set(entry.key, covered - used);
    args.onWarning?.({
      kind: 'carry-in-overlap',
      symbol: entry.pos.symbol,
      isin: entry.pos.isin,
      carryInQuantity: entry.pos.quantity,
      coveredQuantity: used,
    });
  }

  const events: TimelineEvent[] = [];
  for (const { pos, key, datetime, residual } of entries) {
    if (residual <= 0 || pos.quantity <= 0) continue;
    let splitFactor = 1;
    for (const event of priorEvents) {
      if (
        event.kind === 'action' &&
        event.action.type === 'stock-split' &&
        event.action.denominator !== 0 &&
        event.datetime.getTime() > datetime.getTime() &&
        lotKey(event.action) === key
      ) {
        splitFactor *= event.action.numerator / event.action.denominator;
      }
    }
    const quantity = residual / splitFactor;
    const residualCostPln = (pos.costPln * residual) / pos.quantity;
    events.push({
      kind: 'carry-in',
      datetime,
      key,
      quantity,
      costPerSharePln: residualCostPln / quantity,
      costMissing: pos.costMissing || pos.rateUnavailable,
    });
  }
  return events;
}

function processAction(args: {
  action: EnrichedCorporateAction;
  lotQueues: Map<string, FifoLot[]>;
  results: TradeResult[];
  taxPeriod: TaxPeriod;
  symbolCountryMap: Map<string, string>;
}): void {
  const { action, lotQueues } = args;
  const key = lotKey(action);
  const lots = lotQueues.get(key);

  if (!lots || lots.length === 0) return;

  if (action.type === 'stock-split') {
    const newLots = applyStockSplit({
      lots,
      numerator: action.numerator,
      denominator: action.denominator,
    });
    lotQueues.set(key, newLots);
  } else {
    // action.type === 'merger'
    const mergerResult = applyMerger({
      lots,
      conversionRatio: action.conversionRatio ?? 0,
      cashPerShare: action.cashPerShare ?? 0,
      cashCurrency: action.cashCurrency ?? '',
      cashExchangeRate: action.cashExchangeRate,
      newSharesValue: action.newSharesValue,
    });

    // Remove old symbol lots
    lotQueues.delete(key);

    // Move new lots to target symbol
    if (
      mergerResult.newLots.length > 0 &&
      (action.targetIsin ?? action.targetSymbol)
    ) {
      const targetKey = (
        action.targetIsin ??
        action.targetSymbol ??
        ''
      ).toUpperCase();
      const targetLots = getOrCreateLots(lotQueues, targetKey);
      targetLots.push(...mergerResult.newLots);
    }

    // Record cash proceeds as synthetic sell (if in tax period)
    if (
      mergerResult.cashProceeds > 0 &&
      isInPeriod({ datetime: action.datetime, taxPeriod: args.taxPeriod })
    ) {
      const cashExRate = action.cashExchangeRate;
      const proceedsPln = mergerResult.cashProceeds * cashExRate;
      const costPln = mergerResult.cashCostPln;
      args.results.push({
        symbol: action.symbol,
        datetime: action.datetime,
        type: 'sell',
        source: 'corporate-action',
        quantity: 0,
        price: 0,
        proceeds: mergerResult.cashProceeds,
        commission: 0,
        currency: mergerResult.cashCurrency,
        exchangeRate: cashExRate,
        proceedsPln,
        costPln,
        gainLossPln: proceedsPln - costPln,
        taxPln: Math.max(proceedsPln - costPln, 0) * TAX_RATE,
        rateUnavailable:
          action.cashRateUnavailable || mergerResult.costRateUnavailable,
        costRateUnavailable: mergerResult.costRateUnavailable,
        country: args.symbolCountryMap.get(action.symbol) ?? 'XX',
        foreignTaxPln: 0,
        foreignTaxOriginal: 0,
        ...(mergerResult.costMissing ? { costBasisMissing: true } : {}),
      });
    }
  }
}

function processTrade(args: {
  trade: EnrichedTrade;
  lotQueues: Map<string, FifoLot[]>;
  results: TradeResult[];
  taxPeriod: TaxPeriod;
  symbolCountryMap: Map<string, string>;
}): void {
  const { trade, lotQueues, results, taxPeriod } = args;
  const key = lotKey(trade);
  const lots = getOrCreateLots(lotQueues, key);

  if (trade.type === 'buy') {
    const costPerSharePln = trade.price * trade.exchangeRate;
    const commissionPln = trade.commission * trade.commissionExchangeRate;
    const commissionPerSharePln =
      trade.quantity > 0 ? commissionPln / trade.quantity : 0;

    lots.push({
      quantity: trade.quantity,
      costPerSharePln,
      commissionPerSharePln,
      rateUnavailable: trade.rateUnavailable,
    });

    if (isInPeriod({ datetime: trade.datetime, taxPeriod })) {
      results.push({
        symbol: trade.symbol,
        datetime: trade.datetime,
        type: 'buy',
        source: trade.source ?? 'trade',
        quantity: trade.quantity,
        price: trade.price,
        proceeds: 0,
        commission: trade.commission,
        currency: trade.currency,
        exchangeRate: trade.exchangeRate,
        proceedsPln: 0,
        costPln: 0,
        gainLossPln: 0,
        taxPln: 0,
        rateUnavailable: trade.rateUnavailable,
        country: args.symbolCountryMap.get(trade.symbol) ?? 'XX',
        foreignTaxPln: 0,
        foreignTaxOriginal: 0,
      });
    }
  } else {
    // Sell — consume lots FIFO
    // Gross proceeds go to PIT-38 poz. 22; the sell commission is a cost
    // (poz. 23) per the MF PIT-38 brochure, so gain/loss is unchanged.
    const proceedsPln = trade.proceeds * trade.exchangeRate;
    const sellCommissionPln = trade.commission * trade.commissionExchangeRate;

    let totalCostPln = 0;
    let remainingQty = trade.quantity;
    let costRateUnavailable = false;
    let costMissing = false;

    if (lots.length === 0) {
      throw new Error(
        `No buy lots available for ${trade.symbol} (${trade.isin ?? 'no ISIN'}) on ${trade.datetime.toISOString()}. Cannot sell ${String(trade.quantity)} shares.`,
      );
    }

    // Float subtraction leaves ~1e-15 residue (e.g. 0.1+0.2 != 0.3).
    // Compare against epsilon scaled to trade size, capped so a real
    // fractional shortfall cannot disappear on very large trades.
    const qtyEpsilon = Math.min(
      Math.max(Math.abs(trade.quantity), 1) * 1e-9,
      1e-8,
    );

    while (remainingQty > qtyEpsilon && lots.length > 0) {
      const lot = lots[0];
      const usedQty = Math.min(remainingQty, lot.quantity);
      if (lot.rateUnavailable) costRateUnavailable = true;

      totalCostPln +=
        usedQty * (lot.costPerSharePln + lot.commissionPerSharePln);
      remainingQty -= usedQty;
      if (lot.costMissing) costMissing = true;

      if (lot.quantity - usedQty <= qtyEpsilon) {
        lots.shift();
      } else {
        lot.quantity -= usedQty;
      }
    }

    if (remainingQty > qtyEpsilon) {
      throw new Error(
        `Insufficient buy lots for ${trade.symbol} (${trade.isin ?? 'no ISIN'}) on ${trade.datetime.toISOString()}. Short ${String(remainingQty)} shares.`,
      );
    }

    totalCostPln += sellCommissionPln;

    if (isInPeriod({ datetime: trade.datetime, taxPeriod })) {
      results.push({
        symbol: trade.symbol,
        datetime: trade.datetime,
        type: 'sell',
        source: trade.source ?? 'trade',
        quantity: trade.quantity,
        price: trade.price,
        proceeds: trade.proceeds,
        commission: trade.commission,
        currency: trade.currency,
        exchangeRate: trade.exchangeRate,
        proceedsPln,
        costPln: totalCostPln,
        sellCommissionPln,
        gainLossPln: proceedsPln - totalCostPln,
        taxPln: Math.max(proceedsPln - totalCostPln, 0) * TAX_RATE,
        rateUnavailable: trade.rateUnavailable || costRateUnavailable,
        costRateUnavailable,
        country: args.symbolCountryMap.get(trade.symbol) ?? 'XX',
        foreignTaxPln: 0,
        foreignTaxOriginal: 0,
        ...(costMissing ? { costBasisMissing: true } : {}),
      });
    }
  }
}
