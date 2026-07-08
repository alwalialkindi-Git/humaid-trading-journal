import { z } from "zod";
import {
  calculatePositions,
  EngineError,
  type EngineAsset,
  type EnginePortfolio,
  type EngineTransaction,
} from "@/lib/engine/positions";
import type { LedgerRepository, TransactionFilter } from "./repository";
import type { PortfolioRow, TransactionInput, TransactionRow } from "./types";
import { ServiceError } from "./errors";

/**
 * Transactions service — every ledger mutation flows through here.
 *
 * Correctness pattern: **validate by trial recompute**. Before persisting any
 * create/update/delete, the service replays the affected (portfolio, asset)
 * ledger WITH the proposed change through the deterministic engine. If the
 * engine rejects it (oversell, malformed row), nothing is persisted and the
 * caller gets a ServiceError('engine_rejected'). After persisting, the same
 * engine result updates the positions cache and per-sell realized_pnl — the
 * cache can never disagree with the engine.
 */

const ASSET_TYPES = ["buy", "sell", "dividend", "adjustment"] as const;
const CASH_TYPES = [
  "deposit",
  "withdrawal",
  "fee",
  "zakat_payment",
  "purification_payment",
] as const;
/** In the schema but service-gated until their engine strategies ship (M1 doc §11). */
const GATED_TYPES = ["split", "transfer_in", "transfer_out"] as const;

const baseSchema = z.object({
  portfolio_id: z.string().min(1),
  broker_id: z.string().min(1).nullish(),
  currency: z.string().trim().min(3).max(3),
  trade_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "trade_date must be YYYY-MM-DD"),
  trade_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "trade_time must be HH:MM[:SS]")
    .nullish(),
  fees: z.coerce.number().min(0).default(0),
  notes: z.string().max(2000).nullish(),
  external_ref: z.string().max(120).nullish(),
});

const tradeSchema = baseSchema.extend({
  type: z.enum(["buy", "sell"]),
  asset_id: z.string().min(1),
  quantity: z.coerce.number().positive("quantity must be positive"),
  price: z.coerce.number().min(0, "price cannot be negative"),
});

const dividendSchema = baseSchema.extend({
  type: z.literal("dividend"),
  asset_id: z.string().min(1),
  amount: z.coerce.number().positive("amount must be positive"),
  purification_percentage: z.coerce.number().min(0).max(100).nullish(),
});

const adjustmentSchema = baseSchema.extend({
  type: z.literal("adjustment"),
  asset_id: z.string().min(1),
  quantity: z.coerce
    .number()
    .refine((v) => v !== 0, "adjustment quantity cannot be zero"),
  price: z.coerce.number().min(0).default(0),
});

const cashSchema = baseSchema.extend({
  type: z.enum(CASH_TYPES),
  amount: z.coerce.number().positive("amount must be positive"),
});

