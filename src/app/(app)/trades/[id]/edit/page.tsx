import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Trade } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { TradeForm } from "../../trade-form";

export const metadata: Metadata = { title: "Edit Trade" };

export default async function EditTradePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("trades")
    .select("*")
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();

  if (!data) notFound();
  const trade = data as Trade;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={`Edit ${trade.symbol}`}
        description={`Logged ${new Date(trade.created_at).toLocaleDateString("en-GB")}`}
      />
      <TradeForm trade={trade} />
    </div>
  );
}
