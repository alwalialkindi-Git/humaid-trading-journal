import type { LedgerRepository, TransactionFilter } from "../repository";
import type {
  AssetOverrideRow,
  AssetRow,
  BrokerRow,
  PortfolioRow,
  PositionRow,
  TransactionRow,
} from "../types";
import { ServiceError } from "../errors";

/**
 * In-memory LedgerRepository for tests. Behaviorally equivalent to the
 * Supabase repository for what the services rely on: per-user scoping,
 * (symbol, exchange) asset uniqueness, (portfolio, asset) position upsert.
 */
export class InMemoryRepository implements LedgerRepository {
  portfolios: PortfolioRow[] = [];
  brokers: BrokerRow[] = [];
  transactions: TransactionRow[] = [];
  positions: PositionRow[] = [];
  assets: AssetRow[] = [];
  overrides: AssetOverrideRow[] = [];

  private seq = 0;
  private id(prefix: string): string {
    return `${prefix}-${++this.seq}`;
  }
  private now(): string {
    return new Date(2026, 0, 1, 0, 0, this.seq).toISOString();
  }

  // -- portfolios -----------------------------------------------------------

  async listPortfolios(userId: string) {
    return this.portfolios.filter((p) => p.user_id === userId);
  }
  async getPortfolio(userId: string, id: string) {
    return this.portfolios.find((p) => p.user_id === userId && p.id === id) ?? null;
  }
  async insertPortfolio(row: Omit<PortfolioRow, "id">) {
    const full = { ...row, id: this.id("pf") };
    this.portfolios.push(full);
    return full;
  }
  async updatePortfolio(
    userId: string,
    id: string,
    patch: Partial<Pick<PortfolioRow, "name" | "base_currency" | "is_archived">>
  ) {
    const row = await this.getPortfolio(userId, id);
    if (!row) throw new ServiceError("Portfolio not found", "not_found");
    Object.assign(row, patch);
    return row;
  }

  // -- brokers ---------------------------------------------------------------

  async listBrokers(userId: string) {
    return this.brokers.filter((b) => b.user_id === userId);
  }
  async getBroker(userId: string, id: string) {
    return this.brokers.find((b) => b.user_id === userId && b.id === id) ?? null;
  }
  async insertBroker(row: Omit<BrokerRow, "id">) {
    const full = { ...row, id: this.id("br") };
    this.brokers.push(full);
    return full;
  }
  async updateBroker(userId: string, id: string, patch: Partial<Omit<BrokerRow, "id" | "user_id">>) {
    const row = await this.getBroker(userId, id);
    if (!row) throw new ServiceError("Broker not found", "not_found");
    Object.assign(row, patch);
    return row;
  }
  async deleteBroker(userId: string, id: string) {
    this.brokers = this.brokers.filter((b) => !(b.user_id === userId && b.id === id));
    for (const t of this.transactions) {
      if (t.broker_id === id) t.broker_id = null; // mirrors ON DELETE SET NULL
    }
  }

  // -- transactions ------------------------------------------------------------

  async listTransactions(userId: string, filter: TransactionFilter = {}) {
    return this.transactions
      .filter(
        (t) =>
          t.user_id === userId &&
          (!filter.portfolioId || t.portfolio_id === filter.portfolioId) &&
          (!filter.assetId || t.asset_id === filter.assetId) &&
          (!filter.brokerId || t.broker_id === filter.brokerId) &&
          (!filter.types || filter.types.includes(t.type))
      )
      .sort((a, b) =>
        a.trade_date === b.trade_date
          ? a.created_at.localeCompare(b.created_at)
          : a.trade_date.localeCompare(b.trade_date)
      );
  }
  async getTransaction(userId: string, id: string) {
    return this.transactions.find((t) => t.user_id === userId && t.id === id) ?? null;
  }
  async insertTransaction(row: Omit<TransactionRow, "id" | "created_at" | "realized_pnl">) {
    if (row.external_ref) {
      const dup = this.transactions.find(
        (t) => t.portfolio_id === row.portfolio_id && t.external_ref === row.external_ref
      );
      if (dup) throw new ServiceError("duplicate external_ref", "conflict");
    }
    const full: TransactionRow = {
      ...row,
      id: this.id("tx"),
      created_at: this.now(),
      realized_pnl: null,
    };
    this.transactions.push(full);
    return full;
  }
  async updateTransaction(
    userId: string,
    id: string,
    patch: Partial<Omit<TransactionRow, "id" | "user_id" | "created_at">>
  ) {
    const row = await this.getTransaction(userId, id);
    if (!row) throw new ServiceError("Transaction not found", "not_found");
    Object.assign(row, patch);
    return row;
  }
  async deleteTransaction(userId: string, id: string) {
    this.transactions = this.transactions.filter(
      (t) => !(t.user_id === userId && t.id === id)
    );
  }
  async setRealizedPnl(userId: string, id: string, realizedPnl: number | null) {
    const row = await this.getTransaction(userId, id);
    if (row) row.realized_pnl = realizedPnl;
  }

  // -- positions ----------------------------------------------------------------

  async listPositions(userId: string, portfolioId?: string) {
    return this.positions.filter(
      (p) => p.user_id === userId && (!portfolioId || p.portfolio_id === portfolioId)
    );
  }
  async upsertPosition(row: PositionRow) {
    const existing = this.positions.find(
      (p) => p.portfolio_id === row.portfolio_id && p.asset_id === row.asset_id
    );
    if (existing) Object.assign(existing, row);
    else this.positions.push({ ...row, id: this.id("pos") });
  }
  async deletePosition(userId: string, portfolioId: string, assetId: string) {
    this.positions = this.positions.filter(
      (p) =>
        !(p.user_id === userId && p.portfolio_id === portfolioId && p.asset_id === assetId)
    );
  }

  // -- assets ----------------------------------------------------------------------

  async getAsset(id: string) {
    return this.assets.find((a) => a.id === id) ?? null;
  }
  async getAssets(ids: string[]) {
    return this.assets.filter((a) => ids.includes(a.id));
  }
  async findAssetBySymbolExchange(symbol: string, exchange: string) {
    return (
      this.assets.find((a) => a.symbol === symbol && a.exchange === exchange) ?? null
    );
  }
  async insertAsset(row: Omit<AssetRow, "id">) {
    const dup = await this.findAssetBySymbolExchange(row.symbol, row.exchange);
    if (dup) throw new ServiceError("duplicate (symbol, exchange)", "conflict");
    const full = { ...row, id: this.id("asset") };
    this.assets.push(full);
    return full;
  }
  async updateAsset(id: string, patch: Partial<Omit<AssetRow, "id">>) {
    const row = await this.getAsset(id);
    if (!row) throw new ServiceError("Asset not found", "not_found");
    Object.assign(row, patch);
    return row;
  }

  // -- overrides ----------------------------------------------------------------------

  async getOverride(userId: string, assetId: string) {
    return (
      this.overrides.find((o) => o.user_id === userId && o.asset_id === assetId) ?? null
    );
  }
  async listOverrides(userId: string) {
    return this.overrides.filter((o) => o.user_id === userId);
  }
  async upsertOverride(row: Omit<AssetOverrideRow, "id">) {
    const existing = await this.getOverride(row.user_id, row.asset_id);
    if (existing) {
      Object.assign(existing, row);
      return existing;
    }
    const full = { ...row, id: this.id("ov") };
    this.overrides.push(full);
    return full;
  }
  async deleteOverride(userId: string, assetId: string) {
    this.overrides = this.overrides.filter(
      (o) => !(o.user_id === userId && o.asset_id === assetId)
    );
  }
}