export class TransactionsService {
  constructor(private repo: LedgerRepository) {}

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  /** Shape validation mirroring the DB tx_shape constraint, with messages. */
  private parseInput(input: TransactionInput) {
    if ((GATED_TYPES as readonly string[]).includes(input.type)) {
      throw new ServiceError(
        `Transaction type '${input.type}' is reserved and not enabled yet ` +
          `(corporate actions / transfers ship in a later milestone).`,
        "validation"
      );
    }
    const schema = (ASSET_TYPES as readonly string[]).includes(input.type)
      ? input.type === "dividend"
        ? dividendSchema
        : input.type === "adjustment"
          ? adjustmentSchema
          : tradeSchema
      : (CASH_TYPES as readonly string[]).includes(input.type)
        ? cashSchema
        : null;
    if (!schema) {
      throw new ServiceError(`Unknown transaction type '${input.type}'.`, "validation");
    }
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new ServiceError(
        `${String(first.path.join("."))}: ${first.message}`,
        "validation"
      );
    }
    return parsed.data;
  }

  /** Ownership checks — the service layer trusts nothing the caller sends. */
  private async assertOwnership(
    userId: string,
    portfolioId: string,
    brokerId: string | null | undefined,
    assetId: string | null | undefined
  ): Promise<PortfolioRow> {
    const portfolio = await this.repo.getPortfolio(userId, portfolioId);
    if (!portfolio) {
      throw new ServiceError("Portfolio not found or not yours.", "forbidden");
    }
    if (brokerId) {
      const broker = await this.repo.getBroker(userId, brokerId);
      if (!broker) {
        throw new ServiceError("Broker not found or not yours.", "forbidden");
      }
    }
    if (assetId) {
      const asset = await this.repo.getAsset(assetId);
      if (!asset) throw new ServiceError("Asset not found.", "not_found");
    }
    return portfolio;
  }

  // -------------------------------------------------------------------------
  // Recompute (trial + persist) — shared by create/update/delete
  // -------------------------------------------------------------------------

  private toEngineTx(row: TransactionRow): EngineTransaction {
    return {
      id: row.id,
      portfolio_id: row.portfolio_id,
      asset_id: row.asset_id,
      type: row.type,
      quantity: row.quantity,
      price: row.price,
      amount: row.amount,
      fees: row.fees,
      currency: row.currency,
      trade_date: row.trade_date,
      trade_time: row.trade_time,
      created_at: row.created_at,
    };
  }

  /**
   * Replay one (portfolio, asset) pair over the given ledger rows.
   * Throws ServiceError('engine_rejected') when the engine refuses.
   */
  private async replayPair(
    userId: string,
    portfolio: PortfolioRow,
    assetId: string,
    rows: TransactionRow[]
  ) {
    const asset = await this.repo.getAsset(assetId);
    if (!asset) throw new ServiceError("Asset not found.", "not_found");
    const enginePortfolio: EnginePortfolio = {
      id: portfolio.id,
      cost_method: portfolio.cost_method,
    };
    const engineAsset: EngineAsset = {
      id: asset.id,
      currency: asset.currency,
      symbol: asset.symbol,
    };
    try {
      return calculatePositions(
        rows.map((r) => this.toEngineTx(r)),
        [engineAsset],
        [enginePortfolio]
      );
    } catch (e) {
      if (e instanceof EngineError) {
        throw new ServiceError(e.message, "engine_rejected");
      }
      throw e;
    }
  }

  /** Recompute the cache for a pair from the PERSISTED ledger and write it. */
  private async persistRecompute(
    userId: string,
    portfolio: PortfolioRow,
    assetId: string
  ): Promise<void> {
    const rows = await this.repo.listTransactions(userId, {
      portfolioId: portfolio.id,
      assetId,
    });
    if (rows.length === 0) {
      await this.repo.deletePosition(userId, portfolio.id, assetId);
      return;
    }
    const result = await this.replayPair(userId, portfolio, assetId, rows);
    const position = result.positions.find(
      (p) => p.portfolio_id === portfolio.id && p.asset_id === assetId
    );
    if (position) {
      await this.repo.upsertPosition({
        user_id: userId,
        portfolio_id: portfolio.id,
        asset_id: assetId,
        quantity: position.quantity,
        average_cost: position.average_cost,
        cost_basis: position.cost_basis,
        realized_pnl: position.realized_pnl,
        dividends_received: position.dividends_received,
        first_acquired_at: position.first_acquired_at,
        last_transaction_at: position.last_transaction_at,
      });
    }
    // Sync the engine-written realized_pnl cache on sell rows.
    for (const row of rows) {
      if (row.type !== "sell") continue;
      const realized = result.realizedPnlByTransaction.get(row.id) ?? null;
      if (row.realized_pnl !== realized) {
        await this.repo.setRealizedPnl(userId, row.id, realized);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  async list(userId: string, filter?: TransactionFilter): Promise<TransactionRow[]> {
    return this.repo.listTransactions(userId, filter);
  }

  async create(userId: string, input: TransactionInput): Promise<TransactionRow> {
    const data = this.parseInput(input);
    const portfolio = await this.assertOwnership(
      userId,
      data.portfolio_id,
      data.broker_id,
      "asset_id" in data ? data.asset_id : null
    );

    const row: Omit<TransactionRow, "id" | "created_at" | "realized_pnl"> = {
      user_id: userId,
      portfolio_id: data.portfolio_id,
      broker_id: data.broker_id ?? null,
      asset_id: "asset_id" in data ? data.asset_id : null,
      type: data.type,
      quantity: "quantity" in data ? data.quantity : null,
      price: "price" in data ? data.price : null,
      amount: "amount" in data ? data.amount : null,
      fees: data.fees,
      currency: data.currency.toUpperCase(),
      fx_rate: 1,
      trade_date: data.trade_date,
      trade_time: data.trade_time ?? null,
      purification_percentage:
        "purification_percentage" in data ? (data.purification_percentage ?? 0) : null,
      notes: data.notes ?? null,
      metadata: {},
      external_ref: data.external_ref ?? null,
      import_batch_id: null,
    };

    // Trial recompute BEFORE persisting: existing pair ledger + proposed row.
    if (row.asset_id) {
      const existing = await this.repo.listTransactions(userId, {
        portfolioId: row.portfolio_id,
        assetId: row.asset_id,
      });
      const proposed: TransactionRow = {
        ...row,
        id: "__proposed__",
        created_at: "9999-12-31T23:59:59.999Z", // last within its trade moment
        realized_pnl: null,
      };
      await this.replayPair(userId, portfolio, row.asset_id, [...existing, proposed]);
    }

    const inserted = await this.repo.insertTransaction(row);
    if (inserted.asset_id) {
      await this.persistRecompute(userId, portfolio, inserted.asset_id);
    }
    return (await this.repo.getTransaction(userId, inserted.id)) ?? inserted;
  }

  async update(
    userId: string,
    id: string,
    input: TransactionInput
  ): Promise<TransactionRow> {
    const existing = await this.repo.getTransaction(userId, id);
    if (!existing) throw new ServiceError("Transaction not found.", "not_found");

    const data = this.parseInput(input);
    const portfolio = await this.assertOwnership(
      userId,
      data.portfolio_id,
      data.broker_id,
      "asset_id" in data ? data.asset_id : null
    );

    const patch: Partial<Omit<TransactionRow, "id" | "user_id" | "created_at">> = {
      portfolio_id: data.portfolio_id,
      broker_id: data.broker_id ?? null,
      asset_id: "asset_id" in data ? data.asset_id : null,
      type: data.type,
      quantity: "quantity" in data ? data.quantity : null,
      price: "price" in data ? data.price : null,
      amount: "amount" in data ? data.amount : null,
      fees: data.fees,
      currency: data.currency.toUpperCase(),
      trade_date: data.trade_date,
      trade_time: data.trade_time ?? null,
      purification_percentage:
        "purification_percentage" in data ? (data.purification_percentage ?? 0) : null,
      notes: data.notes ?? null,
      external_ref: data.external_ref ?? null,
      realized_pnl: null, // engine re-derives after recompute
    };

    // Trial: affected pairs are the old (portfolio, asset) and the new one.
    const pairs = new Set<string>();
    if (existing.asset_id) pairs.add(`${existing.portfolio_id} ${existing.asset_id}`);
    if (patch.asset_id) pairs.add(`${patch.portfolio_id} ${patch.asset_id}`);

    for (const key of pairs) {
      const [portfolioId, assetId] = key.split(" ");
      const pairPortfolio =
        portfolioId === portfolio.id
          ? portfolio
          : await this.repo.getPortfolio(userId, portfolioId);
      if (!pairPortfolio) throw new ServiceError("Portfolio not found.", "forbidden");
      const rows = (
        await this.repo.listTransactions(userId, { portfolioId, assetId })
      ).filter((r) => r.id !== id);
      // The updated row participates only in its (possibly new) pair.
      if (portfolioId === patch.portfolio_id && assetId === patch.asset_id) {
        rows.push({ ...existing, ...patch, id, realized_pnl: null } as TransactionRow);
      }
      await this.replayPair(userId, pairPortfolio, assetId, rows);
    }

    await this.repo.updateTransaction(userId, id, patch);

    for (const key of pairs) {
      const [portfolioId, assetId] = key.split(" ");
      const pairPortfolio = await this.repo.getPortfolio(userId, portfolioId);
      if (pairPortfolio) await this.persistRecompute(userId, pairPortfolio, assetId);
    }
    return (await this.repo.getTransaction(userId, id))!;
  }

  /**
   * Delete a transaction. M1 policy: hard delete with immediate deterministic
   * recompute (a full audit trail is the M5 milestone — see PRD §12). The
   * trial replay makes deletion "audit-safe" in the sense that a deletion
   * whose removal would corrupt the remaining ledger (e.g. deleting the buy
   * that a later sell depends on) is REJECTED, not silently accepted.
   */
  async delete(userId: string, id: string): Promise<void> {
    const existing = await this.repo.getTransaction(userId, id);
    if (!existing) throw new ServiceError("Transaction not found.", "not_found");

    if (existing.asset_id) {
      const portfolio = await this.repo.getPortfolio(userId, existing.portfolio_id);
      if (!portfolio) throw new ServiceError("Portfolio not found.", "forbidden");
      const remaining = (
        await this.repo.listTransactions(userId, {
          portfolioId: existing.portfolio_id,
          assetId: existing.asset_id,
        })
      ).filter((r) => r.id !== id);
      if (remaining.length > 0) {
        await this.replayPair(userId, portfolio, existing.asset_id, remaining);
      }
      await this.repo.deleteTransaction(userId, id);
      await this.persistRecompute(userId, portfolio, existing.asset_id);
      return;
    }
    await this.repo.deleteTransaction(userId, id);
  }
}
