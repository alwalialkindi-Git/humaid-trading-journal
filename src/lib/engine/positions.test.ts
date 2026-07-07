import { describe, expect, it } from "vitest";
import {
  calculatePositions,
  compareTransactions,
  EngineError,
  type EngineAsset,
  type EnginePortfolio,
  type EngineTransaction,
} from "./positions";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PF = "portfolio-1";

const portfolios: EnginePortfolio[] = [{ id: PF, cost_method: "average" }];

// One provider-resolved US asset and one manual/custom UAE (ADX) asset —
// the engine must treat them identically (data_tier is not even an input).
const AAPL: EngineAsset = { id: "asset-aapl", currency: "USD", symbol: "AAPL" };
const ADIB: EngineAsset = { id: "asset-adib", currency: "AED", symbol: "ADIB" };
const assets = [AAPL, ADIB];

let seq = 0;
function tx(overrides: Partial<EngineTransaction>): EngineTransaction {
  seq++;
  return {
    id: `tx-${seq}`,
    portfolio_id: PF,
    asset_id: null,
    type: "deposit",
    quantity: null,
    price: null,
    amount: null,
    fees: 0,
    currency: "USD",
    trade_date: "2026-01-01",
    trade_time: null,
    created_at: `2026-01-01T00:00:${String(seq).padStart(2, "0")}.000Z`,
    ...overrides,
  };
}

function buy(
  asset: EngineAsset,
  quantity: number,
  price: number,
  extra: Partial<EngineTransaction> = {}
): EngineTransaction {
  return tx({
    asset_id: asset.id,
    type: "buy",
    quantity,
    price,
    currency: asset.currency,
    ...extra,
  });
}

function sell(
  asset: EngineAsset,
  quantity: number,
  price: number,
  extra: Partial<EngineTransaction> = {}
): EngineTransaction {
  return tx({
    asset_id: asset.id,
    type: "sell",
    quantity,
    price,
    currency: asset.currency,
    ...extra,
  });
}

function positionOf(
  result: ReturnType<typeof calculatePositions>,
  asset: EngineAsset
) {
  const p = result.positions.find((x) => x.asset_id === asset.id);
  if (!p) throw new Error(`no position for ${asset.symbol}`);
  return p;
}

function cashOf(
  result: ReturnType<typeof calculatePositions>,
  currency: string
) {
  return (
    result.cashBalances.find((c) => c.currency === currency)?.balance ?? 0
  );
}

// ---------------------------------------------------------------------------
// Required cases
// ---------------------------------------------------------------------------

describe("single buy", () => {
  it("creates a position with quantity, cost basis, and cash debit", () => {
    const result = calculatePositions(
      [buy(AAPL, 10, 150, { fees: 5, trade_date: "2026-02-01" })],
      assets,
      portfolios
    );
    const p = positionOf(result, AAPL);
    expect(p.quantity).toBe(10);
    expect(p.cost_basis).toBe(1505); // 10*150 + 5 fees capitalized
    expect(p.average_cost).toBe(150.5);
    expect(p.currency).toBe("USD"); // asset currency, per design rule
    expect(p.first_acquired_at).toBe("2026-02-01");
    expect(cashOf(result, "USD")).toBe(-1505);
  });
});

describe("multiple buys — weighted average cost", () => {
  it("matches the agreed example: 10@100 + 20@130 → average 120", () => {
    const result = calculatePositions(
      [buy(AAPL, 10, 100), buy(AAPL, 20, 130, { trade_date: "2026-01-02" })],
      assets,
      portfolios
    );
    const p = positionOf(result, AAPL);
    expect(p.quantity).toBe(30);
    expect(p.average_cost).toBe(120);
    expect(p.cost_basis).toBe(3600);
  });
});

