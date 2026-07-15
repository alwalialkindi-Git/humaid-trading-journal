import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSettled,
  getSettledId,
  isSettleFresh,
  markSettled,
  SETTLE_WINDOW_MS,
  subscribeSettled,
} from "./settle";

beforeEach(() => {
  clearSettled();
});

describe("isSettleFresh", () => {
  it("fresh within the window, inclusive at the boundary", () => {
    expect(isSettleFresh(1000, 1000)).toBe(true);
    expect(isSettleFresh(1000, 1000 + SETTLE_WINDOW_MS)).toBe(true);
    expect(isSettleFresh(1000, 1001 + SETTLE_WINDOW_MS)).toBe(false);
  });

  it("never fresh before it was saved", () => {
    expect(isSettleFresh(2000, 1000)).toBe(false);
  });
});

describe("settle store", () => {
  it("returns the marked id while fresh, null after the window", () => {
    markSettled("tx-1", 1000);
    expect(getSettledId(1000)).toBe("tx-1");
    expect(getSettledId(1000 + SETTLE_WINDOW_MS + 1)).toBeNull();
  });

  it("clearSettled consumes the flag", () => {
    markSettled("tx-1", 1000);
    clearSettled();
    expect(getSettledId(1000)).toBeNull();
  });

  it("a newer save replaces the previous one", () => {
    markSettled("tx-1", 1000);
    markSettled("tx-2", 2000);
    expect(getSettledId(2000)).toBe("tx-2");
  });

  it("notifies subscribers on mark and clear, not after unsubscribe", () => {
    const cb = vi.fn();
    const unsubscribe = subscribeSettled(cb);
    markSettled("tx-1", 1000);
    clearSettled();
    expect(cb).toHaveBeenCalledTimes(2);
    unsubscribe();
    markSettled("tx-2", 2000);
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
