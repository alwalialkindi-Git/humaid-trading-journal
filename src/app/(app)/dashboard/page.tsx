import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  Coins,
  Eye,
  PieChart,
  Target,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  computeTradeStats,
  computePortfolioSummary,
  daysUntilNextAnniversary,
  tradePnl,
} from "@/lib/calculations";
import { generateInsights, estimateZakat } from "@/lib/insights";
import {
  formatCurrency,
  formatDate,
  formatSignedCurrency,
  pnlColor,
} from "@/lib/format";
import type {
  Trade,
  Holding,
  Dividend,
  WatchlistItem,
  Profile,
} from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { InsightCards } from "@/components/app/insight-cards";
import { ComplianceBadge } from "@/components/app/compliance-badge";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profileRes, tradesRes, holdingsRes, dividendsRes, watchlistRes] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user!.id).single(),
      supabase
        .from("trades")
        .select("*")
        .eq("user_id", user!.id)
        .order("entry_date", { ascending: false }),
      supabase.from("holdings").select("*").eq("user_id", user!.id),
      supabase.from("dividends").select("*").eq("user_id", user!.id),
      supabase.from("watchlist").select("*").eq("user_id", user!.id),
    ]);

  const profile = (profileRes.data ?? null) as Profile | null;
  const trades = (tradesRes.data ?? []) as Trade[];
  const holdings = (holdingsRes.data ?? []) as Holding[];
  const dividends = (dividendsRes.data ?? []) as Dividend[];
  const watchlist = (watchlistRes.data ?? []) as WatchlistItem[];

  const currency = profile?.currency ?? "AED";
  const stats = computeTradeStats(trades);
  const portfolio = computePortfolioSummary(holdings, dividends);
  const portfolioValue = portfolio.marketValue + (profile?.cash_balance ?? 0);
  const zakatEstimate = profile ? estimateZakat(profile, holdings, dividends) : 0;
  const insights = generateInsights({ trades, holdings, dividends, profile });

  // Shariah compliance summary of holdings
  const complianceCounts = holdings.reduce(
    (acc, h) => {
      acc[h.shariah_status] = (acc[h.shariah_status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Watchlist alerts: current price at or below target buy price
  const watchlistAlerts = watchlist.filter(
    (w) =>
      w.target_price != null &&
      w.current_price != null &&
      w.current_price <= w.target_price
  );

  // Hawl reminder
  const daysToHawl = profile?.hawl_date
    ? daysUntilNextAnniversary(profile.hawl_date)
    : null;

  const recentTrades = trades.slice(0, 5);
  const firstName = profile?.full_name?.split(" ")[0];

  if (trades.length === 0 && holdings.length === 0) {
    return (
      <div>
        <PageHeader
          title={firstName ? `As-salamu alaykum, ${firstName}` : "Welcome"}
          description="Your journal is ready. Start by logging your first trade or holding."
        />
        <EmptyState
          icon={BookOpenText}
          title="Nothing logged yet"
          description="Record your first transaction to start building your portfolio."
        >
          <Button asChild>
            <Link href="/portfolio">Open your portfolio</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={firstName ? `As-salamu alaykum, ${firstName}` : "Dashboard"}
        description="A calm overview of your trading, portfolio, and obligations."
      >
        <Button asChild>
          <Link href="/portfolio">Open portfolio</Link>
        </Button>
      </PageHeader>

      {/* Phase 5 transition notice — removed with the Phase 8 data migration */}
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
        This dashboard shows your <strong>legacy data</strong>. New transactions live in{" "}
        <Link href="/portfolio" className="font-medium underline">
          Portfolio
        </Link>{" "}
        — migration of old records is coming.
      </p>

      {/* Top stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Portfolio value"
          value={formatCurrency(portfolioValue, currency)}
          sub={`incl. ${formatCurrency(profile?.cash_balance ?? 0, currency)} cash`}
          icon={PieChart}
        />
        <StatCard
          label="Total P&L"
          value={formatSignedCurrency(stats.totalPnl, currency)}
          sub={`${formatSignedCurrency(stats.realizedPnl, currency)} realized`}
          icon={TrendingUp}
          valueClassName={pnlColor(stats.totalPnl)}
        />
        <StatCard
          label="Win rate"
          value={stats.closedTrades > 0 ? `${stats.winRate.toFixed(0)}%` : "—"}
          sub={`${stats.wins}W / ${stats.losses}L over ${stats.closedTrades} closed`}
          icon={Target}
        />
        <StatCard
          label="Zakat estimate"
          value={formatCurrency(zakatEstimate, currency)}
          sub={
            daysToHawl != null
              ? `Hawl in ${daysToHawl} day${daysToHawl === 1 ? "" : "s"}`
              : "Set your hawl date in Zakat"
          }
          icon={Coins}
        />
      </div>

      {/* Hawl reminder banner */}
      {daysToHawl != null && daysToHawl <= 30 && (
        <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-emerald-900">
            <strong>Zakat reminder:</strong> your hawl completes in {daysToHawl}{" "}
            day{daysToHawl === 1 ? "" : "s"}. Prepare your calculation.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link href="/zakat">
              Open calculator <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent trades */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Recent trades</CardTitle>
              <CardDescription>Your latest journal entries</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/trades">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentTrades.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No trades logged yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTrades.map((t) => {
                    const pnl = tradePnl(t);
                    return (
                      <TableRow key={t.id}>
                        <TableCell>
                          <Link
                            href={`/trades/${t.id}/edit`}
                            className="font-medium hover:underline"
                          >
                            {t.symbol}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {t.strategy ?? t.asset_type}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(t.entry_date)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={t.trade_status === "open" ? "secondary" : "neutral"}
                          >
                            {t.trade_status}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${pnl != null ? pnlColor(pnl) : "text-muted-foreground"}`}
                        >
                          {pnl != null ? formatSignedCurrency(pnl, currency) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Right column: compliance + watchlist alerts */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Shariah compliance</CardTitle>
              <CardDescription>Status of your holdings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {holdings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No holdings yet.</p>
              ) : (
                (
                  [
                    ["compliant", "Compliant"],
                    ["doubtful", "Doubtful"],
                    ["non_compliant", "Non-compliant"],
                    ["not_reviewed", "Not reviewed"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{complianceCounts[key] ?? 0}</span>
                  </div>
                ))
              )}
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href="/shariah">Open Shariah Filter</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Watchlist alerts</CardTitle>
              <CardDescription>Symbols at or below target price</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {watchlistAlerts.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Eye className="h-4 w-4" /> No alerts right now.
                </p>
              ) : (
                watchlistAlerts.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between rounded-lg border bg-emerald-50/50 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{w.symbol}</p>
                      <p className="text-xs text-muted-foreground">
                        Target {formatCurrency(w.target_price!, currency)} · now{" "}
                        {formatCurrency(w.current_price!, currency)}
                      </p>
                    </div>
                    <ComplianceBadge status={w.shariah_status} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Insights */}
      <div>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Insights</h2>
        <InsightCards insights={insights} />
      </div>
    </div>
  );
}
