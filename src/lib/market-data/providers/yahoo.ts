import YahooFinance from "yahoo-finance2";
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
import { exchangeInfoFromProviderCode } from "../exchange-map";

/**
 * YahooProvider — M1 default.
 *
 * Free and keyless, with verified coverage (design doc §10): US equities/ETFs,
 * DFM (`EMAAR.AE`, `SALIK.AE`, `DEWA.AE`), Tadawul (`2222.SR`), crypto.
 * NO ADX coverage — the service layer handles that path.
 *
 * Unofficial API: treat every call as fallible; the registry falls back to
 * cached prices + MockProvider when Yahoo breaks.
 */

// Raw payload fragments we actually read (yahoo-finance2 responses).
interface YahooSearchQuote {
  symbol?: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  exchDisp?: string;
  quoteType?: string;
}
interface YahooQuote {
  symbol?: string;
  regularMarketPrice?: number;
  currency?: string;
  regularMarketTime?: Date | string | number;
  regularMarketChangePercent?: number;
  marketState?: string;
  fullExchangeName?: string;
  longName?: string;
  shortName?: string;
}
interface YahooAssetProfile {
  sector?: string;
  industry?: string;
  country?: string;
}

function quoteTypeToAssetClass(quoteType: string | undefined): SymbolSearchResult["assetClass"] {
  switch (quoteType) {
    case "EQUITY":
      return "stock";
    case "ETF":
      return "etf";
    case "CRYPTOCURRENCY":
      return "crypto";
    case "MUTUALFUND":
      return "fund";
    default:
      return "other";
  }
}

const RANGE_DAYS: Record<HistoryRange, number> = {
  "1M": 31,
  "3M": 92,
  "6M": 183,
  "1Y": 366,
  "5Y": 1827,
};

export class YahooProvider implements MarketDataProvider {
  readonly id = "yahoo" as const;
  private yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

  normalizeResult(raw: unknown, kind: NormalizeKind) {
    switch (kind) {
      case "search": {
        const q = raw as YahooSearchQuote;
        const providerSymbol = q.symbol ?? "";
        return {
          symbol: providerSymbol.split(".")[0] || providerSymbol,
          providerSymbol,
          name: q.shortname ?? q.longname ?? providerSymbol,
          exchange: exchangeInfoFromProviderCode(q.exchange, q.exchDisp),
          assetClass: quoteTypeToAssetClass(q.quoteType),
        } satisfies SymbolSearchResult;
      }
      case "quote": {
        const q = raw as YahooQuote;
        if (q.regularMarketPrice == null) {
          throw new ProviderError(
            `Yahoo returned no price for ${q.symbol}`,
            "not_found",
            this.id
          );
        }
        const t = q.regularMarketTime;
        const asOf =
          t instanceof Date
            ? t.toISOString()
            : typeof t === "number"
              ? new Date(t * 1000).toISOString()
              : (t ?? new Date(0).toISOString());
        return {
          providerSymbol: q.symbol ?? "",
          price: q.regularMarketPrice,
          currency: q.currency ?? "?",
          asOf: String(asOf),
          dayChangePercent: q.regularMarketChangePercent ?? null,
          marketState: q.marketState ?? null,
          exchangeName: q.fullExchangeName ?? null,
        } satisfies Quote;
      }
      case "profile": {
        const p = raw as YahooAssetProfile & { symbol?: string; name?: string };
        return {
          providerSymbol: p.symbol ?? "",
          name: p.name ?? null,
          sector: p.sector ?? null,
          industry: p.industry ?? null,
          country: p.country ?? null,
        } satisfies CompanyProfile;
      }
    }
  }

  async searchSymbol(query: string): Promise<SymbolSearchResult[]> {
    try {
      const res = await this.yf.search(query, { quotesCount: 8, newsCount: 0 });
      const quotes = (res.quotes ?? []) as YahooSearchQuote[];
      return quotes
        .filter((q) => q.symbol && q.quoteType !== "INDEX")
        .map((q) => this.normalizeResult(q, "search") as SymbolSearchResult);
    } catch (e) {
      throw this.asProviderError(e, `search "${query}"`);
    }
  }

  async getQuote(symbol: string): Promise<Quote> {
    try {
      const raw = await this.yf.quote(symbol);
      return this.normalizeResult(raw, "quote") as Quote;
    } catch (e) {
      throw this.asProviderError(e, `quote ${symbol}`);
    }
  }

  async getCompanyProfile(symbol: string): Promise<CompanyProfile> {
    try {
      const res = await this.yf.quoteSummary(symbol, { modules: ["assetProfile"] });
      return this.normalizeResult(
        { ...(res.assetProfile ?? {}), symbol },
        "profile"
      ) as CompanyProfile;
    } catch (e) {
      throw this.asProviderError(e, `profile ${symbol}`);
    }
  }

  async getHistoricalPrices(
    symbol: string,
    _exchange?: string,
    range: HistoryRange = "1Y"
  ): Promise<PricePoint[]> {
    try {
      const period1 = new Date(Date.now() - RANGE_DAYS[range] * 86_400_000);
      const res = await this.yf.chart(symbol, { period1, interval: "1d" });
      return (res.quotes ?? [])
        .filter((q) => q.close != null)
        .map((q) => ({
          date: new Date(q.date).toISOString().slice(0, 10),
          close: q.close as number,
        }));
    } catch (e) {
      throw this.asProviderError(e, `history ${symbol}`);
    }
  }

  private asProviderError(e: unknown, context: string): ProviderError {
    if (e instanceof ProviderError) return e;
    const message = e instanceof Error ? e.message : String(e);
    // yahoo-finance2 surfaces unknown symbols as assorted errors; treat
    // anything mentioning the symbol/validation as not_found, rest as network.
    const code = /not found|no fundamentals|undefined|invalid|404/i.test(message)
      ? "not_found"
      : "network";
    return new ProviderError(`Yahoo ${context}: ${message}`, code, this.id);
  }
}
