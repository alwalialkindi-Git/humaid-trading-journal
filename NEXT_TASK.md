# NEXT_TASK — D4: Dashboard ("the 60-second review")

> **STATUS: D4 COMPLETE — live in production (`beb195d`, Vercel READY),
> authenticated production smoke test PASSED 2026-07-15/16 (full owner
> checklist; no defects; one 1-cent ≈-aggregation observation logged in
> CURRENT_STATE). All test state restored (hawl date null, currency AED,
> snoozes/period cleared).**
> The next task is **D5 — Islamic finance center** per sprint §28 — not
> started; awaiting owner go-ahead.

## Delivered scope (D4 — sprint §28/§9, fuses milestone Phase 6 dashboard)

- **WealthStrip** (hero): display-currency total in `figure-xl` from the SAME
  `getWealthSummary` rows as Wealth (≈ secondary, native truth line, missing-FX
  excluded and named, provenance on the figure). Global period selector
  (D/W/M/YTD/1Y, persisted at `amanah:period`); period change + sparkline slots
  render "insufficient history" until the M2 daily valuation series (CIO
  condition 1 — never an approximation). Tripwire test now requires
  `getWealthSummary` + `WealthStrip` on the dashboard.
- **AttentionQueue** (`lib/attention.ts` pure + tested): one component replaces
  the banner stacks (hawl banner, NegativeCashNotice, shariah-status card).
  Tiers obligation > integrity > freshness > housekeeping; items — hawl ≤ 30d,
  purification owed (accrued − paid, ledger-derived), non-compliant, unscreened,
  negative cash, stale prices (>24h, manual prices exempt), unpriced. Max 5 +
  "view all"; snooze 7d (localStorage) for everything EXCEPT obligations —
  never snoozable, brass ◆. Empty state: "All quiet, alhamdulillah."
- **ExposureBand**: `SegmentBar` extracted from AllocationBar (Wealth API
  unchanged); dimension toggle Asset · Class · Currency; top-3 concentration,
  liquidity split (listed/unlisted — `is_listed` added to HoldingView, ◇A6),
  currency split, compliance shield summary — all from the ONE
  `normalizeDisplayValues` base (§4.9).
- **FlowsRow**: cash per currency (shared read-model rows), income (dividends
  MTD/YTD on the UTC calendar + purification owed ◆; `lib/dashboard.ts`
  incomeSummary, pure + tested), zakat tile (brass; real hawl countdown;
  accrual estimate honestly pending until the M4 engine).
- **Recent activity** restyled to the D2 timeline glyph language (sacred types
  ◆) and **ledger-native insights** (`generateLedgerInsights`: concentration
  >35 %, strongest/weakest ≥ ±10 %, income YTD; max 3 shown; InsightCards
  re-tokened for both themes).

## Honest deferrals (queue sources & seats, not placeholders)

Reconciliation due (M4 import) · unannotated trades (journal rebuild, Phase 7) ·
research follow-ups (M5.5) · account/label exposure grouping (M4/M5.5) ·
period figures + sparkline (M2 valuation series) · zakat accrual estimate (M4) ·
wealth-strip settle-on-change (needs a change signal; motion §26 forbids
settle on load).

## Regression baseline (verified by existing tests, all passing)

One financial truth: dashboard reads only ledger read models (tripwire), weights
≡ AllocationBar ≡ Weight column (shared normalization), per-currency sums never
mixed (§4.9), cash statement ≡ engine balance.

## Verified

typecheck / lint / build / **164 tests** ✔ (＋21: dashboard math 12, attention
queue 9). Local boot: landing 200; `/dashboard` requires Supabase env (none
locally by design) — the authenticated dashboard pass is the owner's production
check post-push.
