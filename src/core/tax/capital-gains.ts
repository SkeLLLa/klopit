import {
  TAX_RATE,
  type CarryInPosition,
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

export interface CalculateCapitalGainsArgs {
  trades: EnrichedTrade[];
  corporateActions: EnrichedCorporateAction[];
  carryInPositions: CarryInPosition[];
  taxPeriod: TaxPeriod;
  symbolCountryMap?: Map<string, string>;
}

type TimelineEvent =
  | { kind: 'trade'; datetime: Date; trade: EnrichedTrade }
  | { kind: 'action'; datetime: Date; action: EnrichedCorporateAction };

function lotKey(args: {
  isin?: string;
  symbol: string;
  lotId?: string;
}): string {
  const base = (args.isin ?? args.symbol).toUpperCase();
  return args.lotId ? `${base}::${args.lotId}` : base;
}

function isInPeriod(args: { datetime: Date; taxPeriod: TaxPeriod }): boolean {
  return (
    args.datetime >= args.taxPeriod.from && args.datetime <= args.taxPeriod.to
  );
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

  // Seed carry-in positions (cost claimed in prior years)
  for (const pos of carryInPositions) {
    const key = lotKey(pos);
    const lots = getOrCreateLots(lotQueues, key);
    lots.push({
      quantity: pos.quantity,
      costPerSharePln: 0,
      commissionPerSharePln: 0,
    });
  }

  // Build unified timeline
  const timeline: TimelineEvent[] = [
    ...trades.map(
      (trade): TimelineEvent => ({
        kind: 'trade',
        datetime: trade.datetime,
        trade,
      }),
    ),
    ...corporateActions.map(
      (action): TimelineEvent => ({
        kind: 'action',
        datetime: action.datetime,
        action,
      }),
    ),
  ];

  // Sort by datetime; corporate actions before trades on same datetime.
  // When two trades share a datetime, break ties by `lotId` so per-lot
  // output order is stable regardless of DB insertion / array order — the
  // data table is a stable sort by datetime, so this order flows through
  // to display.
  timeline.sort((a, b) => {
    const timeDiff = a.datetime.getTime() - b.datetime.getTime();
    if (timeDiff !== 0) return timeDiff;
    if (a.kind === 'action' && b.kind === 'trade') return -1;
    if (a.kind === 'trade' && b.kind === 'action') return 1;
    if (a.kind === 'trade' && b.kind === 'trade') {
      const aLot = a.trade.lotId ?? '';
      const bLot = b.trade.lotId ?? '';
      if (aLot !== bLot) return aLot < bLot ? -1 : 1;
    }
    return 0;
  });

  for (const event of timeline) {
    if (event.kind === 'action') {
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
        rateUnavailable: action.cashRateUnavailable,
        country: args.symbolCountryMap.get(action.symbol) ?? 'XX',
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
      });
    }
  } else {
    // Sell — consume lots FIFO
    const proceedsPln = trade.proceeds * trade.exchangeRate;
    const commissionPln = trade.commission * trade.commissionExchangeRate;
    const netProceedsPln = proceedsPln - commissionPln;

    let totalCostPln = 0;
    let remainingQty = trade.quantity;

    if (lots.length === 0) {
      throw new Error(
        `No buy lots available for ${trade.symbol} (${trade.isin ?? 'no ISIN'}) on ${trade.datetime.toISOString()}. Cannot sell ${String(trade.quantity)} shares.`,
      );
    }

    while (remainingQty > 0 && lots.length > 0) {
      const lot = lots[0];
      const usedQty = Math.min(remainingQty, lot.quantity);

      totalCostPln +=
        usedQty * (lot.costPerSharePln + lot.commissionPerSharePln);
      remainingQty -= usedQty;

      if (usedQty >= lot.quantity) {
        lots.shift();
      } else {
        lot.quantity -= usedQty;
      }
    }

    if (remainingQty > 0) {
      throw new Error(
        `Insufficient buy lots for ${trade.symbol} (${trade.isin ?? 'no ISIN'}) on ${trade.datetime.toISOString()}. Short ${String(remainingQty)} shares.`,
      );
    }

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
        proceedsPln: netProceedsPln,
        costPln: totalCostPln,
        gainLossPln: netProceedsPln - totalCostPln,
        taxPln: Math.max(netProceedsPln - totalCostPln, 0) * TAX_RATE,
        rateUnavailable: trade.rateUnavailable,
        country: args.symbolCountryMap.get(trade.symbol) ?? 'XX',
      });
    }
  }
}
