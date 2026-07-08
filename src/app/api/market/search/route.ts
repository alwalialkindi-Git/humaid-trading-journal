import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchSymbols } from "@/lib/market-data/service";
import { ProviderError } from "@/lib/market-data/types";

/**
 * GET /api/market/search?q=EMAAR
 *
 * Server-side only: provider calls never happen in the browser (keys, CORS,
 * rate limits). Requires an authenticated session. Read-only — asset upserts
 * happen in the Phase 4 service layer with the service-role key, never here
 * and never from the client.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 1 || q.length > 60) {
    return NextResponse.json({ error: "Query must be 1–60 characters" }, { status: 400 });
  }

  try {
    const response = await searchSymbols(q);
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
