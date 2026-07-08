/**
 * Formatting helpers. Currency defaults to AED but every formatter accepts an
 * override so other currencies can be supported later.
 */

export const DEFAULT_CURRENCY = "AED";

export const SUPPORTED_CURRENCIES = [
  "AED",
  "USD",
  "SAR",
  "KWD",
  "QAR",
  "OMR",
  "BHD",
  "EUR",
  "GBP",
] as const;

export function formatCurrency(
  value: number,
  currency: string = DEFAULT_CURRENCY,
  options: Intl.NumberFormatOptions = {}
): string {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    ...options,
  }).format(value);
}

export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-AE", {
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatSignedCurrency(
  value: number,
  currency: string = DEFAULT_CURRENCY
): string {
  const formatted = formatCurrency(Math.abs(value), currency);
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** True when a price timestamp is older than 24h (kept out of component
 * render bodies — React purity rules forbid Date.now there). */
export function isStalePrice(asOf: string | null | undefined): boolean {
  if (!asOf) return false;
  return Date.now() - new Date(asOf).getTime() > 24 * 3_600_000;
}

export function pnlColor(value: number): string {
  if (value > 0) return "text-profit";
  if (value < 0) return "text-loss";
  return "text-muted-foreground";
}

export function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
