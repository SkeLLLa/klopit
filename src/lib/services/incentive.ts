import { isIncentiveBuy } from '../../core/tax/incentive.js';
import type {
  IncentiveRegime,
  Trade,
  TradeIncentive,
} from '../../core/types.js';
import { db } from '../db.js';

/** Incentive data of `trade` with `regime` replaced; `undefined` clears it. */
export function withIncentiveRegime(
  incentive: TradeIncentive | undefined,
  regime: IncentiveRegime | undefined,
): TradeIncentive | undefined {
  const { regime: _previous, ...rest } = incentive ?? {};
  const next: TradeIncentive = regime ? { ...rest, regime } : rest;
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * Updates that set `regime` on every RSU / ESPP buy lot of `symbol`; other
 * incentive fields (taxed income, FMV) are kept.
 */
export function incentiveRegimeUpdates(args: {
  trades: (Trade & { id?: number })[];
  symbol: string;
  regime: IncentiveRegime | undefined;
}): { id: number; incentive: TradeIncentive | undefined }[] {
  const symbol = args.symbol.toUpperCase();
  return args.trades.flatMap((trade) =>
    trade.id !== undefined &&
    isIncentiveBuy(trade) &&
    trade.symbol.toUpperCase() === symbol
      ? [
          {
            id: trade.id,
            incentive: withIncentiveRegime(trade.incentive, args.regime),
          },
        ]
      : [],
  );
}

/**
 * Set the regime of all RSU / ESPP lots of a symbol (Data → Trades bulk
 * action).
 */
export async function setIncentiveRegimeForSymbol(args: {
  sessionId: string;
  symbol: string;
  regime: IncentiveRegime | undefined;
}): Promise<void> {
  const trades = await db.trades
    .where('sessionId')
    .equals(args.sessionId)
    .toArray();
  const updates = incentiveRegimeUpdates({ trades, ...args });
  await db.transaction('rw', db.trades, async () => {
    for (const { id, incentive } of updates) {
      // oxlint-disable-next-line eslint/no-await-in-loop
      await db.trades.update(id, { incentive });
    }
  });
}

/** Symbols with RSU / ESPP buy lots whose regime has not been chosen. */
export function symbolsMissingIncentiveRegime(
  trades: Pick<Trade, 'type' | 'source' | 'symbol' | 'incentive'>[],
): string[] {
  return [
    ...new Set(
      trades
        .filter((t) => isIncentiveBuy(t) && !t.incentive?.regime)
        .map((t) => t.symbol),
    ),
  ];
}

/**
 * Sessions with Schwab files imported before FMV was recorded: their vests and
 * purchases lack `source` / `incentive`, so the user should re-import.
 */
export function needsSchwabFmvNotice(args: {
  files: readonly { broker: string }[];
  trades: Pick<Trade, 'type' | 'source' | 'account'>[];
}): boolean {
  return (
    args.files.some((f) => f.broker === 'schwab') &&
    args.trades.some(
      (t) =>
        t.type === 'buy' &&
        t.source === undefined &&
        (t.account === undefined || t.account.startsWith('schwab:')),
    )
  );
}

/** Incentive data with the taxed income replaced; `undefined` clears it. */
export function withTaxedIncomePln(
  incentive: TradeIncentive | undefined,
  taxedIncomePln: number | undefined,
): TradeIncentive | undefined {
  const { taxedIncomePln: _previous, ...rest } = incentive ?? {};
  const next: TradeIncentive =
    taxedIncomePln === undefined ? rest : { ...rest, taxedIncomePln };
  return Object.keys(next).length > 0 ? next : undefined;
}
