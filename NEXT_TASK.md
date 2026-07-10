# NEXT_TASK — D1b: Navigation Shell & Command Layer

> **STATUS: COMPLETE (committed locally, not pushed). Awaiting owner review.**
> On approval + push, the next task is **D2 — Wealth redesign**: FinTable composition (toolbar, sorting, aggregates, mobile card transform) and migration of the Positions/Cash/History tables onto it; StatBlock; AllocationBar (top-8 + other); ProvenancePopover enabled on Wealth+Home figures (actor included — CIO condition 3); Wealth header + Accounts tab; Cash statement layout; drawer restyle. Per sprint §28 D2 + Council A4/A6.

## Delivered scope (D1b)

- **Grouped navigation shell** — Council IA §5: OVERVIEW (Home) · WEALTH (Wealth) · THINKING (Journal, Calendar — Research absorbs these at M5.5) · PURITY ◆ (Zakat & Purify, Screener, Watchlist; visually distinct spine) · UNDERSTAND (Insights) · Settings. Labels renamed, routes unchanged. Single source: `components/app/nav-config.ts` (sidebar + palette + tabs consume it — no drift).
- **Command palette** — ⌘K/Ctrl+K, hand-rolled on the Dialog primitive (no new dependency), ARIA combobox/listbox, groups: Actions (Add transaction → the same TransactionDialog; Toggle theme) + Navigate (from nav config). Summonable from sidebar search button and mobile top bar. Assets section deliberately deferred to D2/D3.
- **Mobile bottom navigation** — Home · Wealth · center **+** (same TransactionDialog) · Zakat · More (sheet with remaining destinations + theme). FAB deleted (AMANAH §12.9); hamburger drawer retired; safe-area inset; content bottom padding; toasts raised above the bar.
- **Compliance shield system** — `ui/shield-badge.tsx`: four shapes (filled+check / half / slashed / dashed outline) + mandatory labels + override dot with sr-text; compliance tokens as reinforcement only. `ComplianceBadge` reimplemented on it (dashboard/watchlist/screener upgraded in place); Positions tab swapped.
- **Glossary registry** — `lib/glossary.ts` (15 entries, AMANAH register) + `ui/glossary-term.tsx` popover; proven in the transaction dialog (average cost, purification).

## Verified

typecheck / lint / build / 80 tests ✔. Local browser: login renders on fresh dev server, both themes exact (#F6F5F1 / #101413). Authenticated shell (sidebar groups, palette, bottom tabs) requires the owner's production pass post-push — no local credentials by design.
