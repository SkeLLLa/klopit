import type { DividendResult, TradeResult } from '../types.js';

export interface PortfolioStats {
  gainLossBySymbol: Map<string, number>;
  totalGainLoss: number;
  totalDividends: number;
  symbolCount: number;
}

/** Analyze portfolio for visualization */
export function analyzePortfolio(args: {
  trades: TradeResult[];
  dividends: DividendResult[];
}): PortfolioStats {
  const { trades, dividends } = args;
  const gainLossBySymbol = new Map<string, number>();
  let totalGainLoss = 0;
  let totalDividends = 0;

  for (const trade of trades) {
    const current = gainLossBySymbol.get(trade.symbol) ?? 0;
    gainLossBySymbol.set(trade.symbol, current + trade.gainLossPln);
    totalGainLoss += trade.gainLossPln;
  }

  for (const dividend of dividends) {
    totalDividends += dividend.amountPln;
  }

  return {
    gainLossBySymbol,
    totalGainLoss,
    totalDividends,
    symbolCount: gainLossBySymbol.size,
  };
}
