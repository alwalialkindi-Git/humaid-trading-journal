import type { Metadata } from "next";
import { Ban } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { ShariahScreening } from "@/lib/types";
import { PageHeader } from "@/components/app/page-header";
import { ShariahDisclaimer } from "@/components/disclaimer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScreeningsManager } from "./screenings-manager";

export const metadata: Metadata = { title: "Shariah Filter" };

const DISCOURAGED = [
  { name: "Margin trading", reason: "Borrowed money with interest (riba)." },
  { name: "Leverage", reason: "Amplified exposure built on interest-bearing debt." },
  { name: "Short selling", reason: "Selling what you do not own." },
  { name: "CFDs", reason: "Contracts on price movement without asset ownership." },
  { name: "Futures", reason: "Deferred exchange of both counter-values." },
  { name: "Options", reason: "Trading rights, not assets — with excessive gharar." },
  { name: "Interest-based products", reason: "Bonds, savings interest, and money-market yield." },
];

export default async function ShariahPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("shariah_screenings")
    .select("*")
    .eq("user_id", user!.id)
    .order("symbol");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shariah Filter"
        description="Screen the assets you own or watch, and keep the ratios on record."
      />

      <ScreeningsManager screenings={(data ?? []) as ShariahScreening[]} />

      {/* Discouraged instruments */}
      <Card className="border-red-200/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-red-600" />
            Instruments this journal will not celebrate
          </CardTitle>
          <CardDescription>
            These are broadly considered impermissible. The app is built around
            spot ownership of real assets — none of the flows here support them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DISCOURAGED.map((item) => (
              <div
                key={item.name}
                className="rounded-lg border border-red-100 bg-red-50/50 px-4 py-3"
              >
                <p className="text-sm font-medium text-red-900">✕ {item.name}</p>
                <p className="mt-1 text-xs text-red-700/80">{item.reason}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ShariahDisclaimer />
    </div>
  );
}
