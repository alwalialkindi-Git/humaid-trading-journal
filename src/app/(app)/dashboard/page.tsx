import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServices } from "@/lib/services/runtime";
import { daysUntilNextAnniversary } from "@/lib/calculations";
import { isStalePrice } from "@/lib/format";
import { incomeSummary } from "@/lib/dashboard";
import { buildAttentionItems } from "@/lib/attention";
import { generateLedgerInsights } from "@/lib/insights";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { InsightCards } from "@/components/app/insight-cards";
import { CurrencySwitcher } from "@/components/portfolio/currency-switcher";
import { WealthStrip } from "@/components/dashboard/wealth-strip";
import { AttentionQueue } from "@/components/dashboard/attention-queue";
import { ExposureBand } from "@/components/dashboard/exposure-band";
import { FlowsRow } from "@/components/dashboard/flows-row";
import { RecentActivity } from "@/components/dashboard/recent-activity";

export const metadata: Metadata = { title: "Home" };

/**
 * Home — the 60-second review (D4, sprint §9). The PM's six questions,
 * answered top-to-bottom with strict hierarchy: wealth strip → attention
 * queue → exposure band → flows row → recent activity + insights.
 *
 * One financial truth (Bug 3 invariant, kept): every figure derives from the
 * SAME ledger read models as Wealth — getWealthSummary rows feed the
 * WealthStrip and the FlowsRow cash card; holdings and raw transactions feed
 * the rest. No legacy table (trades/holdings/dividends) is read here.
 * Period/performance figures stay "insufficient history" until the daily
 * valuation series lands (M2 — CIO condition 1, never an approximation).
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

  const open = holdings.filter((h) => h.quantity > 0);
  const income = incomeSummary(transactions);

  const hawlDaysRemaining = profile?.hawl_date
    ? daysUntilNextAnniversary(profile.hawl_date)
    : null;

  // Attention queue inputs — every one a ledger-derived fact (§9.2).
  const attentionItems = buildAttentionItems({
    hawlDaysRemaining,
    purificationOwed: income.map((r) => ({
      currency: r.currency,
      amount: r.purification_owed,
    })),
    nonCompliant: open
      .filter((h) => h.shariah_status === "non_compliant")
      .map((h) => h.asset.symbol),
    unscreened: open.filter(
      (h) =>
        h.shariah_status === "not_reviewed" || h.shariah_status === "doubtful"
    ).length,
    negativeCashCurrencies: wealth.negative_cash_currencies,
    stalePrices: open
      .filter(
        (h) =>
          h.effective_price != null &&
          !h.price_is_manual &&
          isStalePrice(h.price_as_of)
      )
      .map((h) => h.asset.symbol),
    unpriced: open
      .filter((h) => h.effective_price == null)
      .map((h) => h.asset.symbol),
  });

  const insights = generateLedgerInsights({
    holdings: open,
    income,
    displayCurrency,
  }).slice(0, 3);

  const recent = [...transactions]
    .sort((a, b) =>
      a.trade_date === b.trade_date
        ? b.created_at.localeCompare(a.created_at)
        : b.trade_date.localeCompare(a.trade_date)
    )
    .slice(0, 5);

  const symbolByAsset: Record<string, string> = {};
  for (const h of holdings) symbolByAsset[h.asset.id] = h.asset.symbol;

  return (
    <div className="space-y-6">
      <PageHeader
        title={firstName ? `As-salamu alaykum, ${firstName}` : "Home"}
        description="One truth: every figure below derives from your ledger."
      >
        <div className="flex items-center gap-2">
          <CurrencySwitcher value={displayCurrency} />
          <Button asChild>
            <Link href="/portfolio">Open portfolio</Link>
          </Button>
        </div>
      </PageHeader>

      {/* 1 — Wealth strip: the shared read model (getWealthSummary), hero-sized */}
      <WealthStrip
        rows={wealth.rows}
        unpricedTotal={wealth.unpriced_total}
        displayCurrency={displayCurrency}
        actorName={profile?.full_name ?? null}
      />

      {/* 2 — Attention queue: ONE component, replaces every banner stack */}
      <AttentionQueue items={attentionItems} />

      {/* 3 — Exposure band: allocation, concentration, liquidity, currencies, shields */}
      <ExposureBand holdings={open} displayCurrency={displayCurrency} />

      {/* 4 — Flows: cash · income · zakat */}
      <FlowsRow
        rows={wealth.rows}
        income={income}
        hawlDate={profile?.hawl_date ?? null}
        daysToHawl={hawlDaysRemaining}
      />

      {/* 5 — Recent activity + insights (max 3) */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentActivity transactions={recent} symbolByAsset={symbolByAsset} />
        </div>
        <div>
          <InsightCards insights={insights} columns={1} />
        </div>
      </div>
    </div>
  );
}
