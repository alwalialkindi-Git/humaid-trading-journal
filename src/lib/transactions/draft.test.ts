import { describe, expect, it } from "vitest";
import {
  decideClose,
  isDraftDirty,
  serializeDraft,
  submitOutcome,
  SUCCESS_TOAST,
  type DraftSnapshot,
} from "./draft";
import { REVALIDATED_ROUTES } from "@/lib/services/revalidation";

const clean: DraftSnapshot = {
  type: "buy",
  assetKey: null,
  portfolioId: "pf-1",
  brokerId: null,
  quantity: "",
  price: "",
  amount: "",
  fees: "0",
  currency: "AED",
  tradeDate: "2026-07-10",
  tradeTime: "",
  purification: "0",
  notes: "",
};

describe("dirty-form close protection (Bug 1)", () => {
  const initial = serializeDraft(clean);

  it("an untouched draft closes without ceremony", () => {
    expect(isDraftDirty(clean, initial)).toBe(false);
    expect(decideClose({ dirty: false, saving: false })).toBe("close");
  });

  it("ANY entered field makes the draft dirty → close requests must confirm", () => {
    for (const change of [
      { quantity: "10" },
      { price: "12.10" },
      { notes: "thesis…" },
      { assetKey: "asset-1" },
      { type: "sell" },
      { tradeDate: "2026-07-01" }, // backdating counts as data too
    ] as Partial<DraftSnapshot>[]) {
      const dirty = { ...clean, ...change };
      expect(isDraftDirty(dirty, initial)).toBe(true);
      expect(decideClose({ dirty: true, saving: false })).toBe("confirm");
    }
  });

  it("navigation/backdrop/Escape while dirty is intercepted (same decision path)", () => {
    // Every close source funnels into decideClose — a bottom-tab tap that
    // reaches the backdrop can therefore never silently discard.
    expect(decideClose({ dirty: true, saving: false })).toBe("confirm");
  });

  it("nothing closes while a save is in flight", () => {
    expect(decideClose({ dirty: true, saving: true })).toBe("ignore");
    expect(decideClose({ dirty: false, saving: true })).toBe("ignore");
  });

  it("before initialization completes, the draft is never considered dirty", () => {
    expect(isDraftDirty({ ...clean, quantity: "10" }, null)).toBe(false);
  });
});

describe("submission outcomes (Bug 1)", () => {
  it("failure keeps the dialog open and preserves every field", () => {
    const outcome = submitOutcome({ ok: false });
    expect(outcome.keepOpen).toBe(true);
    expect(outcome.preserveDraft).toBe(true);
    expect(outcome.clearDraft).toBe(false);
    expect(outcome.toast).toBeNull(); // the ACTUAL server error renders inline
    expect(outcome.revalidate).toHaveLength(0);
  });

  it("success closes, clears the draft, and shows the AMANAH message", () => {
    const outcome = submitOutcome({ ok: true });
    expect(outcome.keepOpen).toBe(false);
    expect(outcome.clearDraft).toBe(true);
    expect(outcome.toast).toBe(SUCCESS_TOAST);
    expect(SUCCESS_TOAST).toBe("Recorded — portfolio figures updated.");
  });

  it("success revalidates BOTH Wealth and Dashboard read models", () => {
    const outcome = submitOutcome({ ok: true });
    expect(outcome.revalidate).toContain("/portfolio");
    expect(outcome.revalidate).toContain("/dashboard");
    expect(outcome.revalidate).toEqual(REVALIDATED_ROUTES);
  });
});
