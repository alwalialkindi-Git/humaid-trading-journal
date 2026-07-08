# Phase 5 UX Consultant Review

Status: **Final — approved direction for Phase 5 implementation**
Method: structured internal review, five perspectives, Product Director decides.
Inputs: PRD, M1 design doc (frozen), Phases 1–4 (schema, engine, market data, services — all committed), current MVP UI.

---

## 1. Current UI audit (state before Phase 5)

What a user sees today is **entirely the MVP**: every page reads and writes the legacy tables (`trades`, `holdings`, `dividends`), while the entire new backend (ledger, engine, market data, services) is invisible.

| Page | Backing | Honest assessment |
| --- | --- | --- |
| Dashboard | legacy | Decent overview, but its numbers come from hand-entered holdings that are stale by design |
| Trades + trade form | legacy | The form is a 30-field wall; it conflates money facts with journal psychology; "sell side" rows are semantically broken |
| Portfolio | legacy | Charts over manual data; the "value" headline is fiction after a week |
| Holdings | legacy | **The page Phase 5 exists to kill**: users hand-maintain qty/avg-cost that the ledger now derives |
| Dividends | legacy | Purification tracking is genuinely good; entry belongs in the transaction flow |
| Watchlist / Shariah / Zakat / Analytics / Calendar / Settings | legacy | Out of Phase 5 scope; untouched until Phases 6–8 |

Structural verdict: the write paths (trade form, holding dialog, dividend dialog) and the read paths (Portfolio, Holdings, Dividends) **should be replaced, not patched**. Patching them to dual-read legacy + ledger would be throwaway work with double the bug surface.

---

## 2. The five consultant perspectives

### 2.1 Product Director

The plan said "Phase 5 = transaction UI, Phase 6 = portfolio v2." I no longer believe that split. If we ship a beautiful Add-Transaction dialog whose results appear **nowhere** — the old Holdings page reads legacy tables — we have built a form that writes into a void. Users (including our own founder) will enter a buy, open Portfolio, see nothing, and conclude the app is broken. The single most important property of Phase 5 is **one coherent loop: enter a transaction → see the truth change.**

So my opening position: Phase 5 must pair the write path with a minimal truthful read path, and cut elsewhere to pay for it. What I will not accept: scope creeping into charts, journal psychology, or analytics. One loop, done properly.

**Should build:** Add Transaction (all 6 enabled types), asset search with the UAE rules, custom-asset creation, brokers, and a new Portfolio page (positions + cash + history) replacing Portfolio/Holdings/Dividends.
**Should not build:** allocation charts, income analytics, emotion/mistake UI, watchlist/zakat/shariah changes, CSV import.

### 2.2 Senior UX Designer

Critique of the current app: the MVP has **three different "add" rituals** (trade form page, holding dialog, dividend dialog) with three mental models for what is really one act — "money moved." The trade form interleaves execution facts with feelings, which is why it feels like homework. And nothing in the app answers the first question a returning user has ("what am I worth, is anything wrong?") from live data.

For Phase 5:

- **One verb.** A single global **Add Transaction** button (topbar on desktop, floating on mobile). Inside: a segmented type switcher (Buy · Sell · Dividend · Deposit · Withdraw · Payment), not a wizard — investors switch types constantly; a wizard punishes them.
- **Progressive disclosure.** The golden path (buy) must be ≤ 8 visible inputs. Fees, broker, time, notes live in a collapsed "More details" section. Journal psychology does not belong here at all — a single optional "note / strategy / tags" row at most; the full annotation editor is Phase 7's Journal.
- **The form must teach the ledger model silently.** "Trade date — when it executed at the market (you can backdate)" as helper text; sell form shows "You hold 30 @ avg 120" *inside* the form; live realized-P&L preview turns the engine into feedback.
- **Search results are decisions, not text.** Every row: symbol, name, exchange badge, country, currency, class. Warned rows (ADIB-Egypt) get an amber treatment and a required extra confirmation step. The "Create custom UAE asset" card must look like a first-class path, not an apologetic footer link.
- I **agree with the Director** on pairing write+read, and I'll go further: shipping write-only would be a UX regression worse than not shipping. Disorientation is the most expensive bug.
- One warning: don't put six tabs on the new Portfolio page. Three: **Positions · Cash · History.** Income and Allocation belong to Phase 6 when they have real content.

