import { beforeEach, describe, expect, it } from "vitest";
import { buildServices, type Services } from "./index";
import { InMemoryRepository } from "./testing/in-memory-repository";
import type { AssetRow, PortfolioRow } from "./types";

const USER = "user-1";
const OTHER_USER = "user-2";

let repo: InMemoryRepository;
let services: Services;
let portfolio: PortfolioRow;
let aapl: AssetRow;
let adib: AssetRow;

beforeEach(async () => {
  repo = new InMemoryRepository();
  services = buildServices(repo);

  portfolio = await repo.insertPortfolio({
    user_id: USER,
    name: "Personal",
    base_currency: "AED",
    cost_method: "average",
    is_default: true,
    is_archived: false,
  });

  // Automated US asset and manual/custom UAE ADX asset — same rules apply.
  aapl = await repo.insertAsset({
    symbol: "AAPL",
    exchange: "NASDAQ",
    name: "Apple Inc.",
    currency: "USD",
    asset_class: "stock",
    data_tier: "automated",
    isin: null,
    sector: "Technology",
    industry: "Consumer Electronics",
    country: "United States",
    is_listed: true,
    provider: "yahoo",
    provider_symbol: "AAPL",
    latest_price: 310,
    price_as_of: "2026-07-07T12:00:00Z",
    price_is_manual: false,
    metadata: {},
    created_by: null,
  });

  adib = await services.assets.createCustomAsset(USER, {
    symbol: "ADIB",
    name: "Abu Dhabi Islamic Bank",
    exchange: "ADX",
    currency: "AED",
    sector: "Islamic Financials",
    latest_price: 13.15,
    price_source_note: "ADX website close 2026-07-07",
  });
});

