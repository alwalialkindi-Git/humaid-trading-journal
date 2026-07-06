import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { Holding } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { HoldingsManager } from "./holdings-manager";

export const metadata: Metadata = { title: "Holdings" };

export default async function HoldingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profile }, { data }] = await Promise.all([
    supabase.from("profiles").select("currency").eq("id", user!.id).single(),
    supabase
      .from("holdings")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: true }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Holdings"
        description="Your current positions. Update prices manually to refresh valuations."
      />
      <HoldingsManager
        holdings={(data ?? []) as Holding[]}
        currency={profile?.currency ?? "AED"}
      />
    </div>
  );
}
