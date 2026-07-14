import { beforeEach, describe, expect, it } from "vitest";
import { buildServices, type Services } from "./index";
import { InMemoryRepository } from "./testing/in-memory-repository";
import type { AssetRow, PortfolioRow } from "./types";

/**
 * Cash statement (D2) — the statement is a VIEW over the same ledger the
 * engine replays. Its one non-negotiable: closing balance ≡ engine cash
 * balance, per currency, always. Drift between the two would be a second
 * financial truth (Bug-3 class) — these tests exist to make that impossible
 * to ship.
 */

const USER = "user-1";

let repo: InMemoryRepository;
let services: Services;
let portfolio: PortfolioRow;
let aapl: AssetRow;
let emaar: AssetRow;

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

  aapl = await repo.insertAsset({
    symbol: "AAPL",
    exchange: "NASDAQ",
    name: "Apple Inc.",
    currency: "USD",
    asset_class: "stock",
    data_tier: "automated",
    isin: null,
    sector: null,
    industry: null,
    country: null,
    is_listed: true,
    provider: "yahoo",
    provider_symbol: "AAPL",
    latest_price: 200,
    price_as_of: "2026-07-01T12:00:00Z",
    price_is_manual: false,
    metadata: {},
    created_by: null,
  });

  emaar = await services.assets.createCustomAsset(USER, {
    symbol: "EMAAR",
    name: "Emaar Properties",
    exchange: "DFM",
    currency: "AED",
    latest_price: 5.85,
    price_source_note: "DFM close",
  });
});

async function seedMixedLedger() {
  const base = { portfolio_id: portfolio.id, fees: 0 };
  // AED lane: deposit → buy (fees) → dividend → zakat payment
  await services.transactions.create(USER, {
    ...base,
    type: "deposit",
    amount: 10_000,
    currency: "AED",
    trade_date: "2026-06-01",
  });
  await services.transactions.create(USER, {
    ...base,
    type: "buy",
    asset_id: emaar.id,
    quantity: 1000,
    price: 5.1,
    fees: 10.3,
    currency: "AED",
    trade_date: "2026-06-03",
  });
  await services.transactions.create(USER, {
    ...base,
    type: "dividend",
    asset_id: emaar.id,
    amount: 250,
    currency: "AED",
    trade_date: "2026-06-10",
  });
  await services.transactions.create(USER, {
    ...base,
    type: "zakat_payment",
    amount: 102,
    currency: "AED",
    trade_date: "2026-06-15",
  });
  // USD lane: buy with NO deposit → negative running balance (D-014 warns, never blocks)
  await services.transactions.create(USER, {
    ...base,
    type: "buy",
    asset_id: aapl.id,
    quantity: 5,
    price: 100,
    fees: 1,
    currency: "USD",
    trade_date: "2026-06-05",
  });
  // sell part of it (net of fees)
  await services.transactions.create(USER, {
    ...base,
    type: "sell",
    asset_id: aapl.id,
    quantity: 2,
    price: 120,
    fees: 0.5,
    currency: "USD",
    trade_date: "2026-06-20",
  });
}

describe("getCashStatement — closing ≡ engine balance (the anti-drift law)", () => {
  it("matches getCashBalances per currency, including a negative lane", async () => {
    await seedMixedLedger();
    const [statements, balances] = await Promise.all([
      services.positions.getCashStatement(USER, portfolio.id),
      services.positions.getCashBalances(USER, portfolio.id),
    ]);
    const balanceByCurrency = new Map(balances.map((b) => [b.currency, b.balance]));
    expect(statements).toHaveLength(balanceByCurrency.size);
    for (const s of statements) {
      expect(s.closing).toBe(balanceByCurrency.get(s.currency));
    }
  });

  it("computes running balances whose last value equals closing", async () => {
    await seedMixedLedger();
    const statements = await services.positions.getCashStatement(USER, portfolio.id);
    for (const s of statements) {
      expect(s.events.length).toBeGreaterThan(0);
      expect(s.events.at(-1)!.balance_after).toBe(s.closing);
    }
  });

  it("applies the D-013 cash rules: buys capitalize fees, sells net them", async () => {
    await seedMixedLedger();
    const usd = (await services.positions.getCashStatement(USER, portfolio.id)).find(
      (s) => s.currency === "USD"
    )!;
    const buy = usd.events.find((e) => e.type === "buy")!;
    const sell = usd.events.find((e) => e.type === "sell")!;
    expect(buy.amount_signed).toBe(-(5 * 100 + 1)); // −501.00
    expect(sell.amount_signed).toBe(2 * 120 - 0.5); // +239.50
    // USD lane never had a deposit → negative throughout, honestly shown
    expect(usd.closing).toBe(-501 + 239.5);
    expect(usd.closing).toBeLessThan(0);
  });

  it("orders events by engine replay (trade_date, trade_time NULLS LAST, created_at)", async () => {
    const base = { portfolio_id: portfolio.id, fees: 0, currency: "AED" };
    await services.transactions.create(USER, {
      ...base,
      type: "deposit",
      amount: 100,
      trade_date: "2026-06-02",
    });
    await services.transactions.create(USER, {
      ...base,
      type: "deposit",
      amount: 50,
      trade_date: "2026-06-01",
      trade_time: "14:00",
    });
    await services.transactions.create(USER, {
      ...base,
      type: "deposit",
      amount: 25,
      trade_date: "2026-06-01",
      trade_time: "09:00",
    });
    const [aed] = await services.positions.getCashStatement(USER, portfolio.id);
    expect(aed.events.map((e) => e.amount_signed)).toEqual([25, 50, 100]);
    expect(aed.events.map((e) => e.balance_after)).toEqual([25, 75, 175]);
  });

  it("excludes non-cash types (adjustment) from the statement", async () => {
    await services.transactions.create(USER, {
      portfolio_id: portfolio.id,
      type: "adjustment",
      asset_id: aapl.id,
      quantity: 10,
      price: 90,
      fees: 0,
      currency: "USD",
      trade_date: "2026-06-01",
    });
    const statements = await services.positions.getCashStatement(USER, portfolio.id);
    expect(statements).toHaveLength(0);
  });

  it("rejects access to another user's portfolio", async () => {
    await expect(
      services.positions.getCashStatement("user-2", portfolio.id)
    ).rejects.toThrow(/not found/i);
  });
});
