# Product Requirements Document — Humaid

**The operating system for Muslim investors.**

Version: 1.0 of this document · Status: Approved direction, pre-implementation
Scope: Everything between the current MVP and product Version 1.0

---

## Part I — Where we are, honestly

### 1. MVP audit

The MVP is a competent *trading journal with Islamic features bolted on*. That is not the product. Page-by-page audit:

| Page | What works | What's wrong |
| --- | --- | --- |
| Landing | Clear positioning, calm identity | Sells a journal, not an operating system |
| Dashboard | Good stat cards, hawl reminder | No onboarding; empty for new users; insights buried at the bottom; zakat number contradicts the calculator (no nisab check) |
| Trades | Solid fields, honest mistake checklist | Built for *traders*; long-term investors (the bigger audience) are forced through trader-shaped forms. Trades don't create holdings — users double-enter everything |
| Add/Edit Trade | Thorough | Too heavy for a quick log; one giant form; no "I bought 10 more SPUS" fast path |
| Portfolio | Allocation views, concentration check | **Stale by design** — every price is manual. Portfolio value is fiction within a week |
| Holdings | Clean CRUD | Duplicates Portfolio conceptually; disconnected from trades; Shariah status is a hand-set dropdown |
| Dividends | Purification tracking is genuinely differentiated | Dividends don't flow into cash; purification owed is displayed but never *resolved* (no "paid" state) |
| Analytics | Right metrics (PF, drawdown, emotion) | No time-range filter, no benchmark, useless to a buy-and-hold investor |
| Calendar | Nice visualization | Thin as a full page; it's a *view* of the journal, not a destination |
| Watchlist | Target + Shariah before buying is the right instinct | Alerts exist only as a dashboard glance; no notification ever reaches the user |
| Shariah Filter | Ratio fields, warning categories, honest disclaimer | **Everything is manually typed.** A user must do the screening themselves elsewhere and transcribe it. This is the #1 gap between "journal" and "platform" |
| Zakat | Best-in-class calculator UX, per-field fiqh help | It's a *calculator*, not a zakat system: no continuity between years, no per-asset hawl tracking, no payment record beyond one saved row |
| Settings | Adequate | No notification prefs, no security section, no multi-portfolio |

### 2. Structural defects (the real findings)

1. **No transaction ledger.** Trades, holdings, dividends, and cash are four disconnected tables the user reconciles by hand. Buying a stock should *be* one event that debits cash, creates/updates a position, and is journal-able. This single defect causes most duplicated data entry.
2. **No instrument master.** `symbol/asset_name/market` are copy-pasted strings across four tables. "EMAAR" in trades and "Emaar" in holdings are different assets as far as the DB knows. Shariah status therefore lives in three places with no source of truth.
3. **Manual prices.** Every valuation, alert, and zakat estimate inherits staleness. Market data is not a feature — it is the substrate.
4. **Screening is transcription, not intelligence.** The moat of this product is *automated, explainable, madhhab-aware Shariah screening*. Today it's a form.
5. **Zakat is an event, not a system.** Real zakat obligations involve per-pool hawl, fluctuating balances, multiple payments, and receipts. We model one snapshot per year.
6. **One persona too many, one too few.** The mistake-checklist/emotion machinery serves active traders; the majority persona (long-term halal investor) gets no tailored experience. Meanwhile nothing serves the beginner who doesn't yet know what a sukuk is.

### 3. Kill / demote / merge list

Question every feature. Verdicts:

| Feature | Verdict | Reasoning |
| --- | --- | --- |
| Holdings page | **Merge into Portfolio** | Same mental object; one destination for "what do I own" |
| Calendar page | **Demote to a Journal view** | A tab/lens, not a nav destination |
| Dividends page | **Merge into Portfolio (Income tab)** | Income is a property of the portfolio; purification moves to the Purification ledger |
| Trades "sell" side as pseudo-short | **Kill** | Confusing, near-haram-adjacent semantics; the ledger model (buy/sell events against a position) replaces it correctly |
| Manual `current_price` fields | **Kill after market data lands** | Keep as fallback for unlisted assets (private sukuk, local funds) |
| Per-table `shariah_status` dropdowns | **Kill** | Replaced by references to the central screening record; user *override* remains possible with a reason |
| Emotion/mistake journaling | **Keep, but gate by persona** | It's excellent — for traders. Investors see a lighter "decision note" instead |
| Rule-based insights | **Keep as the deterministic layer under AI** | Never delete: deterministic insights are the fallback and the trust anchor |
| `journal_notes` table | **Keep and finally use** | Becomes the notebook behind Journal |
| Cash balance as a single profile field | **Kill** | Replaced by cash as a ledger-derived balance per portfolio |
| Zakat dashboard estimate w/o nisab | **Fix** | Same engine as the calculator or don't show a number |

