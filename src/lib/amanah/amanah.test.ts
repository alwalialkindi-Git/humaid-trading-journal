import { describe, expect, it } from "vitest";
import {
  APPROX,
  MINUS,
  ariaMoney,
  formatApproxMoney,
  formatDeltaMoney,
  formatFigureTimestamp,
  formatFullTimestamp,
  formatMoney,
  formatMoneyParts,
  formatMoneyValue,
  formatPercent,
  formatPercentLabel,
  formatQuantity,
  formatUnitPrice,
} from "./number";
import { isStale, trustIndicator, TRUST_STATES } from "./trust";

// ---------------------------------------------------------------------------
// AMANAH §4 — number rules, encoded as tests
// ---------------------------------------------------------------------------

describe("money (§4.3)", () => {
  it("always 2 decimals with grouping", () => {
    expect(formatMoneyValue(1234.5)).toBe("1,234.50");
    expect(formatMoneyValue(12120)).toBe("12,120.00");
    expect(formatMoneyValue(0)).toBe("0.00");
  });

  it("negative money uses the TRUE minus sign U+2212, never a hyphen", () => {
    const s = formatMoneyValue(-125.5);
    expect(s).toBe(`${MINUS}125.50`);
    expect(s.includes("-")).toBe(false); // no ASCII hyphen-minus anywhere
  });

  it("parts split figure and code for the Figure primitive", () => {
    expect(formatMoneyParts(12120, "aed")).toEqual({
      figure: "12,120.00",
      code: "AED",
    });
    expect(formatMoney(12120, "AED")).toBe("12,120.00 AED");
  });
});

describe("deltas (§4.7)", () => {
  it("always signed in BOTH directions", () => {
    expect(formatDeltaMoney(290)).toBe("+290.00");
    expect(formatDeltaMoney(-125.5)).toBe(`${MINUS}125.50`);
    expect(formatDeltaMoney(0)).toBe("+0.00");
  });
});

describe("converted figures (§4.9)", () => {
  it("carry the mandatory ≈ marker", () => {
    expect(formatApproxMoney(61430, "AED")).toBe(`${APPROX} 61,430.00 AED`);
  });
});

describe("unit prices (§4.4)", () => {
  it("up to 4 decimals, trimmed to a minimum of 2", () => {
    expect(formatUnitPrice(12.1)).toBe("12.10");
    expect(formatUnitPrice(27.165)).toBe("27.165");
    expect(formatUnitPrice(27.16504)).toBe("27.165"); // 4dp cap, then trim
    expect(formatUnitPrice(100)).toBe("100.00");
  });
});

describe("quantities (§4.5)", () => {
  it("up to 8 decimals, trailing zeros fully trimmed", () => {
    expect(formatQuantity(1000)).toBe("1,000");
    expect(formatQuantity(0.15)).toBe("0.15");
    expect(formatQuantity(0.15000001)).toBe("0.15000001");
    expect(formatQuantity(2.5)).toBe("2.5");
  });
});

describe("percentages (§4.6)", () => {
  it("1 decimal in tables; signed in delta context", () => {
    expect(formatPercent(4.25)).toBe("4.3%");
    expect(formatPercent(4.25, { delta: true })).toBe("+4.3%");
    expect(formatPercent(-3.1, { delta: true })).toBe(`${MINUS}3.1%`);
  });

  it("labels drop decimals at ≥10%", () => {
    expect(formatPercentLabel(42.4)).toBe("42%");
    expect(formatPercentLabel(4.25)).toBe("4.3%");
  });
});

