import type { Trade, Holding, Dividend } from "./types";

/**
 * Trade P&L conventions:
 * - "buy" trades profit when price rises; "sell" (a sell-first position that
 *   was later covered — still spot, never shorting) profits when price falls.
 *   In practice for a Shariah-compliant journal almost all trades are "buy".
 * - Closed trades use exit_price; open trades use current_price when the user
 *   has entered one, otherwise unrealized P&L is treated as 0.
 */

export function tradePnl(trade: Trade): number | null {
  const reference =
    trade.trade_status === "closed" ? trade.exit_price : trade.current_price;
  if (reference == null) return null;
  const direction = trade.side === "sell" ? -1 : 1;
  const gross = (reference - trade.entry_price) * trade.quantity * direction;
  return gross - (trade.fees ?? 0);
}

export function tradePnlPercent(trade: Trade): number | null {
  const pnl = tradePnl(trade);
  if (pnl == null) return null;
  const cost = trade.entry_price * trade.quantity;
  if (cost === 0) return null;
  return (pnl / cost) * 100;
}

/** Holding period in calendar days (open trades measured to today). */
export function holdingPeriodDays(trade: Trade): number {
  const start = new Date(trade.entry_date).getTime();
  const end = trade.exit_date
    ? new Date(trade.exit_date).getTime()
    : Date.now();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

export interface TradeStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  wins: number;
  losses: number;
  winRate: number; // 0-100, over closed trades
  averageWin: number;
  averageLoss: number; // negative number
  profitFactor: number; // gross wins / gross losses; Infinity if no losses
  totalFees: number;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  averageHoldingDays: number;
}

export function computeTradeStats(trades: Trade[]): TradeStats {
  const closed = trades.filter((t) => t.trade_status === "closed");
  const open = trades.filter((t) => t.trade_status === "open");

  let realizedPnl = 0;
  let unrealizedPnl = 0;
  let grossWins = 0;
  let grossLosses = 0;
  let wins = 0;
  let losses = 0;
  let totalFees = 0;
  let best: Trade | null = null;
  let worst: Trade | null = null;
  let bestPnl = -Infinity;
  let worstPnl = Infinity;
  let holdingSum = 0;

  for (const t of trades) {
    totalFees += t.fees ?? 0;
  }

  for (const t of closed) {
    const pnl = tradePnl(t) ?? 0;
    realizedPnl += pnl;
    holdingSum += holdingPeriodDays(t);
    if (pnl > 0) {
      wins++;
      grossWins += pnl;
    } else if (pnl < 0) {
      losses++;
      grossLosses += Math.abs(pnl);
    }
    if (pnl > bestPnl) {
      bestPnl = pnl;
      best = t;
    }
    if (pnl < worstPnl) {
      worstPnl = pnl;
      worst = t;
    }
  }

  for (const t of open) {
    unrealizedPnl += tradePnl(t) ?? 0;
  }

  return {
    totalTrades: trades.length,
    openTrades: open.length,
    closedTrades: closed.length,
    realizedPnl,
    unrealizedPnl,
    totalPnl: realizedPnl + unrealizedPnl,
    wins,
    losses,
    winRate: closed.length > 0 ? (wins / closed.length) * 100 : 0,
    averageWin: wins > 0 ? grossWins / wins : 0,
    averageLoss: losses > 0 ? -grossLosses / losses : 0,
    profitFactor:
      grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0,
    totalFees,
    bestTrade: best,
    worstTrade: worst,
    averageHoldingDays: closed.length > 0 ? holdingSum / closed.length : 0,
  };
}

/** Realized P&L per day, keyed by exit_date (YYYY-MM-DD). */
export function dailyPnlMap(trades: Trade[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of trades) {
    if (t.trade_status !== "closed" || !t.exit_date) continue;
    const pnl = tradePnl(t) ?? 0;
    const key = t.exit_date.slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + pnl);
  }
  return map;
}

/** Monthly realized P&L, keyed by YYYY-MM, sorted ascending. */
export function monthlyPnl(trades: Trade[]): { month: string; pnl: number }[] {
  const map = new Map<string, number>();
  for (const t of trades) {
    if (t.trade_status !== "closed" || !t.exit_date) continue;
    const key = t.exit_date.slice(0, 7);
    map.set(key, (map.get(key) ?? 0) + (tradePnl(t) ?? 0));
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, pnl]) => ({ month, pnl }));
}