---

## Part II — The Product

### 4. Product vision

**Humaid is the operating system for Muslim wealth.** One place where a Muslim can hold, grow, purify, and give their wealth with certainty that every number and every nudge respects their deen.

Not a brokerage. Not a fatwa council. The *layer between* a Muslim and their money: tracking (portfolio), conscience (screening & purification), obligation (zakat), discipline (journal), and understanding (insights & learning).

**North-star metric:** monthly active users who complete a zakat cycle or purification payment through the platform. (Retention through *religious* utility, not engagement tricks.)

### 5. Core philosophy

1. **Compliance is the substrate, not a filter.** Every asset on every screen carries its Shariah state. There is no "neutral" view of a haram position — it is always visibly flagged with a path to resolution.
2. **Barakah over hype.** No streaks, no confetti, no FOMO mechanics. The calmest fintech product in the world. Green means halal before it means profit.
3. **Ownership only.** The data model cannot represent margin, shorts, or derivatives. Structural impossibility is stronger than a warning label.
4. **Explainable religion.** Every ruling-adjacent output shows its method (e.g. "AAOIFI 5% interest-income threshold"), its inputs, and the disclaimer. We inform; scholars rule.
5. **The user owns their data.** Full export forever, deletion for real, no dark patterns.
6. **Deterministic core, AI on top.** Money math and fiqh math are pure functions with tests. AI explains, summarizes, and coaches — it never computes an amount the deterministic layer didn't produce.

### 6. Target users & personas

**Primary market:** GCC + Western-diaspora Muslims investing in equities/ETFs/sukuk/crypto, English-first with Arabic close behind.

**Persona 1 — Ahmed, the long-term investor (60% of users, the priority).**
34, engineer in Dubai. DCAs into SPUS, ADIB, Aramco monthly. Checks portfolio weekly, not daily. Pain: "Is Tesla still halal this quarter? How much zakat do I owe and when? Did I purify last year's dividends?" Success = he opens Humaid instead of a spreadsheet every Ramadan and monthly payday.

**Persona 2 — Mariam, the active trader (25%).**
28, trades DFM/US stocks around a day job. Wants discipline: journaling, mistake patterns, emotion awareness — everything the MVP already does well. Success = her profit factor improves and her screening happens *before* entry, not after.

**Persona 3 — Yusuf, the beginner (15%, the growth engine).**
22, first salary, knows riba is haram and little else. Needs guided onboarding, education inline with action ("what is a sukuk?" answered where sukuk appear), and a starter path: screen → watch → first position → first zakat. Success = his first-ever investment is halal because Humaid made that the easy path.

**Explicit non-users (for now):** institutions, advisors, mosque zakat committees, non-Muslim ESG investors. Revisit post-1.0.

### 7. Information architecture

From 14 flat pages to 7 intent-based areas:

```
Humaid
├── Home            — state of my wealth + what needs my attention
├── Portfolio       — everything I own (Positions · Income · Cash · Allocation)
├── Journal         — every decision I made (Log · Calendar · Notes · Review)
├── Screener        — is it halal? (Search/screen · Watchlist · My overrides)
├── Zakat & Purify  — what I owe God (Zakat tracker · Purification ledger · History)
├── Insights        — what my data says (Performance · Behavior · AI advisor)
└── Settings        — me, my portfolios, preferences, security, data
```

Persistent elements: global **asset search** (⌘K — search any symbol → screening card → act: watch/buy-log/screen); global **"Needs attention" indicator** (non-compliant holdings, hawl due, unpaid purification, triggered alerts); **quick-add** button (log transaction from anywhere).

### 8. Page-by-page specification

#### 8.1 Home
*Job: 30-second answer to "how is my wealth, and does anything need me?"*

