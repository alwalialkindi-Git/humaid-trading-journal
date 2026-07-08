import { z } from "zod";
import type { SymbolSearchResult, CompanyProfile } from "@/lib/market-data/types";
import { EXCHANGES } from "@/lib/market-data/exchange-map";
import type { LedgerRepository } from "./repository";
import type { AssetRow, CustomAssetInput } from "./types";
import { ServiceError } from "./errors";

/**
 * Assets service — the only path that writes the global instrument master.
 * Runs server-side with the service-role repository; clients never write
 * `assets` directly (M1 doc §1.2).
 */

const customAssetSchema = z.object({
  symbol: z.string().trim().min(1).max(20).transform((s) => s.toUpperCase()),
  name: z.string().trim().min(1).max(120),
  exchange: z.string().trim().max(20).transform((s) => s.toUpperCase()),
  currency: z.string().trim().length(3).transform((s) => s.toUpperCase()),
  asset_class: z
    .enum(["stock", "etf", "crypto", "sukuk", "fund", "commodity", "cash", "other"])
    .default("stock"),
  sector: z.string().trim().max(80).nullish(),
  industry: z.string().trim().max(80).nullish(),
  country: z.string().trim().max(60).nullish(),
  isin: z.string().trim().max(12).nullish(),
  latest_price: z.coerce.number().min(0).nullish(),
  price_as_of: z.string().nullish(),
  price_source_note: z.string().trim().max(300).nullish(),
});

export class AssetsService {
  constructor(private repo: LedgerRepository) {}

  /**
   * Resolve a provider search result to an asset row, creating it on first
   * use. GUARD (§2.4 rule 2/3): a result carrying a cross-exchange `warning`
   * (e.g. ADIB-Egypt for an ADX query) is refused unless the caller passes
   * an explicit confirmation — auto-selection of false friends is impossible
   * at the service layer, not just in the UI.
   */
  async ensureFromSearchResult(
    userId: string,
    result: SymbolSearchResult,
    options: { profile?: CompanyProfile | null; confirmWarned?: boolean } = {}
  ): Promise<AssetRow> {
    if (result.warning && !options.confirmWarned) {
      throw new ServiceError(
        `This result requires explicit confirmation: ${result.warning}`,
        "validation"
      );
    }

    const symbol = result.symbol.toUpperCase();
    const exchange = result.exchange.code.toUpperCase();
    const existing = await this.repo.findAssetBySymbolExchange(symbol, exchange);
    if (existing) return existing;

    const profile = options.profile ?? null;
    // Tier per §2.4: full profile → automated; quote-only → semi_automated.
    const dataTier = profile?.sector ? "automated" : "semi_automated";

    return this.repo.insertAsset({
      symbol,
      exchange,
      name: result.name,
      currency: result.exchange.currency !== "?" ? result.exchange.currency : "USD",
      asset_class: result.assetClass,
      data_tier: dataTier,
      isin: null,
      sector: profile?.sector ?? null,
      industry: profile?.industry ?? null,
      country: profile?.country ?? (result.exchange.country !== "?" ? result.exchange.country : null),
      is_listed: true,
      provider: "yahoo",
      provider_symbol: result.providerSymbol,
      latest_price: null,
      price_as_of: null,
      price_is_manual: false,
      metadata: {},
      created_by: userId,
    });
  }

  /**
   * Create a manual/custom asset — the path for ADX listings (no provider
   * coverage in M1), private sukuk, real estate, local funds. Participates
   * in the ledger identically to automated assets (§2.4 invariant).
   */
  async createCustomAsset(userId: string, input: CustomAssetInput): Promise<AssetRow> {
    const parsed = customAssetSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new ServiceError(
        `${String(first.path.join("."))}: ${first.message}`,
        "validation"
      );
    }
    const d = parsed.data;

    const existing = await this.repo.findAssetBySymbolExchange(d.symbol, d.exchange);
    if (existing) {
      throw new ServiceError(
        `${d.symbol} on ${d.exchange || "(no exchange)"} already exists.`,
        "conflict"
      );
    }

    const knownExchange = d.exchange ? EXCHANGES[d.exchange] : undefined;

    return this.repo.insertAsset({
      symbol: d.symbol,
      exchange: d.exchange,
      name: d.name,
      currency: d.currency,
      asset_class: d.asset_class,
      data_tier: "manual_custom",
      isin: d.isin ?? null,
      sector: d.sector ?? null,
      industry: d.industry ?? null,
      country: d.country ?? knownExchange?.country ?? null,
      // Listed on a real exchange we know (ADX!) but provider-less — still
      // is_listed; truly private assets (empty exchange) are not.
      is_listed: Boolean(knownExchange),
      provider: null,
      provider_symbol: null,
      latest_price: d.latest_price ?? null,
      price_as_of: d.price_as_of ?? (d.latest_price != null ? new Date().toISOString() : null),
      price_is_manual: d.latest_price != null,
      metadata: d.price_source_note ? { price_source_note: d.price_source_note } : {},
      created_by: userId,
    });
  }

  /** Manual price update for manual_custom assets (and provider-gap fallback). */
  async setManualPrice(
    userId: string,
    assetId: string,
    price: number,
    asOf?: string
  ): Promise<AssetRow> {
    if (!Number.isFinite(price) || price < 0) {
      throw new ServiceError("Price must be a non-negative number.", "validation");
    }
    const asset = await this.repo.getAsset(assetId);
    if (!asset) throw new ServiceError("Asset not found.", "not_found");
    // Only the creator updates a custom asset's global price; provider-tier
    // assets get per-user overrides instead (asset_overrides).
    if (asset.data_tier !== "manual_custom" || (asset.created_by && asset.created_by !== userId)) {
      throw new ServiceError(
        "Use a per-user price override for provider-priced assets.",
        "forbidden"
      );
    }
    return this.repo.updateAsset(assetId, {
      latest_price: price,
      price_as_of: asOf ?? new Date().toISOString(),
      price_is_manual: true,
    });
  }
}
