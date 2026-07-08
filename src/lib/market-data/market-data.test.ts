import { describe, expect, it } from "vitest";
import { MockProvider } from "./providers/mock";
import { YahooProvider } from "./providers/yahoo";
import { TwelveDataProvider } from "./providers/twelvedata";
import { EODHDProvider } from "./providers/eodhd";
import { fetchQuote, searchSymbols } from "./service";
import { matchKnownAdx } from "./exchange-map";
import {
  ProviderError,
  type MarketDataProvider,
  type Quote,
  type SymbolSearchResult,
} from "./types";

const mock = new MockProvider();

// ---------------------------------------------------------------------------
// Required case: AAPL search
// ---------------------------------------------------------------------------

describe("AAPL search", () => {
  it("resolves with full exchange, country, and currency labeling", async () => {
    const res = await searchSymbols("AAPL", mock);
    const aapl = res.results.find((r) => r.symbol === "AAPL");
    expect(aapl).toBeDefined();
    expect(aapl!.name).toBe("Apple Inc.");
    expect(aapl!.exchange.code).toBe("NASDAQ");
    expect(aapl!.exchange.country).toBe("United States");
    expect(aapl!.exchange.currency).toBe("USD");
    expect(aapl!.assetClass).toBe("stock");
    expect(res.adxNotice).toBeNull();
    expect(res.customAssetPath).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Required case: EMAAR.AE search + quote (DFM)
// ---------------------------------------------------------------------------

describe("EMAAR.AE (DFM)", () => {
  it("search resolves the DFM listing labeled UAE/AED", async () => {
    const res = await searchSymbols("EMAAR", mock);
    const emaar = res.results.find((r) => r.providerSymbol === "EMAAR.AE");
    expect(emaar).toBeDefined();
    expect(emaar!.exchange.code).toBe("DFM");
    expect(emaar!.exchange.country).toBe("UAE");
    expect(emaar!.exchange.currency).toBe("AED");
    // DFM is covered — no ADX notice for a DFM query.
    expect(res.adxNotice).toBeNull();
  });

  it("quote returns an AED price with a timestamp", async () => {
    const res = await fetchQuote("EMAAR.AE", "DFM", mock);
    expect(res.quote.price).toBeGreaterThan(0);
    expect(res.quote.currency).toBe("AED");
    expect(res.quote.asOf).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(res.usedFallback).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Required case: ADIB Egypt false positive
// ---------------------------------------------------------------------------

describe("ADIB (ADX) — the Egypt false-positive case", () => {
  it("flags the Cairo listing with a warning and never leaves it selectable silently", async () => {
    const res = await searchSymbols("ADIB", mock);
    // The mock mirrors Yahoo reality: the only hit is ADIB *Egypt* on Cairo.
    const egypt = res.results.find((r) => r.providerSymbol === "EGS60111C019.CA");
    expect(egypt).toBeDefined();
    expect(egypt!.exchange.code).toBe("EGX");
    expect(egypt!.exchange.country).toBe("Egypt");
    expect(egypt!.warning).toBeDefined();
    expect(egypt!.warning).toContain("NOT Abu Dhabi Islamic Bank on ADX");
    // Every result in an ADX-matched query without ADX hits is warned.
    expect(res.results.every((r) => r.warning)).toBe(true);
  });

  it("returns the ADX notice with a prefilled custom UAE asset", async () => {
    const res = await searchSymbols("ADIB", mock);
    expect(res.adxNotice).not.toBeNull();
    expect(res.adxNotice!.type).toBe("adx_unavailable");
    expect(res.adxNotice!.prefill).toEqual({
      symbol: "ADIB",
      name: "Abu Dhabi Islamic Bank",
      exchange: "ADX",
      currency: "AED",
      country: "UAE",
    });
  });

  it("matches ADX companies by name fragment too", () => {
    expect(matchKnownAdx("first abu dhabi bank")?.symbol).toBe("FAB");
    expect(matchKnownAdx("Aldar")?.symbol).toBe("ALDAR");
    expect(matchKnownAdx("EMAAR")).toBeNull(); // DFM name must not trigger ADX notice
  });
});

// ---------------------------------------------------------------------------
// Required case: missing ADX asset → manual-custom suggestion
// ---------------------------------------------------------------------------

describe("missing ADX asset (FAB)", () => {
  it("returns zero results plus the create-custom-UAE-asset path", async () => {
    const res = await searchSymbols("FAB", mock);
    expect(res.results).toHaveLength(0);
    expect(res.adxNotice).not.toBeNull();
    expect(res.adxNotice!.message).toContain("custom UAE asset");
    expect(res.adxNotice!.prefill.symbol).toBe("FAB");
    expect(res.adxNotice!.prefill.exchange).toBe("ADX");
    expect(res.customAssetPath).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Required case: fallback to MockProvider
// ---------------------------------------------------------------------------

class FailingProvider implements MarketDataProvider {
  readonly id = "yahoo" as const; // impersonates a broken live provider
  constructor(private code: ProviderError["code"] = "network") {}
  private fail(): never {
    throw new ProviderError("simulated outage", this.code, this.id);
  }
  normalizeResult(): never {
    this.fail();
  }
  async searchSymbol(): Promise<SymbolSearchResult[]> {
    this.fail();
  }
  async getQuote(): Promise<Quote> {
    this.fail();
  }
  async getCompanyProfile(): Promise<never> {
    this.fail();
  }
  async getHistoricalPrices(): Promise<never> {
    this.fail();
  }
}

describe("provider fallback", () => {
  it("a network failure falls back to mock fixtures and says so", async () => {
    const res = await searchSymbols("AAPL", new FailingProvider("network"));
    expect(res.usedFallback).toBe(true);
    expect(res.provider).toBe("mock");
    expect(res.results.some((r) => r.symbol === "AAPL")).toBe(true);
  });

  it("not_found is a real answer and is NOT masked by fallback", async () => {
    await expect(
      fetchQuote("NOPE", undefined, new FailingProvider("not_found"))
    ).rejects.toMatchObject({ code: "not_found" });
  });
});

// ---------------------------------------------------------------------------
// Required case: normalized result shape (Yahoo raw payloads, no network)
// ---------------------------------------------------------------------------

describe("YahooProvider.normalizeResult", () => {
  const yahoo = new YahooProvider();

  it("normalizes a raw search quote into the SymbolSearchResult shape", () => {
    // Recorded from the live Phase 0 spike (design doc §10).
    const raw = {
      symbol: "EMAAR.AE",
      shortname: "EMAAR PROPERTIES",
      exchange: "DFM",
      exchDisp: "DFM",
      quoteType: "EQUITY",
    };
    const r = yahoo.normalizeResult(raw, "search") as SymbolSearchResult;
    expect(r).toEqual({
      symbol: "EMAAR",
      providerSymbol: "EMAAR.AE",
      name: "EMAAR PROPERTIES",
      exchange: {
        code: "DFM",
        mic: "XDFM",
        name: "Dubai Financial Market",
        country: "UAE",
        currency: "AED",
      },
      assetClass: "stock",
    });
  });

  it("normalizes a raw quote into the Quote shape", () => {
    const raw = {
      symbol: "2222.SR",
      regularMarketPrice: 26.16,
      currency: "SAR",
      regularMarketTime: new Date("2026-07-07T12:19:49.000Z"),
      regularMarketChangePercent: 0.0,
      marketState: "POSTPOST",
      fullExchangeName: "Saudi",
    };
    const q = yahoo.normalizeResult(raw, "quote") as Quote;
    expect(q.providerSymbol).toBe("2222.SR");
    expect(q.price).toBe(26.16);
    expect(q.currency).toBe("SAR");
    expect(q.asOf).toBe("2026-07-07T12:19:49.000Z");
  });

  it("labels unknown exchanges honestly instead of guessing", () => {
    const raw = { symbol: "XYZ.XX", exchange: "ZZZ", quoteType: "EQUITY" };
    const r = yahoo.normalizeResult(raw, "search") as SymbolSearchResult;
    expect(r.exchange.country).toBe("?");
    expect(r.exchange.currency).toBe("?");
  });

  it("throws not_found when a quote has no price", () => {
    expect(() =>
      yahoo.normalizeResult({ symbol: "GHOST" }, "quote")
    ).toThrowError(ProviderError);
  });
});

// ---------------------------------------------------------------------------
// Stubs fail loudly with configuration guidance
// ---------------------------------------------------------------------------

describe("paid-provider stubs", () => {
  // Typed as the interface — callers only ever see MarketDataProvider.
  const twelveData: MarketDataProvider = new TwelveDataProvider();
  const eodhd: MarketDataProvider = new EODHDProvider();

  it("Twelve Data stub throws not_configured with the env key name", async () => {
    await expect(twelveData.searchSymbol("AAPL")).rejects.toMatchObject({
      code: "not_configured",
    });
    await expect(twelveData.searchSymbol("AAPL")).rejects.toThrow(
      /TWELVE_DATA_API_KEY/
    );
  });

  it("EODHD stub throws not_configured with the env token name", async () => {
    await expect(eodhd.getQuote("ADIB", "ADX")).rejects.toMatchObject({
      code: "not_configured",
    });
    await expect(eodhd.getQuote("ADIB", "ADX")).rejects.toThrow(
      /EODHD_API_TOKEN/
    );
  });
});
