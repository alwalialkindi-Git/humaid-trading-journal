import { describe, expect, it } from "vitest";
import {
  buildTicketLine,
  formatTicketDate,
  parseFigure,
  type TicketFacts,
} from "./ticket";

/** Fixed "now": 15 Jul 2026 (UTC) — same year as the sample trades. */
const NOW = Date.UTC(2026, 6, 15);

const base: TicketFacts = {
  type: "buy",
  assetSymbol: null,
  quantity: null,
  price: null,
  amount: null,
  fees: 0,
  currency: "AED",
  tradeDate: "2026-07-08",
  portfolioName: "Personal",
  brokerName: "IBKR",
  realizedPnl: null,
};

describe("buildTicketLine", () => {
  it("builds the §11 buy sentence with fees included in the total", () => {
    const t = buildTicketLine(
      { ...base, type: "buy", assetSymbol: "EMAAR", quantity: 1000, price: 12.1, fees: 20 },
      NOW
    );
    expect(t?.body).toBe(
      "Buy 1,000 EMAAR @ 12.10 — 12,120.00 AED incl. 20.00 AED fees · Personal / IBKR · 8 Jul"
    );
    expect(t?.pnl).toBeNull();
    expect(t?.toast).toBe(t?.body);
  });

  it("omits the fees clause when fees are zero", () => {
    const t = buildTicketLine(
      { ...base, type: "buy", assetSymbol: "EMAAR", quantity: 1000, price: 12.1 },
      NOW
    );
    expect(t?.body).toBe("Buy 1,000 EMAAR @ 12.10 — 12,100.00 AED · Personal / IBKR · 8 Jul");
  });

  it("sell: proceeds net of fees, and the P&L preview rides the toast", () => {
    const t = buildTicketLine(
      {
        ...base,
        type: "sell",
        assetSymbol: "EMAAR",
        quantity: 500,
        price: 12.8,
        fees: 20,
        realizedPnl: 290,
      },
      NOW
    );
    expect(t?.body).toBe(
      "Sell 500 EMAAR @ 12.80 — 6,380.00 AED after 20.00 AED fees · Personal / IBKR · 8 Jul"
    );
    expect(t?.pnl).toBe(290);
    expect(t?.toast).toBe(`${t?.body} · P&L +290.00 AED`);
  });

  it("negative sell P&L uses the true minus (§4.7)", () => {
    const t = buildTicketLine(
      {
        ...base,
        type: "sell",
        assetSymbol: "EMAAR",
        quantity: 100,
        price: 10,
        realizedPnl: -125.5,
      },
      NOW
    );
    expect(t?.toast.endsWith("· P&L −125.50 AED")).toBe(true);
  });

  it("P&L is only carried for sells", () => {
    const t = buildTicketLine(
      { ...base, type: "buy", assetSymbol: "EMAAR", quantity: 1, price: 1, realizedPnl: 99 },
      NOW
    );
    expect(t?.pnl).toBeNull();
    expect(t?.toast).not.toContain("P&L");
  });

  it("dividend names the asset", () => {
    const t = buildTicketLine(
      { ...base, type: "dividend", assetSymbol: "EMAAR", amount: 250 },
      NOW
    );
    expect(t?.body).toBe("Dividend EMAAR — 250.00 AED · Personal / IBKR · 8 Jul");
  });

  it("cash and obligation types speak amount-only; broker optional", () => {
    const t = buildTicketLine(
      { ...base, type: "deposit", amount: 5000, brokerName: null },
      NOW
    );
    expect(t?.body).toBe("Deposit — 5,000.00 AED · Personal · 8 Jul");
    const z = buildTicketLine({ ...base, type: "zakat_payment", amount: 100 }, NOW);
    expect(z?.body).toBe("Zakat payment — 100.00 AED · Personal / IBKR · 8 Jul");
    const w = buildTicketLine({ ...base, type: "withdrawal", amount: 100 }, NOW);
    expect(w?.body.startsWith("Withdraw — ")).toBe(true);
  });

  it("returns null while the draft is not a complete sentence", () => {
    expect(buildTicketLine({ ...base, type: "buy", assetSymbol: "EMAAR" }, NOW)).toBeNull();
    expect(
      buildTicketLine({ ...base, type: "buy", quantity: 10, price: 5 }, NOW)
    ).toBeNull(); // no asset
    expect(
      buildTicketLine({ ...base, type: "buy", assetSymbol: "X", quantity: 0, price: 5 }, NOW)
    ).toBeNull(); // zero quantity
    expect(buildTicketLine({ ...base, type: "deposit", amount: 0 }, NOW)).toBeNull();
    expect(buildTicketLine({ ...base, type: "nonsense", amount: 5 }, NOW)).toBeNull();
  });

  it("omits the portfolio clause when unknown, keeps the date", () => {
    const t = buildTicketLine(
      { ...base, type: "deposit", amount: 100, portfolioName: null, brokerName: null },
      NOW
    );
    expect(t?.body).toBe("Deposit — 100.00 AED · 8 Jul");
  });
});

describe("formatTicketDate", () => {
  it("drops the year within the current year, keeps it otherwise", () => {
    expect(formatTicketDate("2026-07-08", NOW)).toBe("8 Jul");
    expect(formatTicketDate("2025-12-31", NOW)).toBe("31 Dec 2025");
  });

  it("passes through unparseable input", () => {
    expect(formatTicketDate("not-a-date", NOW)).toBe("not-a-date");
  });
});

describe("parseFigure", () => {
  it("blank and non-numeric input is null, numbers parse", () => {
    expect(parseFigure("")).toBeNull();
    expect(parseFigure("  ")).toBeNull();
    expect(parseFigure("abc")).toBeNull();
    expect(parseFigure("12.5")).toBe(12.5);
    expect(parseFigure("0")).toBe(0);
  });
});