function buyInput(assetId: string, quantity: number, price: number, extra = {}) {
  return {
    portfolio_id: portfolio.id,
    asset_id: assetId,
    type: "buy" as const,
    quantity,
    price,
    fees: 0,
    currency: "USD",
    trade_date: "2026-06-01",
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Required case 1: creating a buy recomputes the position
// ---------------------------------------------------------------------------

describe("create buy → position recompute", () => {
  it("persists the transaction and writes the derived position", async () => {
    await services.transactions.create(USER, buyInput(aapl.id, 10, 100, { fees: 5 }));
    const positions = await repo.listPositions(USER, portfolio.id);
    expect(positions).toHaveLength(1);
    expect(positions[0].quantity).toBe(10);
    expect(positions[0].cost_basis).toBe(1005); // fees capitalized
    expect(positions[0].average_cost).toBe(100.5);
    expect(positions[0].first_acquired_at).toBe("2026-06-01");
  });
});

// ---------------------------------------------------------------------------
// Required case 2: multiple buys update weighted average cost
// ---------------------------------------------------------------------------

describe("multiple buys → weighted average", () => {
  it("10@100 + 20@130 → average cost 120", async () => {
    await services.transactions.create(USER, buyInput(aapl.id, 10, 100));
    await services.transactions.create(
      USER,
      buyInput(aapl.id, 20, 130, { trade_date: "2026-06-02" })
    );
    const [position] = await repo.listPositions(USER, portfolio.id);
    expect(position.quantity).toBe(30);
    expect(position.average_cost).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// Required case 3: sell recomputes realized P&L (position + sell row cache)
// ---------------------------------------------------------------------------

describe("sell → realized P&L recompute", () => {
  it("computes realized P&L and caches it on the sell row", async () => {
    await services.transactions.create(USER, buyInput(aapl.id, 10, 100));
    await services.transactions.create(
      USER,
      buyInput(aapl.id, 20, 130, { trade_date: "2026-06-02" })
    );
    const sellRow = await services.transactions.create(USER, {
      portfolio_id: portfolio.id,
      asset_id: aapl.id,
      type: "sell",
      quantity: 15,
      price: 140,
      fees: 10,
      currency: "USD",
      trade_date: "2026-06-10",
    });
    expect(sellRow.realized_pnl).toBe(290); // 15*(140-120) - 10

    const [position] = await repo.listPositions(USER, portfolio.id);
    expect(position.realized_pnl).toBe(290);
    expect(position.quantity).toBe(15);
    expect(position.average_cost).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// Required case 4: invalid sell is rejected (nothing persisted)
// ---------------------------------------------------------------------------

describe("invalid sell rejected", () => {
  it("rejects overselling and persists nothing", async () => {
    await services.transactions.create(USER, buyInput(aapl.id, 10, 100));
    await expect(
      services.transactions.create(USER, {
        portfolio_id: portfolio.id,
        asset_id: aapl.id,
        type: "sell",
        quantity: 11,
        price: 120,
        currency: "USD",
        trade_date: "2026-06-05",
      })
    ).rejects.toMatchObject({ code: "engine_rejected" });

    expect(repo.transactions).toHaveLength(1); // only the buy
    const [position] = await repo.listPositions(USER, portfolio.id);
    expect(position.quantity).toBe(10); // untouched
  });

  it("rejects malformed shapes before touching the engine", async () => {
    await expect(
      services.transactions.create(USER, {
        portfolio_id: portfolio.id,
        asset_id: aapl.id,
        type: "buy",
        quantity: 0, // invalid
        price: 100,
        currency: "USD",
        trade_date: "2026-06-01",
      })
    ).rejects.toMatchObject({ code: "validation" });

    await expect(
      services.transactions.create(USER, {
        portfolio_id: portfolio.id,
        type: "transfer_in", // service-gated in M1
        asset_id: aapl.id,
        quantity: 5,
        currency: "USD",
        trade_date: "2026-06-01",
      })
    ).rejects.toMatchObject({ code: "validation" });
  });
});

// ---------------------------------------------------------------------------
// Required case 5: manual ADX asset transactions work identically
// ---------------------------------------------------------------------------

describe("manual/custom ADX asset", () => {
  it("was created as manual_custom, listed, with the price source note", () => {
    expect(adib.data_tier).toBe("manual_custom");
    expect(adib.exchange).toBe("ADX");
    expect(adib.is_listed).toBe(true); // real exchange, provider-less
    expect(adib.currency).toBe("AED");
    expect(adib.price_is_manual).toBe(true);
    expect(adib.metadata.price_source_note).toBe("ADX website close 2026-07-07");
    expect(adib.country).toBe("UAE"); // derived from the ADX exchange metadata
  });

  it("buy/sell on the ADX asset flows through the same engine rules", async () => {
    await services.transactions.create(USER, {
      portfolio_id: portfolio.id,
      asset_id: adib.id,
      type: "buy",
      quantity: 1000,
      price: 12.3,
      fees: 20,
      currency: "AED",
      trade_date: "2026-06-01",
    });
    const sellRow = await services.transactions.create(USER, {
      portfolio_id: portfolio.id,
      asset_id: adib.id,
      type: "sell",
      quantity: 400,
      price: 13.0,
      currency: "AED",
      trade_date: "2026-06-20",
    });
    // avg = (1000*12.30 + 20)/1000 = 12.32 → realized = 400*(13.00-12.32) = 272
    expect(sellRow.realized_pnl).toBe(272);

    const holdings = await services.positions.getHoldings(USER, portfolio.id);
    const holding = holdings.find((h) => h.asset.id === adib.id)!;
    expect(holding.quantity).toBe(600);
    expect(holding.effective_price).toBe(13.15); // manual price participates
    expect(holding.market_value).toBe(7890);
    expect(holding.asset.data_tier).toBe("manual_custom");
  });

  it("refuses to create a warned cross-exchange search result without confirmation", async () => {
    await expect(
      services.assets.ensureFromSearchResult(USER, {
        symbol: "EGS60111C019",
        providerSymbol: "EGS60111C019.CA",
        name: "Abu Dhabi Islamic Bank - Egypt",
        exchange: { code: "EGX", name: "Egyptian Exchange", country: "Egypt", currency: "EGP" },
        assetClass: "stock",
        warning: "This is ... on Egyptian Exchange — NOT Abu Dhabi Islamic Bank on ADX.",
      })
    ).rejects.toMatchObject({ code: "validation" });
  });
});

// ---------------------------------------------------------------------------
// Required case 6: broker ownership validation
// ---------------------------------------------------------------------------

describe("broker ownership", () => {
  it("accepts the user's own broker and rejects someone else's", async () => {
    const myBroker = await services.brokers.create(USER, {
      name: "IBKR",
      account_currency: "USD",
    });
    const theirBroker = await repo.insertBroker({
      user_id: OTHER_USER,
      name: "Their broker",
      country: null,
      account_number: null,
      account_currency: "USD",
      notes: null,
    });

    const ok = await services.transactions.create(
      USER,
      buyInput(aapl.id, 5, 100, { broker_id: myBroker.id })
    );
    expect(ok.broker_id).toBe(myBroker.id);

    await expect(
      services.transactions.create(
        USER,
        buyInput(aapl.id, 5, 100, { broker_id: theirBroker.id, trade_date: "2026-06-02" })
      )
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("rejects transactions against someone else's portfolio", async () => {
    const theirPortfolio = await repo.insertPortfolio({
      user_id: OTHER_USER,
      name: "Not yours",
      base_currency: "USD",
      cost_method: "average",
      is_default: true,
      is_archived: false,
    });
    await expect(
      services.transactions.create(
        USER,
        buyInput(aapl.id, 5, 100, { portfolio_id: theirPortfolio.id })
      )
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});

// ---------------------------------------------------------------------------
// Required case 7: cash balance updates
// ---------------------------------------------------------------------------

describe("cash balances", () => {
  it("derives per-currency balances from the ledger", async () => {
    await services.transactions.create(USER, {
      portfolio_id: portfolio.id,
      type: "deposit",
      amount: 50000,
      currency: "AED",
      trade_date: "2026-05-01",
    });
    await services.transactions.create(USER, {
      portfolio_id: portfolio.id,
      asset_id: adib.id,
      type: "buy",
      quantity: 1000,
      price: 12.3,
      fees: 20,
      currency: "AED",
      trade_date: "2026-06-01",
    });
    await services.transactions.create(USER, {
      portfolio_id: portfolio.id,
      asset_id: adib.id,
      type: "dividend",
      amount: 850,
      currency: "AED",
      trade_date: "2026-06-25",
      purification_percentage: 2.5,
    });
    await services.transactions.create(USER, {
      portfolio_id: portfolio.id,
      type: "zakat_payment",
      amount: 1250,
      currency: "AED",
      trade_date: "2026-06-30",
    });

    const cash = await services.positions.getCashBalances(USER, portfolio.id);
    expect(cash).toHaveLength(1);
    expect(cash[0].currency).toBe("AED");
    expect(cash[0].balance).toBe(50000 - (1000 * 12.3 + 20) + 850 - 1250);
  });

  it("summary surfaces negative cash as a warning, not an error", async () => {
    await services.transactions.create(USER, buyInput(aapl.id, 10, 100));
    const summary = await services.positions.getPortfolioSummary(USER, portfolio.id);
    expect(summary.warnings.some((w) => w.includes("negative"))).toBe(true);
    expect(summary.totals.market_value_by_currency.USD).toBe(3100); // 10 × 310
  });
});

// ---------------------------------------------------------------------------
// Required case 8: delete recomputes safely
// ---------------------------------------------------------------------------

describe("delete → safe recompute", () => {
  it("deleting a sell restores the position and clears its cached P&L", async () => {
    await services.transactions.create(USER, buyInput(aapl.id, 30, 120));
    const sellRow = await services.transactions.create(USER, {
      portfolio_id: portfolio.id,
      asset_id: aapl.id,
      type: "sell",
      quantity: 10,
      price: 140,
      currency: "USD",
      trade_date: "2026-06-10",
    });
    let [position] = await repo.listPositions(USER, portfolio.id);
    expect(position.quantity).toBe(20);
    expect(position.realized_pnl).toBe(200);

    await services.transactions.delete(USER, sellRow.id);
    [position] = await repo.listPositions(USER, portfolio.id);
    expect(position.quantity).toBe(30);
    expect(position.realized_pnl).toBe(0);
  });

  it("rejects deleting a buy that a later sell depends on", async () => {
    const buyRow = await services.transactions.create(USER, buyInput(aapl.id, 10, 100));
    await services.transactions.create(USER, {
      portfolio_id: portfolio.id,
      asset_id: aapl.id,
      type: "sell",
      quantity: 10,
      price: 110,
      currency: "USD",
      trade_date: "2026-06-10",
    });
    await expect(services.transactions.delete(USER, buyRow.id)).rejects.toMatchObject({
      code: "engine_rejected",
    });
    // Ledger and position untouched.
    expect(repo.transactions).toHaveLength(2);
    const [position] = await repo.listPositions(USER, portfolio.id);
    expect(position.quantity).toBe(0);
    expect(position.realized_pnl).toBe(100);
  });

  it("deleting the last transaction of a pair removes the cached position", async () => {
    const buyRow = await services.transactions.create(USER, buyInput(aapl.id, 10, 100));
    await services.transactions.delete(USER, buyRow.id);
    expect(await repo.listPositions(USER, portfolio.id)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Supporting behavior
// ---------------------------------------------------------------------------

describe("overrides", () => {
  it("requires a reason for Shariah-status overrides", async () => {
    await expect(
      services.overrides.set(USER, aapl.id, { shariah_status: "compliant" })
    ).rejects.toThrow(/reason/i);

    const override = await services.overrides.set(USER, aapl.id, {
      shariah_status: "compliant",
      override_reason: "Screened manually per my scholar's method.",
    });
    expect(override.shariah_status).toBe("compliant");
  });

  it("override price and status flow into holdings, labeled", async () => {
    await services.transactions.create(USER, buyInput(aapl.id, 10, 100));
    await services.overrides.set(USER, aapl.id, {
      manual_price: 999,
      shariah_status: "doubtful",
      override_reason: "Pending re-screen.",
    });
    const [holding] = await services.positions.getHoldings(USER, portfolio.id);
    expect(holding.effective_price).toBe(999);
    expect(holding.price_is_manual).toBe(true);
    expect(holding.shariah_status).toBe("doubtful");
    expect(holding.shariah_is_override).toBe(true);
  });
});

describe("update transaction", () => {
  it("re-validates and recomputes; an update creating an oversell is rejected", async () => {
    const buyRow = await services.transactions.create(USER, buyInput(aapl.id, 10, 100));
    await services.transactions.create(USER, {
      portfolio_id: portfolio.id,
      asset_id: aapl.id,
      type: "sell",
      quantity: 8,
      price: 120,
      currency: "USD",
      trade_date: "2026-06-10",
    });

    // Shrinking the buy to 5 would make the sell of 8 impossible.
    await expect(
      services.transactions.update(USER, buyRow.id, buyInput(aapl.id, 5, 100))
    ).rejects.toMatchObject({ code: "engine_rejected" });

    // Growing it works and recomputes.
    await services.transactions.update(USER, buyRow.id, buyInput(aapl.id, 20, 100));
    const [position] = await repo.listPositions(USER, portfolio.id);
    expect(position.quantity).toBe(12);
  });
});

describe("custom asset validation", () => {
  it("rejects duplicate (symbol, exchange)", async () => {
    await expect(
      services.assets.createCustomAsset(USER, {
        symbol: "ADIB",
        name: "Duplicate",
        exchange: "ADX",
        currency: "AED",
      })
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("manual price updates are restricted to manual_custom assets", async () => {
    await expect(
      services.assets.setManualPrice(USER, aapl.id, 500)
    ).rejects.toMatchObject({ code: "forbidden" });
    const updated = await services.assets.setManualPrice(USER, adib.id, 13.4);
    expect(updated.latest_price).toBe(13.4);
    expect(updated.price_is_manual).toBe(true);
  });

  it("provider quotes apply only to provider-backed assets", async () => {
    const updated = await services.assets.applyProviderQuote(
      aapl.id,
      315.5,
      "2026-07-08T12:00:00Z"
    );
    expect(updated.latest_price).toBe(315.5);
    expect(updated.price_is_manual).toBe(false);
    // Manual/custom assets never take provider quotes.
    await expect(
      services.assets.applyProviderQuote(adib.id, 99, "2026-07-08T12:00:00Z")
    ).rejects.toMatchObject({ code: "validation" });
  });
});
