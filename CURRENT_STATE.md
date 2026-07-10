# CURRENT_STATE

_Last updated: 2026-07-10 (start of D1a)_

## Production

- **URL:** https://humaid-trading-journal.vercel.app (Vercel, team `alwali`, project `humaid-trading-journal`, auto-deploys `main`)
- **Latest commit on `main` / deployed:** `aa7307e` — "M1 Phase 5: The Loop"
- Supabase: MVP schema (001) + ledger migration (`002_ledger.sql`) **applied to live**; `SUPABASE_SERVICE_ROLE_KEY` + market-data env set on Vercel.

## Completed

- **MVP** (`ce7d916`) — 14-page journal/portfolio/zakat app on legacy tables.
- **M1 Phase 1 — ledger schema** (`3c2ead9`): exchanges/assets/asset_overrides/portfolios/brokers/transactions/journal_annotations/positions, RLS, signup trigger; PGlite-validated.
- **M1 Phase 2 — position engine** (same commit): pure average-cost engine, trial-replay ordering, no-shorts; 22+ tests.
- **M1 Phase 3 — market data layer** (`03201d2`): provider abstraction (Yahoo default, Mock fallback, TwelveData/EODHD stubs), UAE search rules incl. ADIB-Egypt guard, `/api/market/*`.
- **M1 Phase 4 — service layer** (`768d44f`): repository pattern, trial-recompute validation, admin-key boundary; 57 tests.
- **M1 Phase 5 — "The Loop"** (`aa7307e`): Add Transaction (8 types), asset search + custom UAE assets, sell preview ≡ engine, brokers, ledger-true Portfolio (Positions/Cash/History), redirects from old pages; 60 tests. **Live-smoke-tested by owner.**
- **Design constitution** (uncommitted until D1a commit): PRD, M1 design doc, Phase 5 UX review committed earlier; Design Sprint 1 (amended), Design Council Final Review (CIO 5 conditions + Irreplaceability Doctrine), AMANAH design system — approved and **frozen**.

## Current phase

**D1a — COMPLETE (local commit, not pushed; awaiting owner review).** Delivered: Amanah token layer v2 (two-layer, dual themes verified in browser), figure typography utilities, `lib/amanah/` number + trust systems (20 rule tests), Figure primitive with provenance popover, FinTable primitives + cell renderers, Field wrapper, motion verbs wired into Dialog/Sheet, badge dark tints, single-mark EmptyState, theme toggle (sidebar footer). No page redesigns; Phase 5 flows untouched. Next: owner review → **D1b** (nav shell, ⌘K, mobile bottom tabs, shield icons, glossary registry).

## Known limitations

- **Two worlds until Phase 8 migration:** Dashboard, Trades, Analytics, Calendar, Watchlist, Shariah, and the Zakat prefill still read **legacy MVP tables**; only Portfolio is ledger-true. Legacy-data notice shown on Dashboard.
- No FX conversion (totals per currency; `≈` conversions arrive M2).
- No daily valuation series yet → **no performance figures permitted** (CIO condition 1).
- Shariah screening engine not implemented (M3) — all badges honestly "Not screened" (or user override).
- Broker import + reconciliation not implemented (M4).
- ADX has no automated provider (manual_custom tier; paid-provider validation in M2).
- Prices refresh on demand only (cron in M2). Yahoo is unofficial — degrades to cached + mock.
- Dark theme (landing page + legacy pages have hardcoded light tints — acceptable until their redesign phases).
- Account deletion is a placeholder (M5).

## Next objective

Finish D1a → owner review → D1b (nav shell, ⌘K, mobile tabs, shield icons, glossary).