/** Cumulative realized-P&L equity curve, one point per closed trade. */
export function buildEquityCurve(
  trades: Trade[]
): { date: string; equity: number }[] {
  const closed = trades
    .filter((t) => t.trade_status === "closed" && t.exit_date)
    .sort((a, b) => (a.exit_date! < b.exit_date! ? -1 : 1));
  let equity = 0;
  const curve: { date: string; equity: number }[] = [];
  for (const t of closed) {
    equity += tradePnl(t) ?? 0;
    curve.push({
      date: t.exit_date!.slice(0, 10),
      equity: Math.round(equity * 100) / 100,
    });
  }
  return curve;
}

/**
 * Days until the next anniversary of a date (e.g. the zakat hawl).
 * Returns null for invalid dates.
 */
export function daysUntilNextAnniversary(
  dateStr: string,
  now: number = Date.now()
): number | null {
  const base = new Date(dateStr);
  if (Number.isNaN(base.getTime())) return null;
  const next = new Date(base);
  while (next.getTime() < now) next.setFullYear(next.getFullYear() + 1);
  return Math.ceil((next.getTime() - now) / 86_400_000);
}

/** Max drawdown of the cumulative realized-P&L equity curve. */
export function maxDrawdown(trades: Trade[]): number {
  const closed = trades
    .filter((t) => t.trade_status === "closed" && t.exit_date)
    .sort((a, b) => (a.exit_date! < b.exit_date! ? -1 : 1));
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const t of closed) {
    equity += tradePnl(t) ?? 0;
    peak = Math.max(peak, equity);
    maxDd = Math.max(maxDd, peak - equity);
  }
  return maxDd;
}

export function groupPnlBy(
  trades: Trade[],
  keyFn: (t: Trade) => string | null
): { key: string; pnl: number; count: number; wins: number }[] {
  const map = new Map<string, { pnl: number; count: number; wins: number }>();
  for (const t of trades) {
    if (t.trade_status !== "closed") continue;
    const key = keyFn(t);
    if (!key) continue;
    const pnl = tradePnl(t) ?? 0;
    const entry = map.get(key) ?? { pnl: 0, count: 0, wins: 0 };
    entry.pnl += pnl;
    entry.count++;
    if (pnl > 0) entry.wins++;
    map.set(key, entry);
  }
  return [...map.entries()]
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.pnl - a.pnl);
}

export function mistakeFrequency(
  trades: Trade[]
): { mistake: string; count: number }[] {
  const map = new Map<string, number>();
  for (const t of trades) {
    for (const m of t.mistakes ?? []) {
      map.set(m, (map.get(m) ?? 0) + 1);
    }
  }
  return [...map.entries()]
    .map(([mistake, count]) => ({ mistake, count }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------

export function holdingMarketValue(h: Holding): number {
  return h.quantity * h.current_price;
}

export function holdingCostBasis(h: Holding): number {
  return h.quantity * h.average_cost;
}

export function holdingUnrealizedPnl(h: Holding): number {
  return holdingMarketValue(h) - holdingCostBasis(h);
}

export interface PortfolioSummary {
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  totalDividends: number;
  allocationByType: { key: string; value: number }[];
  allocationByMarket: { key: string; value: number }[];
  allocationBySector: { key: string; value: number }[];
  largestPosition: { symbol: string; share: number } | null;
}

export function computePortfolioSummary(
  holdings: Holding[],
  dividends: Dividend[]
): PortfolioSummary {
  const marketValue = holdings.reduce((s, h) => s + holdingMarketValue(h), 0);
  const costBasis = holdings.reduce((s, h) => s + holdingCostBasis(h), 0);

  const groupBy = (fn: (h: Holding) => string) => {
    const map = new Map<string, number>();
    for (const h of holdings) {
      const key = fn(h);
      map.set(key, (map.get(key) ?? 0) + holdingMarketValue(h));
    }
    return [...map.entries()]
      .map(([key, value]) => ({ key, value }))
      .sort((a, b) => b.value - a.value);
  };

  let largestPosition: { symbol: string; share: number } | null = null;
  if (marketValue > 0) {
    for (const h of holdings) {
      const share = holdingMarketValue(h) / marketValue;
      if (!largestPosition || share > largestPosition.share) {
        largestPosition = { symbol: h.symbol, share };
      }
    }
  }

  return {
    marketValue,
    costBasis,
    unrealizedPnl: marketValue - costBasis,
    unrealizedPnlPercent:
      costBasis > 0 ? ((marketValue - costBasis) / costBasis) * 100 : 0,
    totalDividends: dividends.reduce((s, d) => s + d.amount, 0),
    allocationByType: groupBy((h) => h.asset_type),
    allocationByMarket: groupBy((h) => h.market ?? "Other"),
    allocationBySector: groupBy((h) => h.sector ?? "Other"),
    largestPosition,
  };
}
