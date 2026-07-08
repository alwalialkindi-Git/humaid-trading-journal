import type { SupabaseClient } from "@supabase/supabase-js";
import type { LedgerRepository, TransactionFilter } from "./repository";
import type {
  AssetOverrideRow,
  AssetRow,
  BrokerRow,
  PortfolioRow,
  PositionRow,
  TransactionRow,
} from "./types";
import { ServiceError } from "./errors";

/**
 * Supabase-backed LedgerRepository.
 *
 * Two clients by design:
 *  - `db`: the user-scoped server client (RLS enforced) — all per-user tables.
 *  - `admin`: service-role client — ONLY `assets` writes and `positions`
 *    writes (the two surfaces clients cannot write; M1 doc §1.2/§1.8).
 *
 * SERVER-SIDE ONLY — never import from client components.
 */
export class SupabaseRepository implements LedgerRepository {
  constructor(
    private db: SupabaseClient,
    private admin: SupabaseClient
  ) {}

  private static unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
    if (res.error) throw new ServiceError(res.error.message, "conflict");
    if (res.data == null) throw new ServiceError("No data returned", "not_found");
    return res.data;
  }

  // -- portfolios -----------------------------------------------------------

  async listPortfolios(userId: string): Promise<PortfolioRow[]> {
    const res = await this.db
      .from("portfolios")
      .select("*")
      .eq("user_id", userId)
      .order("created_at");
    return (res.data ?? []) as PortfolioRow[];
  }

  async getPortfolio(userId: string, id: string): Promise<PortfolioRow | null> {
    const res = await this.db
      .from("portfolios")
      .select("*")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();
    return (res.data ?? null) as PortfolioRow | null;
  }

  async insertPortfolio(row: Omit<PortfolioRow, "id">): Promise<PortfolioRow> {
    const res = await this.db.from("portfolios").insert(row).select().single();
    return SupabaseRepository.unwrap(res) as PortfolioRow;
  }

  async updatePortfolio(
    userId: string,
    id: string,
    patch: Partial<Pick<PortfolioRow, "name" | "base_currency" | "is_archived">>
  ): Promise<PortfolioRow> {
    const res = await this.db
      .from("portfolios")
      .update(patch)
      .eq("user_id", userId)
      .eq("id", id)
      .select()
      .single();
    return SupabaseRepository.unwrap(res) as PortfolioRow;
  }

  // -- brokers --------------------------------------------------------------

  async listBrokers(userId: string): Promise<BrokerRow[]> {
    const res = await this.db
      .from("brokers")
      .select("*")
      .eq("user_id", userId)
      .order("created_at");
    return (res.data ?? []) as BrokerRow[];
  }

  async getBroker(userId: string, id: string): Promise<BrokerRow | null> {
    const res = await this.db
      .from("brokers")
      .select("*")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();
    return (res.data ?? null) as BrokerRow | null;
  }

  async insertBroker(row: Omit<BrokerRow, "id">): Promise<BrokerRow> {
    const res = await this.db.from("brokers").insert(row).select().single();
    return SupabaseRepository.unwrap(res) as BrokerRow;
  }

  async updateBroker(
    userId: string,
    id: string,
    patch: Partial<Omit<BrokerRow, "id" | "user_id">>
  ): Promise<BrokerRow> {
    const res = await this.db
      .from("brokers")
      .update(patch)
      .eq("user_id", userId)
      .eq("id", id)
      .select()
      .single();
    return SupabaseRepository.unwrap(res) as BrokerRow;
  }

  async deleteBroker(userId: string, id: string): Promise<void> {
    const res = await this.db.from("brokers").delete().eq("user_id", userId).eq("id", id);
    if (res.error) throw new ServiceError(res.error.message, "conflict");
  }

  // -- transactions ----------------------------------------------------------

  async listTransactions(
    userId: string,
    filter: TransactionFilter = {}
  ): Promise<TransactionRow[]> {
    let query = this.db.from("transactions").select("*").eq("user_id", userId);
    if (filter.portfolioId) query = query.eq("portfolio_id", filter.portfolioId);
    if (filter.assetId) query = query.eq("asset_id", filter.assetId);
    if (filter.brokerId) query = query.eq("broker_id", filter.brokerId);
    if (filter.types?.length) query = query.in("type", filter.types);
    const res = await query
      .order("trade_date", { ascending: true })
      .order("created_at", { ascending: true });
    return (res.data ?? []) as TransactionRow[];
  }

  async getTransaction(userId: string, id: string): Promise<TransactionRow | null> {
    const res = await this.db
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();
    return (res.data ?? null) as TransactionRow | null;
  }

  async insertTransaction(
    row: Omit<TransactionRow, "id" | "created_at" | "realized_pnl">
  ): Promise<TransactionRow> {
    const res = await this.db.from("transactions").insert(row).select().single();
    return SupabaseRepository.unwrap(res) as TransactionRow;
  }

  async updateTransaction(
    userId: string,
    id: string,
    patch: Partial<Omit<TransactionRow, "id" | "user_id" | "created_at">>
  ): Promise<TransactionRow> {
    const res = await this.db
      .from("transactions")
      .update(patch)
      .eq("user_id", userId)
      .eq("id", id)
      .select()
      .single();
    return SupabaseRepository.unwrap(res) as TransactionRow;
  }

  async deleteTransaction(userId: string, id: string): Promise<void> {
    const res = await this.db
      .from("transactions")
      .delete()
      .eq("user_id", userId)
      .eq("id", id);
    if (res.error) throw new ServiceError(res.error.message, "conflict");
  }

  async setRealizedPnl(userId: string, id: string, realizedPnl: number | null): Promise<void> {
    const res = await this.db
      .from("transactions")
      .update({ realized_pnl: realizedPnl })
      .eq("user_id", userId)
      .eq("id", id);
    if (res.error) throw new ServiceError(res.error.message, "conflict");
  }

  // -- positions (service-role writes) ---------------------------------------

  async listPositions(userId: string, portfolioId?: string): Promise<PositionRow[]> {
    let query = this.db.from("positions").select("*").eq("user_id", userId);
    if (portfolioId) query = query.eq("portfolio_id", portfolioId);
    const res = await query;
    return (res.data ?? []) as PositionRow[];
  }

  async upsertPosition(row: PositionRow): Promise<void> {
    const res = await this.admin
      .from("positions")
      .upsert({ ...row, computed_at: new Date().toISOString() }, { onConflict: "portfolio_id,asset_id" });
    if (res.error) throw new ServiceError(res.error.message, "conflict");
  }

  async deletePosition(userId: string, portfolioId: string, assetId: string): Promise<void> {
    const res = await this.admin
      .from("positions")
      .delete()
      .eq("user_id", userId)
      .eq("portfolio_id", portfolioId)
      .eq("asset_id", assetId);
    if (res.error) throw new ServiceError(res.error.message, "conflict");
  }

  // -- assets (service-role writes) -------------------------------------------

  async getAsset(id: string): Promise<AssetRow | null> {
    const res = await this.db.from("assets").select("*").eq("id", id).maybeSingle();
    return (res.data ?? null) as AssetRow | null;
  }

  async getAssets(ids: string[]): Promise<AssetRow[]> {
    if (ids.length === 0) return [];
    const res = await this.db.from("assets").select("*").in("id", ids);
    return (res.data ?? []) as AssetRow[];
  }

  async findAssetBySymbolExchange(symbol: string, exchange: string): Promise<AssetRow | null> {
    const res = await this.db
      .from("assets")
      .select("*")
      .eq("symbol", symbol)
      .eq("exchange", exchange)
      .maybeSingle();
    return (res.data ?? null) as AssetRow | null;
  }

  async insertAsset(row: Omit<AssetRow, "id">): Promise<AssetRow> {
    const res = await this.admin.from("assets").insert(row).select().single();
    return SupabaseRepository.unwrap(res) as AssetRow;
  }

  async updateAsset(id: string, patch: Partial<Omit<AssetRow, "id">>): Promise<AssetRow> {
    const res = await this.admin.from("assets").update(patch).eq("id", id).select().single();
    return SupabaseRepository.unwrap(res) as AssetRow;
  }

  // -- overrides ---------------------------------------------------------------

  async getOverride(userId: string, assetId: string): Promise<AssetOverrideRow | null> {
    const res = await this.db
      .from("asset_overrides")
      .select("*")
      .eq("user_id", userId)
      .eq("asset_id", assetId)
      .maybeSingle();
    return (res.data ?? null) as AssetOverrideRow | null;
  }

  async listOverrides(userId: string): Promise<AssetOverrideRow[]> {
    const res = await this.db.from("asset_overrides").select("*").eq("user_id", userId);
    return (res.data ?? []) as AssetOverrideRow[];
  }

  async upsertOverride(row: Omit<AssetOverrideRow, "id">): Promise<AssetOverrideRow> {
    const res = await this.db
      .from("asset_overrides")
      .upsert(row, { onConflict: "user_id,asset_id" })
      .select()
      .single();
    return SupabaseRepository.unwrap(res) as AssetOverrideRow;
  }

  async deleteOverride(userId: string, assetId: string): Promise<void> {
    const res = await this.db
      .from("asset_overrides")
      .delete()
      .eq("user_id", userId)
      .eq("asset_id", assetId);
    if (res.error) throw new ServiceError(res.error.message, "conflict");
  }
}
