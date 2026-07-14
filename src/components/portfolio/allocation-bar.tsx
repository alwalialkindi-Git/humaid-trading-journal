import { cn } from "@/lib/utils";
import { convertTotals, getFxProvider } from "@/lib/fx";
import { allocationSegments } from "@/lib/fin-table";
import { formatMoney, formatPercentLabel, APPROX } from "@/lib/amanah/number";
import type { HoldingView } from "@/lib/services";

/**
 * AllocationBar — the signature composition visual (sprint §10/§23; the
 * donut is retired). 100% stacked horizontal, top-8 + "Other", labeled
 * segments. Weights are computed in the display currency via the read-layer
 * FX provider; holdings whose currency has no rate are EXCLUDED and named,
 * never zeroed (D-009). Chart colors come from the closed chart token set.
 */

const SEGMENT_TOKENS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export function AllocationBar({
  holdings,
  displayCurrency,
  className,
}: {
  holdings: HoldingView[];
  displayCurrency: string;
  className?: string;
}) {
  const fx = getFxProvider();
  const excludedCurrencies = new Set<string>();
  let unpriced = 0;

  const items = [];
  for (const h of holdings) {
    if (h.quantity <= 0) continue;
    if (h.market_value == null) {
      unpriced += 1;
      continue;
    }
    const converted = convertTotals(
      [{ currency: h.asset.currency, amount: h.market_value }],
      displayCurrency,
      fx
    );
    if (converted.excluded.length > 0) {
      excludedCurrencies.add(h.asset.currency.toUpperCase());
      continue;
    }
    items.push({ label: h.asset.symbol, value: converted.total });
  }

  const segments = allocationSegments(items, 8);
  if (segments.length === 0) return null;
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          Allocation
        </p>
        <p className="figure-sm text-ink-faint">
          {APPROX} {formatMoney(total, displayCurrency)} priced
        </p>
      </div>
      <div
        className="flex h-4 w-full overflow-hidden rounded-sm"
        role="img"
        aria-label={`Allocation: ${segments
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
      {(unpriced > 0 || excludedCurrencies.size > 0) && (
        <p className="text-[11px] text-warn">
          {unpriced > 0 && `${unpriced} unpriced holding${unpriced > 1 ? "s" : ""} excluded.`}
          {excludedCurrencies.size > 0 &&
            ` ${[...excludedCurrencies].join(", ")} excluded — no FX rate.`}
        </p>
      )}
    </div>
  );
}
