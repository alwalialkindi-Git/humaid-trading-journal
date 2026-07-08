import {
  calculatePositions,
  type EngineAsset,
  type EnginePortfolio,
  type EngineTransaction,
} from "@/lib/engine/positions";
import type { LedgerRepository } from "./repository";
import type {
  AssetOverrideRow,
  AssetRow,
  CashBalanceView,
  HoldingView,
  PortfolioSummaryView,
} from "./types";
import { ServiceError } from "./errors";

/**
 * Positions service — read models over the derived cache + live prices.
 *
 * Holdings come from the `positions` cache (engine-written); market value,
 * unrealized P&L, and allocation are joined at READ time from effective
 * prices (override.manual_price ?? asset.latest_price) so a price move never
 * requires rewriting positions. Unpriced assets are surfaced as null values
 * and an exclusion count — never silently valued at zero.
 *
 * The engine never branches on data_tier; neither does anything here —
 * manual/custom assets flow through identically (§2.4 invariant).
 */
export class PositionsService {
  constructor(private repo: LedgerRepository) {}

  private effectivePrice(
    asset: AssetRow,
    override: AssetOverrideRow | null
  ): { price: number | null; isManual: boolean; asOf: string | null } {
    if (override?.manual_price != null) {
      return { price: override.manual_price, isManual: true, asOf: override.manual_price_at };
    }
    if (asset.latest_price != null) {
      return { price: asset.latest_price, isManual: asset.price_is_manual, asOf: asset.price_as_of };
    }
    return { price: null, isManual: false, asOf: null };
  }

  async getHoldings(userId: string, portfolioId?: string): Promise<HoldingView[]> {
    const positions = await this.repo.listPositions(userId, portfolioId);
    if (positions.length === 0) return [];

    const assets = await this.repo.getAssets(positions.map((p) => p.asset_id));
    const assetById = new Map(assets.map((a) => [a.id, a]));
    const overrides = await this.repo.listOverrides(userId);
    const overrideByAsset = new Map(overrides.map((o) => [o.asset_id, o]));

    // Allocation base: priced market value per portfolio, per currency-blind
    // sum is wrong across currencies — M1 computes allocation within the
    // portfolio in ASSET currency terms only when a single currency is
    // present; mixed-currency allocation waits for FX (M2). Here: allocation
    // over holdings sharing the portfolio, computed on priced values, with
    // mixed currencies allowed but flagged by the summary's warnings.
    const holdings: HoldingView[] = [];

    for (const p of positions) {
      const asset = assetById.get(p.asset_id);
      if (!asset) continue; // orphaned cache row; rebuild tool handles it
      const override = overrideByAsset.get(p.asset_id) ?? null;
      const { price, isManual, asOf } = this.effectivePrice(asset, override);

      const marketValue = price != null ? round2(p.quantity * price) : null;
      const unrealized =
        marketValue != null ? round2(marketValue - p.cost_basis) : null;

      holdings.push({
        portfolio_id: p.portfolio_id,
        asset: {
          id: asset.id,
          symbol: asset.symbol,
          name: override?.display_name ?? asset.name,
          exchange: asset.exchange,
          currency: asset.currency,
          asset_class: asset.asset_class,
          data_tier: asset.data_tier,
        },
        quantity: p.quantity,
        average_cost: p.average_cost,
        cost_basis: p.cost_basis,
        effective_price: price,
        price_is_manual: isManual,
        price_as_of: asOf,
        market_value: marketValue,
        unrealized_pnl: unrealized,
        unrealized_pnl_percent:
          unrealized != null && p.cost_basis > 0
            ? round2((unrealized / p.cost_basis) * 100)
            : null,
        realized_pnl: p.realized_pnl,
        dividends_received: p.dividends_received,
        allocation_percent: null, // filled below once totals are known
        shariah_status: override?.shariah_status ?? "not_reviewed",
        shariah_is_override: override?.shariah_status != null,
      });
    }

    // Allocation % per portfolio over priced holdings.
    const byPortfolio = new Map<string, HoldingView[]>();
    for (const h of holdings) {
      const list = byPortfolio.get(h.portfolio_id) ?? [];
      list.push(h);
      byPortfolio.set(h.portfolio_id, list);
    }
    for (const list of byPortfolio.values()) {
      const total = list.reduce((s, h) => s + (h.market_value ?? 0), 0);
      if (total > 0) {
        for (const h of list) {
          h.allocation_percent =
            h.market_value != null ? round2((h.market_value / total) * 100) : null;
        }
      }
    }

    return holdings;
  }

