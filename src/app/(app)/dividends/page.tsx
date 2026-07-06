import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { Dividend } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { DividendsManager } from "./dividends-manager";

export const metadata: Metadata = { title: "Dividends" };

export default async function DividendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profile }, { data }] = await Promise.all([
    supabase.from("profiles").select("currency").eq("id", user!.id).single(),
    supabase
      .from("dividends")
      .select("*")
      .eq("user_id", user!.id)
      .order("payment_date", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dividends"
        description="Income received from your holdings, with purification tracking."
      />
      <DividendsManager
        dividends={(data ?? []) as Dividend[]}
        currency={profile?.currency ?? "AED"}
      />
    </div>
  );
}
