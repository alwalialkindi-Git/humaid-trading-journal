import {
  ProviderError,
  type CompanyProfile,
  type HistoryRange,
  type MarketDataProvider,
  type NormalizeKind,
  type PricePoint,
  type Quote,
  type SymbolSearchResult,
} from "../types";
import { EXCHANGES } from "../exchange-map";

/**
 * MockProvider — deterministic fixtures for tests, development without
 * network, and automatic fallback when the live provider fails.
 *
 * Fixtures deliberately mirror real provider behavior, including the
 * ADIB-Egypt false positive: searching "ADIB" here returns ONLY the Cairo
 * listing, exactly like Yahoo does (design doc §10) — so the service layer's
 * UAE rules are testable offline.
 */

interface Fixture {
  search: SymbolSearchResult;
  quote: Quote;
  profile: CompanyProfile;
  /** Extra query strings this fixture matches — emulates provider fuzzy search. */
  aliases?: string[];
}

const FIXED_AS_OF = "2026-07-07T12:00:00.000Z";

function fixture(
  symbol: string,
  providerSymbol: string,
  name: string,
  exchangeCode: keyof typeof EXCHANGES,
  assetClass: SymbolSearchResult["assetClass"],
  price: number,
  profile: Partial<CompanyProfile> = {}
): Fixture {
  const exchange = EXCHANGES[exchangeCode];
  return {
    search: { symbol, providerSymbol, name, exchange, assetClass },
    quote: {
      providerSymbol,
      price,
      currency: exchange.currency,
      asOf: FIXED_AS_OF,
      dayChangePercent: 0.42,
      marketState: "CLOSED",
      exchangeName: exchange.name,
    },
    profile: {
      providerSymbol,
      name,
      sector: profile.sector ?? null,
      industry: profile.industry ?? null,
      country: profile.country ?? exchange.country,
    },
  };
}

const FIXTURES: Fixture[] = [
  fixture("AAPL", "AAPL", "Apple Inc.", "NASDAQ", "stock", 310.66, {
    sector: "Technology",
    industry: "Consumer Electronics",
    country: "United States",
  }),
  fixture("MSFT", "MSFT", "Microsoft Corporation", "NASDAQ", "stock", 388.84, {
    sector: "Technology",
    industry: "Software - Infrastructure",
    country: "United States",
  }),
  fixture("TSLA", "TSLA", "Tesla, Inc.", "NASDAQ", "stock", 402.9, {
    sector: "Consumer Cyclical",
    industry: "Auto Manufacturers",
    country: "United States",
  }),
  fixture("EMAAR", "EMAAR.AE", "Emaar Properties", "DFM", "stock", 12.06, {
    sector: "Real Estate",
    industry: "Real Estate - Development",
    country: "United Arab Emirates",
  }),
  fixture("DEWA", "DEWA.AE", "Dubai Electricity and Water Authority", "DFM", "stock", 2.81, {
    sector: "Utilities",
    industry: "Utilities - Regulated Electric",
    country: "United Arab Emirates",
  }),
  fixture("SALIK", "SALIK.AE", "Salik Company P.J.S.C.", "DFM", "stock", 5.87, {
    sector: "Industrials",
    industry: "Infrastructure Operations",
    country: "United Arab Emirates",
  }),
  fixture("2222", "2222.SR", "Saudi Arabian Oil Co.", "TADAWUL", "stock", 26.16, {
    sector: "Energy",
    industry: "Oil & Gas Integrated",
    country: "Saudi Arabia",
  }),
  fixture("SPUS", "SPUS", "SP Funds S&P 500 Sharia ETF", "NYSE_ARCA", "etf", 56.76),
  fixture("HLAL", "HLAL", "Wahed FTSE USA Shariah ETF", "NASDAQ", "etf", 70.58),
  // The false friend: Yahoo's only "ADIB" hit is the EGYPTIAN listing —
  // fuzzy-matched by name, which the alias reproduces offline.
  {
    ...fixture(
      "EGS60111C019",
      "EGS60111C019.CA",
      "Abu Dhabi Islamic Bank - Egypt",
      "EGX",
      "stock",
      47.74,
      { sector: "Financial Services", industry: "Banks", country: "Egypt" }
    ),
    aliases: ["ADIB"],
  },
];

export class MockProvider implements MarketDataProvider {
  readonly id = "mock" as const;

  normalizeResult(raw: unknown, kind: NormalizeKind) {
    // Mock data is already normalized; pass through with a shape assertion.
    const value = raw as SymbolSearchResult | Quote | CompanyProfile;
    if (kind === "search" && !("assetClass" in value)) {
      throw new ProviderError("Malformed mock search payload", "not_found", this.id);
    }
    return value;
  }

  async searchSymbol(query: string): Promise<SymbolSearchResult[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return FIXTURES.filter(
      (f) =>
        f.search.symbol.toLowerCase().includes(q) ||
        f.search.providerSymbol.toLowerCase().includes(q) ||
        f.search.name.toLowerCase().includes(q) ||
        (f.aliases ?? []).some((a) => a.toLowerCase().includes(q))
    ).map((f) => ({ ...f.search }));
  }

  async getQuote(symbol: string): Promise<Quote> {
    const hit = FIXTURES.find(
      (f) => f.search.providerSymbol.toUpperCase() === symbol.toUpperCase()
    );
    if (!hit) {
      throw new ProviderError(`Mock has no quote for ${symbol}`, "not_found", this.id);
    }
    return { ...hit.quote };
  }

  async getCompanyProfile(symbol: string): Promise<CompanyProfile> {
    const hit = FIXTURES.find(
      (f) => f.search.providerSymbol.toUpperCase() === symbol.toUpperCase()
    );
    if (!hit) {
      throw new ProviderError(`Mock has no profile for ${symbol}`, "not_found", this.id);
    }
    return { ...hit.profile };
  }

  async getHistoricalPrices(
    symbol: string,
    _exchange?: string,
    range: HistoryRange = "1Y"
  ): Promise<PricePoint[]> {
    const quote = await this.getQuote(symbol);
    const days = { "1M": 22, "3M": 66, "6M": 130, "1Y": 260, "5Y": 1300 }[range];
    // Deterministic gentle sine wave around the fixture price.
    const points: PricePoint[] = [];
    const end = new Date(FIXED_AS_OF).getTime();
    for (let i = days; i >= 0; i--) {
      const date = new Date(end - i * 86_400_000).toISOString().slice(0, 10);
      const close = quote.price * (1 + 0.05 * Math.sin(i / 9));
      points.push({ date, close: Math.round(close * 10000) / 10000 });
    }
    return points;
  }
}
