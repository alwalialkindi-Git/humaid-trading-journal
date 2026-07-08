import {
  ProviderError,
  type CompanyProfile,
  type MarketDataProvider,
  type Quote,
  type SymbolSearchResult,
} from "./types";
import { matchKnownAdx } from "./exchange-map";
import { getFallbackProvider, getProvider } from "./registry";

/**
 * Market data service — orchestration on top of the provider interface.
 * Implements the binding UAE search rules (design doc §2.4):
 *  1. Every result carries exchange + country + currency (provider contract).
 *  2. Nothing is ever auto-selected; the API only returns labeled candidates.
 *  3. A known-ADX query whose hits are on OTHER exchanges gets a per-result
 *     warning (the ADIB-Egypt case) and an ADX notice.
 *  4. Every response carries the "create custom asset" path; ADX queries get
 *     a prefilled UAE suggestion.
 */

export interface CustomAssetPrefill {
  symbol: string;
  name: string;
  exchange: "ADX";
  currency: "AED";
  country: "UAE";
}

export interface AdxNotice {
  type: "adx_unavailable";
  message: string;
  prefill: CustomAssetPrefill;
}

export interface SearchResponse {
  provider: string;
  query: string;
  results: SymbolSearchResult[];
  /** Present when the query matches a known ADX listing (no automated data). */
  adxNotice: AdxNotice | null;
  /** Always true: the create-custom-asset path is never hidden (§2.4 rule 4). */
  customAssetPath: true;
  /** True when the live provider failed and fixtures answered instead. */
  usedFallback: boolean;
}

async function withFallback<T>(
  provider: MarketDataProvider,
  call: (p: MarketDataProvider) => Promise<T>
): Promise<{ value: T; provider: MarketDataProvider; usedFallback: boolean }> {
  try {
    return { value: await call(provider), provider, usedFallback: false };
  } catch (e) {
    // not_found is a real answer, not an outage — don't mask it with fixtures.
    if (e instanceof ProviderError && e.code === "not_found") throw e;
    if (provider.id === "mock") throw e;
    const fallback = getFallbackProvider();
    return { value: await call(fallback), provider: fallback, usedFallback: true };
  }
}

export async function searchSymbols(
  query: string,
  providerOverride?: MarketDataProvider
): Promise<SearchResponse> {
  const active = providerOverride ?? getProvider();
  const trimmed = query.trim();
  if (!trimmed) {
    return {
      provider: active.id,
      query,
      results: [],
      adxNotice: null,
      customAssetPath: true,
      usedFallback: false,
    };
  }

  const { value: results, provider, usedFallback } = await withFallback(
    active,
    (p) => p.searchSymbol(trimmed)
  );

  const adxMatch = matchKnownAdx(trimmed);
  let adxNotice: AdxNotice | null = null;

  if (adxMatch) {
    const hasAdxResult = results.some((r) => r.exchange.code === "ADX");
    if (!hasAdxResult) {
      // Rule 3: flag every cross-exchange hit as a potential false friend —
      // it must be shown (honesty) but never auto-selected (safety).
      for (const r of results) {
        r.warning =
          `This is ${r.name} on ${r.exchange.name} (${r.exchange.country}, ` +
          `${r.exchange.currency}) — NOT ${adxMatch.name} on ADX. ` +
          `Select it only if it is really what you meant.`;
      }
      adxNotice = {
        type: "adx_unavailable",
        message:
          `${adxMatch.name} trades on ADX (Abu Dhabi), which the current data ` +
          `provider does not cover. Create it as a custom UAE asset with a ` +
          `manual price — it participates fully in your portfolio, P&L, zakat, ` +
          `and screening.`,
        prefill: {
          symbol: adxMatch.symbol,
          name: adxMatch.name,
          exchange: "ADX",
          currency: "AED",
          country: "UAE",
        },
      };
    }
  }

  return {
    provider: provider.id,
    query: trimmed,
    results,
    adxNotice,
    customAssetPath: true,
    usedFallback,
  };
}

export interface QuoteResponse {
  provider: string;
  quote: Quote;
  usedFallback: boolean;
}

export async function fetchQuote(
  symbol: string,
  exchange?: string,
  providerOverride?: MarketDataProvider
): Promise<QuoteResponse> {
  const active = providerOverride ?? getProvider();
  const { value, provider, usedFallback } = await withFallback(active, (p) =>
    p.getQuote(symbol, exchange)
  );
  return { provider: provider.id, quote: value, usedFallback };
}

export interface ProfileResponse {
  provider: string;
  profile: CompanyProfile;
  usedFallback: boolean;
}

export async function fetchProfile(
  symbol: string,
  exchange?: string,
  providerOverride?: MarketDataProvider
): Promise<ProfileResponse> {
  const active = providerOverride ?? getProvider();
  const { value, provider, usedFallback } = await withFallback(active, (p) =>
    p.getCompanyProfile(symbol, exchange)
  );
  return { provider: provider.id, profile: value, usedFallback };
}
