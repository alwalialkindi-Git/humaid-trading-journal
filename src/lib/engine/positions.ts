/**
 * Position calculation engine — the deterministic core of the ledger.
 *
 * Pure module: no I/O, no Supabase, no Date.now(). Input is the ledger,
 * output is positions + cash + per-sell realized P&L. Every financial number
 * in the product comes from here (or a sibling engine); UI and AI layers may
 * only display or explain these results, never recompute them.
 *
 * Design rules (docs/M1_LEDGER_FOUNDATION.md §3):
 * - Replay order: (trade_date, trade_time NULLS LAST, created_at).
 * - Positions are computed in the ASSET's currency; base-currency conversion
 *   is a read-layer concern, never done here.
 * - Cash balances are per (portfolio, transaction currency).
 * - Buy fees are capitalized into cost basis; sell fees reduce proceeds.
 * - Sells greater than the available quantity are rejected (no shorts).
 * - Transfers and adjustments never create realized P&L and never touch cash.
 * - The engine never branches on how an asset is priced (data_tier):
 *   manual/custom assets behave exactly like provider-resolved ones.
 * - cost_method is a strategy (average today, fifo later): the core replay
 *   loop is method-agnostic and delegates all basis math to the strategy.
 */

export type TransactionType =
  | "buy"
  | "sell"
  | "dividend"
  | "deposit"
  | "withdrawal"
  | "fee"
  | "zakat_payment"
  | "purification_payment"
  | "adjustment"
  | "split"
  | "transfer_in"
  | "transfer_out";

export type CostMethod = "average" | "fifo";

export interface EngineTransaction {
  id: string;
  portfolio_id: string;
  asset_id: string | null;
  type: TransactionType;
  quantity: number | null;
  price: number | null;
  amount: number | null;
  fees: number;
  currency: string;
  trade_date: string; // YYYY-MM-DD
  trade_time: string | null; // HH:MM[:SS]
  created_at: string; // ISO timestamp — same-moment tiebreaker only
}

export interface EngineAsset {
  id: string;
  currency: string;
  symbol?: string; // for error messages only
}

export interface EnginePortfolio {
  id: string;
  cost_method: CostMethod;
}

export interface PositionResult {
  portfolio_id: string;
  asset_id: string;
  currency: string; // the asset's currency
  quantity: number;
  average_cost: number;
  cost_basis: number;
  realized_pnl: number; // lifetime, in asset currency
  dividends_received: number;
  first_acquired_at: string | null;
  last_transaction_at: string | null;
}

export interface CashBalance {
  portfolio_id: string;
  currency: string;
  balance: number;
}

export interface EngineWarning {
  code: "negative_cash" | "transfer_in_without_cost";
  message: string;
  portfolio_id: string;
  transaction_id?: string;
}

export interface CalculationResult {
  positions: PositionResult[];
  cashBalances: CashBalance[];
  /** Realized P&L per sell transaction id (asset currency, fees deducted). */
  realizedPnlByTransaction: Map<string, number>;
  warnings: EngineWarning[];
}

export class EngineError extends Error {
  constructor(
    message: string,
    public readonly transactionId?: string
  ) {
    super(message);
    this.name = "EngineError";
  }
}

// ---------------------------------------------------------------------------
// Cost-basis strategies
//
// The strategy owns its state shape (opaque to the core loop), so FIFO can
// keep a lot queue without the core changing. Contract:
//  - addUnits: acquire `quantity` units for `totalCost` (cost incl. fees)
//  - removeUnits: release `quantity` units, returning the cost basis removed
//    (this is what realized P&L is measured against)
// ---------------------------------------------------------------------------

interface CostBasisStrategy<S = unknown> {
  createState(): S;
  addUnits(state: S, quantity: number, totalCost: number): void;
  removeUnits(state: S, quantity: number): number;
  getQuantity(state: S): number;
  getCostBasis(state: S): number;
}

interface AverageState {
  quantity: number;
  costBasis: number;
}

const EPS = 1e-9;

