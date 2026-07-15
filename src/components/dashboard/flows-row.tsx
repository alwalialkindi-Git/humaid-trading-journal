import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/amanah/number";
import type { IncomeSummaryRow } from "@/lib/dashboard";
import type { CurrencySummaryRow } from "@/lib/services";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Figure } from "@/components/ui/figure";

/**
 * Flows row (D4, sprint §9.4): cash per currency (the mini statement),
 * income (dividends MTD/YTD + purification owed), and the zakat tile —
 * brass-tinted, an act of worship, never alarm styling. Cash figures come
 * from the SAME wealth read model rows; income derives from the raw ledger
 * (lib/dashboard incomeSummary). The zakat ESTIMATE stays honestly pending
 * until the ledger zakat engine (M4) — the hawl date is real today.
 */

export function FlowsRow({
  rows,
  income,
  hawlDate,
  daysToHawl,
}: {
  rows: CurrencySummaryRow[];
  income: IncomeSummaryRow[];
  hawlDate: string | null;
  daysToHawl: number | null;
}) {
  const owed = income.filter((r) => r.purification_owed > 0);

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Cash — per currency, from the shared read model */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle>Cash</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/portfolio?tab=cash">
              Statement <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-ink-muted">No cash recorded yet.</p>
          ) : (
            rows.map((r) => (
              <div key={r.currency} className="flex items-baseline justify-between">
                <span className="text-xs text-ink-muted">{r.currency}</span>
                <Figure value={r.cash} currency={r.currency} size="md" />
              </div>
            ))
          )}
          {rows.some((r) => r.cash < 0) && (
            <p className="text-[11px] text-warn">
              Negative cash usually means a missing deposit — record it.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Income — dividends MTD/YTD + purification owed */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle>Income</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/portfolio?tab=activity&type=dividend">
              Dividends <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {income.length === 0 ? (
            <p className="text-sm text-ink-muted">No dividends recorded yet.</p>
          ) : (
            income.map((r) => (
              <div key={r.currency} className="flex items-baseline justify-between">
                <span className="text-xs text-ink-muted">{r.currency} · MTD / YTD</span>
                <span className="space-x-2">
                  <Figure value={r.dividends_mtd} currency={r.currency} size="sm" />
                  <span className="text-ink-faint">/</span>
                  <Figure value={r.dividends_ytd} currency={r.currency} size="sm" />
                </span>
              </div>
            ))
          )}
          {owed.length > 0 && (
            <p className="border-t pt-2 text-xs">
              <span aria-hidden className="mr-1 text-sacred">
                ◆
              </span>
              Purification owed:{" "}
              <span className="figure-sm">
                {owed
                  .map((r) => formatMoney(r.purification_owed, r.currency))
                  .join(" · ")}
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Zakat — the sacred tile */}
      <Card className="border-sacred/30 bg-sacred-surface">
        <CardHeader className="pb-3">
          <CardTitle>
            <span aria-hidden className="mr-1.5 text-sacred">
              ◆
            </span>
            Zakat
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {hawlDate && daysToHawl != null ? (
            <p className="text-sm">
              Your hawl completes in{" "}
              <span className="figure-sm font-medium">{daysToHawl}</span> day
              {daysToHawl === 1 ? "" : "s"}
              <span className="block text-xs text-ink-muted">
                Anniversary of {formatDate(hawlDate)}
              </span>
            </p>
          ) : (
            <p className="text-sm text-ink-muted">
              No hawl date set —{" "}
              <Link href="/settings" className="underline underline-offset-2">
                set it in Settings
              </Link>
              .
            </p>
          )}
          <p className="text-xs text-ink-muted">
            Accrual estimate: not calculated yet — ledger zakat engine pending.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link href="/zakat">
              Open Zakat &amp; Purify <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
