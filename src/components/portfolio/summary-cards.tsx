import { getFxProvider, convertTotals, fxDerivation, type ConvertedTotal } from "@/lib/fx";
import { formatMoney } from "@/lib/amanah/number";
import type { CurrencySummaryRow, WealthSummaryView } from "@/lib/services";
import type { Provenance } from "@/lib/amanah/trust";
import { Card, CardContent } from "@/components/ui/card";
import { Figure } from "@/components/ui/figure";

/**
 * THE financial summary cards (Bugs 2–4) — one component rendered by BOTH
 * Wealth and Dashboard, fed by the one shared read model
 * (PositionsService.getWealthSummary). Pages never do their own arithmetic.
 *
 * Currency law: primary figure in the user's display currency, secondary
 * ≈ equivalent below it (smaller, muted, never equal in authority). Native
 * per-currency truth stays visible underneath. Components with no FX rate
 * are EXCLUDED and named — never zeroed.
 */

const SECONDARY_OF: Record<string, string> = { AED: "USD", USD: "AED" };

type Metric = {
  key: keyof Pick<
    CurrencySummaryRow,
    | "total_value"
    | "market_value"
    | "cash"
    | "cost_basis"
    | "unrealized_pnl"
    | "realized_pnl"
  >;
  label: string;
  kind: "money" | "delta";
  derivation: string;
};

const METRICS: Metric[] = [
  { key: "total_value", label: "Total portfolio value", kind: "money", derivation: "market value + cash" },
  { key: "market_value", label: "Market value", kind: "money", derivation: "Σ quantity × price over priced open holdings" },
  { key: "cash", label: "Cash", kind: "money", derivation: "Σ ledger cash events (deposits, buys, sells, dividends, payments)" },
  { key: "cost_basis", label: "Cost basis", kind: "money", derivation: "Σ quantity × average cost over open holdings (buy fees capitalized)" },
  { key: "unrealized_pnl", label: "Unrealized P&L", kind: "delta", derivation: "market value − cost basis of priced holdings" },
  { key: "realized_pnl", label: "Realized P&L", kind: "delta", derivation: "Σ engine-computed realized P&L (lifetime, incl. closed positions)" },
];

function convertMetric(
  rows: CurrencySummaryRow[],
  key: Metric["key"],
  display: string
): ConvertedTotal {
  return convertTotals(
    rows.map((r) => ({ currency: r.currency, amount: r[key] })),
    display,
    getFxProvider()
  );
}

export function SummaryCards({
  wealth,
  displayCurrency,
  actorName,
}: {
  wealth: WealthSummaryView;
  displayCurrency: "USD" | "AED";
  actorName: string | null;
}) {
  const rows = wealth.rows;
  const secondaryCurrency = SECONDARY_OF[displayCurrency];
  const asOf = rows.map((r) => r.as_of).filter(Boolean).sort().at(-1) ?? null;

  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {METRICS.map((metric) => {
          const primary = convertMetric(rows, metric.key, displayCurrency);
          const secondary = convertMetric(rows, metric.key, secondaryCurrency);

          const provenance: Provenance = {
            state: "calculated",
            source: "Ledger engine",
            asOf: asOf ?? undefined,
            actor: actorName ?? undefined,
            derivation: [
              metric.derivation,
              fxDerivation(primary.rates_used),
              metric.key === "market_value" && wealth.unpriced_total > 0
                ? `${wealth.unpriced_total} unpriced holding(s) excluded`
                : undefined,
            ]
              .filter(Boolean)
              .join(" · "),
          };

          return (
            <Card key={metric.key}>
              <CardContent className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                  {metric.label}
                </p>
                <div className="mt-1.5">
                  <Figure
                    value={primary.total}
                    kind={metric.kind}
                    currency={displayCurrency}
                    size="lg"
                    approx={primary.approximate}
                    provenance={provenance}
                  />
                </div>
                {/* secondary equivalent: smaller, muted, always ≈ */}
                <div className="mt-0.5 text-ink-faint">
                  <Figure
                    value={secondary.total}
                    kind={metric.kind}
                    currency={secondaryCurrency}
                    size="sm"
                    approx
                    className="text-ink-faint"
                  />
                </div>
                {primary.excluded.length > 0 && (
                  <p className="mt-1 text-[10px] text-warn">
                    Excludes {primary.excluded.map((e) => e.currency).join(", ")} — no FX
                    rate.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Native truth — never hidden behind conversion */}
      <p className="text-xs text-ink-muted">
        Native totals:{" "}
        {rows
          .map((r) => `${formatMoney(r.total_value, r.currency)}`)
          .join(" · ")}
        {wealth.unpriced_total > 0 &&
          ` · ${wealth.unpriced_total} unpriced holding(s) excluded from market value`}
      </p>
    </div>
  );
}
