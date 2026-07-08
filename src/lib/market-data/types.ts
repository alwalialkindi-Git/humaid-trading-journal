/**
 * Market data abstraction — normalized types and the provider contract.
 *
 * The rest of the app only ever sees these shapes. Raw provider payloads are
 * converted via each provider's `normalizeResult()` and never leak upward.
 * Providers run SERVER-SIDE ONLY (API keys, CORS, and shared-cache writes).
 */

export type AssetClass =
  | "stock"
  | "etf"
  | "crypto"
  | "sukuk"
  | "fund"
  | "commodity"
  | "cash"
  | "other";

/** Exchange metadata attached to every search result — never omitted (§2.4). */
export interface ExchangeInfo {
  /** Our canonical code ('DFM', 'ADX', 'NASDAQ', …) or a provider code we can't map. */
  code: string;
  name: string;
  country: string; // '?' when unknown — displayed, never hidden
  currency: string; // '?' when unknown
  mic?: string;
}

export interface SymbolSearchResult {
  /** Display symbol, e.g. 'EMAAR' */
  symbol: string;
  /** Provider's canonical id used for follow-up calls, e.g. 'EMAAR.AE' */
  providerSymbol: string;
  name: string;
  exchange: ExchangeInfo;
  assetClass: AssetClass;
  /**
   * Set when this result is a known false-friend for the query (e.g. the
   * ADIB-Egypt listing when the user is looking for ADIB on ADX). The UI must
   * render it and must NOT auto-select the result.
   */
  warning?: string;
}

export interface Quote {
  providerSymbol: string;
  price: number;
  currency: string;
  asOf: string; // ISO timestamp
  dayChangePercent: number | null;
  marketState: string | null; // 'REGULAR' | 'CLOSED' | … provider-normalized
  exchangeName: string | null;
}

export interface CompanyProfile {
  providerSymbol: string;
  name: string | null;
  sector: string | null;
  industry: string | null;
  country: string | null;
}

export type HistoryRange = "1M" | "3M" | "6M" | "1Y" | "5Y";

export interface PricePoint {
  date: string; // YYYY-MM-DD
  close: number;
}

/** What a raw payload is being normalized into. */
export type NormalizeKind = "search" | "quote" | "profile";

export interface MarketDataProvider {
  readonly id: "yahoo" | "twelvedata" | "eodhd" | "mock";

  searchSymbol(query: string): Promise<SymbolSearchResult[]>;
  getQuote(symbol: string, exchange?: string): Promise<Quote>;
  getCompanyProfile(symbol: string, exchange?: string): Promise<CompanyProfile>;
  getHistoricalPrices(
    symbol: string,
    exchange?: string,
    range?: HistoryRange
  ): Promise<PricePoint[]>;

  /**
   * Convert one raw provider payload into the normalized shape for `kind`.
   * Exposed on the interface (not private) so normalization is directly
   * testable against recorded fixtures per provider.
   */
  normalizeResult(
    raw: unknown,
    kind: NormalizeKind
  ): SymbolSearchResult | Quote | CompanyProfile;
}

export type ProviderErrorCode =
  | "not_found"
  | "network"
  | "rate_limited"
  | "not_configured";

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code: ProviderErrorCode,
    public readonly providerId: string
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
