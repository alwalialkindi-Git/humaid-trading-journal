import type { AllocationInput } from "@/lib/fin-table";
import { allocationSegments, type DisplayNormalized } from "@/lib/fin-table";
import type { HoldingView, TransactionRow } from "@/lib/services";
import type { AssetClass } from "@/lib/market-data/types";

/**
 * Dashboard read-layer math — pure module (D4, sprint §9).
 * Everything here derives from ledger read models (HoldingView rows and
 * TransactionRow lists) plus the ONE display-currency normalization from
 * lib/fin-table — the dashboard never runs its own FX or its own weight
 * base (§4.9: the exposure band and the Wealth page can never disagree).
 */

// ---------------------------------------------------------------------------
// Global period selector (§9.1) — the SELECTION is shared across pages;
// period figures themselves stay "insufficient history" until the daily
// valuation series lands (M2, CIO condition 1 — never an approximation).
// ---------------------------------------------------------------------------

export const PERIODS = ["D", "W", "M", "YTD", "1Y"] as const;
export type Period = (typeof PERIODS)[number];
export const DEFAULT_PERIOD: Period = "M";
/** localStorage key — Home/Wealth/Insights all read the same selection. */
export const PERIOD_STORAGE_KEY = "amanah:period";

// ---------------------------------------------------------------------------
// Income & purification (§9.4) — ledger-true, per NATIVE currency
// ---------------------------------------------------------------------------

export interface IncomeSummaryRow {
  currency: string;
  /** Dividends received this calendar month (UTC calendar, like trade dates). */
  dividends_mtd: number;
  /** Dividends received this calendar year. */
  dividends_ytd: number;
  /** Lifetime purification accrued: Σ dividend amount × purification %. */
  purification_accrued: number;
  /** Lifetime purification payments recorded in the ledger. */
  purification_paid: number;
  /** accrued − paid. An obligation never resets with the calendar. */
  purification_owed: number;
}

/**
 * Income read model from the raw ledger rows. Calendar bucketing uses UTC —
 * trade dates are calendar dates and always format in UTC (D2 hydration
 * rule); `now` is injectable so this stays deterministic under test.
 */
