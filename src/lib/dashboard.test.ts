import { describe, expect, it } from "vitest";
import {
  exposureExclusions,
  exposureItems,
  incomeSummary,
  liquiditySplit,
  topConcentration,
} from "./dashboard";
import { allocationSegments, normalizeDisplayValues } from "./fin-table";
import type { HoldingView, TransactionRow } from "./services";
import type { TransactionType } from "./engine/positions";

/**
 * Dashboard math (D4, §9): income/purification from the raw ledger, and the
 * exposure band's grouping/splits over the SAME display-currency base the
 * Wealth page uses (normalizeDisplayValues) — one truth, by construction.
 */

// The clock for calendar bucketing: 15 Jul 2026 (matches trade-date fixtures).
const NOW = Date.parse("2026-07-15T12:00:00Z");

let txSeq = 0;
function tx(partial: Partial<TransactionRow> & { type: TransactionType }): TransactionRow {
  txSeq += 1;
  return {
    id: `t-${txSeq}`,
    user_id: "user-1",
    portfolio_id: "p-1",
    broker_id: null,
    asset_id: null,
    quantity: null,
    price: null,
    amount: null,
    fees: 0,
    currency: "AED",
    fx_rate: 1,
    trade_date: "2026-07-01",
    trade_time: null,
    purification_percentage: null,
    notes: null,
    metadata: {},
    external_ref: null,
    import_batch_id: null,
    realized_pnl: null,
    created_at: `2026-07-01T00:00:${String(txSeq).padStart(2, "0")}Z`,
    ...partial,
  };
}

let holdSeq = 0;
function holding(
  partial: Partial<Omit<HoldingView, "asset">> & {
    asset?: Partial<HoldingView["asset"]>;
  } = {}
): HoldingView {
  holdSeq += 1;
  const { asset, ...rest } = partial;
  return {
    portfolio_id: "p-1",
    asset: {
      id: `a-${holdSeq}`,
      symbol: `SYM${holdSeq}`,
      name: `Asset ${holdSeq}`,
      exchange: "DFM",
      currency: "AED",
      asset_class: "stock",
      data_tier: "automated",
      provider: null,
      provider_symbol: null,
      is_listed: true,
      ...asset,
    },
    quantity: 100,
    average_cost: 10,
    cost_basis: 1000,
    effective_price: 12,
    price_is_manual: false,
    price_as_of: "2026-07-15T08:00:00Z",
    market_value: 1200,
    unrealized_pnl: 200,
    unrealized_pnl_percent: 20,
    realized_pnl: 0,
    dividends_received: 0,
    shariah_status: "not_reviewed",
    shariah_is_override: false,
    ...rest,
  };
}

function normalize(holdings: HoldingView[], display = "AED") {
  return normalizeDisplayValues(
    holdings,
    (h) => h.asset.id,
    (h) => h.market_value,
    (h) => h.asset.currency,
    display
  );
}

describe("incomeSummary (§9.4 — ledger-true income & purification)", () => {
  it("buckets dividends into MTD and YTD on the UTC calendar", () => {
    const rows = incomeSummary(
      [
        tx({ type: "dividend", amount: 100, trade_date: "2026-07-10" }), // this month
        tx({ type: "dividend", amount: 40, trade_date: "2026-02-03" }), // this year
        tx({ type: "dividend", amount: 999, trade_date: "2025-12-30" }), // last year
      ],
      NOW
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].currency).toBe("AED");
    expect(rows[0].dividends_mtd).toBe(100);
    expect(rows[0].dividends_ytd).toBe(140);
  });

  it("purification owed = lifetime accrued − lifetime paid (never calendar-reset)", () => {
    const rows = incomeSummary(
      [
        // 250 × 20% = 50 accrued, even though it was LAST year
        tx({
          type: "dividend",
          amount: 250,
          purification_percentage: 20,
          trade_date: "2025-06-10",
        }),
        tx({ type: "purification_payment", amount: 30, trade_date: "2026-01-05" }),
      ],
      NOW
    );
    expect(rows[0].purification_accrued).toBe(50);
    expect(rows[0].purification_paid).toBe(30);
    expect(rows[0].purification_owed).toBe(20);
    expect(rows[0].dividends_ytd).toBe(0); // last year's dividend
  });

  it("keeps currencies separate and sorted; overpayment stays signed (honesty)", () => {
    const rows = incomeSummary(
      [
        tx({ type: "dividend", amount: 100, currency: "USD", trade_date: "2026-07-01" }),
        tx({ type: "purification_payment", amount: 25, currency: "AED" }),
      ],
      NOW
    );
    expect(rows.map((r) => r.currency)).toEqual(["AED", "USD"]);
    expect(rows[0].purification_owed).toBe(-25); // paid ahead — shown, not clamped
    expect(rows[1].dividends_mtd).toBe(100);
  });

  it("returns [] for a ledger with no income events", () => {
    expect(incomeSummary([tx({ type: "buy", quantity: 1, price: 5 })], NOW)).toEqual([]);
  });
});

