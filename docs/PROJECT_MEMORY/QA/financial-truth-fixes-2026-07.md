# Financial-truth regression fixes (2026-07, pre-D2)

Owner's authenticated production check after D1b found four regressions; D2 paused until fixed. Root causes:

1. **Draft loss (Bug 1):** Radix Dialog dismisses on Escape/backdrop by default AND our `onOpenChange` called `reset()` on every close — any outside tap wiped the draft. (Bottom-nav z-index was *not* the culprit: nav z-40 sits under overlay z-50; the tap hit the backdrop, whose dismiss was the destructive act.) Fix: snapshot-based dirty detection (`lib/transactions/draft.ts`), every close path funnels through `decideClose` (dirty→confirm overlay "Discard this unsaved transaction?", saving→ignore), failures keep dialog + fields + show the real server error, success shows the exact AMANAH toast and revalidates `REVALIDATED_ROUTES`.
2. **Misleading header (Bug 2):** header displayed `market+cash` per currency labeled "incl. cash" — tiny/negative values read as P&L. Fix: header slimmed to name+actions; six SummaryCards from the shared read model; equations tested.
3. **Two financial truths (Bug 3):** dashboard still rendered legacy trades/holdings/dividends. Fix: rebuilt on `getWealthSummary` + the same SummaryCards component (reconciliation by construction), ledger recent-activity, shield summary from ledger holdings, zakat honest pending, legacy banner removed, source-level tripwire test forbids legacy `from()` reads on the dashboard.
4. **Dual currency (Bug 4):** `lib/fx/` — provider abstraction, `PegFxProvider` USD/AED 3.6725 (methodology named in provenance), read-layer-only conversion, `convertTotals` with missing-rate EXCLUSION (never zero), `≈` mandatory, native values immutable (tested); display preference = `profiles.currency` (USD/AED switcher on Wealth + Dashboard).

Formulas (per native currency): market = Σ qty×effective_price (priced only) · total = market + cash · basis = Σ open cost basis · unrealized = market − basis_priced · realized = Σ engine realized · dividends = Σ received. Conversion: presentation layer only.

Tests added: 24 (draft 8, fx+tripwire 10, summary equations/reconciliation/immutability 6) → 104 total.
Known limits: peg provider covers USD/AED only (M2 live FX for other pairs); dialog guard covered by logic tests + manual pass (DOM-level e2e deferred to a Playwright milestone); trades/analytics/calendar pages remain legacy (their milestones unchanged).
