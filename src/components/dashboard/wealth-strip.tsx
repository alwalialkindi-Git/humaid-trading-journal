"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { convertTotals, fxDerivation, getFxProvider } from "@/lib/fx";
import { formatMoney } from "@/lib/amanah/number";
import {
  DEFAULT_PERIOD,
  PERIODS,
  PERIOD_STORAGE_KEY,
  type Period,
} from "@/lib/dashboard";
import type { CurrencySummaryRow } from "@/lib/services";
import type { Provenance } from "@/lib/amanah/trust";
import { Figure } from "@/components/ui/figure";

/**
 * Wealth strip — the dashboard hero (D4, sprint §9.1). Total wealth in
 * figure-xl from the SAME shared read model as the Wealth page
 * (getWealthSummary rows), display-currency law intact: primary figure,
 * ≈ secondary, native truth underneath, missing-FX components excluded and
 * named.
 *
 * The period selector is the GLOBAL one (D/W/M/YTD/1Y — persisted, shared
 * with Wealth/Insights when they gain period views). Period change and the
 * sparkline require the daily valuation series (hard M2 requirement, CIO
 * condition 1) — until it exists those slots say "insufficient history",
 * never an approximation.
 */

const SECONDARY_OF: Record<string, string> = { AED: "USD", USD: "AED" };

/**
 * Period preference store — localStorage-backed external store so the
 * remembered selection flows through useSyncExternalStore (no
 * setState-in-effect; SSR snapshot is the default, corrected after
 * hydration). Same pattern as the FinTable density store.
 */
const periodListeners = new Set<() => void>();
function subscribePeriod(cb: () => void): () => void {
  periodListeners.add(cb);
  return () => periodListeners.delete(cb);
}
function readPeriod(): Period {
  const stored = window.localStorage.getItem(PERIOD_STORAGE_KEY);
  return stored && (PERIODS as readonly string[]).includes(stored)
    ? (stored as Period)
    : DEFAULT_PERIOD;
}
function writePeriod(period: Period): void {
  window.localStorage.setItem(PERIOD_STORAGE_KEY, period);
  for (const cb of periodListeners) cb();
}

export function WealthStrip({
  rows,
  unpricedTotal,
  displayCurrency,
  actorName,
}: {
  rows: CurrencySummaryRow[];
  unpricedTotal: number;
  displayCurrency: "USD" | "AED";
  actorName: string | null;
}) {
  const period = useSyncExternalStore(
    subscribePeriod,
    readPeriod,
    () => DEFAULT_PERIOD
  );

  if (rows.length === 0) return null;

  const parts = rows.map((r) => ({ currency: r.currency, amount: r.total_value }));
  const primary = convertTotals(parts, displayCurrency, getFxProvider());
  const secondaryCurrency = SECONDARY_OF[displayCurrency];
  const secondary = convertTotals(parts, secondaryCurrency, getFxProvider());
  const asOf = rows.map((r) => r.as_of).filter(Boolean).sort().at(-1) ?? null;

  const provenance: Provenance = {
    state: "calculated",
    source: "Ledger engine",
    asOf: asOf ?? undefined,
    actor: actorName ?? undefined,
    derivation: [
      "market value + cash, every currency",
      fxDerivation(primary.rates_used),
      unpricedTotal > 0 ? `${unpricedTotal} unpriced holding(s) excluded` : undefined,
    ]
      .filter(Boolean)
      .join(" · "),
  };

  return (
    <section
      aria-label="Total wealth"
      className="rounded-lg border bg-card p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Total wealth
          </p>
          <div className="mt-1">
            <Figure
              value={primary.total}
              currency={displayCurrency}
              size="xl"
              approx={primary.approximate}
              provenance={provenance}
            />
          </div>
          <div className="mt-0.5">
            <Figure
              value={secondary.total}
              currency={secondaryCurrency}
              size="sm"
              approx
              className="text-ink-faint"
            />
          </div>
          {/* Native truth — never hidden behind conversion */}
          <p className="mt-2 text-xs text-ink-muted">
            Native totals:{" "}
            {rows.map((r) => formatMoney(r.total_value, r.currency)).join(" · ")}
            {unpricedTotal > 0 &&
              ` · ${unpricedTotal} unpriced holding(s) excluded`}
          </p>
          {primary.excluded.length > 0 && (
            <p className="mt-1 text-[11px] text-warn">
              Excludes {primary.excluded.map((e) => e.currency).join(", ")} — no FX
              rate.
            </p>
          )}
        </div>

        <div className="shrink-0 sm:text-right">
          <div
            role="group"
            aria-label="Period"
            className="inline-flex rounded-md border p-0.5"
          >
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={period === p}
                onClick={() => writePeriod(p)}
                className={cn(
                  "rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors",
                  period === p
                    ? "bg-surface-sunken text-foreground"
                    : "text-ink-muted hover:text-foreground"
                )}
              >
                {p}
              </button>
            ))}
          </div>
          {/* Period change + sparkline seat — honest until the valuation series */}
          <p className="mt-2 max-w-[260px] text-xs text-ink-muted">
            Change ({period}): insufficient history.
          </p>
          <p className="mt-0.5 max-w-[260px] text-[11px] leading-relaxed text-ink-faint">
            Period figures and the trend line appear once the daily valuation
            record begins — never an approximation.
          </p>
        </div>
      </div>
    </section>
  );
}
