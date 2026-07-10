/**
 * Transaction draft protection (Bug 1) — the pure decision logic behind the
 * dialog's close guard, extracted so the regression rules are unit-tested:
 *
 * 1. A dirty draft is never silently dismissed (Escape / backdrop / X /
 *    bottom-tab tap all funnel into requestClose → 'confirm').
 * 2. A failed submission preserves every entered field and keeps the dialog
 *    open with the server's actual error.
 * 3. A successful save closes, clears the draft, and revalidates every
 *    ledger read model.
 */

import { REVALIDATED_ROUTES } from "@/lib/services/revalidation";

/** Everything the user can type — the identity of a draft. */
export interface DraftSnapshot {
  type: string;
  assetKey: string | null; // selected/preset asset id or position asset id
  portfolioId: string;
  brokerId: string | null;
  quantity: string;
  price: string;
  amount: string;
  fees: string;
  currency: string;
  tradeDate: string;
  tradeTime: string;
  purification: string;
  notes: string;
}

export function serializeDraft(s: DraftSnapshot): string {
  // Stable field order — object identity is irrelevant, content is.
  return [
    s.type,
    s.assetKey ?? "",
    s.portfolioId,
    s.brokerId ?? "",
    s.quantity,
    s.price,
    s.amount,
    s.fees,
    s.currency,
    s.tradeDate,
    s.tradeTime,
    s.purification,
    s.notes,
  ].join("");
}

export function isDraftDirty(current: DraftSnapshot, initial: string | null): boolean {
  if (initial === null) return false; // snapshot not taken yet (still loading)
  return serializeDraft(current) !== initial;
}

export type CloseDecision = "close" | "confirm" | "ignore";

/**
 * What to do when ANY close is requested (Escape, backdrop, X, Cancel,
 * navigation attempt). Saving blocks closing entirely; dirt demands
 * confirmation; clean closes immediately.
 */
export function decideClose(state: { dirty: boolean; saving: boolean }): CloseDecision {
  if (state.saving) return "ignore";
  if (state.dirty) return "confirm";
  return "close";
}

export interface SubmitOutcome {
  keepOpen: boolean;
  preserveDraft: boolean;
  clearDraft: boolean;
  /** AMANAH-register message to show; null = show the server error inline. */
  toast: string | null;
  /** Read models that must be revalidated. Empty on failure. */
  revalidate: readonly string[];
}

export const SUCCESS_TOAST = "Recorded — portfolio figures updated.";

export function submitOutcome(result: { ok: boolean }): SubmitOutcome {
  if (!result.ok) {
    return {
      keepOpen: true,
      preserveDraft: true,
      clearDraft: false,
      toast: null, // the actual server error renders inline, never a silent close
      revalidate: [],
    };
  }
  return {
    keepOpen: false,
    preserveDraft: false,
    clearDraft: true,
    toast: SUCCESS_TOAST,
    revalidate: REVALIDATED_ROUTES,
  };
}
