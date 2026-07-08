import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { createServices } from "@/lib/services/runtime";
import type { CashBalanceView, TransactionRow } from "@/lib/services";
import { formatCurrency, formatDate, formatNumber, titleCase } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/app/empty-state";
import { PortfolioHeader } from "@/components/portfolio/portfolio-header";
import { PositionsTab } from "@/components/portfolio/positions-tab";
import { HistoryTable, type AssetLabel } from "@/components/portfolio/history-table";

export const metadata: Metadata = { title: "Portfolio" };

const TABS = [
  { key: "positions", label: "Positions" },
  { key: "cash", label: "Cash" },
  { key: "history", label: "History" },
] as const;

const CASH_TYPES = [
  "deposit",
  "withdrawal",
  "fee",
  "zakat_payment",
  "purification_payment",
] as const;

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string }>;
}) {
  const { tab: tabParam, type: typeParam } = await searchParams;
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam! : "positions";

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
      // Schema applied but this account predates the portfolio backfill.
      throw new Error(
        'relation missing: no portfolio — run the backfill block at the end of supabase/migrations/002_ledger.sql'
      );
    }
    const [summary, transactions, brokers] = await Promise.all([
      services.positions.getPortfolioSummary(user!.id, active.id),
      services.transactions.list(user!.id, { portfolioId: active.id }),
      services.brokers.list(user!.id),
    ]);
    data = { summary, transactions, brokers };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/does not exist|schema cache|relation/i.test(message)) {
      return <LedgerNotInitialized />;
    }
    throw e;
  }

  const { summary, transactions, brokers } = data;

  const assetLabels: Record<string, AssetLabel> = {};
  for (const h of summary.holdings) {
    assetLabels[h.asset.id] = {
      symbol: h.asset.symbol,
      name: h.asset.name,
      currency: h.asset.currency,
    };
  }

  const latestPriceAsOf =
    summary.holdings
      .map((h) => h.price_as_of)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

  const cashRows = transactions.filter((t) =>
    (CASH_TYPES as readonly string[]).includes(t.type)
  );

  return (
    <div>
      <PortfolioHeader summary={summary} latestPriceAsOf={latestPriceAsOf} />

      {/* Tabs (URL-driven, server-rendered) */}
      <div className="mb-5 flex gap-1 border-b" role="tablist" aria-label="Portfolio views">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/portfolio?tab=${t.key}`}
            role="tab"
            aria-selected={tab === t.key}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "positions" && (
        <PositionsTab
          holdings={summary.holdings}
          transactions={transactions}
          hasAnyTransactions={transactions.length > 0}
        />
      )}

      {tab === "cash" && <CashTab cash={summary.cash} rows={cashRows} />}

      {tab === "history" && (
        <HistoryTable
          transactions={transactions}
          assetLabels={assetLabels}
          brokers={brokers}
          initialTypeFilter={typeParam}
        />
      )}
    </div>
  );
}

function CashTab({ cash, rows }: { cash: CashBalanceView[]; rows: TransactionRow[] }) {
  if (cash.length === 0 && rows.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="No cash recorded"
        description="Record a deposit to start tracking cash — buys and sells will move it automatically."
      />
    );
  }

  const sorted = [...rows].sort((a, b) =>
    a.trade_date === b.trade_date
      ? b.created_at.localeCompare(a.created_at)
      : b.trade_date.localeCompare(a.trade_date)
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cash.map((c) => (
          <Card key={c.currency}>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Cash · {c.currency}
              </p>
              <p
                className={cn(
                  "mt-2 text-2xl font-semibold tracking-tight",
                  c.balance < 0 && "text-loss"
                )}
              >
                {formatCurrency(c.balance, c.currency)}
              </p>
              {c.balance < 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  More spent than deposited — add an opening deposit.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {sorted.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-3 text-sm font-semibold">Cash events</p>
            <ul className="divide-y">
              {sorted.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span>
                    <span className="font-medium">{titleCase(t.type)}</span>
                    <span className="ml-2 text-muted-foreground">
                      {formatDate(t.trade_date)}
                    </span>
                    {t.notes && (
                      <span className="ml-2 text-xs text-muted-foreground">· {t.notes}</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      t.type === "deposit" ? "text-profit" : "text-foreground"
                    )}
                  >
                    {t.type === "deposit" ? "+" : "−"}
                    {formatNumber(t.amount ?? 0)} {t.currency}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LedgerNotInitialized() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-xl font-semibold">The ledger isn’t initialized</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        The database schema for portfolios and transactions hasn’t been applied to this
        Supabase project yet. Run{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">
          supabase/migrations/002_ledger.sql
        </code>{" "}
        in the SQL Editor, make sure{" "}
        <code className="rounded bg-muted px-1.5 py-0.5">SUPABASE_SERVICE_ROLE_KEY</code> is
        set, then reload. See docs/DEPLOYMENT.md.
      </p>
    </div>
  );
}
