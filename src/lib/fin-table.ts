import { convertTotals, getFxProvider, type FxProvider } from "@/lib/fx";

/**
 * FinTable logic — pure module (AMANAH §5, sprint §22).
 * The flagship table's behavior lives here so it is unit-testable without
 * DOM: sorting, per-currency aggregation (mixed currencies are NEVER summed,
 * §4.9), density persistence keys, display-currency normalization for weights
 * and cross-currency sorting, and the AllocationBar's top-N+other math.
 */

export type FinDensity = "comfortable" | "compact";

export const FIN_DENSITIES: readonly FinDensity[] = ["comfortable", "compact"];

/** localStorage key for a table's remembered density (a table-level preference). */
export function densityStorageKey(tableId: string): string {
  return `amanah:fin-density:${tableId}`;
}

export type SortDir = "asc" | "desc";

export interface SortState {
  key: string;
  dir: SortDir;
}

/**
 * Single-column sort. Nulls sort LAST in both directions (an unpriced value
 * never pretends to be the smallest number — §4.12 honesty).
 * Returns a new array; never mutates.
 */
export function sortRows<T>(
  rows: readonly T[],
  sortValue: (row: T) => string | number | null,
  dir: SortDir
): T[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = sortValue(a);
    const vb = sortValue(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1; // nulls last regardless of direction
    if (vb == null) return -1;
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * mul;
    return String(va).localeCompare(String(vb)) * mul;
  });
}

/** Next sort state for a header click: new column → desc, same column → flip. */
export function nextSort(current: SortState | null, key: string): SortState {
  if (!current || current.key !== key) return { key, dir: "desc" };
  return { key, dir: current.dir === "desc" ? "asc" : "desc" };
}

/**
 * Footer aggregate: sum amounts PER CURRENCY (never across — §4.9).
 * Null amounts (unpriced) are skipped, matching their exclusion notes.
 * Keys are sorted so footer order is stable.
 */
export function sumByCurrency<T>(
  rows: readonly T[],
  amount: (row: T) => number | null,
  currency: (row: T) => string
): { currency: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const v = amount(row);
    if (v == null) continue;
    const c = currency(row).toUpperCase();
    totals.set(c, round2((totals.get(c) ?? 0) + v));
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([c, total]) => ({ currency: c, total }));
}

// ---------------------------------------------------------------------------
// Display-currency normalization (§4.9) — ONE source for weights and sorting
// ---------------------------------------------------------------------------

export interface DisplayNormalized {
  /** Market value converted to the display currency; null when unpriced or no FX rate. */
  displayValue: number | null;
  /**
   * Share of the included (priced + convertible, positive) total, 1dp —
   * the same rounding as allocationSegments, so the Weight column and the
   * AllocationBar can never disagree. Null when displayValue is null.
   */
  weightPercent: number | null;
  /** True when the row's currency has no FX rate to the display currency (excluded, never zeroed). */
  noRate: boolean;
}

/**
 * Convert per-row native values into the display currency and derive weights
 * from THAT normalized base — portfolio weights are never computed from mixed
 * native currencies (§4.9). Rows that cannot be converted (unpriced, or no FX
 * rate) get null weight and are excluded from the base, never treated as zero.
 */
export function normalizeDisplayValues<T>(
  rows: readonly T[],
  key: (row: T) => string,
  value: (row: T) => number | null,
  currency: (row: T) => string,
  displayCurrency: string,
  fx: FxProvider = getFxProvider()
): Map<string, DisplayNormalized> {
  const out = new Map<string, DisplayNormalized>();
  for (const row of rows) {
    const v = value(row);
    if (v == null) {
      out.set(key(row), { displayValue: null, weightPercent: null, noRate: false });
      continue;
    }
    const converted = convertTotals(
      [{ currency: currency(row), amount: v }],
      displayCurrency,
      fx
    );
    if (converted.excluded.length > 0) {
      out.set(key(row), { displayValue: null, weightPercent: null, noRate: true });
      continue;
    }
    out.set(key(row), { displayValue: converted.total, weightPercent: null, noRate: false });
  }

  // Weight base mirrors allocationSegments: positive display values only.
  let total = 0;
  for (const n of out.values()) {
    if (n.displayValue != null && n.displayValue > 0) total += n.displayValue;
  }
  if (total > 0) {
    for (const n of out.values()) {
      if (n.displayValue != null) {
        n.weightPercent =
          n.displayValue > 0 ? round1((n.displayValue / total) * 100) : 0;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// AllocationBar math (sprint §10/§25: top-8 + expandable "other")
// ---------------------------------------------------------------------------

export interface AllocationInput {
  label: string;
  /** Value in the DISPLAY currency (conversion happens before this module). */
  value: number;
}

export interface AllocationSegment {
  label: string;
  value: number;
  /** Share of the included total, 1dp (§4.6). Shares sum to ~100 (rounding). */
  percent: number;
  isOther: boolean;
}

/**
 * Top-N segments + a single "Other" remainder. Zero/negative values are
 * excluded (an allocation bar shows composition of positive value only).
 */
export function allocationSegments(
  items: readonly AllocationInput[],
  maxSegments = 8
): AllocationSegment[] {
  const positive = items.filter((i) => i.value > 0);
  const total = positive.reduce((s, i) => s + i.value, 0);
  if (total <= 0) return [];

  const sorted = [...positive].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, maxSegments);
  const tail = sorted.slice(maxSegments);

  const segments: AllocationSegment[] = head.map((i) => ({
    label: i.label,
    value: round2(i.value),
    percent: round1((i.value / total) * 100),
    isOther: false,
  }));

  if (tail.length > 0) {
    const rest = tail.reduce((s, i) => s + i.value, 0);
    segments.push({
      label: `Other (${tail.length})`,
      value: round2(rest),
      percent: round1((rest / total) * 100),
      isOther: true,
    });
  }

  return segments;
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
function round1(v: number): number {
  return Math.round((v + Number.EPSILON) * 10) / 10;
}
