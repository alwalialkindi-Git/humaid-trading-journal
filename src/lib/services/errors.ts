export type ServiceErrorCode =
  | "validation"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "engine_rejected";

/**
 * Errors thrown by the service layer. `engine_rejected` wraps EngineError:
 * the mutation would produce an impossible ledger (e.g. oversell) and was
 * NOT persisted.
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code: ServiceErrorCode
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
