# CURRENT_STATE

_Last updated: 2026-07-11 (D2 implementation complete — local commit, not pushed)_

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

**D2 — Wealth redesign: COMPLETE (local commit, not pushed; awaiting owner review).** FinTable flagship (`ui/fin-table.tsx` + pure `lib/fin-table.ts`): closed column-type set, single-column sort (nulls last), density Comfortable 44 / Compact 32 remembered per table (useSyncExternalStore + localStorage), sticky header, per-currency footer aggregates (never mixed, §4.9), month group headers, declared mobile card transform, export seat (disabled until M4). Positions migrated onto it — every figure through the Figure primitive; price/value carry provenance (source · as-of · actor "You" on manual · derivation qty×price). AllocationBar (top-8 + Other, chart tokens, display-ccy via peg FX, unpriced/excluded named). StatBlock primitive; drawer restyled to three zones (identity / stat grid / ledger timeline with glyphs). NEW **Accounts tab** (per-broker ledger facts: recorded count, last activity, currencies; per-account holdings honestly deferred to M4). NEW **Cash statement** (`getCashStatement` service read model): per-currency opening → signed events with running balance → closing, engine replay order via `compareTransactions`, **closing ≡ engine balance tested**; sacred payments marked ◆. Tabs now Positions · Accounts · Cash · Activity (legacy `?tab=history` redirects). 119 tests (＋15: fin-table logic 9, cash statement 6). typecheck/lint/build ✔. Local boot verified (landing 200); authenticated Wealth pass = owner's production check post-push (no local credentials by design). Figma reference: system file `Thz2JywmZei5FKdrgT8Td0` (D-018 step-4 frames); B v3 exploration parked unratified in the Lab file — no AMANAH amendments.


**D1a — LIVE in production** (`feae5bb`, verified: tokens/dual themes/boot script on prod; owner's authenticated pass ✔).

**D1b — LIVE in production** (`cd8b2c2`; owner's authenticated pass surfaced the regressions below).

**FINANCIAL-TRUTH FIXES (Bugs 1–4) — COMPLETE (local commit, not pushed; awaiting owner review; D2 remains paused).** Draft-guard on the transaction dialog (dirty close → confirm; failures preserve fields; success = exact "Recorded — portfolio figures updated." + revalidation of /portfolio + /dashboard); Wealth header replaced by six shared summary cards (total/market/cash/basis/unrealized/realized) with the tested equations; Dashboard rebuilt on the SAME `getWealthSummary` read model (no legacy trades/holdings/dividends reads — tripwire-tested; legacy banner removed; zakat = honest pending state); dual-currency display (profile-stored USD/AED preference, switcher on both pages, ≈ secondary equivalents, peg FX provider 3.6725 with provenance, missing-rate exclusion). 104 tests.

**D1b delivery notes (superseded heading):** Delivered: grouped nav shell (Council IA — OVERVIEW/WEALTH/THINKING/PURITY◆/UNDERSTAND; labels Wealth·Journal·Screener·Insights·Zakat & Purify, routes unchanged; shared `nav-config.ts` single source), ⌘K command palette (hand-rolled on Dialog, ARIA combobox, Actions + Navigate, opens the same TransactionDialog), mobile bottom tab bar (Home·Wealth·+·Zakat·More sheet; FAB retired; safe-area; toaster raised above bar), compliance ShieldBadge system (filled/half/slashed/dashed-outline shapes + labels — never color-alone; swapped into ComplianceBadge + Positions), glossary registry (`lib/glossary.ts`, 15 terms) + GlossaryTerm popover (wired: sell avg-cost, dividend purification). THINKING houses Journal+Calendar until Research lands (M5.5). Next: owner review of D1b → push → **D2 Wealth redesign**.

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
