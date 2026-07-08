import {
  ProviderError,
  type CompanyProfile,
  type MarketDataProvider,
  type PricePoint,
  type Quote,
  type SymbolSearchResult,
} from "../types";

/**
 * EODHDProvider — STUB (interface-complete, not implemented in M1).
 *
 * Candidate for M2 ADX coverage (EODHD lists both DFM and ADX exchanges —
 * verify with a trial token against ADIB/FAB/ALDAR before purchase).
 *
 * TO ENABLE:
 * 1. Get a token at https://eodhd.com → set env var `EODHD_API_TOKEN`
 *    (server-side only — never NEXT_PUBLIC_*; slot documented in .env.example).
 * 2. Set `MARKET_DATA_PROVIDER=eodhd`.
 * 3. Implement the methods below against https://eodhd.com/api:
 *    - search:  GET /search/{q}?api_token=…                      → array
 *    - quote:   GET /real-time/{SYMBOL}.{EXCHANGE}?api_token=…   → close, change_p…
 *    - profile: GET /fundamentals/{SYMBOL}.{EXCHANGE}?filter=General
 *    - history: GET /eod/{SYMBOL}.{EXCHANGE}?period=d
 *    Symbol mapping: EODHD uses SYMBOL.EXCHANGE suffixes with ITS OWN codes:
 *    DFM = '.DU' (EMAAR.DU), ADX = '.AD' (ADIB.AD), Tadawul = '.SR',
 *    US = '.US'. Map from our canonical exchange codes accordingly.
 */
export class EODHDProvider implements MarketDataProvider {
  readonly id = "eodhd" as const;

  private notConfigured(): never {
    throw new ProviderError(
      "EODHD provider is a stub in M1. Set EODHD_API_TOKEN and implement " +
        "lib/market-data/providers/eodhd.ts (see file header).",
      "not_configured",
      this.id
    );
  }

  // Implementations may omit interface parameters they don't use (TS
  // structural typing) — the real signatures live on MarketDataProvider.
  normalizeResult(): SymbolSearchResult | Quote | CompanyProfile {
    this.notConfigured();
  }
  async searchSymbol(): Promise<SymbolSearchResult[]> {
    this.notConfigured();
  }
  async getQuote(): Promise<Quote> {
    this.notConfigured();
  }
  async getCompanyProfile(): Promise<CompanyProfile> {
    this.notConfigured();
  }
  async getHistoricalPrices(): Promise<PricePoint[]> {
    this.notConfigured();
  }
}
