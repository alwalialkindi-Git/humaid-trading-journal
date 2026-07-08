import type { ExchangeInfo } from "./types";

/**
 * Exchange metadata used to enrich every search result with exchange,
 * country, and currency (§2.4 search UX rule 1). Mirrors the seeded
 * `exchanges` table for our canonical codes, plus mappings from provider
 * exchange codes to canonical ones.
 */

export const EXCHANGES: Record<string, ExchangeInfo> = {
  DFM: { code: "DFM", mic: "XDFM", name: "Dubai Financial Market", country: "UAE", currency: "AED" },
  ADX: { code: "ADX", mic: "XADS", name: "Abu Dhabi Securities Exchange", country: "UAE", currency: "AED" },
  NASDAQ_DUBAI: { code: "NASDAQ_DUBAI", mic: "DIFX", name: "Nasdaq Dubai", country: "UAE", currency: "USD" },
  TADAWUL: { code: "TADAWUL", mic: "XSAU", name: "Saudi Exchange (Tadawul)", country: "Saudi Arabia", currency: "SAR" },
  NASDAQ: { code: "NASDAQ", mic: "XNAS", name: "Nasdaq", country: "United States", currency: "USD" },
  NYSE: { code: "NYSE", mic: "XNYS", name: "New York Stock Exchange", country: "United States", currency: "USD" },
  NYSE_ARCA: { code: "NYSE_ARCA", mic: "ARCX", name: "NYSE Arca", country: "United States", currency: "USD" },
  CRYPTO: { code: "CRYPTO", name: "Crypto", country: "*", currency: "USD" },
  // Not in our seeded table but needed to LABEL results honestly (the
  // ADIB-Egypt case): we must show where a result actually trades.
  EGX: { code: "EGX", mic: "XCAI", name: "Egyptian Exchange (Cairo)", country: "Egypt", currency: "EGP" },
};

/** Yahoo search `exchange` codes → our canonical exchange codes. */
const YAHOO_EXCHANGE_MAP: Record<string, string> = {
  DFM: "DFM",
  SAU: "TADAWUL",
  NMS: "NASDAQ", // NasdaqGS
  NGM: "NASDAQ", // NasdaqGM
  NCM: "NASDAQ", // NasdaqCM
  NYQ: "NYSE",
  PCX: "NYSE_ARCA",
  CCC: "CRYPTO",
  CAI: "EGX",
};

/** Resolve a provider exchange code to full info; unknown codes are shown as-is. */
export function exchangeInfoFromProviderCode(
  providerCode: string | undefined,
  providerDisplay?: string
): ExchangeInfo {
  const canonical = providerCode ? YAHOO_EXCHANGE_MAP[providerCode] : undefined;
  if (canonical && EXCHANGES[canonical]) return EXCHANGES[canonical];
  return {
    code: providerCode ?? "?",
    name: providerDisplay ?? providerCode ?? "Unknown exchange",
    country: "?",
    currency: "?",
  };
}

/**
 * Known ADX listings (symbol → company). Yahoo has NO ADX coverage (verified,
 * design doc §10), so a query matching one of these must trigger the
 * "create custom UAE asset" path — and any fuzzy cross-exchange hit (e.g.
 * ADIB Egypt on Cairo) must carry a warning and never be auto-selected.
 */
export const KNOWN_ADX_SYMBOLS: Record<string, string> = {
  ADIB: "Abu Dhabi Islamic Bank",
  FAB: "First Abu Dhabi Bank",
  ALDAR: "Aldar Properties",
  IHC: "International Holding Company",
  TAQA: "Abu Dhabi National Energy Company (TAQA)",
  ADCB: "Abu Dhabi Commercial Bank",
  ADNOCDIST: "ADNOC Distribution",
  ADNOCGAS: "ADNOC Gas",
  ADPORTS: "AD Ports Group",
  EAND: "e& (Emirates Telecommunications Group)",
  BOROUGE: "Borouge",
  PUREHEALTH: "Pure Health Holding",
  MULTIPLY: "Multiply Group",
  ALPHADHABI: "Alpha Dhabi Holding",
};

export function matchKnownAdx(query: string): { symbol: string; name: string } | null {
  const q = query.trim().toUpperCase();
  if (KNOWN_ADX_SYMBOLS[q]) return { symbol: q, name: KNOWN_ADX_SYMBOLS[q] };
  // Also match by company-name fragment ("abu dhabi islamic" → ADIB)
  const lower = query.trim().toLowerCase();
  if (lower.length >= 4) {
    for (const [symbol, name] of Object.entries(KNOWN_ADX_SYMBOLS)) {
      if (name.toLowerCase().includes(lower)) return { symbol, name };
    }
  }
  return null;
}
