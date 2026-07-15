import { describe, expect, it } from "vitest";
import {
  ATTENTION_MAX_VISIBLE,
  buildAttentionItems,
  snoozeUntilIso,
  visibleAttention,
  type AttentionInput,
  type AttentionItem,
} from "./attention";

/**
 * Attention queue (D4, §9.2 ◇A5): strict severity tiers, max 5 + view all,
 * snoozable except obligations. Obligations can never be silenced — that is
 * the amanah, encoded.
 */

const NOW = Date.parse("2026-07-15T12:00:00Z");

const EMPTY: AttentionInput = {
  hawlDaysRemaining: null,
  purificationOwed: [],
  nonCompliant: [],
  unscreened: 0,
  negativeCashCurrencies: [],
  stalePrices: [],
  unpriced: [],
};

describe("buildAttentionItems", () => {
  it("returns nothing for a quiet ledger", () => {
    expect(buildAttentionItems(EMPTY)).toEqual([]);
  });

  it("builds every item class with the right tier and snoozability", () => {
    const items = buildAttentionItems({
      hawlDaysRemaining: 12,
      purificationOwed: [{ currency: "AED", amount: 20 }],
      nonCompliant: ["RIBA"],
      unscreened: 2,
      negativeCashCurrencies: ["USD"],
      stalePrices: ["EMAAR"],
      unpriced: ["PRIVCO"],
    });
    expect(items.map((i) => [i.id, i.tier, i.snoozable])).toEqual([
      ["zakat-hawl", "obligation", false],
      ["purification-owed", "obligation", false],
      ["non-compliant", "integrity", true],
      ["unscreened", "integrity", true],
      ["negative-cash", "integrity", true],
      ["stale-prices", "freshness", true],
      ["unpriced", "freshness", true],
    ]);
    // Acts of worship carry the brass accent, never alarm styling.
    expect(items.find((i) => i.id === "zakat-hawl")?.sacred).toBe(true);
    expect(items.find((i) => i.id === "purification-owed")?.sacred).toBe(true);
    expect(items.find((i) => i.id === "purification-owed")?.title).toContain(
      "20.00 AED"
    );
  });

  it("hawl enters the queue only inside the 30-day window", () => {
    expect(
      buildAttentionItems({ ...EMPTY, hawlDaysRemaining: 31 })
    ).toEqual([]);
    const due = buildAttentionItems({ ...EMPTY, hawlDaysRemaining: 0 });
    expect(due[0].title).toContain("zakat is due");
  });

  it("ignores non-positive purification balances (paid ahead is not owed)", () => {
    expect(
      buildAttentionItems({
        ...EMPTY,
        purificationOwed: [{ currency: "AED", amount: -25 }],
      })
    ).toEqual([]);
  });
});

describe("visibleAttention", () => {
  const item = (
    id: string,
    tier: AttentionItem["tier"],
    snoozable = tier !== "obligation"
  ): AttentionItem => ({
    id,
    tier,
    title: id,
    href: "/",
    hrefLabel: "Open",
    snoozable,
  });

  it("orders strictly by tier: obligation > integrity > freshness > housekeeping", () => {
    const out = visibleAttention(
      [
        item("h1", "housekeeping"),
        item("f1", "freshness"),
        item("o1", "obligation"),
        item("i1", "integrity"),
      ],
      {},
      NOW
    );
    expect(out.visible.map((i) => i.id)).toEqual(["o1", "i1", "f1", "h1"]);
    expect(out.total).toBe(4);
  });

  it("caps at 5 visible and carries the rest as overflow", () => {
    const items = [
      item("o1", "obligation"),
      item("i1", "integrity"),
      item("i2", "integrity"),
      item("f1", "freshness"),
      item("f2", "freshness"),
      item("h1", "housekeeping"),
    ];
    const out = visibleAttention(items, {}, NOW);
    expect(out.visible).toHaveLength(ATTENTION_MAX_VISIBLE);
    expect(out.overflow.map((i) => i.id)).toEqual(["h1"]);
  });

  it("hides actively snoozed items and counts them; expired snoozes are void", () => {
    const items = [item("f1", "freshness"), item("f2", "freshness")];
    const out = visibleAttention(
      items,
      {
        f1: new Date(NOW + 3_600_000).toISOString(), // active
        f2: new Date(NOW - 3_600_000).toISOString(), // expired
      },
      NOW
    );
    expect(out.visible.map((i) => i.id)).toEqual(["f2"]);
    expect(out.snoozed).toBe(1);
    expect(out.total).toBe(1);
  });

  it("obligations can never be snoozed away", () => {
    const out = visibleAttention(
      [item("o1", "obligation")],
      { o1: new Date(NOW + 86_400_000).toISOString() },
      NOW
    );
    expect(out.visible.map((i) => i.id)).toEqual(["o1"]);
    expect(out.snoozed).toBe(0);
  });
});

describe("snoozeUntilIso", () => {
  it("defaults to 7 days from now", () => {
    expect(snoozeUntilIso(NOW)).toBe(
      new Date(NOW + 7 * 86_400_000).toISOString()
    );
  });
});
