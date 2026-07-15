# NEXT_TASK — D3: Transaction flow

> **STATUS: D3 COMPLETE — live in production (`26829df` + smoke fixes `7dfc63b`),
> full authenticated production pass ✔ 2026-07-15, including re-verification of
> both smoke-fix regressions (mouse-clickable Cash/Obligation menus; Escape
> clears search results first, closes only when none remain).**
> The next task is **D4** per sprint §28 — not started; awaiting owner go-ahead.

## Delivered scope (D3 — sprint §28/§11; logic untouched)

- **Dialog compaction**: type switcher is one segmented row —
  Buy · Sell · Div · Cash ▾ · Obligation ▾ (`type-segment-row.tsx`); menu segments show
  the chosen subtype; sell segment disabled without open positions; Buy preselected,
  cursor in asset search (kept). Dialog 560px desktop, bottom sheet on mobile. Sacred
  copy moved to the brass accent (◆, `sacred`/`sacred-surface`).
- **TicketLine**: pure builder `lib/transactions/ticket.ts` + `ticket-line.tsx` — live
  sentence above the footer in AMANAH §4 figures; sells carry the engine P&L preview
  (same `previewSellRealizedPnl` export; the old preview box removed, not duplicated);
  **the same builder's text is the success toast** (falls back to the Bug-1 constant).
- **Save-settle moment**: `lib/transactions/settle.ts` (10s freshness window); the dialog
  marks the written row id; `FinTable` gained `highlightKey` + mobileCard meta; Activity
  settles the row with the 2s `animate-settle` verb, then consumes the flag.
- **Keyboard completeness**: global `N` opens Add Transaction (never while typing or a
  dialog is open); ⌘/Ctrl+Enter submits; Escape clears open search results before the
  dialog close guard; segmented row is a roving radiogroup (←/→/Home/End).
- **Asset-search row alignment**: results table-aligned — shield placeholder (dashed
  not-screened, sr-only label) / symbol / name / exchange / country·ccy grid columns;
  warned rows stay amber with the confirm step (§8.8 logic unchanged).

## Regression baseline (verified by existing tests, all passing)

Draft-guard (dirty close → confirm; failure preserves fields), sell preview ≡ engine,
ADIB / warned cross-exchange confirmation flow.

## Verified

typecheck / lint / build / **143 tests** ✔ (＋18: ticket builder 12, settle store 6).
`/portfolio` requires Supabase env (none locally by design) — the authenticated dialog
pass is the owner's production check post-push.