  /** Cash per (portfolio, currency), derived from the ledger via the engine. */
  async getCashBalances(userId: string, portfolioId: string): Promise<CashBalanceView[]> {
    const portfolio = await this.repo.getPortfolio(userId, portfolioId);
    if (!portfolio) throw new ServiceError("Portfolio not found.", "forbidden");

    const rows = await this.repo.listTransactions(userId, { portfolioId });
    if (rows.length === 0) return [];

    const assetIds = [...new Set(rows.map((r) => r.asset_id).filter(Boolean))] as string[];
    const assets = await this.repo.getAssets(assetIds);
    const engineAssets: EngineAsset[] = assets.map((a) => ({
      id: a.id,
      currency: a.currency,
      symbol: a.symbol,
    }));
    const enginePortfolio: EnginePortfolio = {
      id: portfolio.id,
      cost_method: portfolio.cost_method,
    };
    const engineTxs: EngineTransaction[] = rows.map((r) => ({
      id: r.id,
      portfolio_id: r.portfolio_id,
      asset_id: r.asset_id,
      type: r.type,
      quantity: r.quantity,
      price: r.price,
      amount: r.amount,
      fees: r.fees,
      currency: r.currency,
      trade_date: r.trade_date,
      trade_time: r.trade_time,
      created_at: r.created_at,
    }));

    const result = calculatePositions(engineTxs, engineAssets, [enginePortfolio]);
    return result.cashBalances.map((c) => ({
      portfolio_id: c.portfolio_id,
      currency: c.currency,
      balance: c.balance,
    }));
  }

  async getPortfolioSummary(
    userId: string,
    portfolioId: string
  ): Promise<PortfolioSummaryView> {
    const portfolio = await this.repo.getPortfolio(userId, portfolioId);
    if (!portfolio) throw new ServiceError("Portfolio not found.", "forbidden");

    const holdings = await this.getHoldings(userId, portfolioId);
    const cash = await this.getCashBalances(userId, portfolioId);

    const sumBy = (fn: (h: HoldingView) => number | null): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const h of holdings) {
        const v = fn(h);
        if (v == null) continue;
        out[h.asset.currency] = round2((out[h.asset.currency] ?? 0) + v);
      }
      return out;
    };

    const warnings: string[] = [];
    const unpriced = holdings.filter(
      (h) => h.quantity > 0 && h.effective_price == null
    ).length;
    if (unpriced > 0) {
      warnings.push(
        `${unpriced} holding${unpriced > 1 ? "s are" : " is"} unpriced and excluded from totals — set a manual price.`
      );
    }
    for (const c of cash) {
      if (c.balance < 0) {
        warnings.push(
          `Cash in ${c.currency} is negative (${c.balance}). Add a deposit or opening balance.`
        );
      }
    }
    const currencies = new Set(holdings.map((h) => h.asset.currency));
    if (currencies.size > 1) {
      warnings.push(
        "Holdings span multiple currencies; totals are per currency until FX conversion lands (M2)."
      );
    }

    return {
      portfolio,
      holdings,
      cash,
      totals: {
        market_value_by_currency: sumBy((h) => h.market_value),
        cost_basis_by_currency: sumBy((h) => h.cost_basis),
        realized_pnl_by_currency: sumBy((h) => h.realized_pnl),
        dividends_by_currency: sumBy((h) => h.dividends_received),
        unpriced_holdings: unpriced,
      },
      warnings,
    };
  }
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