describe("sell — partial position", () => {
  it("realizes P&L at average cost and leaves average cost unchanged", () => {
    const sellTx = sell(AAPL, 15, 140, { fees: 10, trade_date: "2026-01-10" });
    const result = calculatePositions(
      [buy(AAPL, 10, 100), buy(AAPL, 20, 130, { trade_date: "2026-01-02" }), sellTx],
      assets,
      portfolios
    );
    const p = positionOf(result, AAPL);
    // realized = 15*(140-120) - 10 fees = 290
    expect(result.realizedPnlByTransaction.get(sellTx.id)).toBe(290);
    expect(p.realized_pnl).toBe(290);
    expect(p.quantity).toBe(15);
    expect(p.average_cost).toBe(120); // unchanged by the sell
    expect(p.cost_basis).toBe(1800);
  });
});

describe("sell — full position", () => {
  it("closes to zero with no residual cost basis, keeping lifetime realized P&L", () => {
    const result = calculatePositions(
      [buy(AAPL, 30, 120), sell(AAPL, 30, 125, { trade_date: "2026-01-05" })],
      assets,
      portfolios
    );
    const p = positionOf(result, AAPL);
    expect(p.quantity).toBe(0);
    expect(p.cost_basis).toBe(0);
    expect(p.average_cost).toBe(0);
    expect(p.realized_pnl).toBe(150); // 30*(125-120)
  });
});

describe("sell — more than available", () => {
  it("throws an EngineError naming the transaction", () => {
    const bad = sell(AAPL, 11, 100, { trade_date: "2026-01-02" });
    expect(() =>
      calculatePositions([buy(AAPL, 10, 100), bad], assets, portfolios)
    ).toThrowError(EngineError);
    try {
      calculatePositions([buy(AAPL, 10, 100), bad], assets, portfolios);
    } catch (e) {
      expect((e as EngineError).transactionId).toBe(bad.id);
      expect((e as EngineError).message).toContain("Short positions are not supported");
    }
  });

  it("also rejects a sell that arrives date-ordered before its buy", () => {
    // Sell dated Jan 1, buy dated Jan 2 — replay order makes this a short.
    expect(() =>
      calculatePositions(
        [
          buy(AAPL, 10, 100, { trade_date: "2026-01-02" }),
          sell(AAPL, 5, 110, { trade_date: "2026-01-01" }),
        ],
        assets,
        portfolios
      )
    ).toThrowError(EngineError);
  });
});

describe("buy fees capitalized", () => {
  it("includes fees in cost basis so unrealized P&L is honest about total cost", () => {
    const result = calculatePositions(
      [buy(AAPL, 100, 10, { fees: 25 })],
      assets,
      portfolios
    );
    const p = positionOf(result, AAPL);
    expect(p.cost_basis).toBe(1025);
    expect(p.average_cost).toBe(10.25);
  });
});

describe("dividend income", () => {
  it("increases income and cash, never cost basis", () => {
    const result = calculatePositions(
      [
        buy(ADIB, 1000, 12, { currency: "AED" }),
        tx({
          asset_id: ADIB.id,
          type: "dividend",
          amount: 850,
          currency: "AED",
          trade_date: "2026-03-01",
        }),
      ],
      assets,
      portfolios
    );
    const p = positionOf(result, ADIB);
    expect(p.dividends_received).toBe(850);
    expect(p.cost_basis).toBe(12000); // untouched
    expect(cashOf(result, "AED")).toBe(-12000 + 850);
  });
});

describe("cash — deposit, withdrawal, fee, zakat & purification payments", () => {
  it("tracks balances per (portfolio, currency)", () => {
    const result = calculatePositions(
      [
        tx({ type: "deposit", amount: 50000, currency: "AED" }),
        tx({ type: "withdrawal", amount: 5000, currency: "AED", trade_date: "2026-01-02" }),
        tx({ type: "fee", amount: 100, currency: "AED", trade_date: "2026-01-03" }),
        tx({ type: "zakat_payment", amount: 1250, currency: "AED", trade_date: "2026-01-04" }),
        tx({ type: "purification_payment", amount: 36, currency: "AED", trade_date: "2026-01-05" }),
        tx({ type: "deposit", amount: 1000, currency: "USD", trade_date: "2026-01-06" }),
      ],
      assets,
      portfolios
    );
    expect(cashOf(result, "AED")).toBe(50000 - 5000 - 100 - 1250 - 36);
    expect(cashOf(result, "USD")).toBe(1000); // separate balance per currency
    expect(result.warnings).toHaveLength(0);
  });

  it("warns (does not block) on negative cash", () => {
    const result = calculatePositions(
      [buy(AAPL, 10, 100)],
      assets,
      portfolios
    );
    expect(cashOf(result, "USD")).toBe(-1000);
    expect(result.warnings.some((w) => w.code === "negative_cash")).toBe(true);
  });
});

