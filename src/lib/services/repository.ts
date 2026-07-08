/**
 * LedgerRepository — the data-access boundary of the service layer.
 *
 * Two implementations:
 *  - SupabaseRepository (runtime): user-scoped client for RLS tables, admin
 *    (service-role) client ONLY for global `assets` writes and the derived
 *    `positions` cache.
 *  - InMemoryRepository (tests): behaviorally equivalent for what services
 *    rely on (per-user scoping, uniqueness), letting business rules be tested
 *    without a database.
 *
 * Every method that touches user data takes `userId` and scopes to it —
 * services validate ownership on top, RLS enforces it underneath.
 */

import type {
  AssetOverrideRow,
  AssetRow,
  BrokerRow,
  PortfolioRow,
  PositionRow,
  TransactionRow,
} from "./types";

export interface TransactionFilter {
  portfolioId?: string;
  assetId?: string;
  brokerId?: string;
  types?: TransactionRow["type"][];
}

export interface LedgerRepository {
  // portfolios
  listPortfolios(userId: string): Promise<PortfolioRow[]>;
  getPortfolio(userId: string, id: string): Promise<PortfolioRow | null>;
  insertPortfolio(row: Omit<PortfolioRow, "id">): Promise<PortfolioRow>;
  updatePortfolio(
    userId: string,
    id: string,
    patch: Partial<Pick<PortfolioRow, "name" | "base_currency" | "is_archived">>
  ): Promise<PortfolioRow>;

  // brokers
  listBrokers(userId: string): Promise<BrokerRow[]>;
  getBroker(userId: string, id: string): Promise<BrokerRow | null>;
  insertBroker(row: Omit<BrokerRow, "id">): Promise<BrokerRow>;
  updateBroker(
    userId: string,
    id: string,
    patch: Partial<Omit<BrokerRow, "id" | "user_id">>
  ): Promise<BrokerRow>;
  deleteBroker(userId: string, id: string): Promise<void>;

  // transactions
  listTransactions(userId: string, filter?: TransactionFilter): Promise<TransactionRow[]>;
  getTransaction(userId: string, id: string): Promise<TransactionRow | null>;
  insertTransaction(
    row: Omit<TransactionRow, "id" | "created_at" | "realized_pnl">
  ): Promise<TransactionRow>;
  updateTransaction(
    userId: string,
    id: string,
    patch: Partial<Omit<TransactionRow, "id" | "user_id" | "created_at">>
  ): Promise<TransactionRow>;
  deleteTransaction(userId: string, id: string): Promise<void>;
  /** Engine-written cache field; set after recompute. */
  setRealizedPnl(userId: string, id: string, realizedPnl: number | null): Promise<void>;

  // positions (derived cache — service-role writes at runtime)
  listPositions(userId: string, portfolioId?: string): Promise<PositionRow[]>;
  upsertPosition(row: PositionRow): Promise<void>;
  deletePosition(userId: string, portfolioId: string, assetId: string): Promise<void>;

  // assets (global — service-role writes at runtime)
  getAsset(id: string): Promise<AssetRow | null>;
  getAssets(ids: string[]): Promise<AssetRow[]>;
  findAssetBySymbolExchange(symbol: string, exchange: string): Promise<AssetRow | null>;
  insertAsset(row: Omit<AssetRow, "id">): Promise<AssetRow>;
  updateAsset(id: string, patch: Partial<Omit<AssetRow, "id">>): Promise<AssetRow>;

  // asset overrides (per user)
  getOverride(userId: string, assetId: string): Promise<AssetOverrideRow | null>;
  listOverrides(userId: string): Promise<AssetOverrideRow[]>;
  upsertOverride(row: Omit<AssetOverrideRow, "id">): Promise<AssetOverrideRow>;
  deleteOverride(userId: string, assetId: string): Promise<void>;
}
