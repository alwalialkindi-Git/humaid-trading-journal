import type { LedgerRepository } from "./repository";
import { TransactionsService } from "./transactions-service";
import { AssetsService } from "./assets-service";
import { PositionsService } from "./positions-service";
import { PortfoliosService } from "./portfolios-service";
import { BrokersService } from "./brokers-service";
import { OverridesService } from "./overrides-service";

export { ServiceError } from "./errors";
export type * from "./types";

/**
 * Framework-free barrel: wiring over any repository. The Next/Supabase
 * runtime factory lives in ./runtime (kept separate so tests and the engine
 * never import Next.js server modules).
 */
export interface Services {
  transactions: TransactionsService;
  assets: AssetsService;
  positions: PositionsService;
  portfolios: PortfoliosService;
  brokers: BrokersService;
  overrides: OverridesService;
}

export function buildServices(repo: LedgerRepository): Services {
  return {
    transactions: new TransactionsService(repo),
    assets: new AssetsService(repo),
    positions: new PositionsService(repo),
    portfolios: new PortfoliosService(repo),
    brokers: new BrokersService(repo),
    overrides: new OverridesService(repo),
  };
}
