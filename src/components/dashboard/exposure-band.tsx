"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { normalizeDisplayValues } from "@/lib/fin-table";
import {
  EXPOSURE_DIMENSIONS,
  exposureExclusions,
  exposureItems,
  liquiditySplit,
  topConcentration,
  type ExposureDimension,
} from "@/lib/dashboard";
import { formatPercentLabel } from "@/lib/amanah/number";
import type { HoldingView } from "@/lib/services";
import { SegmentBar } from "@/components/portfolio/allocation-bar";
import { ShieldBadge, type ComplianceState } from "@/components/ui/shield-badge";

/**
 * Exposure band (D4, sprint §9.3 ◇A6): the signature allocation bar under a
 * grouping-dimension toggle (Asset · Class · Currency — account grouping
 * needs per-account holdings, M4; labels arrive M5.5), plus top-3
 * concentration, the compliance shield summary, and the liquidity split —
 * with real estate/PE incoming, hiding illiquidity is not a risk view.
 * Every figure derives from the ONE display-currency base the Wealth page
 * uses (normalizeDisplayValues) — the band and the Weight column can never
 * disagree.
 */

const COMPLIANCE_ORDER: ComplianceState[] = [
  "compliant",
  "doubtful",
  "non_compliant",
  "not_reviewed",
];

export function ExposureBand({
  holdings,
  displayCurrency,
}: {
  /** Open positions only. */
  holdings: HoldingView[];
  displayCurrency: string;
}) {
  const [dimension, setDimension] = useState<ExposureDimension>("asset");

  const normalized = useMemo(
    () =>
      normalizeDisplayValues(
        holdings,
        (h) => h.asset.id,
        (h) => h.market_value,
        (h) => h.asset.currency,
        displayCurrency
      ),
    [holdings, displayCurrency]
  );

  const items = useMemo(
    () => exposureItems(holdings, normalized, dimension),
    [holdings, normalized, dimension]
  );
  const exclusions = useMemo(
    () => exposureExclusions(holdings, normalized),
    [holdings, normalized]
  );
  const top = useMemo(
    () => topConcentration(holdings, normalized),
    [holdings, normalized]
  );
  const liquidity = useMemo(
    () => liquiditySplit(holdings, normalized),
    [holdings, normalized]
  );
  const currencies = useMemo(
    () => exposureItems(holdings, normalized, "currency"),
    [holdings, normalized]
  );
  const currencyTotal = currencies.reduce((s, c) => s + c.value, 0);

  const complianceCounts = holdings.reduce(
    (acc, h) => {
      acc[h.shariah_status] = (acc[h.shariah_status] ?? 0) + 1;
      return acc;
    },
    {} as Record<ComplianceState, number>
  );

  if (holdings.length === 0) return null;

  return (
    <section aria-label="Exposure" className="rounded-lg border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Exposure</h2>
        <div
          role="group"
          aria-label="Group exposure by"
          className="inline-flex rounded-md border p-0.5"
        >
          {EXPOSURE_DIMENSIONS.map((d) => (
            <button
              key={d.key}
              type="button"
              aria-pressed={dimension === d.key}
              onClick={() => setDimension(d.key)}
              className={cn(
                "rounded-[5px] px-2.5 py-1 text-xs font-medium transition-colors",
                dimension === d.key
                  ? "bg-surface-sunken text-foreground"
                  : "text-ink-muted hover:text-foreground"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <SegmentBar
        label={`By ${dimension}`}
        items={items}
        displayCurrency={displayCurrency}
        unpriced={exclusions.unpriced}
        noRate={exclusions.noRate}
      />

      <dl className="mt-4 grid gap-x-6 gap-y-3 border-t pt-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Top concentration
          </dt>
          <dd className="mt-1 space-x-3">
            {top.length === 0 ? (
              <span className="text-ink-faint">— nothing priced</span>
            ) : (
              top.map((t) => (
                <span key={t.label} className="inline-flex items-baseline gap-1">
                  <span className="text-ink-muted">{t.label}</span>
                  <span className="figure-sm">{formatPercentLabel(t.percent)}</span>
                </span>
              ))
            )}
          </dd>
        </div>

        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Liquidity
          </dt>
          <dd className="mt-1">
            {liquidity == null ? (
              <span className="text-ink-faint">— nothing priced</span>
            ) : (
              <>
                <span className="text-ink-muted">Listed</span>{" "}
                <span className="figure-sm">
                  {formatPercentLabel(liquidity.listed_percent)}
                </span>
                <span className="mx-2 text-ink-faint">·</span>
                <span className="text-ink-muted">Unlisted</span>{" "}
                <span className="figure-sm">
                  {formatPercentLabel(liquidity.unlisted_percent)}
                </span>
              </>
            )}
          </dd>
        </div>

        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Currencies
          </dt>
          <dd className="mt-1 space-x-3">
            {currencyTotal <= 0 ? (
              <span className="text-ink-faint">— nothing priced</span>
            ) : (
              currencies
                .filter((c) => c.value > 0)
                .map((c) => (
                  <span key={c.label} className="inline-flex items-baseline gap-1">
                    <span className="text-ink-muted">{c.label}</span>
                    <span className="figure-sm">
                      {formatPercentLabel((c.value / currencyTotal) * 100)}
                    </span>
                  </span>
                ))
            )}
          </dd>
        </div>

        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Screening
          </dt>
          <dd className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            {COMPLIANCE_ORDER.filter((s) => (complianceCounts[s] ?? 0) > 0).map(
              (state) => (
                <span key={state} className="inline-flex items-center gap-1">
                  <ShieldBadge state={state} />
                  <span className="figure-sm">{complianceCounts[state]}</span>
                </span>
              )
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
