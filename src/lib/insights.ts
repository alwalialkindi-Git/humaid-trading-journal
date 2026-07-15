import {
  computeTradeStats,
  computePortfolioSummary,
  groupPnlBy,
  mistakeFrequency,
} from "./calculations";
import { computeZakat, type ZakatInputs } from "./zakat";
import { formatCurrency, titleCase } from "./format";
import { formatMoney, formatPercent } from "./amanah/number";
import { normalizeDisplayValues } from "./fin-table";
import type { IncomeSummaryRow } from "./dashboard";
import type { HoldingView } from "./services";
import { MISTAKE_LABELS, type Mistake } from "./types";
import type { Trade, Holding, Dividend, Profile } from "./types";

export type InsightTone = "positive" | "negative" | "warning" | "neutral";

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  detail: string;
}

/**
 * Rule-based insights. This module is intentionally structured like an AI
 * provider so a real model can slot in later: `generateInsights` is the single
 * entry point, and the UI only knows about the `Insight` shape.
 */
export function generateInsights(params: {
  trades: Trade[];
  holdings: Holding[];
  dividends: Dividend[];
  profile: Profile | null;
}): Insight[] {
  const { trades, holdings, dividends, profile } = params;
  const currency = profile?.currency ?? "AED";
  const insights: Insight[] = [];
  const stats = computeTradeStats(trades);

  // Most repeated mistake
  const mistakes = mistakeFrequency(trades);
  if (mistakes.length > 0 && mistakes[0].count >= 2) {
    const label =
      MISTAKE_LABELS[mistakes[0].mistake as Mistake] ??
      titleCase(mistakes[0].mistake);
    insights.push({
      id: "top-mistake",
      tone: "negative",
      title: `Your most repeated mistake is ${label}`,
      detail: `It appears in ${mistakes[0].count} trades. Add a written checklist before entering a position to break the pattern.`,
    });
  }

  // Best strategy
  const strategies = groupPnlBy(trades, (t) => t.strategy);
  if (strategies.length > 0 && strategies[0].pnl > 0) {
    insights.push({
      id: "best-strategy",
      tone: "positive",
      title: `Your best performing strategy is ${strategies[0].key}`,
      detail: `${strategies[0].count} closed trades produced ${formatCurrency(strategies[0].pnl, currency)} in realized profit. Consider allocating more focus here.`,
    });
  }

  // Worst emotion
  const emotions = groupPnlBy(trades, (t) => t.emotion);
  const worstEmotion = emotions[emotions.length - 1];
  if (worstEmotion && worstEmotion.pnl < 0) {
    insights.push({
      id: "worst-emotion",
      tone: "warning",
      title: `You perform worse when feeling ${worstEmotion.key}`,
      detail: `Trades tagged "${worstEmotion.key}" have lost ${formatCurrency(Math.abs(worstEmotion.pnl), currency)} overall. Pause before trading in that state.`,
    });
  }

  // Shariah review needed
  const needsReview = holdings.filter(
    (h) => h.shariah_status === "not_reviewed" || h.shariah_status === "doubtful"
  );
  if (needsReview.length > 0) {
    insights.push({
      id: "shariah-review",
      tone: "warning",
      title: `${needsReview.length} holding${needsReview.length > 1 ? "s" : ""} need Shariah review`,
      detail: `${needsReview.map((h) => h.symbol).join(", ")} — run them through the Shariah Filter to confirm compliance status.`,
    });
  }

  // Concentration risk
  const portfolio = computePortfolioSummary(holdings, dividends);
  if (portfolio.largestPosition && portfolio.largestPosition.share > 0.35) {
    insights.push({
      id: "concentration",
      tone: "warning",
      title: `High exposure to ${portfolio.largestPosition.symbol}`,
      detail: `${(portfolio.largestPosition.share * 100).toFixed(0)}% of your portfolio sits in one symbol. Consider diversifying to reduce concentration risk.`,
    });
  }

  // Zakat estimate from current portfolio snapshot
  if (profile) {
    const compliantValue = holdings
      .filter((h) => h.shariah_status === "compliant")
      .reduce((s, h) => s + h.quantity * h.current_price, 0);
    if (compliantValue + profile.cash_balance > 0) {
      const estimate = estimateZakat(profile, holdings, dividends);
      insights.push({
        id: "zakat-estimate",
        tone: "neutral",
        title: `Your estimated zakat due is ${formatCurrency(estimate, currency)}`,
        detail:
          "Based on cash balance plus compliant holdings at 2.5%. Open the Zakat Calculator for a full calculation with nisab check.",
      });
    }
  }

  // Win rate encouragement / caution
  if (stats.closedTrades >= 5) {
    if (stats.winRate >= 60 && stats.profitFactor >= 1.5) {
      insights.push({
        id: "discipline",
        tone: "positive",
        title: `Solid discipline: ${stats.winRate.toFixed(0)}% win rate`,
        detail: `Profit factor of ${stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)} across ${stats.closedTrades} closed trades. Keep following your plan.`,
      });
    } else if (stats.profitFactor < 1 && stats.profitFactor > 0) {
      insights.push({
        id: "profit-factor-low",
        tone: "negative",
        title: "Losses currently outweigh wins",
        detail: `Profit factor is ${stats.profitFactor.toFixed(2)}. Review your worst trades and check which mistakes repeat.`,
      });
    }
  }

  return insights;
}

