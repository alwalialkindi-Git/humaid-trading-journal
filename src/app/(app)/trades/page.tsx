import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { computeTradeStats } from "@/lib/calculations";
import { formatCurrency, formatSignedCurrency, pnlColor } from "@/lib/format";
import type { Trade } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Button } from "@/components/ui/button";
import { TradesTable } from "./trades-table";

export const metadata: Metadata = { title: "Trades Journal" };

export default async function TradesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profile }, { data }] = await Promise.all([
    supabase.from("profiles").select("currency").eq("id", user!.id).single(),
    supabase
      .from("trades")
      .select("*")
      .eq("user_id", user!.id)
      .order("entry_date", { ascending: false }),
  ]);

  const trades = (data ?? []) as Trade[];
  const currency = profile?.currency ?? "AED";
  const stats = computeTradeStats(trades);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trades Journal"
        description="Every position, every lesson — logged with honesty."
      >
        <Button asChild>
          <Link href="/trades/new">
            <Plus className="h-4 w-4" /> New trade
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Realized P&L"
          value={formatSignedCurrency(stats.realizedPnl, currency)}
          valueClassName={pnlColor(stats.realizedPnl)}
          sub={`${stats.closedTrades} closed trades`}
        />
        <StatCard
          label="Win rate"
          value={stats.closedTrades > 0 ? `${stats.winRate.toFixed(0)}%` : "—"}
          sub={`avg win ${formatCurrency(stats.averageWin, currency)} / avg loss ${formatCurrency(Math.abs(stats.averageLoss), currency)}`}
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
          sub="gross wins ÷ gross losses"
        />
        <StatCard
          label="Total fees"
          value={formatCurrency(stats.totalFees, currency)}
          sub={`across ${stats.totalTrades} trades`}
        />
      </div>

      <TradesTable trades={trades} currency={currency} />
    </div>
  );
}
