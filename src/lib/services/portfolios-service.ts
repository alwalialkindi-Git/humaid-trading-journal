import { z } from "zod";
import type { LedgerRepository } from "./repository";
import type { PortfolioRow } from "./types";
import { ServiceError } from "./errors";

const portfolioSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  base_currency: z.string().trim().length(3).transform((s) => s.toUpperCase()),
});

export class PortfoliosService {
  constructor(private repo: LedgerRepository) {}

  async list(userId: string): Promise<PortfolioRow[]> {
    return this.repo.listPortfolios(userId);
  }

  async get(userId: string, id: string): Promise<PortfolioRow> {
    const row = await this.repo.getPortfolio(userId, id);
    if (!row) throw new ServiceError("Portfolio not found.", "not_found");
    return row;
  }

  async create(
    userId: string,
    input: { name: string; base_currency: string }
  ): Promise<PortfolioRow> {
    const parsed = portfolioSchema.safeParse(input);
    if (!parsed.success) {
      throw new ServiceError(parsed.error.issues[0].message, "validation");
    }
    const existing = await this.repo.listPortfolios(userId);
    return this.repo.insertPortfolio({
      user_id: userId,
      name: parsed.data.name,
      base_currency: parsed.data.base_currency,
      cost_method: "average",
      is_default: existing.length === 0,
      is_archived: false,
    });
  }

  async rename(userId: string, id: string, name: string): Promise<PortfolioRow> {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 60) {
      throw new ServiceError("Name must be 1–60 characters.", "validation");
    }
    await this.get(userId, id);
    return this.repo.updatePortfolio(userId, id, { name: trimmed });
  }

  async setArchived(userId: string, id: string, archived: boolean): Promise<PortfolioRow> {
    const row = await this.get(userId, id);
    if (row.is_default && archived) {
      throw new ServiceError("The default portfolio cannot be archived.", "validation");
    }
    return this.repo.updatePortfolio(userId, id, { is_archived: archived });
  }
}
