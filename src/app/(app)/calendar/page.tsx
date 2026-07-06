import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import type { Trade } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { TradingCalendar } from "./trading-calendar";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profile }, { data }] = await Promise.all([
    supabase.from("profiles").select("currency").eq("id", user!.id).single(),
    supabase.from("trades").select("*").eq("user_id", user!.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trading Calendar"
        description="Daily realized P&L — green days, red days, and the story between them."
      />
      <TradingCalendar
        trades={(data ?? []) as Trade[]}
        currency={profile?.currency ?? "AED"}
      />
    </div>
  );
}