export function incomeSummary(
  transactions: readonly TransactionRow[],
  now: number = Date.now()
): IncomeSummaryRow[] {
  const iso = new Date(now).toISOString();
  const yearMonth = iso.slice(0, 7); // "2026-07"
  const year = iso.slice(0, 4); // "2026"

  const rows = new Map<string, IncomeSummaryRow>();
  const row = (currency: string): IncomeSummaryRow => {
    const c = currency.toUpperCase();
    let r = rows.get(c);
    if (!r) {
      r = {
        currency: c,
        dividends_mtd: 0,
        dividends_ytd: 0,
        purification_accrued: 0,
        purification_paid: 0,
        purification_owed: 0,
      };
      rows.set(c, r);
    }
    return r;
  };

  for (const t of transactions) {
    if (t.type === "dividend") {
      const r = row(t.currency);
      const amount = t.amount ?? 0;
      if (t.trade_date.startsWith(yearMonth)) r.dividends_mtd += amount;
      if (t.trade_date.startsWith(year)) r.dividends_ytd += amount;
      if (t.purification_percentage != null && t.purification_percentage > 0) {
        r.purification_accrued += amount * (t.purification_percentage / 100);
      }
    } else if (t.type === "purification_payment") {
      row(t.currency).purification_paid += t.amount ?? 0;
    }
  }

  return [...rows.values()]
    .map((r) => ({
      currency: r.currency,
      dividends_mtd: round2(r.dividends_mtd),
      dividends_ytd: round2(r.dividends_ytd),
      purification_accrued: round2(r.purification_accrued),
      purification_paid: round2(r.purification_paid),
      purification_owed: round2(r.purification_accrued - r.purification_paid),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

// ---------------------------------------------------------------------------
// Exposure band (§9.3) — one grouping-dimension system over ONE normalized base
// ---------------------------------------------------------------------------

/** Account grouping needs per-account holdings (M4); labels arrive M5.5. */
export type ExposureDimension = "asset" | "class" | "currency";

export const EXPOSURE_DIMENSIONS: readonly {
  key: ExposureDimension;
  label: string;
}[] = [
  { key: "asset", label: "Asset" },
  { key: "class", label: "Class" },
  { key: "currency", label: "Currency" },
];

const CLASS_LABELS: Record<AssetClass, string> = {
  stock: "Stocks",
  etf: "ETFs",
  crypto: "Crypto",
  sukuk: "Sukuk",
  fund: "Funds",
  commodity: "Commodities",
  cash: "Cash",
  other: "Other assets",
};

/**
 * Allocation items for one grouping dimension, valued in the display
 * currency via the shared normalization. Rows without a display value
 * (unpriced / no FX rate) are excluded here and NAMED by
 * `exposureExclusions` — never zeroed (D-009).
 */
export function exposureItems(
  holdings: readonly HoldingView[],
  normalized: Map<string, DisplayNormalized>,
  dimension: ExposureDimension
): AllocationInput[] {
  const grouped = new Map<string, number>();
  const order: string[] = [];

  for (const h of holdings) {
    if (h.quantity <= 0) continue;
    const value = normalized.get(h.asset.id)?.displayValue;
    if (value == null) continue;
    const label =
      dimension === "asset"
        ? h.asset.symbol
        : dimension === "class"
          ? (CLASS_LABELS[h.asset.asset_class] ?? h.asset.asset_class)
          : h.asset.currency.toUpperCase();
    if (!grouped.has(label)) order.push(label);
    grouped.set(label, (grouped.get(label) ?? 0) + value);
  }

  return order.map((label) => ({ label, value: round2(grouped.get(label)!) }));
}

/** Symbols excluded from the display-value base, by reason (named, §4.12). */
export function exposureExclusions(
  holdings: readonly HoldingView[],
  normalized: Map<string, DisplayNormalized>
): { unpriced: string[]; noRate: string[] } {
  const unpriced: string[] = [];
  const noRate: string[] = [];
  for (const h of holdings) {
    if (h.quantity <= 0) continue;
    const n = normalized.get(h.asset.id);
    if (n?.displayValue != null) continue;
    if (n?.noRate) {
      noRate.push(`${h.asset.symbol} (${h.asset.currency.toUpperCase()})`);
    } else {
      unpriced.push(h.asset.symbol);
    }
  }
  return { unpriced, noRate };
}

export interface ConcentrationFigure {
  label: string;
  percent: number;
}

/** Top-N single-asset concentration, from the same base as the bar (§9.3). */
export function topConcentration(
  holdings: readonly HoldingView[],
  normalized: Map<string, DisplayNormalized>,
  n = 3
): ConcentrationFigure[] {
  return allocationSegments(exposureItems(holdings, normalized, "asset"))
    .filter((s) => !s.isOther)
    .slice(0, n)
    .map((s) => ({ label: s.label, percent: s.percent }));
}

export interface LiquiditySplit {
  listed_percent: number;
  unlisted_percent: number;
  listed_value: number;
  unlisted_value: number;
}

/**
 * Listed vs unlisted share of the priced, convertible base (§9.3 ◇A6 —
 * with real estate/PE incoming, hiding illiquidity is not a risk view).
 * Null when nothing is priced.
 */
export function liquiditySplit(
  holdings: readonly HoldingView[],
  normalized: Map<string, DisplayNormalized>
): LiquiditySplit | null {
  let listed = 0;
  let unlisted = 0;
  for (const h of holdings) {
    if (h.quantity <= 0) continue;
    const value = normalized.get(h.asset.id)?.displayValue;
    if (value == null || value <= 0) continue;
    if (h.asset.is_listed) listed += value;
    else unlisted += value;
  }
  const total = listed + unlisted;
  if (total <= 0) return null;
  return {
    listed_percent: round1((listed / total) * 100),
    unlisted_percent: round1((unlisted / total) * 100),
    listed_value: round2(listed),
    unlisted_value: round2(unlisted),
  };
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
function round1(v: number): number {
  return Math.round((v + Number.EPSILON) * 10) / 10;
}