### 2.3 Senior Frontend Engineer

Critique of the current code: the MVP pattern — client components writing straight to Supabase with the browser client — **cannot carry Phase 5**. Ledger writes must go through the service layer (trial recompute + the service-role positions cache), which only exists server-side. If we hack around that, we fork business logic into the client and the cache will rot.

Positions:

- **Mutations = Next.js Server Actions** calling `createServices()`. Typed end-to-end, no bespoke API routes per form, auth from the session, and the admin client stays server-side by construction. Reads = server components calling `PositionsService`. `router.refresh()` after mutation. No client cache library — at this scale it's pure liability.
- **Reuse the engine in the browser for the sell preview.** `lib/engine/positions.ts` is pure TS with zero server deps — importing it client-side gives a preview that *cannot* disagree with the server, because it is the same code.
- **Forms:** keep the established stack (controlled inputs + zod). Do not introduce react-hook-form for six small forms; two form stacks in one codebase is how UI rewrites start. Share the zod schemas conceptually with the service layer but don't import server modules into client bundles — define the client-side schemas next to the forms; the service revalidates regardless (client validation is UX, server validation is law).
- **Component risk:** the Add-Transaction dialog wants to become a god-component. Countermeasure: a thin `TransactionDialog` shell (type switcher + submit) and per-type field groups (`BuyFields`, `SellFields`, …) sharing one `useTransactionForm` state hook. AssetSearch is its own component with its own state machine (idle → searching → results → selected/custom) — it will be reused by Watchlist and Screener later.
- **Replace, don't patch:** old `portfolio/`, `holdings/`, `dividends/` page trees get deleted, with redirects. Keeping them alive "just in case" doubles the maintenance surface during the exact phase we can least afford it.
- Flag for the record: Phase 5 requires the live migration + `SUPABASE_SERVICE_ROLE_KEY` on Vercel *before* merge; a feature-complete UI against an unmigrated database 500s on first click.

### 2.4 Islamic Finance Advisor

Critique of the current app: compliance is presented as a *property the user types in*, which inverts responsibility. And the moment of purchase — the single point where Shariah guidance changes behavior — has no guidance at all: the old trade form would happily record a purchase of a conventional bank.

For Phase 5:

- **Compliance must be visible at the moment of decision.** Every asset in search results and in the buy form carries a Shariah status chip. In M1 the only source is the user's own override, so the honest default is **"Not screened"** — and honesty is the requirement: never infer, never default to green. A muted chip with "Screening arrives with the Screener (M3); you can set your own status with a reason" is correct. What I will not accept is fake certainty.
- **Purification at the source.** The dividend form must carry the purification % field with its explanation ("the impermissible share of this dividend, given to charity — separate from zakat"). This exists in the MVP dividends dialog; it must not be lost in the move.
- **Sacred cash flows need names.** `zakat_payment` and `purification_payment` must appear in the type picker as "Zakat payment" and "Purification payment" — not buried under "Other/Fee." Recording a zakat payment is an act of worship; the UI should treat it with the same weight as a trade. I disagree with any suggestion to collapse them into a generic "payment" type in the UI.
- **Boundaries:** the type picker must contain no space where margin/short/derivative entry could live. Sell validation ("you cannot sell more than you hold") should carry its one-line why: "Short selling is not supported — you can only sell what you own."
- The standing disclaimer must appear wherever a Shariah status chip appears (tooltip level is acceptable).
- On scope I side with the Director: nothing in zakat/screening pages should be touched this phase — better untouched than half-migrated.

### 2.5 Power Investor / Trader

