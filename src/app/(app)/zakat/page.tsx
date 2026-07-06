import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { computePurification } from "@/lib/zakat";
import type { Dividend, Holding, Profile, ZakatRecord } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { ShariahDisclaimer } from "@/components/disclaimer";
import { ZakatCalculator } from "./zakat-calculator";

export const metadata: Metadata = { title: "Zakat Calculator" };

export default async function ZakatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profileRes, holdingsRes, dividendsRes, recordsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).single(),
    supabase.from("holdings").select("*").eq("user_id", user!.id),
    supabase.from("dividends").select("*").eq("user_id", user!.id),
    supabase
      .from("zakat_records")
      .select("*")
      .eq("user_id", user!.id)
      .order("hawl_date", { ascending: false }),
  ]);

  const profile = profileRes.data as Profile | null;
  const holdings = (holdingsRes.data ?? []) as Holding[];
  const dividends = (dividendsRes.data ?? []) as Dividend[];
  const records = (recordsRes.data ?? []) as ZakatRecord[];

  // Prefill values from the current portfolio snapshot
  const compliantStockValue = holdings
    .filter((h) => h.shariah_status === "compliant")
    .reduce((s, h) => s + h.quantity * h.current_price, 0);
  const doubtfulStockValue = holdings
    .filter((h) => h.shariah_status === "doubtful")
    .reduce((s, h) => s + h.quantity * h.current_price, 0);
  const dividendsTotal = dividends.reduce((s, d) => s + d.amount, 0);
  const purificationFromDividends = dividends.reduce(
    (s, d) => s + computePurification(d.amount, d.purification_percentage),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Zakat Calculator"
        description="Calculate what you owe with a full breakdown — and keep a record for every hawl."
      />
      <ZakatCalculator
        currency={profile?.currency ?? "AED"}
        defaultNisabMethod={profile?.nisab_method ?? "gold"}
        defaultHawlDate={profile?.hawl_date ?? ""}
        prefill={{
          tradingCash: profile?.cash_balance ?? 0,
          compliantStockValue: Math.round(compliantStockValue * 100) / 100,
          doubtfulStockValue: Math.round(doubtfulStockValue * 100) / 100,
          dividendsReceived: Math.round(dividendsTotal * 100) / 100,
          purificationFromDividends:
            Math.round(purificationFromDividends * 100) / 100,
        }}
        records={records}
      />
      <ShariahDisclaimer />
    </div>
  );
}
