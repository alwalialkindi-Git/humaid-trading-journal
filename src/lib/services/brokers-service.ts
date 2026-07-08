import { z } from "zod";
import type { LedgerRepository } from "./repository";
import type { BrokerRow } from "./types";
import { ServiceError } from "./errors";

const brokerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  country: z.string().trim().max(60).nullish(),
  account_number: z.string().trim().max(60).nullish(),
  account_currency: z.string().trim().length(3).transform((s) => s.toUpperCase()),
  notes: z.string().trim().max(1000).nullish(),
});

export type BrokerInput = z.input<typeof brokerSchema>;

export class BrokersService {
  constructor(private repo: LedgerRepository) {}

  async list(userId: string): Promise<BrokerRow[]> {
    return this.repo.listBrokers(userId);
  }

  async create(userId: string, input: BrokerInput): Promise<BrokerRow> {
    const parsed = brokerSchema.safeParse(input);
    if (!parsed.success) {
      throw new ServiceError(parsed.error.issues[0].message, "validation");
    }
    return this.repo.insertBroker({
      user_id: userId,
      name: parsed.data.name,
      country: parsed.data.country ?? null,
      account_number: parsed.data.account_number ?? null,
      account_currency: parsed.data.account_currency,
      notes: parsed.data.notes ?? null,
    });
  }

  async update(userId: string, id: string, input: BrokerInput): Promise<BrokerRow> {
    const existing = await this.repo.getBroker(userId, id);
    if (!existing) throw new ServiceError("Broker not found.", "not_found");
    const parsed = brokerSchema.safeParse(input);
    if (!parsed.success) {
      throw new ServiceError(parsed.error.issues[0].message, "validation");
    }
    return this.repo.updateBroker(userId, id, {
      name: parsed.data.name,
      country: parsed.data.country ?? null,
      account_number: parsed.data.account_number ?? null,
      account_currency: parsed.data.account_currency,
      notes: parsed.data.notes ?? null,
    });
  }

  /** Transactions keep their history (broker_id → null, per ON DELETE SET NULL). */
  async delete(userId: string, id: string): Promise<void> {
    const existing = await this.repo.getBroker(userId, id);
    if (!existing) throw new ServiceError("Broker not found.", "not_found");
    await this.repo.deleteBroker(userId, id);
  }
}
