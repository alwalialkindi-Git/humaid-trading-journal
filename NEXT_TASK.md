# NEXT_TASK — D1a: Design Foundation

> **STATUS: COMPLETE (committed locally, not pushed). Awaiting owner review.**
> On approval, the next task is **D1b** — nav shell (grouped sidebar incl. THINKING/Research), ⌘K command menu (≤15 actions), mobile bottom tab bar (FAB removed), compliance shield icon set, glossary registry. Do not start D1b before owner approval of D1a.

**Objective (was):** implement the design foundation ONLY — the Amanah token layer and the primitives every later phase builds on. The app must look refreshed but behave identically.

## Scope (build exactly this)

1. **Design tokens v2** — two layers (primitives → semantic aliases) in `globals.css` per AMANAH §6/§12.1; all existing semantic names keep working (values change, names don't); new tokens added (`surface-*`, `ink-*`, `pnl-*`, `sacred`, `border-strong`, compliance set); brass/amber separated; radius 8/6/4; two shadows only (borders-first).
2. **Dual themes** — light (warm paper) + dark (night desk) as co-equal alias sets under `[data-theme="dark"]`; no-FOUC init script; user preference persisted (`htj.theme`); default light; toggle placed unobtrusively (sidebar footer); Tailwind `dark:` custom variant wired to `data-theme`.
3. **Typography / figure scale** — `figure-xl/lg/md/sm` utilities with `tabular-nums` per AMANAH §4.
4. **Number formatting system** — `src/lib/amanah/number.ts`: money (2dp + trailing code), unit price (≤4dp trim→2), quantity (≤8dp trim), percent, signed deltas with **U+2212**, timestamps (HH:MM today / 8 Jul older / full in provenance), `≈` for converted figures. Unit-tested against AMANAH §4 rules. (Legacy `lib/format.ts` untouched — old pages migrate in D2+.)
5. **Trust states** — `src/lib/amanah/trust.ts`: the closed 10-state set + visibility logic ("trust whispers, exceptions speak"); `FreshnessDot` + `TrustChip` components.
6. **Figure primitive** — `components/ui/figure.tsx`: tabular figure + lighter currency code + delta sign/color + provenance popover (source · as-of · actor · derivation), quiet by default.
7. **Table primitives** — `components/fin-table/`: presentational base (sticky header, density comfortable/compact, right-aligned numeric cells, footer-aggregate row) + cell renderers on Figure (Money/Qty/UnitPrice/Delta/Percent/Date/Text). **No existing table migrates yet** (that's D2).
8. **Foundation components** — `Field` wrapper (label/help/error + aria); motion verbs (appear/slide/settle/nudge) as CSS utilities wired into Dialog/Sheet; Popover primitive; Badge dark-theme tints; EmptyState single-mark star (per Council A8 art direction).

## Do NOT touch

- No page redesigns (Wealth/Dashboard/etc. stay as-is on the new tokens).
- No Phase 5 flow changes (buy/ADIB/sell-preview are the regression baseline).
- No ledger/service/engine logic changes (except none).
- No Supabase schema changes.
- No new product-strategy documents.

## Success criteria

- Existing app works exactly as before (all flows), light and dark.
- Phase 5 flows intact; 60+ existing tests still green; new formatter/trust tests green.
- `typecheck` + `lint` + `build` + `test` all pass.
- Commit locally; **do not push** until owner approves.
