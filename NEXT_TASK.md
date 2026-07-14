# NEXT_TASK — D2: Wealth Redesign

> **STATUS: D2 COMPLETE — live in production (`a688a4d` + smoke-test fixes `892bb24`),
> authenticated production pass ✔ 2026-07-14.** The next task is
> **D3 — Transaction flow** (sprint §28/§11): dialog compaction (segmented type
> row), TicketLine summary, save-settle moment (row settles with 2s highlight),
> keyboard completeness, asset-search row alignment. Logic untouched — the
> draft-guard, sell preview ≡ engine, and ADIB warning flow are the regression
> baseline.

## Delivered scope (D2)

- **FinTable** (flagship, sprint §22 / AMANAH §5): `components/ui/fin-table.tsx` on pure
  `lib/fin-table.ts` — closed column types, single-column sort with nulls last, density
  44/32 remembered per table, sticky header, per-currency footer aggregates, month group
  headers, declared mobile card transform, export seat (M4).
- **Positions migrated**: Figure primitive everywhere; provenance on price + value
  (source · as-of · actor · derivation — CIO condition 3); shields unchanged; footer
  Σ value per currency; default sort by value.
- **AllocationBar** (top-8 + Other) on chart tokens with display-currency weights via the
  peg FX layer; unpriced/no-rate holdings excluded BY NAME.
- **StatBlock**; **drawer restyle** (identity / figures / ledger timeline zones).
- **Accounts tab**: per-broker ledger facts (recorded transactions, last activity,
  currencies) + link to filtered Activity; per-account holdings/cash stated as M4 scope.
- **Cash statement**: `PositionsService.getCashStatement` — opening → signed events with
  running balance → closing per currency, engine replay order, sacred payments ◆;
  **closing ≡ engine cash balance is a test invariant**.
- **Tabs**: Positions · Accounts · Cash · Activity (History renamed; legacy links resolve).

## Verified

typecheck / lint / build / **119 tests** ✔ (＋15 for fin-table logic and statement parity).
Local boot: landing renders on fresh dev server; `/portfolio` requires Supabase env
(none locally by design) — authenticated pass is the owner's production check post-push.
