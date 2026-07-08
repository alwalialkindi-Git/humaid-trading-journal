"use server";

/**
 * Phase 5 server actions — the ONLY mutation gateway for the ledger UI.
 * Every action authenticates, builds the service layer (user-scoped client
 * for RLS tables + admin client for its two documented surfaces), and maps
 * ServiceError into a serializable result the forms can render.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServices } from "@/lib/services/runtime";
import { ServiceError } from "@/lib/services";
import type {
  AssetRow,
  BrokerRow,
  CustomAssetInput,
  HoldingView,
  PortfolioRow,
  TransactionInput,
  TransactionRow,
} from "@/lib/services";
import type { BrokerInput } from "@/lib/services/brokers-service";
import { fetchProfile, fetchQuote } from "@/lib/market-data/service";
import type { SymbolSearchResult } from "@/lib/market-data/types";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: string };

async function requireUserId(): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ServiceError("Not signed in.", "forbidden");
  return { userId: user.id };
}

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof ServiceError) {
      return { ok: false, error: e.message, code: e.code };
    }
    console.error("Ledger action failed:", e);
    return {
      ok: false,
      error: "Something went wrong — your data was not changed. Please try again.",
      code: "unknown",
    };
  }
}

// ---------------------------------------------------------------------------
// Dialog context
// ---------------------------------------------------------------------------

export interface DialogContext {
  portfolios: PortfolioRow[];
  brokers: BrokerRow[];
  holdings: HoldingView[]; // all portfolios; client filters by selection
}

export async function getDialogContextAction(): Promise<ActionResult<DialogContext>> {
  return run(async () => {
    const { userId } = await requireUserId();
    const services = await createServices();
    const [portfolios, brokers, holdings] = await Promise.all([
      services.portfolios.list(userId),
      services.brokers.list(userId),
      services.positions.getHoldings(userId),
    ]);
    return { portfolios: portfolios.filter((p) => !p.is_archived), brokers, holdings };
  });
}

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export interface EnsuredAsset {
  asset: AssetRow;
  quotePrice: number | null;
  quoteAsOf: string | null;
}

export async function ensureAssetFromSearchAction(
  result: SymbolSearchResult,
  confirmWarned = false
): Promise<ActionResult<EnsuredAsset>> {
  return run(async () => {
    const { userId } = await requireUserId();
    const services = await createServices();

    // Profile enrichment decides the data tier (automated vs semi_automated);
    // ETFs and some non-US listings legitimately have none.
    let profile = null;
    try {
      profile = (await fetchProfile(result.providerSymbol)).profile;
    } catch {
      profile = null;
    }

    let asset = await services.assets.ensureFromSearchResult(userId, result, {
      profile,
      confirmWarned,
    });

    // Cache a quote for portfolio pricing + form prefill (best effort).
    let quotePrice: number | null = null;
    let quoteAsOf: string | null = null;
    try {
      const { quote } = await fetchQuote(result.providerSymbol);
      quotePrice = quote.price;
      quoteAsOf = quote.asOf;
      asset = await services.assets.applyProviderQuote(asset.id, quote.price, quote.asOf);
    } catch {
      // No quote is not a blocker — the user enters their fill price anyway.
    }

    return { asset, quotePrice, quoteAsOf };
  });
}

export async function createCustomAssetAction(
  input: CustomAssetInput
): Promise<ActionResult<AssetRow>> {
  return run(async () => {
    const { userId } = await requireUserId();
    const services = await createServices();
    return services.assets.createCustomAsset(userId, input);
  });
}

export async function setManualPriceAction(
  assetId: string,
  price: number
): Promise<ActionResult<AssetRow>> {
  return run(async () => {
    const { userId } = await requireUserId();
    const services = await createServices();
    const asset = await services.assets.setManualPrice(userId, assetId, price);
    revalidatePath("/portfolio");
    return asset;
  });
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export async function createTransactionAction(
  input: TransactionInput
): Promise<ActionResult<TransactionRow>> {
  return run(async () => {
    const { userId } = await requireUserId();
    const services = await createServices();
    const row = await services.transactions.create(userId, input);
    revalidatePath("/portfolio");
    return row;
  });
}

export async function updateTransactionAction(
  id: string,
  input: TransactionInput
): Promise<ActionResult<TransactionRow>> {
  return run(async () => {
    const { userId } = await requireUserId();
    const services = await createServices();
    const row = await services.transactions.update(userId, id, input);
    revalidatePath("/portfolio");
    return row;
  });
}

export async function deleteTransactionAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const { userId } = await requireUserId();
    const services = await createServices();
    await services.transactions.delete(userId, id);
    revalidatePath("/portfolio");
    return null;
  });
}

// ---------------------------------------------------------------------------
// Brokers
// ---------------------------------------------------------------------------

export async function createBrokerAction(
  input: BrokerInput
): Promise<ActionResult<BrokerRow>> {
  return run(async () => {
    const { userId } = await requireUserId();
    const services = await createServices();
    const broker = await services.brokers.create(userId, input);
    revalidatePath("/settings");
    return broker;
  });
}

export async function updateBrokerAction(
  id: string,
  input: BrokerInput
): Promise<ActionResult<BrokerRow>> {
  return run(async () => {
    const { userId } = await requireUserId();
    const services = await createServices();
    const broker = await services.brokers.update(userId, id, input);
    revalidatePath("/settings");
    return broker;
  });
}

export async function deleteBrokerAction(id: string): Promise<ActionResult<null>> {
  return run(async () => {
    const { userId } = await requireUserId();
    const services = await createServices();
    await services.brokers.delete(userId, id);
    revalidatePath("/settings");
    revalidatePath("/portfolio");
    return null;
  });
}

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------

export interface RefreshResult {
  updated: number;
  failed: { symbol: string; reason: string }[];
}

export async function refreshPricesAction(
  portfolioId: string
): Promise<ActionResult<RefreshResult>> {
  return run(async () => {
    const { userId } = await requireUserId();
    const services = await createServices();
    const holdings = await services.positions.getHoldings(userId, portfolioId);

    const refreshable = holdings.filter(
      (h) =>
        h.quantity > 0 &&
        h.asset.provider &&
        h.asset.provider_symbol &&
        h.asset.data_tier !== "manual_custom"
    );

    const result: RefreshResult = { updated: 0, failed: [] };
    for (const h of refreshable) {
      try {
        const { quote } = await fetchQuote(h.asset.provider_symbol!);
        await services.assets.applyProviderQuote(h.asset.id, quote.price, quote.asOf);
        result.updated++;
      } catch (e) {
        result.failed.push({
          symbol: h.asset.symbol,
          reason: e instanceof Error ? e.message.slice(0, 120) : "unavailable",
        });
      }
    }
    revalidatePath("/portfolio");
    return result;
  });
}
