import { z } from "zod";
import type { LedgerRepository } from "./repository";
import type { AssetOverrideRow } from "./types";
import { ServiceError } from "./errors";

const overrideSchema = z
  .object({
    display_name: z.string().trim().min(1).max(120).nullish(),
    sector: z.string().trim().min(1).max(80).nullish(),
    manual_price: z.coerce.number().min(0).nullish(),
    shariah_status: z
      .enum(["compliant", "doubtful", "non_compliant", "not_reviewed"])
      .nullish(),
    override_reason: z.string().trim().max(500).nullish(),
  })
  .refine(
    (d) => d.shariah_status == null || Boolean(d.override_reason?.trim()),
    {
      message:
        "A reason is required when overriding Shariah status (e.g. 'my scholar permits X').",
      path: ["override_reason"],
    }
  );

export type OverrideInput = z.input<typeof overrideSchema>;

/**
 * Asset overrides — per-user manual corrections, always labeled in the UI.
 * A Shariah-status override REQUIRES a reason (design doc §1.3): disagreement
 * with the data is allowed; silent disagreement is not.
 */
export class OverridesService {
  constructor(private repo: LedgerRepository) {}

  async get(userId: string, assetId: string): Promise<AssetOverrideRow | null> {
    return this.repo.getOverride(userId, assetId);
  }

  async set(
    userId: string,
    assetId: string,
    input: OverrideInput
  ): Promise<AssetOverrideRow> {
    const asset = await this.repo.getAsset(assetId);
    if (!asset) throw new ServiceError("Asset not found.", "not_found");

    const parsed = overrideSchema.safeParse(input);
    if (!parsed.success) {
      throw new ServiceError(parsed.error.issues[0].message, "validation");
    }
    const d = parsed.data;
    return this.repo.upsertOverride({
      user_id: userId,
      asset_id: assetId,
      display_name: d.display_name ?? null,
      sector: d.sector ?? null,
      manual_price: d.manual_price ?? null,
      manual_price_at: d.manual_price != null ? new Date().toISOString() : null,
      shariah_status: d.shariah_status ?? null,
      override_reason: d.override_reason ?? null,
    });
  }

  /** "Reset to provider values." */
  async clear(userId: string, assetId: string): Promise<void> {
    await this.repo.deleteOverride(userId, assetId);
  }
}