describe("transfers — never realized P&L, never cash", () => {
  it("transfer_in adds units at carrying cost with no cash effect", () => {
    const result = calculatePositions(
      [
        tx({
          asset_id: AAPL.id,
          type: "transfer_in",
          quantity: 50,
          price: 90,
          currency: "USD",
        }),
      ],
      assets,
      portfolios
    );
    const p = positionOf(result, AAPL);
    expect(p.quantity).toBe(50);
    expect(p.average_cost).toBe(90);
    expect(p.realized_pnl).toBe(0);
    expect(result.cashBalances).toHaveLength(0);
    expect(result.realizedPnlByTransaction.size).toBe(0);
  });

  it("transfer_out removes units at average cost with no P&L and no cash", () => {
    const result = calculatePositions(
      [
        buy(AAPL, 30, 120),
        tx({
          asset_id: AAPL.id,
          type: "transfer_out",
          quantity: 10,
          currency: "USD",
          trade_date: "2026-01-05",
        }),
      ],
      assets,
      portfolios
    );
    const p = positionOf(result, AAPL);
    expect(p.quantity).toBe(20);
    expect(p.cost_basis).toBe(2400); // 20 × 120 — basis follows units out
    expect(p.average_cost).toBe(120);
    expect(p.realized_pnl).toBe(0);
    expect(result.realizedPnlByTransaction.size).toBe(0);
    expect(cashOf(result, "USD")).toBe(-3600); // only the original buy
  });

  it("transfer_out cannot exceed held quantity", () => {
    expect(() =>
      calculatePositions(
        [
          buy(AAPL, 10, 100),
          tx({
            asset_id: AAPL.id,
            type: "transfer_out",
            quantity: 11,
            currency: "USD",
            trade_date: "2026-01-02",
          }),
        ],
        assets,
        portfolios
      )
    ).toThrowError(EngineError);
  });
});

describe("manual/custom asset parity", () => {
  it("a manual UAE ADX asset produces identical numbers to an automated US asset", () => {
    // Same trade sequence run against both assets — engine output must be
    // identical except for identity/currency labels. The engine does not even
    // receive data_tier; this test pins that invariant.
    const sequenceFor = (asset: EngineAsset) => [
      buy(asset, 10, 100, { currency: asset.currency }),
      buy(asset, 20, 130, { currency: asset.currency, trade_date: "2026-01-02" }),
      sell(asset, 15, 140, { fees: 10, currency: asset.currency, trade_date: "2026-01-10" }),
      tx({
        asset_id: asset.id,
        type: "dividend",
        amount: 200,
        currency: asset.currency,
        trade_date: "2026-02-01",
      }),
    ];

    const us = positionOf(
      calculatePositions(sequenceFor(AAPL), assets, portfolios),
      AAPL
    );
    const uae = positionOf(
      calculatePositions(sequenceFor(ADIB), assets, portfolios),
      ADIB
    );

    const strip = (p: typeof us) => ({
      portfolio_id: p.portfolio_id,
      quantity: p.quantity,
      average_cost: p.average_cost,
      cost_basis: p.cost_basis,
      realized_pnl: p.realized_pnl,
      dividends_received: p.dividends_received,
      first_acquired_at: p.first_acquired_at,
      last_transaction_at: p.last_transaction_at,
    });
    expect(strip(uae)).toEqual(strip(us));
    expect(uae.average_cost).toBe(120);
    expect(uae.realized_pnl).toBe(290);
    expect(uae.currency).toBe("AED"); // still reported in the asset's currency
  });
});