Critique of the current app, bluntly: I would not use it. Manual holdings means my portfolio is wrong every day. Entering a trade takes longer than placing one at my broker. No brokers, no cash tracking, no way to answer "what did I actually pay in fees this year."

What Phase 5 must get right for me:

- **Speed.** Symbol → qty → price → save. Under 30 seconds or I'm back to my spreadsheet. Quote prefill on price (editable — my fill price is not the market price). Date defaults to today; typing `t-1`-style shortcuts is a nice-to-have, a working date picker is the requirement.
- **Defaults that remember.** Last-used portfolio and broker preselected. If I trade through IBKR 95% of the time, don't ask me 95 times.
- **The sell form must show my position** (held qty, avg cost) and the realized P&L preview *before* I commit. This is the feature that builds trust in the engine.
- **History I can interrogate:** filter by type/asset/broker, see fees, see realized P&L per sell, edit/delete with the safety the backend already promises.
- **A refresh-prices button** on the new Portfolio page. Auto-refresh can wait for M2 cron; a button cannot — a portfolio page with no way to update prices is the old app again.
- What I'm told to wait for, and my response: CSV import (fine — M4, but it better come), FIFO (fine), allocation charts (don't care), income tab (mildly annoyed — dividends in History is acceptable for now), emotions/mistakes at entry (**good riddance from the buy form** — I'll journal in the Journal).
- One disagreement with the Designer: don't hide **fees** behind "More details." Fees are a first-class execution fact; every real broker ticket shows them. Keep fees visible on the main form.

---

## 3. Conflicts and tradeoffs

| # | Conflict | Positions | Resolution (see §4) |
| --- | --- | --- | --- |
| 1 | Dialog-only vs write+read loop | Original plan said dialog-only; Director/UX/Investor all reject write-without-read | **Merge**: Phase 5 = dialog + minimal Portfolio page; pay for it by pushing Income/Allocation tabs and all charts to Phase 6 |
| 2 | Fees placement | UX wants them collapsed; Investor wants them visible | **Investor wins**: fees stay on the main form (one small field; execution fact, not detail) |
| 3 | Journal fields in the dialog | UX: none; Investor: none at entry; Director originally wanted strategy/tags | **Cut to one optional row**: note + strategy + tags in "More details"; emotion/mistakes wait for Phase 7's Journal (the annotation table already supports them) |
| 4 | Payment types naming | Advisor: first-class "Zakat payment"/"Purification payment"; UX worried about picker crowding | **Advisor wins**: 7 visible types grouped in the picker (Trade: Buy/Sell · Income: Dividend · Cash: Deposit/Withdraw · Obligations: Zakat/Purification · Fee under Cash). Grouping solves the crowding |
| 5 | Shariah chip with no screening engine | Advisor wants status at purchase; M3 hasn't shipped | **Honest chip**: "Not screened" default from override-only source, with explanation tooltip + disclaimer. No fake data |
| 6 | Form library | — | No new deps; controlled inputs + zod, per Engineer |
| 7 | Old pages | Patch vs replace | **Replace + redirect**; legacy Trades/Calendar/Dashboard remain (read-only reality) until Phases 7–8, with a small "legacy data" notice on Dashboard |

---

## 4. Product Director — final decision

Phase 5 is **"The Loop"**: a user can record any money event in under 30 seconds and immediately see their computed, honestly-priced portfolio change. Nothing else.

Decisions, binding:

1. Phase 5 ships **Add Transaction** (Buy, Sell, Dividend, Deposit, Withdraw, Fee, Zakat payment, Purification payment) **and** the new **Portfolio page** (Positions · Cash · History) which replaces the old Portfolio, Holdings, and Dividends pages (301 redirects; page trees deleted).
2. Phase 6 inherits: Income tab, Allocation tab, all charts, price auto-refresh (cron), dashboard rebuild.
3. Phase 7 inherits: Journal (trades page replacement, calendar tab, annotation editor with emotions/mistakes).
4. Phase 8 inherits: legacy data migration. Until then Dashboard/Trades/Analytics/Calendar show legacy data with a one-line notice on Dashboard: *"Showing legacy data — new transactions appear in Portfolio. Migration coming."*
5. All mutations via Server Actions → services. The engine runs client-side **only** for the sell preview.
6. Fees visible on the main form. Journal capture = one optional collapsed row. Sacred payments are named. Shariah chip is honest-or-absent.
7. Step zero of implementation is operational: apply `002_ledger.sql` to live Supabase + set `SUPABASE_SERVICE_ROLE_KEY` (+ `MARKET_DATA_PROVIDER`) in Vercel and `.env.local`.

Success criteria: golden-path buy in <30s including search; ADIB flow ends in a correctly-created custom ADX asset in ≤5 clicks from the warning; a sell's previewed P&L equals the saved row's `realized_pnl` to the fils; zero writes to legacy tables from any new surface.

---

## 5. Phase 5 scope

- Global **Add Transaction** entry point (desktop topbar button; mobile floating action button) opening the transaction dialog anywhere in the app.
- Transaction dialog: 8 types across 5 groups, per-type field groups, shared shell.
- **Asset search** (typeahead over `/api/market/search`) with full labeling, warning treatment, custom-asset path.
- **Custom asset creation** (inline panel in the dialog) — the ADX/manual tier, plus generic custom assets.
- **Sell flow** with position context + live engine preview.
- **New Portfolio page** at `/portfolio`: header (per-currency totals, warnings, refresh-prices button), tabs Positions / Cash / History, position detail drawer, transaction edit/delete.
- **Brokers**: Settings section (CRUD) + inline "new broker" in the dialog + remembered default.
- **Redirects**: `/holdings` → `/portfolio?tab=positions`, `/dividends` → `/portfolio?tab=history&type=dividend`; old page trees deleted. Old "New trade" buttons point at the Add Transaction dialog.
- Server Actions for every mutation; `refresh-prices` action calling the market-data service.

## 6. Phase 5 non-goals (explicit)

Income/Allocation tabs · any charts · dashboard rebuild · journal annotation editor (emotions/mistakes) · CSV import · price cron · FX conversion · watchlist/shariah/zakat page changes · legacy data migration · split/transfer UI (service-gated) · portfolio create/manage UI beyond the default (single-portfolio UX this phase; the selector ships when a second portfolio can be created — Phase 6).

## 7. Navigation changes

- Sidebar: **Portfolio** entry now points at the new page; **Holdings** and **Dividends** entries removed (routes redirect). All other entries unchanged.
- Topbar (new, desktop): persistent **“+ Add transaction”** primary button. Mobile: floating action button, bottom-right, above the tab-safe area.
- Dashboard gains the one-line legacy notice (link → /portfolio). No other dashboard change.

## 8. Exact user flows

**8.1 Add buy transaction (golden path)**
1. Any page → “+ Add transaction” → dialog opens on **Buy** (last-used type is *not* remembered; Buy is always default — predictability beats cleverness).
2. Asset field focused → user types “EMAAR” → results in ≤600ms: `EMAAR · Emaar Properties · DFM · UAE · AED · stock`.
3. Select → asset ensured server-side (created on first use); quote fetched; price field prefilled `12.06` (editable, marked “market price — adjust to your fill”); currency locks to AED.
4. Qty `1000`, price adjusted `12.10`, fees `20` (visible field, default 0). Portfolio preselected (default), broker preselected (last used, optional). Trade date = today (editable, helper: “when it executed — backdating is fine”), optional time under More details.
5. (Optional) More details: time, note/strategy/tags row, external ref.
6. Save → server action → trial recompute → success toast “Bought 1,000 EMAAR — position updated” → dialog closes → if on /portfolio, row updates.
Failure: engine rejection or validation error renders inline under the offending field; dialog stays open with state intact.

**8.2 Add sell transaction**
1. Dialog → Sell → asset picker lists **open positions only** (symbol, qty held, avg cost).
2. Selecting shows a context strip: “You hold 1,000 @ 12.10 avg”.
3. Qty entry validates ≤ held (inline error at the boundary, with the why: “Short selling isn’t supported — you can only sell what you own”).
4. Price + fees entered → **live preview** (client-side engine): “Realized P&L: +340.00 AED”. Preview updates per keystroke.
5. Save → recompute → toast shows the same number (it is the same computation).

**8.3 Add dividend**
1. Dialog → Dividend → asset picker (open + previously-held positions).
2. Amount, date, currency (from asset), **Purification %** field with helper (“the impermissible share of this dividend, to be given in charity — separate from zakat”), default 0.
3. Save → cash increases, position dividends_received increases; History shows it under Income.

**8.4 Add cash deposit / withdrawal**
1. Dialog → Deposit (or Withdraw) → amount, currency (default portfolio base), date, optional note/broker.
2. Save → Cash tab updates. Withdraw taking a currency negative is allowed; the Cash tab shows the warning banner (“more spent than deposited — add an opening deposit”).
(Zakat payment / Purification payment: same form as Withdraw with their own labels and confirmation copy: “May it be accepted.”)

**8.5 Add broker**
- Path A (Settings → Brokers): list + “Add broker” dialog (name*, country, account number, currency*, notes) → CRUD table. Delete confirms with “transactions keep their history; they’ll show no broker.”
- Path B (inline): broker select in transaction dialog → “+ New broker…” → 3-field mini-form (name, country, currency) inside a popover → created, selected, remembered.

**8.6 Search asset**
1. Focus asset field → hint row: “Search any symbol or name — US, Dubai (DFM), Saudi (Tadawul), crypto”.
2. ≥1 char + 300ms debounce → GET /api/market/search.
3. Result rows always show: symbol · name · exchange badge · country · currency · class icon. Keyboard: ↑↓ navigate, Enter selects, Esc closes (ARIA combobox).
4. Footer of every result list: **“Can’t find it? Create a custom asset”**.
5. Provider outage → cached/mock results show with a “live search degraded” note; custom path always available.

**8.7 Create custom UAE asset**
1. From the search footer, or automatically offered by the ADX notice (8.8).
2. Inline panel replaces results: symbol*, name*, exchange (picker; DFM/ADX/Nasdaq Dubai surfaced first; “none/private” allowed), currency* (prefilled from exchange), class, sector, ISIN (optional), **latest price + price date + source note** (“e.g. ADX website close”).
3. Create → asset selected into the transaction form; chip shows `ADIB · ADX · manual price`.
4. Custom assets display a permanent “manual” price chip everywhere.

**8.8 ADIB Egypt warning flow (required test case)**
1. User types “ADIB” → API returns the Cairo hit + `adxNotice`.
2. UI renders, in order: **(a)** an amber notice card: “Abu Dhabi Islamic Bank trades on ADX, which live search doesn’t cover yet. **Create it as a custom UAE asset** — one click, prefilled.” with a primary button; **(b)** the Cairo result, amber-tinted, labeled “Abu Dhabi Islamic Bank — **Egypt** · Cairo (EGX) · EGP”, not selectable by Enter — clicking it opens a confirm step (“This is the Egyptian listing, not ADX. Use it anyway?”).
3. Primary button → 8.7 panel prefilled (ADIB / Abu Dhabi Islamic Bank / ADX / AED / UAE) → user adds price → create → buy continues.
4. Nothing in this flow can silently select Cairo — matching the service-layer guard.

## 9. Screen specifications

**9.1 New Portfolio page (`/portfolio`)** — server component
- Header: portfolio name; per-currency total strip (e.g. “AED 61,430 · USD 3,100”), each = priced positions + cash in that currency; warning chips (unpriced count, negative cash, mixed currency); **Refresh prices** button with “as of HH:MM” caption; Add transaction button.
- Tabs: **Positions** (default) · **Cash** · **History** (tab in URL: `?tab=`).
- Positions tab: table (columns in §10); row click → detail drawer (9.5). Zero-qty positions hidden behind a “Show closed positions” toggle.
- Cash tab: one balance card per currency + cash-only event list; negative-balance banner.
- History tab: transaction table (9.6) with filters.

**9.2 Add Transaction dialog** — client component; desktop: centered modal (max-w-xl); mobile: full-screen sheet
- Header: “Add transaction” + grouped type switcher (segmented: Buy · Sell · Dividend · Cash ▾ [Deposit/Withdraw/Fee] · Obligation ▾ [Zakat/Purification]).
- Body: per-type field group (§10). Asset-first ordering for Buy/Sell/Dividend.
- Footer: Cancel · Save (busy state). Errors inline; engine rejections render as a form-level alert with the engine’s message verbatim (they are written for humans).

**9.3 Broker management (Settings → Brokers)**
- Card with table: name, country, account (masked, last 4), currency, notes icon; row actions edit/delete. “Add broker” button → dialog. Empty state (§11).

**9.4 Asset search / typeahead** — reusable `<AssetSearch>` combobox
- States: idle (hint) → loading (skeleton rows) → results → warned-results (amber) → adx-notice → custom-panel → selected (chip with symbol · exchange · currency, × to clear).

**9.5 Position detail drawer** (right sheet desktop / bottom sheet mobile)
- Header: symbol, name, exchange · currency, Shariah chip (honest), manual-price chip when applicable.
- Stats grid: qty, avg cost, cost basis, price (+as-of), market value, unrealized P&L (+%), realized P&L, dividends received.
- Body: this position’s transaction replay list (date, type, qty@price, fees, realized P&L on sells) in engine order; per-row edit/delete.
- Footer actions: Buy more · Sell (both open the dialog prefilled) · Set manual price (custom assets) / Set override (provider assets).

**9.6 Transaction history table** (History tab)
- Filters: type (multi), asset (search-select), broker, date range.
- Columns: date (+time icon when set), type badge, asset (symbol or “—” cash), qty@price / amount, fees, currency, broker, realized P&L (sells), note icon, actions (edit/delete with confirm; delete failures surface the engine’s reason, e.g. “a later sell depends on this buy”).

## 10. Data shown on each screen (field-level)

- **Buy/Sell form:** asset*, portfolio* (select), broker (select+inline-create), quantity*, price* (quote-prefilled on buy), fees (default 0), currency (locked to asset), trade date*, [More: trade time, note/strategy/tags, external ref]. Sell adds: held qty, avg cost, realized P&L preview.
- **Dividend form:** asset*, amount*, currency, trade date*, purification % (+helper), [More: broker, note].
- **Cash forms:** amount*, currency*, trade date*, [More: broker, note]. Zakat/Purification variants: same + reverent confirmation copy.
- **Positions row:** symbol+name, data-tier/manual chip, qty, avg cost, cost basis, price (+staleness: amber >24h), market value, unrealized P&L value+% (green/red+sign), realized P&L, dividends, allocation %, Shariah chip. Unpriced: price/value/unrealized show “—” + “set price” link; excluded-from-totals noted in header.
- **Cash tab:** per-currency balance, per-event list (date, type, amount, running balance).
- **Summary header:** totals per currency, unpriced count, warnings — exactly `PortfolioSummaryView` (no client math).

## 11. Empty states

- Portfolio (no transactions ever): pattern-background card — “Your ledger is empty. Record your first buy, or start with a cash deposit.” CTA: Add transaction. Secondary: “Have history at a broker? Import arrives in M4 — you can backdate transactions today.”
- Positions (cash only): “Cash is in. When you buy, positions appear here.”
- Cash (none): “Record a deposit to start tracking cash.”
- History (filters exclude all): “No transactions match — clear filters.”
- Brokers: “Add the brokers you trade through to attribute and filter your history.”
- Sell with no open positions: type switcher disables Sell with tooltip “No open positions to sell.”
- Search no results (non-ADX): “No matches. Check the symbol, or create a custom asset.”

## 12. Error states

- Search API down → degraded note + cached/mock results + custom path (never a dead end).
- Quote fetch fails on select → price field empty with “couldn’t fetch a quote — enter your fill price” (not blocking).
- Save: validation → inline per-field; engine rejection → form-level alert, verbatim message, state preserved; network → retry-able alert; auth expired → redirect to login with `next`.
- Delete rejected (dependent sell) → dialog explains + “View position history”.
- Refresh prices partial failure → toast “Updated 4 of 5 — EMAAR unavailable (showing HH:MM price)”.
- Migration missing / service-role missing (operational): a friendly full-page error on /portfolio (“The ledger isn’t initialized — see docs/DEPLOYMENT”) rather than a stack trace; detect by table-missing error code.

## 13. Mobile layout

- Dialog = full-screen sheet, sticky header (type switcher scrolls horizontally) and sticky footer (Save). Inputs ≥44px, numeric keyboards (`inputMode="decimal"`), date via native picker.
- Positions table → cards: symbol+name+chips top row; qty@avg left, value+unrealized right; tap → drawer (bottom sheet, drag-dismiss).
- History → cards grouped by date. Filters in a sheet.
- FAB for Add transaction; totals strip horizontally scrollable.

## 14. Desktop layout

- Dialog centered modal (max-w-xl), 2-column field grid; keyboard-first (autofocus asset, Tab order = golden path, ⌘Enter submits).
- Portfolio: full-width tables within the 7xl container; drawer 480px right sheet; History filters inline in the toolbar.
- Topbar (new, slim): page title + Add transaction; coexists with sidebar.

## 15. Component plan

```
src/components/transactions/
  transaction-dialog.tsx     — shell: type switcher, footer, submit orchestration (client)
  transaction-form-state.ts  — useTransactionForm(): one state hook, per-type slices
  buy-sell-fields.tsx        — shared trade fields; sell adds PositionContext + PnlPreview
  dividend-fields.tsx
  cash-fields.tsx            — deposit/withdraw/fee/zakat/purification variants
  asset-search.tsx           — combobox state machine (idle/loading/results/warned/custom/selected)
  custom-asset-panel.tsx     — §8.7 form (reused by ADX notice)
  broker-select.tsx          — select + inline create popover
  pnl-preview.tsx            — client-side engine call, debounced
src/components/portfolio/
  portfolio-header.tsx       — totals strip, warnings, refresh button (client for refresh)
  positions-table.tsx        — + positions-cards (mobile) (server-rendered, client row-expand)
  cash-tab.tsx
  history-table.tsx          — filters (client), rows
  position-drawer.tsx        — client sheet
src/app/(app)/portfolio/page.tsx        — server component (summary + tab routing)
src/app/(app)/portfolio/actions.ts      — server actions: createTransaction, updateTransaction,
                                          deleteTransaction, createBroker, createCustomAsset,
                                          ensureAssetFromSearch, refreshPrices, setManualPrice
src/app/(app)/settings/brokers-section.tsx
Deleted: src/app/(app)/holdings/*, src/app/(app)/dividends/*, old portfolio internals.
Redirects: next.config.ts (permanent) for /holdings, /dividends.
```

## 16. State management plan

- **Server state = the truth**: server components fetch via services; after any server-action mutation, `router.refresh()`. No SWR/React-Query/Zustand.
- **Dialog state**: one `useTransactionForm` hook (plain `useState` reducer-style), per-type value slices, single submit path building `TransactionInput`.
- **AssetSearch**: local state machine + 300ms debounce + AbortController per keystroke; selected asset lifts to the form hook.
- **Preview**: derived state — pure engine call in a `useMemo` over (position rows passed from server, current inputs). No effects.
- **Remembered defaults** (portfolio, broker): `localStorage`, read once on dialog open; harmless if stale (service re-validates ownership).
- Tab + filters in URL search params (shareable, back-button-friendly).

## 17. Form validation plan

Three layers, each with its job:
1. **Client zod** (UX): per-type schemas colocated with the dialog — required fields, positivity, date format, purification 0–100. Instant inline messages on blur/submit.
2. **Service zod + ownership** (law): already shipped (Phase 4); server actions surface `ServiceError.message` into form state — field-level where the message names a field, else form-level.
3. **Engine** (physics): oversell etc. — client preview catches most before submit (same engine), server trial recompute is final. Engine messages render verbatim.
No native-only validation anywhere; `noValidate` on forms, we own the messages.

## 18. Accessibility notes

- Dialog: focus trap, Esc close (with dirty-state confirm), `aria-labelledby` title, focus returns to invoker (Radix Dialog provides most).
- AssetSearch: ARIA combobox pattern (`role="combobox"`, `aria-expanded`, `aria-activedescendant`, options as `role="option"`); results announced via `aria-live="polite"`; warned options include the warning in their accessible name.
- Every input has a real `<label>`; errors linked with `aria-describedby`; helper texts likewise.
- P&L colors always paired with sign (+/−) — never color-only. Status chips carry text, not just hue.
- Type switcher = radiogroup with arrow-key navigation. Tables: proper `<th scope>`, row-expand buttons labeled (“View EMAAR position details”).
- Toasts `role="status"`; engine rejection alerts `role="alert"`.

## 19. Risks before implementation

| Risk | Mitigation |
| --- | --- |
| Live migration/env not applied → new UI 500s | **Checklist step 0**; friendly detection (§12 last item) |
| Two-worlds confusion until Phase 8 (dashboard/trades = legacy) | Legacy notice on Dashboard; Phases 6–8 sequenced promptly |
| Yahoo rate-limits from Vercel egress | Fallback + staleness chips already built; refresh button budget 3s |
| Dialog god-component | Component plan §15 enforced in review; shell < 200 lines or split |
| Client/server schema drift | Service revalidates everything; client schemas are convenience only — a drift bug degrades UX, never correctness |
| Engine-in-browser bundle weight | Engine is dependency-free (~6KB); acceptable. Never import services/marked-server modules client-side (lint-guarded by import path review) |
| Deleting old pages breaks deep links | Permanent redirects in next.config; grep for internal links to /holdings, /dividends |

## 20. Final implementation checklist (ordered)

- [ ] 0. **Ops**: apply `002_ledger.sql` to live Supabase; verify (`select count(*) from exchanges` = 8); add `SUPABASE_SERVICE_ROLE_KEY` + `MARKET_DATA_PROVIDER` to Vercel + `.env.local`; smoke-test `/api/market/search?q=EMAAR` authenticated.
- [ ] 1. Server actions file (`portfolio/actions.ts`) wrapping services; unit-level smoke via existing service tests.
- [ ] 2. `<AssetSearch>` with all states incl. ADIB flow (mock provider in dev makes this testable offline).
- [ ] 3. `<CustomAssetPanel>` (+ prefill path from ADX notice).
- [ ] 4. Transaction dialog shell + buy/sell fields + broker select + preview; then dividend + cash/obligation fields.
- [ ] 5. Portfolio page: summary header, Positions tab, drawer.
- [ ] 6. Cash + History tabs (filters, edit/delete via dialog).
- [ ] 7. Brokers in Settings.
- [ ] 8. Redirects + delete old holdings/dividends/portfolio internals + dashboard legacy notice + nav updates.
- [ ] 9. Empty/error states pass (§11–12 as a checklist), mobile pass at 375px, a11y pass (§18).
- [ ] 10. `typecheck` + `lint` + `build` + `test`; manual smoke of all 8 flows (§8) against live Supabase; commit.

*Approved. Phase 5 implementation may begin at checklist step 0.*
