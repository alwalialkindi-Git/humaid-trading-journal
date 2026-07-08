import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchProfile } from "@/lib/market-data/service";
import { ProviderError } from "@/lib/market-data/types";

/** GET /api/market/profile?symbol=EMAAR.AE[&exchange=DFM] — auth required. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const symbol = params.get("symbol") ?? "";
  const exchange = params.get("exchange") ?? undefined;
  if (!symbol || symbol.length > 30) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  try {
    const response = await fetchProfile(symbol, exchange);
    return NextResponse.json(response);
  } catch (e) {
    if (e instanceof ProviderError) {
      return NextResponse.json(
        { error: e.message, code: e.code, provider: e.providerId },
        { status: e.code === "not_found" ? 404 : 502 }
      );
    }
    return NextResponse.json({ error: "Market data unavailable" }, { status: 502 });
  }
}
