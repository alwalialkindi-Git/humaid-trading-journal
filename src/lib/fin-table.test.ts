import { describe, expect, it } from "vitest";
import {
  allocationSegments,
  densityStorageKey,
  nextSort,
  sortRows,
  sumByCurrency,
} from "./fin-table";

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

describe("densityStorageKey", () => {
  it("is namespaced per table", () => {
    expect(densityStorageKey("positions")).toBe("amanah:fin-density:positions");
  });
});
