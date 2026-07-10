/**
 * Service-layer types — rows mirroring supabase/migrations/002_ledger.sql
 * plus input DTOs and read models. The UI consumes THESE shapes; it never
 * touches ledger tables directly.
 */

import type { CostMethod, TransactionType } from "@/lib/engine/positions";
import type { AssetClass } from "@/lib/market-data/types";

// ---------------------------------------------------------------------------
// Rows (DB shapes)
// ---------------------------------------------------------------------------

export type DataTier = "automated" | "semi_automated" | "manual_custom";

export interface AssetRow {
  id: string;
  symbol: string;
  exchange: string;
  name: string;
  currency: string;
  asset_class: AssetClass;
  data_tier: DataTier;
  isin: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
  is_listed: boolean;
  provider: string | null;
  provider_symbol: string | null;
  latest_price: number | null;
  price_as_of: string | null;
  price_is_manual: boolean;
  metadata: Record<string, unknown>;
  created_by: string | null;
}

export interface AssetOverrideRow {
  id: string;
  user_id: string;
  asset_id: string;
  display_name: string | null;
  sector: string | null;
  manual_price: number | null;
  manual_price_at: string | null;
  shariah_status: "compliant" | "doubtful" | "non_compliant" | "not_reviewed" | null;
  override_reason: string | null;
}

export interface PortfolioRow {
  id: string;
  user_id: string;
  name: string;
  base_currency: string;
  cost_method: CostMethod;
  is_default: boolean;
  is_archived: boolean;
}

export interface BrokerRow {
  id: string;
  user_id: string;
  name: string;
  country: string | null;
  account_number: string | null;
  account_currency: string;
  notes: string | null;
}

export interface TransactionRow {
  id: string;
  user_id: string;
  portfolio_id: string;
  broker_id: string | null;
  asset_id: string | null;
  type: TransactionType;
  quantity: number | null;
  price: number | null;
  amount: number | null;
  fees: number;
  currency: string;
  fx_rate: number;
  trade_date: string;
  trade_time: string | null;
  purification_percentage: number | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  external_ref: string | null;
  import_batch_id: string | null;
  realized_pnl: number | null;
  created_at: string;
}

export interface PositionRow {
  id?: string;
  user_id: string;
  portfolio_id: string;
  asset_id: string;
  quantity: number;
  average_cost: number;
  cost_basis: number;
  realized_pnl: number;
  dividends_received: number;
  first_acquired_at: string | null;
  last_transaction_at: string | null;
}

// ---------------------------------------------------------------------------
// Inputs (DTOs)
// ---------------------------------------------------------------------------

export interface TransactionInput {
  portfolio_id: string;
  broker_id?: string | null;
  asset_id?: string | null;
  type: TransactionType;
  quantity?: number | null;
  price?: number | null;
  amount?: number | null;
  fees?: number;
  currency: string;
  trade_date: string;
  trade_time?: string | null;
  purification_percentage?: number | null;
  notes?: string | null;
  external_ref?: string | null;
}

export interface CustomAssetInput {
  symbol: string;
  name: string;
  exchange: string; // 'ADX', 'DFM', '' for private assets
  currency: string;
  asset_class?: AssetClass;
  sector?: string | null;
  industry?: string | null;
  country?: string | null;
  isin?: string | null;
  latest_price?: number | null;
  price_as_of?: string | null;
  price_source_note?: string | null;
}

// ---------------------------------------------------------------------------
// Read models
// ---------------------------------------------------------------------------

/** One computed holding as the Portfolio UI will consume it. */
export interface HoldingView {
  portfolio_id: string;
  asset: {
    id: string;
    symbol: string;
    name: string; // override.display_name ?? asset.name
    exchange: string;
    currency: string;
    asset_class: AssetClass;
    data_tier: DataTier;
    provider: string | null;
    provider_symbol: string | null;
  };
  quantity: number;
  average_cost: number;
  cost_basis: number;
  /** override.manual_price ?? asset.latest_price — null when unpriced. */
  effective_price: number | null;
  price_is_manual: boolean;
  price_as_of: string | null;
  market_value: number | null; // null when unpriced (never silently 0)
  unrealized_pnl: number | null;
  unrealized_pnl_percent: number | null;
  realized_pnl: number;
  dividends_received: number;
  /** Share of the portfolio's priced market value; null when unpriced. */
  allocation_percent: number | null;
  /** M1: from the user's override only; the M3 screening engine replaces this. */
  shariah_status: "compliant" | "doubtful" | "non_compliant" | "not_reviewed";
  shariah_is_override: boolean;
}

export interface CashBalanceView {
  portfolio_id: string;
  currency: string;
  balance: number;
}

/**
 * Per-currency financial truth (shared read model — Bug 2/3 fix).
 * One row per NATIVE currency; nothing here is FX-converted (conversion is
 * presentation-layer). The equations these fields must satisfy are tested:
 *   total_value        = market_value + cash
 *   unrealized_pnl     = market_value − cost_basis_priced
 *   market_value       = Σ qty × effective_price over PRICED open holdings
 */
export interface CurrencySummaryRow {
  currency: string;
  market_value: number;
  cash: number;
  total_value: number;
  /** Cost basis of ALL open holdings in this currency (priced or not). */
  cost_basis: number;
  /** Cost basis of the PRICED subset — the base of unrealized_pnl. */
  cost_basis_priced: number;
  unrealized_pnl: number;
  realized_pnl: number;
  dividends: number;
  unpriced_holdings: number;
  /** Latest price timestamp among holdings in this currency. */
  as_of: string | null;
}

export interface WealthSummaryView {
  portfolio: PortfolioRow;
  rows: CurrencySummaryRow[];
  negative_cash_currencies: string[];
  unpriced_total: number;
}

export interface PortfolioSummaryView {
  portfolio: PortfolioRow;
  holdings: HoldingView[];
  cash: CashBalanceView[];
  totals: {
    /** Sum of priced holdings only, in ASSET currencies mixed — see note. */
    market_value_by_currency: Record<string, number>;
    cost_basis_by_currency: Record<string, number>;
    realized_pnl_by_currency: Record<string, number>;
    dividends_by_currency: Record<string, number>;
    unpriced_holdings: number; // count excluded from totals, surfaced in UI
  };
  warnings: string[];
}
