import {
  ProviderError,
  type CompanyProfile,
  type MarketDataProvider,
  type PricePoint,
  type Quote,
  type SymbolSearchResult,
} from "../types";

/**
 * TwelveDataProvider — STUB (interface-complete, not implemented in M1).
 *
 * Enable in M2 after validating GCC coverage (their "Grow" plan claims ADX —
 * verify with a trial key against ADIB/FAB/ALDAR before purchase).
 *
 * TO ENABLE:
 * 1. Get a key at https://twelvedata.com → set env var `TWELVE_DATA_API_KEY`
 *    (server-side only — never NEXT_PUBLIC_*; slot documented in .env.example).
 * 2. Set `MARKET_DATA_PROVIDER=twelvedata`.
 * 3. Implement the methods below against https://api.twelvedata.com:
 *    - search:  GET /symbol_search?symbol={q}                → data[]
 *    - quote:   GET /quote?symbol={s}&exchange={x}           → price, currency…
 *    - profile: GET /profile?symbol={s}&exchange={x}         → sector, industry…
 *    - history: GET /time_series?symbol={s}&interval=1day    → values[]
 *    Symbol mapping: Twelve Data uses exchange as a SEPARATE parameter
 *    (symbol='EMAAR', exchange='DFM') — unlike Yahoo's suffix convention.
 *    Free tier: 800 credits/day, 8 req/min — batch and throttle accordingly.
 */
export class TwelveDataProvider implements MarketDataProvider {
  readonly id = "twelvedata" as const;

  private notConfigured(): never {
    throw new ProviderError(
      "Twelve Data provider is a stub in M1. Set TWELVE_DATA_API_KEY and " +
        "implement lib/market-data/providers/twelvedata.ts (see file header).",
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
