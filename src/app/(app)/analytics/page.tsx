import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  buildEquityCurve,
  computePortfolioSummary,
  computeTradeStats,
  groupPnlBy,
  maxDrawdown,
  mistakeFrequency,
  monthlyPnl,
  tradePnl,
} from "@/lib/calculations";
import {
  formatCurrency,
  formatSignedCurrency,
  pnlColor,
  titleCase,
} from "@/lib/format";
import { MISTAKE_LABELS, type Mistake } from "@/lib/types";
import type { Dividend, Holding, Trade } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { EmptyState } from "@/components/app/empty-state";
import {
  AllocationPie,
  CountBarChart,
  EquityCurveChart,
  GroupPnlChart,
  MonthlyPnlChart,
} from "@/components/charts/charts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profile }, tradesRes, holdingsRes, dividendsRes] =
    await Promise.all([
      supabase.from("profiles").select("currency").eq("id", user!.id).single(),
      supabase
        .from("trades")
        .select("*")
        .eq("user_id", user!.id)
        .order("entry_date"),
      supabase.from("holdings").select("*").eq("user_id", user!.id),
      supabase.from("dividends").select("*").eq("user_id", user!.id),
    ]);

  const trades = (tradesRes.data ?? []) as Trade[];
  const holdings = (holdingsRes.data ?? []) as Holding[];
  const dividends = (dividendsRes.data ?? []) as Dividend[];
  const currency = profile?.currency ?? "AED";

  if (trades.length === 0) {
    return (
      <div>
        <PageHeader
          title="Analytics"
          description="Performance metrics appear once you log trades."
        />
        <EmptyState
          icon={BarChart3}
          title="No data to analyze yet"
          description="Log a few trades in the journal and this page will fill with honest numbers about your performance."
        />
      </div>
    );
  }

  const stats = computeTradeStats(trades);
  const monthly = monthlyPnl(trades);
  const drawdown = maxDrawdown(trades);
  const byStrategy = groupPnlBy(trades, (t) => t.strategy);
  const byEmotion = groupPnlBy(trades, (t) => t.emotion);
  const bySymbol = groupPnlBy(trades, (t) => t.symbol);
  const mistakes = mistakeFrequency(trades).map((m) => ({
    label: MISTAKE_LABELS[m.mistake as Mistake] ?? titleCase(m.mistake),
    count: m.count,
  }));
  const portfolio = computePortfolioSummary(holdings, dividends);

  const equityCurve = buildEquityCurve(trades);

  const bestSymbols = bySymbol.slice(0, 3);
  const worstSymbols = [...bySymbol].reverse().slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="The numbers that tell you the truth about your trading."
      />

      {/* Headline metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total P&L"
          value={formatSignedCurrency(stats.totalPnl, currency)}
          sub={`${formatSignedCurrency(stats.realizedPnl, currency)} realized · ${formatSignedCurrency(stats.unrealizedPnl, currency)} open`}
          valueClassName={pnlColor(stats.totalPnl)}
        />
        <StatCard
          label="Win rate"
          value={stats.closedTrades > 0 ? `${stats.winRate.toFixed(0)}%` : "—"}
          sub={`${stats.wins} wins / ${stats.losses} losses`}
        />
        <StatCard
          label="Profit factor"
          value={
            stats.profitFactor === Infinity
              ? "∞"
              : stats.profitFactor > 0
                ? stats.profitFactor.toFixed(2)
                : "—"
          }
          sub={`avg win ${formatCurrency(stats.averageWin, currency)} · avg loss ${formatCurrency(Math.abs(stats.averageLoss), currency)}`}
        />
        <StatCard
          label="Max drawdown"
          value={formatCurrency(drawdown, currency)}
          sub="peak-to-trough on realized equity"
          valueClassName={drawdown > 0 ? "text-loss" : undefined}
        />
      </div>

      {/* P&L charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly P&L</CardTitle>
            <CardDescription>Realized profit and loss by month</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyPnlChart data={monthly} currency={currency} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Equity curve</CardTitle>
            <CardDescription>Cumulative realized P&L over time</CardDescription>
          </CardHeader>
          <CardContent>
            {equityCurve.length > 1 ? (
              <EquityCurveChart data={equityCurve} currency={currency} />
            ) : (
              <p className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                Close at least two trades to draw the curve.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Strategy / emotion */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Strategy performance</CardTitle>
            <CardDescription>Realized P&L by strategy</CardDescription>
          </CardHeader>
          <CardContent>
            {byStrategy.length > 0 ? (
              <GroupPnlChart data={byStrategy} currency={currency} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Tag trades with a strategy to see this chart.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Emotion performance</CardTitle>
            <CardDescription>How your state of mind affects results</CardDescription>
          </CardHeader>
          <CardContent>
            {byEmotion.length > 0 ? (
              <GroupPnlChart
                data={byEmotion.map((e) => ({ ...e, key: titleCase(e.key) }))}
                currency={currency}
              />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Record emotions on trades to see this chart.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mistakes + symbols */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Mistake frequency</CardTitle>
            <CardDescription>Patterns to break</CardDescription>
          </CardHeader>
          <CardContent>
            {mistakes.length > 0 ? (
              <CountBarChart data={mistakes} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No mistakes recorded — either great discipline or optimistic
                journaling.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Best & worst symbols</CardTitle>
            <CardDescription>By realized P&L</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Trades</TableHead>
                  <TableHead>Win rate</TableHead>
                  <TableHead className="text-right">P&L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...bestSymbols, ...worstSymbols.filter((w) => !bestSymbols.includes(w))].map(
                  (s) => (
                    <TableRow key={s.key}>
                      <TableCell className="font-medium">{s.key}</TableCell>
                      <TableCell>{s.count}</TableCell>
                      <TableCell>
                        {((s.wins / s.count) * 100).toFixed(0)}%
                      </TableCell>
                      <TableCell className={`text-right font-medium ${pnlColor(s.pnl)}`}>
                        {formatSignedCurrency(s.pnl, currency)}
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Allocation + risk */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Allocation by asset type</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationPie
              data={portfolio.allocationByType.map((a) => ({
                ...a,
                key: a.key === "etf" ? "ETF" : titleCase(a.key),
              }))}
              currency={currency}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Allocation by market</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationPie data={portfolio.allocationByMarket} currency={currency} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Risk exposure</CardTitle>
            <CardDescription>Quick checks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Open positions</span>
              <span className="font-medium">{stats.openTrades}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Largest position</span>
              <span className="font-medium">
                {portfolio.largestPosition
                  ? `${portfolio.largestPosition.symbol} (${(portfolio.largestPosition.share * 100).toFixed(0)}%)`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg holding period</span>
              <span className="font-medium">
                {stats.averageHoldingDays.toFixed(0)} days
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total fees paid</span>
              <span className="font-medium">
                {formatCurrency(stats.totalFees, currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Best trade</span>
              <span className="font-medium text-profit">
                {stats.bestTrade
                  ? `${stats.bestTrade.symbol} ${formatSignedCurrency(tradePnl(stats.bestTrade) ?? 0, currency)}`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Worst trade</span>
              <span className="font-medium text-loss">
                {stats.worstTrade
                  ? `${stats.worstTrade.symbol} ${formatSignedCurrency(tradePnl(stats.worstTrade) ?? 0, currency)}`
                  : "—"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
