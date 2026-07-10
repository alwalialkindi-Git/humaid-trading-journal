import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  convert,
  convertTotals,
  fxDerivation,
  getFxProvider,
  PegFxProvider,
  USD_AED_PEG,
} from "./index";
import { formatApproxMoney } from "@/lib/amanah/number";

const fx = new PegFxProvider();

describe("FX provider (peg methodology)", () => {
  it("converts USD→AED using the official peg, with full provenance", () => {
    const rate = fx.getRate("USD", "AED")!;
    expect(rate.rate).toBe(3.6725);
    expect(rate.base).toBe("USD");
    expect(rate.quote).toBe("AED");
    expect(rate.source).toContain("peg");
    expect(rate.asOf).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(convert(12345.67, rate)).toBe(45339.47); // 12,345.67 × 3.6725
  });

  it("converts AED→USD in the reverse direction", () => {
    const rate = fx.getRate("AED", "USD")!;
    expect(rate.rate).toBeCloseTo(1 / USD_AED_PEG, 10);
    expect(convert(3672.5, rate)).toBe(1000);
  });

  it("returns null for unsupported pairs — callers must exclude, never zero", () => {
    expect(fx.getRate("SAR", "AED")).toBeNull();
    expect(fx.getRate("USD", "EUR")).toBeNull();
  });
});

describe("convertTotals (read-layer)", () => {
  const parts = [
    { currency: "AED", amount: 1000 },
    { currency: "USD", amount: 100 },
  ];

  it("sums into the display currency and flags approximation", () => {
    const toAed = convertTotals(parts, "AED", fx);
    expect(toAed.total).toBe(1000 + 100 * USD_AED_PEG);
    expect(toAed.approximate).toBe(true); // → the figure MUST carry ≈
    expect(toAed.excluded).toHaveLength(0);
    expect(toAed.rates_used).toHaveLength(1);

    const toUsd = convertTotals(parts, "USD", fx);
    expect(toUsd.total).toBe(Math.round((100 + 1000 / USD_AED_PEG) * 100) / 100);
  });

  it("same-currency-only input needs no ≈", () => {
    const res = convertTotals([{ currency: "AED", amount: 500 }], "AED", fx);
    expect(res.approximate).toBe(false);
    expect(res.total).toBe(500);
  });

  it("missing FX rate → component EXCLUDED and named, never treated as zero", () => {
    const res = convertTotals(
      [...parts, { currency: "SAR", amount: 999 }],
      "AED",
      fx
    );
    expect(res.excluded).toEqual([{ currency: "SAR", amount: 999 }]);
    // total unchanged by the excluded component (and NOT reduced to zero):
    expect(res.total).toBe(1000 + 100 * USD_AED_PEG);
  });

  it("never mutates its inputs (native values immutable)", () => {
    const input = [{ currency: "USD", amount: 100 }];
    const before = JSON.stringify(input);
    convertTotals(input, "AED", fx);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("derivation line explains the conversion for provenance", () => {
    const res = convertTotals(parts, "AED", fx);
    const line = fxDerivation(res.rates_used)!;
    expect(line).toContain("USD/AED 3.6725");
    expect(line).toContain("peg");
    expect(line).toContain("As of");
  });
});

describe("approximation symbol (AMANAH §4.9)", () => {
  it("converted figures always carry ≈", () => {
    expect(formatApproxMoney(45339.47, "AED")).toBe("≈ 45,339.47 AED");
  });
});

describe("singleton provider", () => {
  it("getFxProvider returns the configured peg provider", () => {
    expect(getFxProvider().id).toBe("aed-peg");
  });
});

describe("no legacy tables in current financial summaries (tripwire)", () => {
  // Bug 3 regression guard: the Dashboard and the shared cards must never
  // read trades/holdings/dividends legacy tables as current truth.
  const read = (rel: string) =>
    readFileSync(join(process.cwd(), rel), "utf8");

  it("dashboard page reads only the ledger", () => {
    const src = read("src/app/(app)/dashboard/page.tsx");
    expect(src).not.toMatch(/from\(["'](trades|holdings|dividends)["']\)/);
    expect(src).toContain("getWealthSummary");
    expect(src).toContain("SummaryCards");
  });

  it("wealth page renders the same shared read model", () => {
    const src = read("src/app/(app)/portfolio/page.tsx");
    expect(src).toContain("getWealthSummary");
    expect(src).toContain("SummaryCards");
  });
});