describe("timestamps (§4.8) — fixed display zone (GST, UTC+4)", () => {
  // Inputs carry explicit offsets: output must not depend on the machine
  // timezone (SSR hydration parity — React #418 regression, D2 smoke test).
  const now = new Date("2026-07-08T15:00:00+04:00").getTime();

  it("same-day figures show HH:MM", () => {
    expect(formatFigureTimestamp("2026-07-08T12:31:00+04:00", now)).toBe("12:31");
  });

  it("older figures show day + month", () => {
    expect(formatFigureTimestamp("2026-07-03T12:31:00+04:00", now)).toBe("3 Jul");
  });

  it("provenance shows the full form", () => {
    expect(formatFullTimestamp("2026-07-08T12:31:00+04:00")).toBe("8 Jul 2026, 12:31");
  });

  it("renders in the fixed display zone regardless of the machine zone (hydration safety)", () => {
    // The same instant expressed in UTC and in GST must format identically:
    // server (UTC) and client (any zone) produce the same text.
    expect(formatFullTimestamp("2026-07-08T08:31:00Z")).toBe("8 Jul 2026, 12:31");
    expect(formatFullTimestamp("2026-07-08T08:31:00Z")).toBe(
      formatFullTimestamp("2026-07-08T12:31:00+04:00")
    );
    // Same-day boundary is evaluated in the display zone, not machine-local:
    // 22:30 UTC on 8 Jul is already 9 Jul in GST → not "same day" as 15:00 GST 8 Jul.
    expect(formatFigureTimestamp("2026-07-08T22:30:00Z", now)).toBe("9 Jul");
  });

  it("invalid input degrades to an em dash, never NaN", () => {
    expect(formatFigureTimestamp("not-a-date", now)).toBe("—");
  });
});

describe("screen-reader money (§27)", () => {
  it("spells the sign instead of relying on symbols", () => {
    expect(ariaMoney(-125.5, "AED")).toBe("minus 125.50 AED");
    expect(ariaMoney(290, "AED", true)).toBe("up 290.00 AED");
    expect(ariaMoney(-290, "AED", true)).toBe("down 290.00 AED");
  });
});

// ---------------------------------------------------------------------------
// AMANAH §9 — trust visibility: "trust whispers, exceptions speak"
// ---------------------------------------------------------------------------

describe("trust indicators (§9)", () => {
  const now = new Date("2026-07-08T15:00:00Z").getTime();
  const fresh = "2026-07-08T12:00:00Z"; // 3h old
  const stale = "2026-07-06T12:00:00Z"; // 51h old

  it("the closed set has exactly ten states", () => {
    expect(TRUST_STATES).toHaveLength(10);
  });

  it("normal is silent: live/calculated/imported/reconciled show nothing", () => {
    for (const state of ["live", "calculated", "imported", "reconciled"] as const) {
      expect(trustIndicator({ state, asOf: fresh }, now)).toEqual({ kind: "none" });
    }
  });

  it("human data always announces itself: manual/override/estimated chip", () => {
    expect(trustIndicator({ state: "manual" }, now)).toEqual({
      kind: "chip",
      label: "Manual",
    });
    expect(trustIndicator({ state: "override" }, now)).toEqual({
      kind: "chip",
      label: "Override",
    });
    expect(trustIndicator({ state: "estimated" }, now)).toEqual({
      kind: "chip",
      label: "Estimated",
    });
  });

  it("staleness speaks only past 24h", () => {
    expect(trustIndicator({ state: "cached", asOf: fresh }, now)).toEqual({
      kind: "none",
    });
    expect(trustIndicator({ state: "cached", asOf: stale }, now)).toEqual({
      kind: "dot",
      tone: "warn",
      pulse: false,
    });
    // a "live" figure whose timestamp aged also degrades honestly
    expect(trustIndicator({ state: "live", asOf: stale }, now)).toEqual({
      kind: "dot",
      tone: "warn",
      pulse: false,
    });
  });

  it("pending pulses", () => {
    expect(trustIndicator({ state: "pending" }, now)).toEqual({
      kind: "dot",
      tone: "warn",
      pulse: true,
    });
  });

  it("isStale boundary sits at exactly 24h", () => {
    const exactly24h = new Date(now - 24 * 3_600_000).toISOString();
    const past24h = new Date(now - 24 * 3_600_000 - 1000).toISOString();
    expect(isStale(exactly24h, now)).toBe(false);
    expect(isStale(past24h, now)).toBe(true);
    expect(isStale(undefined, now)).toBe(false);
  });
});
