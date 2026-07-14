/**
 * AMANAH number system — the binding rules of AMANAH_DESIGN_SYSTEM.md §4.
 * Pure module. All NEW surfaces format through here; legacy lib/format.ts
 * remains for un-migrated MVP pages and is retired page-by-page (D2+).
 *
 * Non-negotiables encoded below:
 * - tabular rendering is the component's job (figure-* utilities); this
 *   module guarantees the STRINGS: grouping, precision, trimming, signs.
 * - true minus U+2212, never a hyphen (§4.7)
 * - money always 2dp; unit prices ≤4dp trimmed to ≥2; quantities ≤8dp trimmed
 * - deltas always signed in both directions
 * - `≈` mandatory on converted figures (§4.9)
 */

export const MINUS = "−"; // − true minus
export const APPROX = "≈"; // ≈

const LOCALE = "en-US"; // deterministic grouping ("1,234.50") across environments

/**
 * Display timezone for timestamps (§4.8). Fixed to Gulf Standard Time
 * (UTC+4, no DST) — timestamp text must be byte-identical between the server
 * render and client hydration (React #418 otherwise), so machine-local
 * formatting is forbidden here. Becomes a profile preference when one exists.
 */
export const DISPLAY_TIME_ZONE = "Asia/Dubai";

function groupFormat(value: number, minFrac: number, maxFrac: number): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: minFrac,
    maximumFractionDigits: maxFrac,
  }).format(value);
}

/** Replace ASCII hyphen-minus from Intl output with the true minus sign. */
function trueMinus(formatted: string): string {
  return formatted.replace(/-/g, MINUS);
}

/** "1,234.50" — money figure without its currency code (§4.3). */
export function formatMoneyValue(value: number): string {
  return trueMinus(groupFormat(value, 2, 2));
}

export interface MoneyParts {
  /** Signed figure, e.g. "1,234.50" or "−125.50" */
  figure: string;
  /** ISO code rendered smaller/lighter by the Figure primitive */
  code: string;
}

export function formatMoneyParts(value: number, currency: string): MoneyParts {
  return { figure: formatMoneyValue(value), code: currency.toUpperCase() };
}

/** "1,234.50 AED" — plain-text form (toasts, aria, exports). */
export function formatMoney(value: number, currency: string): string {
  const { figure, code } = formatMoneyParts(value, currency);
  return `${figure} ${code}`;
}

/**
 * Delta money: ALWAYS signed both directions (§4.7).
 * "+290.00" / "−125.50" / "+0.00" (a zero delta is a positive-signed fact).
 */
export function formatDeltaMoney(value: number): string {
  const sign = value < 0 ? MINUS : "+";
  return `${sign}${groupFormat(Math.abs(value), 2, 2)}`;
}

/** "≈ 61,430.00 AED" — mandatory marker for FX-converted figures (§4.9). */
export function formatApproxMoney(value: number, currency: string): string {
  return `${APPROX} ${formatMoney(value, currency)}`;
}

/** Unit price: up to 4 decimals, trailing zeros trimmed to a minimum of 2 (§4.4). */
export function formatUnitPrice(value: number): string {
  const four = groupFormat(value, 2, 4);
  return trueMinus(four);
}

/** Quantity: up to 8 decimals, trailing zeros fully trimmed (§4.5). */
export function formatQuantity(value: number): string {
  return trueMinus(groupFormat(value, 0, 8));
}

/** Percent for tables/stats: 1 decimal (§4.6). Signed when delta=true. */
export function formatPercent(value: number, options: { delta?: boolean } = {}): string {
  const body = groupFormat(Math.abs(value), 1, 1);
  if (options.delta) {
    const sign = value < 0 ? MINUS : "+";
    return `${sign}${body}%`;
  }
  return `${trueMinus(groupFormat(value, 1, 1))}%`;
}

/** Percent for labels ≥10%: no decimals (§4.6). */
export function formatPercentLabel(value: number): string {
  const digits = Math.abs(value) >= 10 ? 0 : 1;
  return `${trueMinus(groupFormat(value, digits, digits))}%`;
}

/**
 * Figure timestamp (§4.8): "12:31" if same local day, else "8 Jul".
 * `now` injectable for tests — this module never calls Date.now() itself
 * when a caller can supply time (React purity + determinism).
 */
export function formatFigureTimestamp(iso: string, now: number = Date.now()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dayInZone = (t: Date) =>
    t.toLocaleDateString("en-CA", { timeZone: DISPLAY_TIME_ZONE });
  const sameDay = dayInZone(d) === dayInZone(new Date(now));
  if (sameDay) {
    return d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: DISPLAY_TIME_ZONE,
    });
  }
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: DISPLAY_TIME_ZONE,
  });
}

/** Full provenance timestamp (§4.8): "8 Jul 2026, 12:31". */
export function formatFullTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: DISPLAY_TIME_ZONE,
  });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DISPLAY_TIME_ZONE,
  });
  return `${date}, ${time}`;
}

/** Screen-reader money (§27): "12,120 dirhams 50 fils" is over-engineering;
 * the accessible form is the plain-text money with the sign spelled out. */
export function ariaMoney(value: number, currency: string, delta = false): string {
  const abs = groupFormat(Math.abs(value), 2, 2);
  const sign = delta ? (value < 0 ? "down " : "up ") : value < 0 ? "minus " : "";
  return `${sign}${abs} ${currency.toUpperCase()}`;
}