describe("agreed average-cost example", () => {
  it("Buy 10 @ 100, Buy 20 @ 130 → average cost exactly 120", () => {
    const result = calculatePositions(
      [buy(AAPL, 10, 100), buy(AAPL, 20, 130, { trade_date: "2026-01-02" })],
      assets,
      portfolios
    );
    expect(positionOf(result, AAPL).average_cost).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// Supporting behavior
// ---------------------------------------------------------------------------

describe("replay ordering", () => {
  it("orders by trade_date, then trade_time (nulls last), then created_at", () => {
    const a = tx({ trade_date: "2026-01-02", trade_time: null, created_at: "2026-06-01T00:00:00Z" });
    const b = tx({ trade_date: "2026-01-02", trade_time: "09:30", created_at: "2026-06-02T00:00:00Z" });
    const c = tx({ trade_date: "2026-01-01", trade_time: null, created_at: "2026-06-03T00:00:00Z" });
    const d = tx({ trade_date: "2026-01-02", trade_time: null, created_at: "2026-05-01T00:00:00Z" });
    const sorted = [a, b, c, d].sort(compareTransactions);
    // c (earlier date) → b (timed before untimed) → d then a (created_at)
    expect(sorted.map((t) => t.id)).toEqual([c.id, b.id, d.id, a.id]);
  });

  it("a backdated buy entered later still replays before an earlier-entered sell", () => {
    // Sell entered first (created earlier) but dated after the buy.
    const backdatedBuy = buy(AAPL, 10, 100, {
      trade_date: "2026-01-01",
      created_at: "2026-06-30T00:00:00Z", // entered much later
    });
    const laterSell = sell(AAPL, 10, 110, {
      trade_date: "2026-01-15",
      created_at: "2026-01-15T00:00:00Z",
    });
    const result = calculatePositions(
      [laterSell, backdatedBuy],
      assets,
      portfolios
    );
    expect(positionOf(result, AAPL).realized_pnl).toBe(100);
  });
});

describe("adjustments", () => {
  it("positive adjustment establishes an opening balance with no cash effect", () => {
    const result = calculatePositions(
      [
        tx({
          asset_id: ADIB.id,
          type: "adjustment",
          quantity: 1500,
          price: 12.3,
          currency: "AED",
        }),
      ],
      assets,
      portfolios
    );
    const p = positionOf(result, ADIB);
    expect(p.quantity).toBe(1500);
    expect(p.average_cost).toBe(12.3);
    expect(result.cashBalances).toHaveLength(0);
  });

  it("negative adjustment removes units without realized P&L", () => {
    const result = calculatePositions(
      [
        buy(AAPL, 10, 100),
        tx({
          asset_id: AAPL.id,
          type: "adjustment",
          quantity: -4,
          price: 0,
          currency: "USD",
          trade_date: "2026-01-02",
        }),
      ],
      assets,
      portfolios
    );
    const p = positionOf(result, AAPL);
    expect(p.quantity).toBe(6);
    expect(p.realized_pnl).toBe(0);
    expect(p.average_cost).toBe(100);
  });
});

describe("guards", () => {
  it("rejects unknown assets and portfolios with EngineError", () => {
    expect(() =>
      calculatePositions(
        [buy({ id: "ghost", currency: "USD" }, 1, 1)],
        assets,
        portfolios
      )
    ).toThrowError(EngineError);
    expect(() =>
      calculatePositions(
        [buy(AAPL, 1, 1, { portfolio_id: "ghost-portfolio" })],
        assets,
        portfolios
      )
    ).toThrowError(EngineError);
  });

  it("rejects 'split' rows loudly until the corporate-action strategy ships", () => {
    expect(() =>
      calculatePositions(
        [tx({ asset_id: AAPL.id, type: "split" })],
        assets,
        portfolios
      )
    ).toThrowError(/split/);
  });

  it("FIFO portfolios fail loudly rather than silently mis-computing", () => {
    expect(() =>
      calculatePositions(
        [buy(AAPL, 1, 1)],
        assets,
        [{ id: PF, cost_method: "fifo" }]
      )
    ).toThrowError(/FIFO/);
  });
});
