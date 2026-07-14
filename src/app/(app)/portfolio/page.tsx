import type { Metadata } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { createServices } from "@/lib/services/runtime";
import { PortfolioHeader } from "@/components/portfolio/portfolio-header";
import { PositionsTab } from "@/components/portfolio/positions-tab";
import { AccountsTab } from "@/components/portfolio/accounts-tab";
import { CashStatement } from "@/components/portfolio/cash-statement";
import { HistoryTable, type AssetLabel } from "@/components/portfolio/history-table";
import { SummaryCards } from "@/components/portfolio/summary-cards";
import { NegativeCashNotice } from "@/components/portfolio/negative-cash-notice";

export const metadata: Metadata = { title: "Wealth" };

const TABS = [
  { key: "positions", label: "Positions" },
  { key: "accounts", label: "Accounts" },
  { key: "cash", label: "Cash" },
  { key: "activity", label: "Activity" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function resolveTab(param: string | undefined): TabKey {
  if (param === "history") return "activity"; // legacy links keep working
  return TABS.some((t) => t.key === param) ? (param as TabKey) : "positions";
}

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string; broker?: string }>;
}) {
  const { tab: tabParam, type: typeParam, broker: brokerParam } = await searchParams;
  const tab = resolveTab(tabParam);

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
    const [summary, wealth, statements, transactions, brokers, profileRes] =
      await Promise.all([
        services.positions.getPortfolioSummary(user!.id, active.id),
        services.positions.getWealthSummary(user!.id, active.id),
        services.positions.getCashStatement(user!.id, active.id),
        services.transactions.list(user!.id, { portfolioId: active.id }),
        services.brokers.list(user!.id),
        supabase.from("profiles").select("currency, full_name").eq("id", user!.id).single(),
      ]);
    data = { summary, wealth, statements, transactions, brokers, profile: profileRes.data };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/does not exist|schema cache|relation/i.test(message)) {
      return <LedgerNotInitialized />;
    }
    throw e;
  }

  const { summary, wealth, statements, transactions, brokers, profile } = data;
  const displayCurrency = profile?.currency === "USD" ? "USD" : "AED";
  const actorName = profile?.full_name ?? null;

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

  return (
    <div>
      <PortfolioHeader
        portfolioId={wealth.portfolio.id}
        portfolioName={wealth.portfolio.name}
        displayCurrency={displayCurrency}
        latestPriceAsOf={latestPriceAsOf}
      />

      {/* THE shared financial read model (Bugs 2–4) — same component as Dashboard */}
      <div className="mb-5 space-y-3">
        <SummaryCards
          wealth={wealth}
          displayCurrency={displayCurrency}
          actorName={actorName}
        />
        <NegativeCashNotice currencies={wealth.negative_cash_currencies} />
      </div>

      {/* Tabs (URL-driven, server-rendered) */}
      <div className="mb-5 flex gap-1 overflow-x-auto border-b" role="tablist" aria-label="Wealth views">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/portfolio?tab=${t.key}`}
            role="tab"
            aria-selected={tab === t.key}
            className={cn(
              "whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors",
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
          displayCurrency={displayCurrency}
        />
      )}

      {tab === "accounts" && (
        <AccountsTab brokers={brokers} transactions={transactions} />
      )}

      {tab === "cash" && (
        <CashStatement
          statements={statements}
          assetLabels={assetLabels}
          brokers={brokers}
        />
      )}

      {tab === "activity" && (
        <HistoryTable
          transactions={transactions}
          assetLabels={assetLabels}
          brokers={brokers}
          initialTypeFilter={typeParam}
          initialBrokerFilter={brokerParam}
        />
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