const averageCostStrategy: CostBasisStrategy<AverageState> = {
  createState: () => ({ quantity: 0, costBasis: 0 }),
  addUnits(state, quantity, totalCost) {
    state.quantity += quantity;
    state.costBasis += totalCost;
  },
  removeUnits(state, quantity) {
    const averageCost = state.quantity > EPS ? state.costBasis / state.quantity : 0;
    const costRemoved = quantity * averageCost;
    state.quantity -= quantity;
    state.costBasis -= costRemoved;
    // Zero out float dust when the position fully closes.
    if (state.quantity <= EPS) {
      state.quantity = 0;
      state.costBasis = 0;
    }
    return costRemoved;
  },
  getQuantity: (state) => state.quantity,
  getCostBasis: (state) => state.costBasis,
};

const fifoStrategy: CostBasisStrategy = {
  createState() {
    throw new EngineError(
      "FIFO cost method is not implemented yet (reserved; see design doc §11)."
    );
  },
  addUnits() {
    throw new EngineError("FIFO cost method is not implemented yet.");
  },
  removeUnits() {
    throw new EngineError("FIFO cost method is not implemented yet.");
  },
  getQuantity() {
    throw new EngineError("FIFO cost method is not implemented yet.");
  },
  getCostBasis() {
    throw new EngineError("FIFO cost method is not implemented yet.");
  },
};

const STRATEGIES: Record<CostMethod, CostBasisStrategy<never>> = {
  average: averageCostStrategy as CostBasisStrategy<never>,
  fifo: fifoStrategy as CostBasisStrategy<never>,
};

/**
 * Sell preview — the exact realized-P&L formula the average-cost strategy
 * uses, exported for client-side previews so the preview CANNOT disagree
 * with the persisted result (Phase 5 success criterion).
 */
export function previewSellRealizedPnl(params: {
  heldQuantity: number;
  averageCost: number;
  sellQuantity: number;
  sellPrice: number;
  fees: number;
}): { realizedPnl: number; valid: boolean } {
  const { heldQuantity, averageCost, sellQuantity, sellPrice, fees } = params;
  if (
    !Number.isFinite(sellQuantity) ||
    sellQuantity <= 0 ||
    !Number.isFinite(sellPrice) ||
    sellPrice < 0 ||
    sellQuantity > heldQuantity + EPS
  ) {
    return { realizedPnl: 0, valid: false };
  }
  const realized = sellQuantity * (sellPrice - averageCost) - (fees || 0);
  return { realizedPnl: Math.round((realized + Number.EPSILON) * 100) / 100, valid: true };
}

// ---------------------------------------------------------------------------
// Replay ordering
// ---------------------------------------------------------------------------

/** NULLS LAST sentinel: any real HH:MM[:SS] sorts before this. */
const NO_TIME = "￿";

