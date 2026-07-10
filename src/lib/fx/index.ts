/**
 * FX layer — READ/PRESENTATION ONLY (never touches the ledger engine;
 * native transaction values are immutable).
 *
 * Provider abstraction mirrors the market-data pattern: the active provider
 * is server-side and swappable; every rate carries rate/source/as_of/base/
 * quote so converted figures can explain themselves (AMANAH §4.9/§4.11).
 *
 * M-interim methodology: USD/AED uses the official peg (3.6725), explicitly
 * identified as such. A live FX provider slots in at M2 without UI changes.
 */

export interface FxRate {
  base: string; // e.g. "USD"
  quote: string; // e.g. "AED"  (1 base = rate quote)
  rate: number;
  source: string;
  asOf: string; // ISO timestamp
}

export interface FxProvider {
  readonly id: string;
  /** Returns null when the pair is not supported — callers must EXCLUDE, never zero. */
  getRate(base: string, quote: string): FxRate | null;
}

/** The official USD/AED peg, applied symmetrically. Server-side constant by design. */
export const USD_AED_PEG = 3.6725;

export class PegFxProvider implements FxProvider {
  readonly id = "aed-peg";

  getRate(base: string, quote: string): FxRate | null {
    const b = base.toUpperCase();
    const q = quote.toUpperCase();
    const asOf = new Date().toISOString();
    const source = `configured AED peg methodology (USD/AED ${USD_AED_PEG})`;
    if (b === q) return { base: b, quote: q, rate: 1, source: "identity", asOf };
    if (b === "USD" && q === "AED")
      return { base: b, quote: q, rate: USD_AED_PEG, source, asOf };
    if (b === "AED" && q === "USD")
      return { base: b, quote: q, rate: 1 / USD_AED_PEG, source, asOf };
    return null; // any other pair: unsupported until the M2 live provider
  }
}

let provider: FxProvider | null = null;
export function getFxProvider(): FxProvider {
  provider ??= new PegFxProvider();
  return provider;
}

// ---------------------------------------------------------------------------
// Read-layer conversion — pure, tested
// ---------------------------------------------------------------------------

export function convert(amount: number, rate: FxRate): number {
  return Math.round((amount * rate.rate + Number.EPSILON) * 100) / 100;
}

export interface CurrencyAmount {
  currency: string;
  amount: number;
}

export interface ConvertedTotal {
  display_currency: string;
  /** Sum of all convertible components, in the display currency. */
  total: number;
  /** True when any component needed conversion (→ figure must carry ≈). */
  approximate: boolean;
  /** Components with no available rate — EXCLUDED, never treated as zero. */
  excluded: CurrencyAmount[];
  /** The rates applied (for provenance). */
  rates_used: FxRate[];
}

/**
 * Convert per-currency amounts into one display-currency total.
 * Missing-rate components are excluded and reported — never zeroed (§AMANAH
 * "no fake certainty"). Inputs are never mutated.
 */
export function convertTotals(
  parts: CurrencyAmount[],
  displayCurrency: string,
  fx: FxProvider = getFxProvider()
): ConvertedTotal {
  const display = displayCurrency.toUpperCase();
  let total = 0;
  let approximate = false;
  const excluded: CurrencyAmount[] = [];
  const rates_used: FxRate[] = [];

  for (const part of parts) {
    const from = part.currency.toUpperCase();
    if (from === display) {
      total += part.amount;
      continue;
    }
    const rate = fx.getRate(from, display);
    if (!rate) {
      excluded.push({ currency: from, amount: part.amount });
      continue;
    }
    total += convert(part.amount, rate);
    approximate = true;
    if (!rates_used.some((r) => r.base === rate.base && r.quote === rate.quote)) {
      rates_used.push(rate);
    }
  }

  return {
    display_currency: display,
    total: Math.round((total + Number.EPSILON) * 100) / 100,
    approximate,
    excluded,
    rates_used,
  };
}

/** Provenance derivation line for a converted figure (AMANAH §4.11). */
export function fxDerivation(rates: FxRate[]): string | undefined {
  if (rates.length === 0) return undefined;
  return rates
    .map(
      (r) =>
        `Converted using ${r.base}/${r.quote} ${r.rate.toFixed(4)} · Source: ${r.source} · As of ${r.asOf}`
    )
    .join(" ; ");
}
