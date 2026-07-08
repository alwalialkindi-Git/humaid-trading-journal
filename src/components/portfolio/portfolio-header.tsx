"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import type { PortfolioSummaryView } from "@/lib/services";
import { refreshPricesAction } from "@/app/(app)/portfolio/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { AddTransactionButton } from "@/components/transactions/add-transaction-button";
import { formatCurrency } from "@/lib/format";

export function PortfolioHeader({
  summary,
  latestPriceAsOf,
}: {
  summary: PortfolioSummaryView;
  latestPriceAsOf: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const totals = summary.totals.market_value_by_currency;
  const cashByCurrency = new Map(summary.cash.map((c) => [c.currency, c.balance]));
  // Total wealth per currency = priced holdings + cash in that currency.
  const currencies = [
    ...new Set([...Object.keys(totals), ...summary.cash.map((c) => c.currency)]),
  ].sort();

  async function handleRefresh() {
    setRefreshing(true);
    const res = await refreshPricesAction(summary.portfolio.id);
    setRefreshing(false);
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    const { updated, failed } = res.data;
    if (failed.length === 0) {
      toast(updated > 0 ? `Prices updated (${updated}).` : "No provider-priced holdings to refresh.");
    } else {
      toast(
        `Updated ${updated} of ${updated + failed.length} — ${failed.map((f) => f.symbol).join(", ")} unavailable (showing last known price).`,
        "error"
      );
    }
    router.refresh();
  }

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {summary.portfolio.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
            {currencies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No value yet — add a transaction.</p>
            ) : (
              currencies.map((ccy) => {
                const value = (totals[ccy] ?? 0) + (cashByCurrency.get(ccy) ?? 0);
                return (
                  <p key={ccy} className="text-xl font-semibold tracking-tight">
                    {formatCurrency(value, ccy)}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      incl. cash
                    </span>
                  </p>
                );
              })
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh prices
          </Button>
          <AddTransactionButton />
        </div>
      </div>

      {latestPriceAsOf && (
        <p className="text-xs text-muted-foreground">
          Prices as of {new Date(latestPriceAsOf).toLocaleString("en-GB")}
        </p>
      )}

      {summary.warnings.length > 0 && (
        <div className="space-y-1.5">
          {summary.warnings.map((w) => (
            <p
              key={w}
              className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
