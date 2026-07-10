"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { refreshPricesAction } from "@/app/(app)/portfolio/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toaster";
import { AddTransactionButton } from "@/components/transactions/add-transaction-button";
import { CurrencySwitcher } from "@/components/portfolio/currency-switcher";
import { formatFullTimestamp } from "@/lib/amanah/number";

/**
 * Wealth page header (Bug 2 fix): name + actions only. The ambiguous
 * "incl. cash" totals are GONE — all figures render through the shared
 * SummaryCards read model below, never here.
 */
export function PortfolioHeader({
  portfolioId,
  portfolioName,
  displayCurrency,
  latestPriceAsOf,
}: {
  portfolioId: string;
  portfolioName: string;
  displayCurrency: "USD" | "AED";
  latestPriceAsOf: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    const res = await refreshPricesAction(portfolioId);
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
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{portfolioName}</h1>
        {latestPriceAsOf && (
          <p className="mt-0.5 text-xs text-ink-muted">
            Prices as of {formatFullTimestamp(latestPriceAsOf)}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <CurrencySwitcher value={displayCurrency} />
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
  );
}
