import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { WatchlistItem } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { WatchlistManager } from "./watchlist-manager";

export const metadata: Metadata = { title: "Watchlist" };

export default async function WatchlistPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profile }, { data }] = await Promise.all([
    supabase.from("profiles").select("currency").eq("id", user!.id).single(),
    supabase
      .from("watchlist")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Watchlist"
        description="Candidates you're watching — with target prices, risk levels, and Shariah status before you commit."
      />
      <WatchlistManager
        items={(data ?? []) as WatchlistItem[]}
        currency={profile?.currency ?? "AED"}
      />
    </div>
  );
}