describe("exposure grouping (§9.3 — one dimension system, one base)", () => {
  const holdings = [
    holding({
      market_value: 6000,
      asset: { id: "emaar", symbol: "EMAAR", currency: "AED", asset_class: "stock" },
    }),
    holding({
      market_value: 1000, // USD → ×3.6725 = 3,672.50 AED
      asset: { id: "aapl", symbol: "AAPL", currency: "USD", asset_class: "stock" },
    }),
    holding({
      market_value: 2000,
      asset: { id: "sukuk1", symbol: "SUKUK1", currency: "AED", asset_class: "sukuk" },
    }),
  ];
  const normalized = normalize(holdings);

  it("asset dimension: one item per symbol, in display currency", () => {
    const items = exposureItems(holdings, normalized, "asset");
    expect(items).toEqual([
      { label: "EMAAR", value: 6000 },
      { label: "AAPL", value: 3672.5 },
      { label: "SUKUK1", value: 2000 },
    ]);
  });

  it("class dimension groups display values under humane labels", () => {
    const items = exposureItems(holdings, normalized, "class");
    expect(items).toEqual([
      { label: "Stocks", value: 9672.5 },
      { label: "Sukuk", value: 2000 },
    ]);
  });

  it("currency dimension groups by native currency", () => {
    const items = exposureItems(holdings, normalized, "currency");
    expect(items).toEqual([
      { label: "AED", value: 8000 },
      { label: "USD", value: 3672.5 },
    ]);
  });

  it("skips closed positions and rows without a display value", () => {
    const mixed = [
      ...holdings,
      holding({ quantity: 0, asset: { id: "closed", symbol: "CLOSED" } }),
      holding({ market_value: null, asset: { id: "unp", symbol: "UNP" } }),
    ];
    const n = normalize(mixed);
    expect(exposureItems(mixed, n, "asset").map((i) => i.label)).toEqual([
      "EMAAR",
      "AAPL",
      "SUKUK1",
    ]);
  });

  it("names exclusions by reason — unpriced vs no FX rate", () => {
    const mixed = [
      holding({ market_value: null, asset: { id: "unp", symbol: "UNP" } }),
      holding({
        market_value: 500,
        asset: { id: "gbp", symbol: "GBPX", currency: "GBP" },
      }),
    ];
    const n = normalize(mixed);
    expect(exposureExclusions(mixed, n)).toEqual({
      unpriced: ["UNP"],
      noRate: ["GBPX (GBP)"],
    });
  });

  it("top-3 concentration matches the allocation bar's percentages exactly", () => {
    const top = topConcentration(holdings, normalized, 3);
    const segments = allocationSegments(exposureItems(holdings, normalized, "asset"));
    expect(top).toEqual(
      segments.slice(0, 3).map((s) => ({ label: s.label, percent: s.percent }))
    );
    expect(top[0]).toEqual({ label: "EMAAR", percent: 51.4 }); // 6,000 / 11,672.50
  });
});

describe("liquiditySplit (§9.3 ◇A6 — illiquidity is a risk view)", () => {
  it("splits the priced base into listed vs unlisted", () => {
    const holdings = [
      holding({ market_value: 7500, asset: { id: "l1", is_listed: true } }),
      holding({ market_value: 2500, asset: { id: "u1", is_listed: false } }),
    ];
    const split = liquiditySplit(holdings, normalize(holdings));
    expect(split).toEqual({
      listed_percent: 75,
      unlisted_percent: 25,
      listed_value: 7500,
      unlisted_value: 2500,
    });
  });

  it("returns null when nothing is priced (never a fake 100%)", () => {
    const holdings = [holding({ market_value: null, asset: { id: "unp" } })];
    expect(liquiditySplit(holdings, normalize(holdings))).toBeNull();
  });
});
