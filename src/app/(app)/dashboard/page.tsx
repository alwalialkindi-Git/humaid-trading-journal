import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenText, Coins } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServices } from "@/lib/services/runtime";
import { daysUntilNextAnniversary } from "@/lib/calculations";
import { formatDate, formatNumber, formatSignedCurrency, pnlColor, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShieldBadge, type ComplianceState } from "@/components/ui/shield-badge";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { SummaryCards } from "@/components/portfolio/summary-cards";
import { CurrencySwitcher } from "@/components/portfolio/currency-switcher";
import { NegativeCashNotice } from "@/components/portfolio/negative-cash-notice";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Dashboard (Bug 3 fix): every financial figure on this page reads the SAME
 * ledger read model as Wealth (PositionsService.getWealthSummary rendered by
 * the shared SummaryCards) — one financial truth, reconciled by construction.
 * No legacy table (trades/holdings/dividends) is read here; sections that
 * are not ledger-ready yet (zakat) show an honest pending state.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let data;
  try {
    const services = await createServices(supabase);
    const portfolios = await services.portfolios.list(user!.id);
    const active = portfolios.find((p) => p.is_default) ?? portfolios[0];
    if (!active) {
      throw new Error("relation missing: no portfolio — run the 002 backfill");
    }
    const [wealth, holdings, transactions, profileRes] = await Promise.all([
      services.positions.getWealthSummary(user!.id, active.id),
      services.positions.getHoldings(user!.id, active.id),
      services.transactions.list(user!.id, { portfolioId: active.id }),
      supabase
        .from("profiles")
        .select("currency, full_name, hawl_date")
        .eq("id", user!.id)
        .single(),
    ]);
    data = { wealth, holdings, transactions, profile: profileRes.data };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/does not exist|schema cache|relation/i.test(message)) {
      return (
        <EmptyState
          icon={BookOpenText}
          title="The ledger isn’t initialized"
          description="Apply supabase/migrations/002_ledger.sql, then reload. See docs/DEPLOYMENT.md."
        />
      );
    }
    throw e;
  }

  const { wealth, holdings, transactions, profile } = data;
  const displayCurrency = profile?.currency === "USD" ? "USD" : "AED";
  const firstName = profile?.full_name?.split(" ")[0];

  const daysToHawl = profile?.hawl_date
    ? daysUntilNextAnniversary(profile.hawl_date)
    : null;

  if (transactions.length === 0) {
    return (
      <div>
        <PageHeader
          title={firstName ? `As-salamu alaykum, ${firstName}` : "Welcome"}
          description="Your wealth desk is ready."
        />
        <EmptyState
          icon={BookOpenText}
          title="Your ledger is empty"
          description="Record your first buy or a cash deposit — every figure on this page derives from your transactions."
        >
          <Button asChild>
            <Link href="/portfolio">Open your portfolio</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  const recent = [...transactions]
    .sort((a, b) =>
      a.trade_date === b.trade_date
        ? b.created_at.localeCompare(a.created_at)
        : b.trade_date.localeCompare(a.trade_date)
    )
    .slice(0, 5);

  const symbolByAsset = new Map(holdings.map((h) => [h.asset.id, h.asset.symbol]));

  const open = holdings.filter((h) => h.quantity > 0);
  const complianceCounts = open.reduce(
    (acc, h) => {
      acc[h.shariah_status] = (acc[h.shariah_status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={firstName ? `As-salamu alaykum, ${firstName}` : "Dashboard"}
        description="One truth: every figure below derives from your ledger."
      >
        <div className="flex items-center gap-2">
          <CurrencySwitcher value={displayCurrency} />
          <Button asChild>
            <Link href="/portfolio">Open portfolio</Link>
          </Button>
        </div>
      </PageHeader>

      {/* THE shared read model — identical component and data source as Wealth */}
      <SummaryCards
        wealth={wealth}
        displayCurrency={displayCurrency}
        actorName={profile?.full_name ?? null}
      />
      <NegativeCashNotice currencies={wealth.negative_cash_currencies} />

      {daysToHawl != null && daysToHawl <= 30 && (
        <div className="flex flex-col gap-2 rounded-md border border-sacred/30 bg-sacred-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            <strong>Zakat reminder:</strong> your hawl completes in {daysToHawl} day
            {daysToHawl === 1 ? "" : "s"}.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link href="/zakat">
              Open Zakat & Purify <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent activity — from the ledger */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Your latest ledger entries</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/portfolio?tab=history">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="flex items-center gap-2.5">
                    <Badge
                      variant={
                        t.type === "buy"
                          ? "success"
                          : t.type === "sell"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {titleCase(t.type)}
                    </Badge>
                    <span className="font-medium">
                      {t.asset_id ? (symbolByAsset.get(t.asset_id) ?? "—") : "Cash"}
                    </span>
                    <span className="text-xs text-ink-muted">{formatDate(t.trade_date)}</span>
                  </span>
                  <span className={cn("figure-md", t.realized_pnl != null && pnlColor(t.realized_pnl))}>
                    {t.quantity != null && t.price != null
                      ? `${formatNumber(t.quantity, 4)} @ ${formatNumber(t.price, 4)} ${t.currency}`
                      : t.amount != null
                        ? `${formatNumber(t.amount)} ${t.currency}`
                        : "—"}
                    {t.realized_pnl != null && (
                      <span className="ml-2 text-xs">
                        {formatSignedCurrency(t.realized_pnl, t.currency)}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Compliance of current positions — ledger holdings, shield grammar */}
          <Card>
            <CardHeader>
              <CardTitle>Shariah status</CardTitle>
              <CardDescription>Your current positions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {open.length === 0 ? (
                <p className="text-sm text-ink-muted">No open positions.</p>
              ) : (
                (
                  ["compliant", "doubtful", "non_compliant", "not_reviewed"] as ComplianceState[]
                ).map((state) => (
                  <div key={state} className="flex items-center justify-between text-sm">
                    <ShieldBadge state={state} />
                    <span className="figure-md">{complianceCounts[state] ?? 0}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Zakat — honest pending state until the M4 ledger-based engine */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-sacred" /> Zakat estimate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-ink-muted">
                Not calculated yet — ledger integration pending.
              </p>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <Link href="/zakat">Use the calculator</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
