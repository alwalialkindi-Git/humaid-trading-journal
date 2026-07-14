import { describe, expect, it } from "vitest";
import {
  allocationSegments,
  densityStorageKey,
  nextSort,
  normalizeDisplayValues,
  sortRows,
  sumByCurrency,
} from "./fin-table";
import { PegFxProvider } from "./fx";

describe("sortRows", () => {
  const rows = [
    { sym: "A", value: 100 as number | null },
    { sym: "B", value: null },
    { sym: "C", value: 300 },
    { sym: "D", value: 200 },
  ];

  it("sorts numbers desc with nulls LAST", () => {
    const out = sortRows(rows, (r) => r.value, "desc");
    expect(out.map((r) => r.sym)).toEqual(["C", "D", "A", "B"]);
  });

  it("sorts numbers asc with nulls STILL last (unpriced never pretends to be smallest)", () => {
    const out = sortRows(rows, (r) => r.value, "asc");
    expect(out.map((r) => r.sym)).toEqual(["A", "D", "C", "B"]);
  });

  it("sorts strings and never mutates the input", () => {
    const input = [{ s: "b" }, { s: "a" }];
    const out = sortRows(input, (r) => r.s, "asc");
    expect(out.map((r) => r.s)).toEqual(["a", "b"]);
    expect(input.map((r) => r.s)).toEqual(["b", "a"]);
  });
});

describe("nextSort", () => {
  it("new column starts desc; same column flips", () => {
    expect(nextSort(null, "value")).toEqual({ key: "value", dir: "desc" });
    expect(nextSort({ key: "value", dir: "desc" }, "value")).toEqual({
      key: "value",
      dir: "asc",
    });
    expect(nextSort({ key: "value", dir: "asc" }, "qty")).toEqual({
      key: "qty",
      dir: "desc",
    });
  });
});

describe("sumByCurrency — footer aggregates never mix currencies (§4.9)", () => {
  const rows = [
    { v: 100 as number | null, c: "AED" },
    { v: 50.555, c: "aed" }, // case-normalized
    { v: 200, c: "USD" },
    { v: null, c: "USD" }, // unpriced → skipped, not zeroed
  ];

  it("produces one labeled total per currency, sorted, rounded to 2dp", () => {
    const out = sumByCurrency(rows, (r) => r.v, (r) => r.c);
    expect(out).toEqual([
      { currency: "AED", total: 150.56 },
      { currency: "USD", total: 200 },
    ]);
  });
});

describe("allocationSegments — top-N + other", () => {
  it("keeps top N and folds the remainder into a single Other", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      label: `P${i}`,
      value: 100 - i * 5, // 100, 95, ... 55
    }));
    const out = allocationSegments(items, 8);
    expect(out).toHaveLength(9);
    expect(out[8].isOther).toBe(true);
    expect(out[8].label).toBe("Other (2)");
    // value conservation: segments sum to the input total
    const total = items.reduce((s, i) => s + i.value, 0);
    expect(out.reduce((s, seg) => s + seg.value, 0)).toBeCloseTo(total, 2);
  });

  it("emits no Other when N or fewer items", () => {
    const out = allocationSegments(
      [
        { label: "A", value: 60 },
        { label: "B", value: 40 },
      ],
      8
    );
    expect(out).toHaveLength(2);
    expect(out.every((s) => !s.isOther)).toBe(true);
    expect(out[0].percent).toBe(60);
    expect(out[1].percent).toBe(40);
  });

  it("excludes zero/negative values and returns [] when nothing is positive", () => {
    expect(
      allocationSegments([
        { label: "A", value: 0 },
        { label: "B", value: -5 },
      ])
    ).toEqual([]);
  });
});

describe("normalizeDisplayValues — weights NEVER from mixed native currencies (§4.9)", () => {
  const fx = new PegFxProvider();
  // The exact production dataset that exposed the D2 bug: two AED holdings
  // + one USD holding whose native figure is small but whose converted
  // value is the largest position.
  const holdings = [
    { id: "emaar", value: 11860 as number | null, ccy: "AED" },
    { id: "dib", value: 3885 as number | null, ccy: "AED" },
    { id: "baba", value: 3718.28 as number | null, ccy: "USD" },
  ];
  const normalize = (rows: typeof holdings, display = "AED") =>
    normalizeDisplayValues(
      rows,
      (r) => r.id,
      (r) => r.value,
      (r) => r.ccy,
      display,
      fx
    );

  it("converts each holding into the display currency before weighting", () => {
    const out = normalize(holdings);
    expect(out.get("baba")!.displayValue).toBe(13655.38); // 3,718.28 × 3.6725
    expect(out.get("emaar")!.displayValue).toBe(11860);
    // Correct mixed AED/USD weights (the buggy mixed-native sum gave 60.9/20.0/19.1):
    expect(out.get("baba")!.weightPercent).toBe(46.4);
    expect(out.get("emaar")!.weightPercent).toBe(40.3);
    expect(out.get("dib")!.weightPercent).toBe(13.2);
  });

  it("produces the SAME percentages the AllocationBar renders", () => {
    const out = normalize(holdings);
    const segments = allocationSegments(
      holdings.map((h) => ({ label: h.id, value: out.get(h.id)!.displayValue! })),
      8
    );
    for (const seg of segments) {
      expect(seg.percent).toBe(out.get(seg.label)!.weightPercent);
    }
  });

  it("sorts by FX-normalized display value, not raw native figures", () => {
    const rows = [...holdings, { id: "unpriced", value: null, ccy: "AED" }];
    const out = normalize(rows);
    const sorted = sortRows(rows, (r) => out.get(r.id)?.displayValue ?? null, "desc");
    // Native-figure sorting wrongly ranked BABA (3,718.28 USD) below both
    // AED holdings; normalized it is the largest. Nulls stay last.
    expect(sorted.map((r) => r.id)).toEqual(["baba", "emaar", "dib", "unpriced"]);
  });

  it("excludes missing-rate holdings from the base — null weight, never zeroed", () => {
    const rows = [...holdings, { id: "egp-asset", value: 5000 as number | null, ccy: "EGP" }];
    const out = normalize(rows);
    expect(out.get("egp-asset")).toEqual({
      displayValue: null,
      weightPercent: null,
      noRate: true,
    });
    // Convertible holdings keep the same weights as without the EGP row.
    expect(out.get("baba")!.weightPercent).toBe(46.4);
    // And the missing-rate row sorts last alongside unpriced rows.
    const sorted = sortRows(rows, (r) => out.get(r.id)?.displayValue ?? null, "desc");
    expect(sorted.at(-1)!.id).toBe("egp-asset");
  });

  it("unpriced rows carry noRate=false so exclusions are named for the right reason", () => {
    const out = normalize([{ id: "x", value: null, ccy: "AED" }]);
    expect(out.get("x")).toEqual({ displayValue: null, weightPercent: null, noRate: false });
  });
});

describe("densityStorageKey", () => {
  it("is namespaced per table", () => {
    expect(densityStorageKey("positions")).toBe("amanah:fin-density:positions");
  });
});
