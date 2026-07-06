import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Banknote, PieChart as PieIcon, TrendingUp, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  computePortfolioSummary,
  computeTradeStats,
} from "@/lib/calculations";
import {
  formatCurrency,
  formatSignedCurrency,
  pnlColor,
  titleCase,
} from "@/lib/format";
import type { Dividend, Holding, Profile, Trade } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { AllocationPie } from "@/components/charts/charts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CashBalanceCard } from "./cash-balance-card";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profileRes, holdingsRes, dividendsRes, tradesRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase.from("holdings").select("*").eq("user_id", user!.id),
    supabase.from("dividends").select("*").eq("user_id", user!.id),
    supabase.from("trades").select("*").eq("user_id", user!.id),
  ]);

  const profile = profileRes.data as Profile | null;
  const holdings = (holdingsRes.data ?? []) as Holding[];
  const dividends = (dividendsRes.data ?? []) as Dividend[];
  const trades = (tradesRes.data ?? []) as Trade[];

  const currency = profile?.currency ?? "AED";
  const cash = profile?.cash_balance ?? 0;
  const summary = computePortfolioSummary(holdings, dividends);
  const tradeStats = computeTradeStats(trades);
  const totalValue = summary.marketValue + cash;

  // Include cash as its own slice in the asset-type allocation
  const typeAllocation =
    cash > 0
      ? [...summary.allocationByType, { key: "Cash", value: cash }].sort(
          (a, b) => b.value - a.value
        )
      : summary.allocationByType;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio"
        description="Holdings, cash, dividends, and allocation in one view."
      >
        <Button variant="outline" asChild>
          <Link href="/holdings">
            Manage holdings <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total portfolio value"
          value={formatCurrency(totalValue, currency)}
          sub={`${holdings.length} holdings + cash`}
          icon={PieIcon}
        />
        <StatCard
          label="Unrealized P&L"
          value={formatSignedCurrency(summary.unrealizedPnl, currency)}
          sub={`${summary.unrealizedPnlPercent.toFixed(1)}% vs cost basis`}
          icon={TrendingUp}
          valueClassName={pnlColor(summary.unrealizedPnl)}
        />
        <StatCard
          label="Realized P&L"
          value={formatSignedCurrency(tradeStats.realizedPnl, currency)}
          sub={`from ${tradeStats.closedTrades} closed trades`}
          icon={Wallet}
          valueClassName={pnlColor(tradeStats.realizedPnl)}
        />
        <StatCard
          label="Dividends received"
          value={formatCurrency(summary.totalDividends, currency)}
          sub={`${dividends.length} payments`}
          icon={Banknote}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Allocation by asset type</CardTitle>
            <CardDescription>Including cash balance</CardDescription>
          </CardHeader>
          <CardContent>
            <AllocationPie data={typeAllocation.map((a) => ({ ...a, key: a.key === "etf" ? "ETF" : titleCase(a.key) }))} currency={currency} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Allocation by market</CardTitle>
            <CardDescription>Where your capital sits</CardDescription>
          </CardHeader>
          <CardContent>
            <AllocationPie data={summary.allocationByMarket} currency={currency} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Allocation by sector</CardTitle>
            <CardDescription>Business exposure</CardDescription>
          </CardHeader>
          <CardContent>
            <AllocationPie data={summary.allocationBySector} currency={currency} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CashBalanceCard cashBalance={cash} currency={currency} />
        <Card>
          <CardHeader>
            <CardTitle>Concentration check</CardTitle>
            <CardDescription>Risk exposure at a glance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {summary.largestPosition ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Largest position</span>
                  <span className="font-medium">
                    {summary.largestPosition.symbol} ·{" "}
                    {(summary.largestPosition.share * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${summary.largestPosition.share > 0.35 ? "bg-amber-500" : "bg-emerald-600"}`}
                    style={{
                      width: `${Math.min(100, summary.largestPosition.share * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {summary.largestPosition.share > 0.35
                    ? "Over 35% in a single symbol — consider diversifying."
                    : "Concentration looks reasonable."}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">Add holdings to see exposure.</p>
            )}
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-muted-foreground">Cash allocation</span>
              <span className="font-medium">
                {totalValue > 0 ? ((cash / totalValue) * 100).toFixed(1) : "0"}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