export function compareTransactions(
  a: EngineTransaction,
  b: EngineTransaction
): number {
  if (a.trade_date !== b.trade_date) return a.trade_date < b.trade_date ? -1 : 1;
  const at = a.trade_time ?? NO_TIME;
  const bt = b.trade_time ?? NO_TIME;
  if (at !== bt) return at < bt ? -1 : 1;
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Rounding — full precision internally, rounded at the output boundary
// ---------------------------------------------------------------------------

const round = (value: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round((value + Number.EPSILON) * f) / f;
};
const money = (v: number) => round(v, 2);
const unitPrice = (v: number) => round(v, 6);
const units = (v: number) => round(v, 8);

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

interface PositionAccumulator {
  portfolio_id: string;
  asset_id: string;
  currency: string;
  basisState: never;
  strategy: CostBasisStrategy<never>;
  realizedPnl: number;
  dividendsReceived: number;
  firstAcquiredAt: string | null;
  lastTransactionAt: string | null;
}

export function calculatePositions(
  transactions: EngineTransaction[],
  assets: EngineAsset[],
  portfolios: EnginePortfolio[]
): CalculationResult {
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const portfolioById = new Map(portfolios.map((p) => [p.id, p]));

  const positions = new Map<string, PositionAccumulator>();
  const cash = new Map<string, CashBalance>();
  const realizedPnlByTransaction = new Map<string, number>();
  const warnings: EngineWarning[] = [];

  const ordered = [...transactions].sort(compareTransactions);

  const getPosition = (tx: EngineTransaction): PositionAccumulator => {
    const asset = assetById.get(tx.asset_id!);
    if (!asset) {
      throw new EngineError(
        `Transaction ${tx.id} references unknown asset ${tx.asset_id}.`,
        tx.id
      );
    }
    const portfolio = portfolioById.get(tx.portfolio_id);
    if (!portfolio) {
      throw new EngineError(
        `Transaction ${tx.id} references unknown portfolio ${tx.portfolio_id}.`,
        tx.id
      );
    }
    const key = `${tx.portfolio_id} ${tx.asset_id}`;
    let acc = positions.get(key);
    if (!acc) {
      const strategy = STRATEGIES[portfolio.cost_method];
      acc = {
        portfolio_id: tx.portfolio_id,
        asset_id: tx.asset_id!,
        currency: asset.currency,
        strategy,
        basisState: strategy.createState() as never,
        realizedPnl: 0,
        dividendsReceived: 0,
        firstAcquiredAt: null,
        lastTransactionAt: null,
      };
      positions.set(key, acc);
    }
    acc.lastTransactionAt = tx.trade_date;
    return acc;
  };

  const adjustCash = (portfolioId: string, currency: string, delta: number) => {
    const key = `${portfolioId} ${currency}`;
    const entry = cash.get(key) ?? { portfolio_id: portfolioId, currency, balance: 0 };
    entry.balance += delta;
    cash.set(key, entry);
  };

  const requirePositive = (
    tx: EngineTransaction,
    field: "quantity" | "price" | "amount",
    allowZero = false
  ): number => {
    const value = tx[field];
    if (value == null || !Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
      throw new EngineError(
        `Transaction ${tx.id} (${tx.type}) has invalid ${field}: ${value}.`,
        tx.id
      );
    }
    return value;
  };

  for (const tx of ordered) {
    switch (tx.type) {
      case "buy": {
        const quantity = requirePositive(tx, "quantity");
        const price = requirePositive(tx, "price", true);
        const acc = getPosition(tx);
        const totalCost = quantity * price + tx.fees; // fees capitalized
        acc.strategy.addUnits(acc.basisState, quantity, totalCost);
        if (acc.firstAcquiredAt === null) acc.firstAcquiredAt = tx.trade_date;
        adjustCash(tx.portfolio_id, tx.currency, -(quantity * price + tx.fees));
        break;
      }

      case "sell": {
        const quantity = requirePositive(tx, "quantity");
        const price = requirePositive(tx, "price", true);
        const acc = getPosition(tx);
        const held = acc.strategy.getQuantity(acc.basisState);
        if (quantity > held + EPS) {
          throw new EngineError(
            `Transaction ${tx.id} sells ${quantity} but only ${units(held)} ` +
              `of asset ${assetById.get(tx.asset_id!)?.symbol ?? tx.asset_id} ` +
              `are held on ${tx.trade_date}. Short positions are not supported; ` +
              `use an 'adjustment' to establish an opening balance.`,
            tx.id
          );
        }
        const costRemoved = acc.strategy.removeUnits(acc.basisState, quantity);
        const realized = quantity * price - tx.fees - costRemoved;
        acc.realizedPnl += realized;
        realizedPnlByTransaction.set(tx.id, money(realized));
        adjustCash(tx.portfolio_id, tx.currency, quantity * price - tx.fees);
        break;
      }

      case "dividend": {
        const amount = requirePositive(tx, "amount");
        const acc = getPosition(tx);
        acc.dividendsReceived += amount;
        adjustCash(tx.portfolio_id, tx.currency, amount);
        break;
      }

      case "adjustment": {
        // Opening balances / reconciliation: quantity may be signed.
        // No cash effect, no realized P&L — ever.
        if (tx.quantity == null || !Number.isFinite(tx.quantity) || tx.quantity === 0) {
          throw new EngineError(
            `Transaction ${tx.id} (adjustment) has invalid quantity: ${tx.quantity}.`,
            tx.id
          );
        }
        const acc = getPosition(tx);
        if (tx.quantity > 0) {
          const price = requirePositive(tx, "price", true);
          acc.strategy.addUnits(acc.basisState, tx.quantity, tx.quantity * price);
          if (acc.firstAcquiredAt === null) acc.firstAcquiredAt = tx.trade_date;
        } else {
          const removeQty = -tx.quantity;
          const held = acc.strategy.getQuantity(acc.basisState);
          if (removeQty > held + EPS) {
            throw new EngineError(
              `Transaction ${tx.id} adjusts out ${removeQty} but only ${units(held)} are held.`,
              tx.id
            );
          }
          acc.strategy.removeUnits(acc.basisState, removeQty);
        }
        break;
      }

      case "transfer_in": {
        // Units arriving from another account: carried at the stated unit
        // cost. No cash effect, no realized P&L.
        const quantity = requirePositive(tx, "quantity");
        const acc = getPosition(tx);
        const unitCost = tx.price ?? 0;
        if (tx.price == null) {
          warnings.push({
            code: "transfer_in_without_cost",
            message:
              `Transfer-in ${tx.id} has no unit cost; carried at 0. ` +
              `Set a price to preserve the true cost basis.`,
            portfolio_id: tx.portfolio_id,
            transaction_id: tx.id,
          });
        }
        acc.strategy.addUnits(acc.basisState, quantity, quantity * unitCost);
        if (acc.firstAcquiredAt === null) acc.firstAcquiredAt = tx.trade_date;
        break;
      }

      case "transfer_out": {
        // Units leaving to another account at carrying cost: no cash effect,
        // and — critically — NO realized P&L.
        const quantity = requirePositive(tx, "quantity");
        const acc = getPosition(tx);
        const held = acc.strategy.getQuantity(acc.basisState);
        if (quantity > held + EPS) {
          throw new EngineError(
            `Transaction ${tx.id} transfers out ${quantity} but only ${units(held)} are held.`,
            tx.id
          );
        }
        acc.strategy.removeUnits(acc.basisState, quantity);
        break;
      }

      case "deposit": {
        const amount = requirePositive(tx, "amount");
        adjustCash(tx.portfolio_id, tx.currency, amount);
        break;
      }

      case "withdrawal":
      case "fee":
      case "zakat_payment":
      case "purification_payment": {
        const amount = requirePositive(tx, "amount");
        adjustCash(tx.portfolio_id, tx.currency, -amount);
        break;
      }

      case "split": {
        // Reserved: schema allows it, service layer gates it, engine strategy
        // ships with corporate actions (M-later). Failing loudly beats a
        // silently wrong cost basis.
        throw new EngineError(
          `Transaction ${tx.id} has type 'split', which the engine does not support yet.`,
          tx.id
        );
      }

      default: {
        const exhaustive: never = tx.type;
        throw new EngineError(`Unknown transaction type: ${exhaustive}`, tx.id);
      }
    }
  }

  // Negative-cash warnings (warn, never block — design doc §3.3)
  for (const entry of cash.values()) {
    if (entry.balance < -EPS) {
      warnings.push({
        code: "negative_cash",
        message:
          `Cash in ${entry.currency} is negative (${money(entry.balance)}). ` +
          `The ledger shows more spent than deposited — add a deposit or opening balance.`,
        portfolio_id: entry.portfolio_id,
      });
    }
  }

  const positionResults: PositionResult[] = [...positions.values()].map((acc) => {
    const quantity = acc.strategy.getQuantity(acc.basisState);
    const costBasis = acc.strategy.getCostBasis(acc.basisState);
    return {
      portfolio_id: acc.portfolio_id,
      asset_id: acc.asset_id,
      currency: acc.currency,
      quantity: units(quantity),
      average_cost: quantity > EPS ? unitPrice(costBasis / quantity) : 0,
      cost_basis: money(costBasis),
      realized_pnl: money(acc.realizedPnl),
      dividends_received: money(acc.dividendsReceived),
      first_acquired_at: acc.firstAcquiredAt,
      last_transaction_at: acc.lastTransactionAt,
    };
  });

  const cashResults: CashBalance[] = [...cash.values()].map((entry) => ({
    ...entry,
    balance: money(entry.balance),
  }));

  return {
    positions: positionResults,
    cashBalances: cashResults,
    realizedPnlByTransaction,
    warnings,
  };
}