- **Header strip** — greeting (Islamic date + Gregorian), portfolio total, 24h/period change (from live prices), compliance ring (% of portfolio compliant).
- **Needs Attention** (the product's heartbeat; hidden when empty):
  - hawl approaching / zakat due (per pool)
  - unpaid purification balance
  - holding turned non-compliant since last screen refresh
  - watchlist target hit
  - journal review nudge (Mariam only)
- **Wealth snapshot** — value area chart with range selector; compliant vs needs-review breakdown stacked.
- **Zakat card** — *engine-accurate* year-to-date accrual estimate + days to hawl → deep link.
- **Recent activity** — last 5 ledger events (any type).
- **Insight cards** — max 3, ranked by severity; AI-generated with deterministic fallback.
- **First-run state:** replaces all of the above with an onboarding checklist (create portfolio → import/log first position → run first screening → set zakat profile). Persona question during signup ("How do you invest?") tunes journal depth and dashboard emphasis.

#### 8.2 Portfolio
*Job: single source of truth for what I own.* Tabs:

- **Positions** — live-priced table: qty, avg cost (ledger-derived), value, day change, unrealized P&L, weight %, Shariah badge (from central screening), yield. Row expands → position detail: transaction history for that asset, dividend history, purification attached, screening summary, notes. Actions: buy more / sell / edit — all create *ledger events*.
- **Income** — dividend/distribution feed (auto-flagged purification % from screening), income by month chart, projected annual income, purification-owed running total → "resolve in Purify".
- **Cash** — balance per portfolio *derived from the ledger* (deposits, withdrawals, buys, sells, dividends, fees, zakat payments). Manual adjustment = an explicit reconciliation event, never a silent overwrite.
- **Allocation** — donuts (type/market/sector) + **compliance allocation** (compliant/doubtful/non-compliant/unscreened) + concentration and exposure warnings.
- **Widgets:** portfolio switcher (multi-portfolio: "Personal", "Kids' education", "Hajj fund"), currency display toggle, export.

#### 8.3 Journal
*Job: the decision record. Persona-adaptive.*

- **Log** — the ledger, journal-lensed: filterable event list; every buy/sell can be *annotated* (strategy, thesis, setup quality; Mariam additionally gets emotion + mistake checklist; Ahmed gets a single "why" note). Quick-log modal ≤ 10 seconds for a basic entry; full annotation optional and later.
- **Calendar** — the MVP calendar as a tab (realized P&L days for traders; contribution/dividend days for investors).
- **Notes** — freeform notebook (`journal_notes` finally used): weekly reviews, Ramadan reflections, theses. Linkable to assets.
- **Review** (Mariam-centric) — guided weekly/monthly review flow: unannotated trades to close out, mistake trendline, best/worst decisions, one commitment for next week. This flow is where the journal creates habit.

#### 8.4 Screener
*Job: "Is it halal?" answered in five seconds, with receipts.*

- **Search & screen** — search any listed symbol → **Screening Card**: verdict badge, the three AAOIFI ratios as gauge bars vs thresholds, business-activity warnings, purification %, methodology + data-vintage footnote, "differences of opinion" note where relevant (e.g. crypto). Actions: add to watchlist / log purchase / set alert.
  - **Automated tier:** fundamentals from data provider → ratio computation in our engine (explainable, versioned methodology).
  - **Manual tier:** unlisted/local assets keep the MVP's manual form.
  - **Override tier:** user may override any verdict *with a required reason* ("my scholar permits X") — override is visibly badged everywhere.
- **Watchlist** — MVP watchlist upgraded: live prices, target alerts that actually notify (email/push), screening auto-refreshed, "ready to buy" state = target hit AND compliant.
- **My screenings** — history of everything screened, re-screen staleness indicators, methodology settings (AAOIFI default; strict/custom thresholds).

#### 8.5 Zakat & Purify
*Job: from annual calculator to standing obligation system.*

- **Zakat tracker** — the hawl engine: nisab state (live gold/silver), hawl progress per wealth pool, projected liability accruing through the year, "what changed since last year". The MVP calculator survives as the **manual override/what-if mode** inside this system — its per-field fiqh explanations were the best part of the MVP and are kept verbatim.
- **Calculation & payment** — at hawl: guided review (each pool pre-filled from live portfolio, editable), final amount, then **payment recording**: multiple partial payments, recipient notes, receipt attachments, exportable **zakat statement** (PDF).
- **Purification ledger** — every dividend/gain with an impure share creates an *obligation row*; user marks paid (amount, date, charity). Running balance surfaces on Home. This closes the loop the MVP left open.
- **History** — all years, statements, payments; the user's permanent religious-financial record. (This page is the retention engine.)

#### 8.6 Insights
*Job: what the data says — performance, behavior, and a conversation.*

- **Performance** — MVP analytics upgraded: time-range selector, TWR/simple returns, benchmark overlay (SPUS / user choice), realized+unrealized, fees drag, income view for Ahmed.
- **Behavior** (persona-gated) — strategy/emotion/mistake analytics from MVP, plus "you vs your rules" (e.g. stop-loss adherence).
- **Advisor (AI)** — chat over *the user's own data* via tool-calls into the deterministic engines: "How much zakat if I sell EMAAR today?", "Which holding hurt me most this year?", "Explain why Tesla is doubtful." Every numeric answer cites the engine result it came from. Clearly labeled AI + standing disclaimer; refuses fatwa-shaped questions with a scholarly-referral response.

#### 8.7 Settings
Profile · Portfolios (create/rename/archive/base-currency) · Preferences (display currency, madhhab/methodology, nisab method, persona toggle) · Notifications (email/push per event type) · Security (password change, 2FA, sessions) · Data (export JSON/CSV, **real account deletion**) · Billing (post-1.0).

### 9. Database architecture (target)

The migration from MVP schema, in order of importance:

1. **`assets`** — instrument master: `id, symbol, exchange, name, asset_class, sector, country, currency, is_listed, metadata`. Every other table references `asset_id`, killing string duplication. Global table (not per-user), user-created rows allowed for unlisted assets.
2. **`portfolios`** — `id, user_id, name, base_currency, type, is_archived`. Everything user-financial hangs off a portfolio.
3. **`transactions`** — the ledger, replacing trades/holdings/dividends as sources of truth: `id, portfolio_id, asset_id (nullable for cash events), type (buy|sell|dividend|deposit|withdraw|fee|zakat_payment|purification_payment|adjustment), quantity, price, amount, currency, fx_rate, occurred_at, note`. Append-mostly; edits audited.
4. **`positions`** — derived cache (qty, avg cost per portfolio+asset), rebuildable from the ledger; invalidated on write.
5. **`journal_annotations`** — decoration on transactions: strategy, thesis, setup_quality, emotion, mistakes[], review_status. (The MVP `trades` table's psychology, decoupled from the money math.)
6. **`screenings`** — global per-asset screening results: ratios, verdict, methodology_version, source, as_of. **`screening_overrides`** — per-user: verdict, reason.
7. **`prices`** — cached quotes; **`fx_rates`** — currency conversion; both provider-fed with `as_of`.
8. **`zakat_pools`, `zakat_years`, `zakat_payments`** — hawl engine state, per-year calculations, payment records. **`purification_obligations`** — source event, amount, status, paid_at, charity note.
9. **`alerts`**, **`notifications`** — user rules and delivery log.
10. Keep: `profiles` (minus cash_balance), `journal_notes`. Migrate: MVP `trades` → `transactions` + `journal_annotations`; `holdings` → opening-balance transactions; `dividends` → dividend transactions + obligations.

Principles: RLS on every user table (unchanged discipline); global tables (`assets`, `screenings`, `prices`) readable by all authenticated users, writable only by service role; money math in Postgres-agnostic pure TS functions; background work in Supabase Edge Functions + pg_cron (price refresh, screening refresh, hawl checks, notification dispatch).

### 10. AI architecture

Three layers, strictly ordered:

1. **Deterministic engines** (exist today, keep pure): calculations.ts, zakat.ts, screening engine (new). Fully tested; the only source of numbers.
2. **Insight generator**: rule-based (exists) → LLM-*written* narratives over engine outputs. LLM rewrites and prioritizes; it cannot invent metrics. Runs async (cron after price refresh), cached per user per day.
3. **Advisor**: chat with tool-calling into the engines and the user's ledger (read-only tools + explicit-confirmation write tools like "log this trade"). RAG over a curated Islamic-finance knowledge base (methodology docs, glossary, madhhab-difference notes — content we author/license, never scraped fatwas). Hard rails: no fatwa issuance, mandatory disclaimer, numeric claims must cite an engine call.

Provider-agnostic interface (`InsightProvider`, `AdvisorProvider`) so models are swappable; default Claude via API. All AI features degrade gracefully to the deterministic layer.

### 11. Integrations roadmap

| Integration | Purpose | When |
| --- | --- | --- |
| Market data (e.g. EODHD/Twelve Data — needs GCC coverage: DFM/ADX/Tadawul) | Prices, FX, fundamentals | M2 (prices), M3 (fundamentals) |
| Gold/silver spot | Nisab automation | M2 |
| Broker CSV import (IBKR, local brokers' formats) | Kill manual entry | M4 |
| Email (Resend) + Web push | Alerts, hawl reminders | M2 |
| Broker APIs / open banking | Auto-sync | Post-1.0 |
| Charity/zakat payment rails | Pay zakat in-app | Post-1.0 |
| Screening data vendors (cross-check our engine) | Trust & coverage | Post-1.0 |

### 12. Security & trust

- RLS everywhere (existing discipline), service-role only in Edge Functions, no financial writes from the client without a ledger event.
- 2FA (TOTP) at M5; session management UI; rate limiting on auth and AI endpoints.
- Ledger is append-mostly with an audit trail on edits — financial data must be explainable months later.
- Real account deletion (admin API, cascade) — a religious-trust issue, not just GDPR.
- AI privacy: user data sent to model providers only for that user's request, no training, stated plainly.
- Methodology transparency page: screening thresholds, zakat formulas, versioned changelog. Trust is the product.

### 13. Mobile & desktop experience

- **Mobile (primary for Home/Portfolio/quick-log):** PWA first (installable, push via web push), not native, until post-1.0. Bottom tab bar (Home, Portfolio, Screener, Zakat, More). Quick-log and screening card designed thumb-first. Calendar and dense tables get card layouts.
- **Desktop (primary for Journal review, Analytics, Zakat annual session):** current sidebar IA persists; ⌘K search; data-dense tables earn their space; Review flow is a focused full-screen wizard.
- Arabic/RTL at M6: `dir` flip is already centralized; the real work is number/date localization (Hijri calendar display) and mirrored charts.

---

## Part III — Roadmap to 1.0

Sequencing logic: **fix the foundation before adding intelligence** (ledger before market data before screening automation before AI), and keep the app shippable after every milestone.

### M1 — The Ledger Foundation
- **Goal:** one source of truth for money events; kill double-entry; new IA shell.
- **Features:** `assets`/`portfolios`/`transactions`/`positions`/`journal_annotations` model; migration of MVP data; merged Portfolio (Positions/Income/Cash/Allocation tabs); Journal area with quick-log; nav restructure (14 pages → 7 areas); onboarding flow + persona selection.
- **DB:** new tables above; migration scripts from trades/holdings/dividends; drop `profiles.cash_balance`.
- **UI:** Portfolio tabs, quick-log modal, onboarding wizard, new nav; Calendar becomes Journal tab.
- **API:** internal service layer (`lib/services/*`) wrapping all reads/writes — pages stop querying tables directly.
- **Complexity: L** (largest single milestone — schema surgery + migration correctness).
- **Depends on:** nothing. Blocks everything.

### M2 — Live Market Data & Alerts
- **Goal:** the portfolio is *true* without manual effort.
- **Features:** price provider integration (GCC + US coverage), scheduled refresh, live valuations everywhere, FX + multi-currency display, gold/silver spot for nisab, watchlist alerts that deliver (email + web push), manual-price fallback for unlisted assets.
- **DB:** `prices`, `fx_rates`, `alerts`, `notifications`; `assets.provider_ref`.
- **UI:** live change indicators, range charts on Home/Portfolio, notification preferences, alert management.
- **API:** Edge Functions: `refresh-prices` (cron), `dispatch-notifications`; provider adapter interface.
- **Complexity: M–L** (provider coverage of DFM/ADX/Tadawul is the risk item — validate before committing to a vendor).
- **Depends on:** M1 (assets table).

### M3 — Shariah Intelligence
- **Goal:** screening becomes automated, explainable, and the single source of compliance truth.
- **Features:** fundamentals ingestion; AAOIFI ratio engine (versioned methodology, strict/custom threshold settings); Screening Card UX; global screening cache with staleness refresh; user overrides with reasons; compliance state propagated to every asset badge in the app; "holding turned non-compliant" attention events; manual tier retained for unlisted assets.
- **DB:** `screenings`, `screening_overrides`, `fundamentals` cache; migrate MVP `shariah_screenings` → manual-tier records.
- **UI:** Screener area (search-first), Screening Card, methodology settings, compliance allocation chart.
- **API:** `screen-asset` engine function; `refresh-screenings` cron; methodology transparency page.
- **Complexity: L** (the moat; data quality and explainability both hard).
- **Depends on:** M2 (fundamentals via same provider stack).

### M4 — Zakat OS & Purification Ledger
- **Goal:** from calculator to standing religious obligation system.
- **Features:** hawl engine (per-pool tracking, live nisab, year-round accrual projection); guided annual calculation pre-filled from the ledger; multi-payment recording with receipts; zakat statement PDF export; purification obligations auto-created from screened dividends, payable/markable; hawl + purification reminders; broker CSV import (kills the last manual-entry pain).
- **DB:** `zakat_pools`, `zakat_years`, `zakat_payments`, `purification_obligations`; import staging table.
- **UI:** Zakat & Purify area (tracker, guided flow, ledger, history), import wizard.
- **API:** zakat engine v2 (pure, tested against fiqh test cases); `check-hawl` cron; statement generator.
- **Complexity: M–L**.
- **Depends on:** M2 (metal prices, live valuations), M3 (compliant-value classification), M1 (ledger).

### M5 — Insights, Behavior & Hardening
- **Goal:** the data teaches; the platform is production-grade.
- **Features:** Performance analytics v2 (ranges, benchmark overlay, TWR, income view); Behavior analytics (persona-gated MVP psychology + rules adherence); guided Review flow; 2FA, session management, rate limiting; real account deletion; audit trail UI.
- **DB:** `benchmarks` cache; `audit_log`; review fields on annotations.
- **UI:** Insights area (Performance/Behavior tabs), Review wizard, Security settings.
- **API:** returns engine; deletion Edge Function (service role).
- **Complexity: M**.
- **Depends on:** M1 (annotations), M2 (benchmark prices).

### M6 — The AI Layer + Arabic
- **Goal:** the advisor ships; the platform speaks its users' language.
- **Features:** AI-written insight narratives (deterministic fallback retained); Advisor chat with tool-calling into engines + user ledger (read-only first); curated knowledge base + RAG; fatwa-refusal rails and disclaimers; Arabic UI + RTL + Hijri dates.
- **DB:** `knowledge_documents` + embeddings (pgvector); `advisor_conversations`; AI usage metering.
- **UI:** Advisor tab, insight cards v2, language switcher, RTL pass on every screen.
- **API:** `AdvisorProvider`/`InsightProvider` interfaces; tool registry over service layer; embedding pipeline.
- **Complexity: L** (AI rails + full RTL pass are both wide).
- **Depends on:** M1–M4 engines (tools need something to call).

### M7 — Mobile Polish & 1.0
- **Goal:** ship Version 1.0.
- **Features:** PWA (installable, offline shell, push); bottom-tab mobile navigation; thumb-first quick-log and screening; performance pass (Core Web Vitals); empty/error/loading states everywhere; pricing & billing scaffold (free tier: 1 portfolio/manual tier; paid: live data, AI, imports — final packaging decided here); public methodology page; marketing site refresh from "journal" to "operating system".
- **DB:** billing tables (provider-dependent, e.g. Stripe).
- **UI:** mobile nav system, PWA manifest/service worker, landing v2.
- **API:** billing webhooks; usage limits middleware.
- **Complexity: M**.
- **Depends on:** everything prior.

### Version 1.0 definition of done
A Muslim investor can: onboard in under 5 minutes → import or log their portfolio → see live, honest valuations → know the compliance state of everything they own with explanations → be told when zakat is due, calculate it correctly, pay it, and hold the receipt → purify tainted income → understand their own behavior → ask questions in English or Arabic — on their phone.

### Post-1.0 horizon (explicitly deferred)
Native apps · broker API sync · in-app zakat payment rails · advisor/institutional tier · community features (heavy moderation cost; only with clear demand) · additional asset classes (real estate, private equity) · scholar-partnership program for methodology endorsement.

---

*This PRD supersedes the MVP scope. Implementation proceeds one milestone at a time; each milestone begins with a technical design doc against this document.*