/**
 * Ledger-native insights (D4, §9.5) — the same rule-based shape, computed
 * from the ledger read models only (never the legacy tables). Weights come
 * from the ONE display-currency normalization (§4.9). The dashboard shows
 * at most 3.
 */
export function generateLedgerInsights(params: {
  /** Open positions. */
  holdings: HoldingView[];
  income: IncomeSummaryRow[];
  displayCurrency: string;
}): Insight[] {
  const { holdings, income, displayCurrency } = params;
  const insights: Insight[] = [];

  const normalized = normalizeDisplayValues(
    holdings,
    (h) => h.asset.id,
    (h) => h.market_value,
    (h) => h.asset.currency,
    displayCurrency
  );

  // Concentration: one asset above 35% of the priced base.
  let heaviest: { h: HoldingView; weight: number } | null = null;
  for (const h of holdings) {
    const weight = normalized.get(h.asset.id)?.weightPercent;
    if (weight != null && (heaviest == null || weight > heaviest.weight)) {
      heaviest = { h, weight };
    }
  }
  if (heaviest && heaviest.weight > 35) {
    insights.push({
      id: "concentration",
      tone: "warning",
      title: `High exposure to ${heaviest.h.asset.symbol}`,
      detail: `${formatPercent(heaviest.weight)} of your priced portfolio sits in one asset. Concentration is a decision — make sure it is yours.`,
    });
  }

  // Strongest / weakest priced position by unrealized %.
  const priced = holdings.filter(
    (h) => h.unrealized_pnl != null && h.unrealized_pnl_percent != null
  );
  const byPct = [...priced].sort(
    (a, b) => (b.unrealized_pnl_percent ?? 0) - (a.unrealized_pnl_percent ?? 0)
  );
  const best = byPct[0];
  if (best && (best.unrealized_pnl_percent ?? 0) >= 10) {
    insights.push({
      id: "top-gainer",
      tone: "positive",
      title: `${best.asset.symbol} is your strongest position`,
      detail: `Unrealized ${formatPercent(best.unrealized_pnl_percent!, { delta: true })} (${formatMoney(best.unrealized_pnl!, best.asset.currency)}) against average cost.`,
    });
  }
  const worst = byPct[byPct.length - 1];
  if (worst && worst !== best && (worst.unrealized_pnl_percent ?? 0) <= -10) {
    insights.push({
      id: "top-loser",
      tone: "negative",
      title: `${worst.asset.symbol} is your weakest position`,
      detail: `Unrealized ${formatPercent(worst.unrealized_pnl_percent!, { delta: true })} (${formatMoney(worst.unrealized_pnl!, worst.asset.currency)}). Revisit the thesis before averaging down.`,
    });
  }

  // Dividend income this year, per native currency.
  const ytd = income.filter((r) => r.dividends_ytd > 0);
  if (ytd.length > 0) {
    const owed = income.filter((r) => r.purification_owed > 0);
    insights.push({
      id: "income-ytd",
      tone: "neutral",
      title: `Dividend income this year: ${ytd
        .map((r) => formatMoney(r.dividends_ytd, r.currency))
        .join(" · ")}`,
      detail:
        owed.length > 0
          ? `Purification owed: ${owed
              .map((r) => formatMoney(r.purification_owed, r.currency))
              .join(" · ")} — record the payment to settle it.`
          : "All recorded in your ledger — purification is settled.",
    });
  }

  return insights;
}

/** Quick zakat estimate used on the dashboard (cash + compliant holdings). */
export function estimateZakat(
  profile: Profile,
  holdings: Holding[],
  dividends: Dividend[]
): number {
  const compliantValue = holdings
    .filter((h) => h.shariah_status === "compliant")
    .reduce((s, h) => s + h.quantity * h.current_price, 0);
  const dividendTotal = dividends.reduce((s, d) => s + d.amount, 0);
  const inputs: ZakatInputs = {
    cashAtHome: 0,
    bankCash: 0,
    tradingCash: profile.cash_balance,
    compliantStockValue: compliantValue,
    doubtfulStockValue: 0,
    dividendsReceived: dividendTotal,
    goldValue: 0,
    silverValue: 0,
    businessInventory: 0,
    receivables: 0,
    immediateDebts: 0,
    nisabMethod: profile.nisab_method,
    // Without live metal prices we can't check nisab here, so this dashboard
    // estimate applies the 2.5% rate directly.
    goldPricePerGram: 0,
    silverPricePerGram: 0,
  };
  const { zakatableAssets } = computeZakat(inputs);
  return zakatableAssets * 0.025;
}
