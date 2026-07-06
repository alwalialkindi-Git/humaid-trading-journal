import {
  computeTradeStats,
  computePortfolioSummary,
  groupPnlBy,
  mistakeFrequency,
} from "./calculations";
import { computeZakat, type ZakatInputs } from "./zakat";
import { formatCurrency, titleCase } from "./format";
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
