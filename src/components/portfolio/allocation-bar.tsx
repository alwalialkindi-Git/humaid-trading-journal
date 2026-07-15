import { cn } from "@/lib/utils";
import {
  allocationSegments,
  type AllocationInput,
  type DisplayNormalized,
} from "@/lib/fin-table";
import { exposureExclusions, exposureItems } from "@/lib/dashboard";
import { formatMoney, formatPercentLabel, APPROX } from "@/lib/amanah/number";
import type { HoldingView } from "@/lib/services";

/**
 * The signature composition visual (sprint §10/§23; the donut is retired).
 * 100% stacked horizontal, top-8 + "Other", labeled segments.
 *
 * `SegmentBar` is the presentational core (D4 reuses it for every exposure
 * dimension); `AllocationBar` remains the Wealth page's holdings-fed wrapper.
 * Values always come from the SAME display-currency normalization the Weight
 * column uses (lib/fin-table normalizeDisplayValues) — the bar and the column
 * can never disagree. Holdings with no FX rate are EXCLUDED and named, never
 * zeroed (D-009). Chart colors come from the chart token set.
 */

const SEGMENT_TOKENS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export function SegmentBar({
  label,
  items,
  displayCurrency,
  unpriced = [],
  noRate = [],
  maxSegments = 8,
  className,
}: {
  label: string;
  /** Values in the DISPLAY currency (one normalized base, §4.9). */
  items: AllocationInput[];
  displayCurrency: string;
  /** Symbols excluded because they carry no price — named, never zeroed. */
  unpriced?: string[];
  /** "SYMBOL (CCY)" entries excluded because no FX rate exists. */
  noRate?: string[];
  maxSegments?: number;
  className?: string;
}) {
  const segments = allocationSegments(items, maxSegments);
  if (segments.length === 0) return null;
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          {label}
        </p>
        <p className="figure-sm text-ink-faint">
          {APPROX} {formatMoney(total, displayCurrency)} priced
        </p>
      </div>
      <div
        className="flex h-4 w-full overflow-hidden rounded-sm"
        role="img"
        aria-label={`${label}: ${segments
          .map((s) => `${s.label} ${s.percent} percent`)
          .join(", ")}`}
      >
        {segments.map((seg, i) => (
          <div
            key={seg.label}
            title={`${seg.label} · ${formatPercentLabel(seg.percent)}`}
            style={{
              width: `${seg.percent}%`,
              background: seg.isOther
                ? "var(--border-strong)"
                : SEGMENT_TOKENS[i % SEGMENT_TOKENS.length],
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((seg, i) => (
          <span key={seg.label} className="inline-flex items-center gap-1.5 text-xs">
            <span
              aria-hidden
              className="h-2 w-2 rounded-[2px]"
              style={{
                background: seg.isOther
                  ? "var(--border-strong)"
                  : SEGMENT_TOKENS[i % SEGMENT_TOKENS.length],
              }}
            />
            <span className="text-ink-muted">{seg.label}</span>
            <span className="figure-sm text-ink">{formatPercentLabel(seg.percent)}</span>
          </span>
        ))}
      </div>
      {(unpriced.length > 0 || noRate.length > 0) && (
        <p className="text-[11px] text-warn">
          {unpriced.length > 0 && `${unpriced.join(", ")} excluded — unpriced.`}
          {noRate.length > 0 && ` ${noRate.join(", ")} excluded — no FX rate.`}
        </p>
      )}
    </div>
  );
}

export function AllocationBar({
  holdings,
  normalized,
  displayCurrency,
  className,
}: {
  /** Open positions only — the same set `normalized` was computed over. */
  holdings: HoldingView[];
  /** Shared display-currency normalization (computed once by the caller). */
  normalized: Map<string, DisplayNormalized>;
  displayCurrency: string;
  className?: string;
}) {
  const { unpriced, noRate } = exposureExclusions(holdings, normalized);
  return (
    <SegmentBar
      label="Allocation"
      items={exposureItems(holdings, normalized, "asset")}
      displayCurrency={displayCurrency}
      unpriced={unpriced}
      noRate={noRate}
      className={className}
    />
  );
}
