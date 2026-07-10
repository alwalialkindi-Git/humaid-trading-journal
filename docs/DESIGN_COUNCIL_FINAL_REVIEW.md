# Design Council — Final Review

**Status: FINAL AUTHORITY on product direction.** This document supersedes conflicting statements in DESIGN_SPRINT_1_PRODUCT_DIRECTION.md; that document has been amended to match (see §9).

> **Addendum (post-review):** the design *language* is codified in **`docs/AMANAH_DESIGN_SYSTEM.md`** — the single source of truth for philosophy, vocabulary, motion, numbers, tables, charts, states, trust language, Islamic rules, AI rules, and scalability governance. **Reading and approving AMANAH is a mandatory prerequisite before D1a.** Where AMANAH and this review conflict on design-language matters, AMANAH wins. AMANAH also seats a new permanent council member — the **Design System Architect** (owner/protector of the system, reviewer of all token/primitive changes) — and records the CIO's second examination (*"would professional investors genuinely miss it?"*), answered **No-then-Yes** through the now-binding **Irreplaceability Doctrine**: the product must own three records nothing else keeps together — **the Book** (reconciled ledger), **the Conscience** (screening/zakat/purification history), **the Mind** (theses/research/journal) — and every phase must deepen at least one.
Subject under review: `docs/DESIGN_SPRINT_1_PRODUCT_DIRECTION.md` (Sprint 1)
Council: six voting consultants · Design Director (chair, non-voting) · Chief Investment Officer (absolute veto)
Rule of the review: critique the sprint document itself — not the MVP. Approve, amend, or reject.

---

## 1. The six consultant reviews

### 1.1 Institutional Portfolio Manager

**Verdict on Sprint 1: strong surface, missing four load-bearing beams.**

The sprint fixed presentation-of-trust (figures, provenance, dashboard). It under-specified *verification*-of-trust:

1. **No valuation history, no performance.** The doc promises period change, equity curves, drawdown, attribution — all require a **daily portfolio valuation snapshot series**. Nothing in any milestone creates it. Without it, every performance surface is either fake or empty. This must become a named M2 requirement (snapshot job + `valuations` series), or the design must stop promising performance.
2. **No reconciliation.** The single feature that made Sharesight indispensable: periodically confirm my positions/cash against my broker's statement, and show me the diffs. Trial-recompute proves internal consistency; reconciliation proves correspondence with reality. I need a designed seat for it (M4, with the CSV import): per-account "reconcile" flow → diff list → accept as adjustments (with the audit note).
3. **Provenance without an actor is half a provenance.** "Price: Yahoo 12:31" — good. But *who recorded this transaction and when* matters the moment family/advisor access exists. The ledger already stores it (user_id, created_at); the provenance popover must display it. Cheap now, painful to retrofit culturally later.
4. **Risk view ignores liquidity and currency.** With PE/real-estate/sukuk incoming, exposure must split **listed vs unlisted (liquid vs illiquid)** and show **currency exposure** explicitly. An allocation bar that hides that 40% of "wealth" is an illiquid building at a self-declared price is not a risk view.

Smaller: the global **period selector** (D/W/M/YTD/1Y/custom) must be one shared control across Home/Wealth/Insights, not per-chart dropdowns. And benchmarks are a **portfolio-level setting** (default to a halal index), not a chart option.

### 1.2 Senior Wealth Management Product Director

**Verdict: the sprint designed screens; the capability list demands an *object model*. Fix that now or redesign in a year.**

The new requirements (groups, labels, attachments, notes, theses, research, sharing) will crush a screen-by-screen architecture. The platforms that scale (FactSet, Morningstar Direct, Notion) are built on objects with universal behaviors:

- **Core objects:** Portfolio · Account · Asset · Position (derived) · Transaction · Obligation (zakat/purification) · Research Item · **Thesis** · Report.
- **Universal object behaviors** (designed once, applied everywhere): notes, labels, attachments, links-to-other-objects, provenance, and appearing in ⌘K. A label on an account and a label on a research item are the same feature.
- **Custom groups** = saved label-based groupings, and they feed the SAME grouping dimension used by table group-by and the allocation bar (account / class / sector / currency / label). One mental model for slicing wealth.
- **Reports become first-class objects** (Morningstar lesson): generated documents (zakat statement, performance review, activity/tax export) that persist, are listed, and can be regenerated. The sprint's "reports seat" is promoted to a committed Insights tab.
- **Navigation consequence:** the capability list adds a thinking layer. Journal (what I did) and Research (what I read/think) are one workflow — the decision loop. **Merge them into one top-level area: Research** (tabs: Inbox · Theses · Journal). This keeps the 7-area ceiling and matches how investors actually work: read → think → decide → review.
- **Strategic warning:** the research system is a *product milestone*, not a design phase. Insert it into the roadmap explicitly (v1 without AI is small: CRUD + links; the AI layer belongs to M6). Do not smuggle it into a design phase.

### 1.3 Senior UX Designer

**Verdict: approve, with four protections against the doc's own ambitions.**

1. **D1 is overloaded** (tokens + dark theme + primitives + shell + ⌘K + mobile nav + icons). Split: **D1a** (tokens, themes, Figure, primitives, Field, motion) and **D1b** (nav shell, ⌘K, bottom tabs, shield icons). Each independently shippable; regression surface halved.
2. **Provenance must be quiet by default.** If every figure grows a dot and a popover, the trust feature becomes visual noise. Rule: **normal state is clean** (provenance available on hover/long-press); a *visible* indicator appears only when something deserves attention — stale, manual, overridden, or reconciliation-pending. Trust whispers; only exceptions speak.
3. **The attention queue needs governance or it becomes a guilt feed:** severity tiers (obligation > integrity > data-freshness > housekeeping), max 5 visible with "view all", per-item dismiss/snooze where fiqh allows (you may snooze a stale price; you may not snooze zakat — you can only reschedule it honestly).
4. **Capture must be ≤10 seconds** or the research system dies on arrival: ⌘K → paste URL → save. Title/date auto-filled from the page's public metadata (see legal note §6), everything else optional and editable later from the Inbox. Mobile: share-sheet-shaped flow (PWA share target when M7 lands).
Also: one **term-glossary registry** (hover/tap definitions for avg cost, hawl, nisab, drawdown…) instead of scattered helper text — it's both the beginner layer and the future translation surface.

### 1.4 Senior Visual Design Director

**Verdict: approve the language; five corrections before D1 freezes tokens.**

1. **Brass vs amber collision:** `sacred` (brass) and `warn` (amber) are perceptual neighbors; a zakat tile must never read as a warning. Shift brass toward olive-gold (light `#8A6D1F` region), warn toward orange-amber, and contrast-test them side by side in both themes as a D1a gate.
2. **Quantity formatting rule missing:** trim trailing zeros on quantities (1,000 not 1,000.0000; 0.15 BTC not 0.15000000). Percentages: one decimal in tables, none in labels ≥10%.
3. **Compact density needs its own type check:** 32px rows with 14px figures collide; compact uses `figure-sm` (12px) with a legibility pass — compact is a *typographic* mode, not just tighter padding.
4. **Empty-state art direction:** replace the tiled star wallpaper with a **single large, partially-cropped 8-point star line-drawing** (one mark, generous space) — premium restraint instead of texture. Same three permitted sites.
5. **Shield icons are the only custom glyphs — do them properly:** must read at 14px, four states distinguishable in grayscale, and carry a small actor-dot variant for overridden states. Everything else stays Lucide.
Endorsed and locked: sans-only, the figure scale, borders-over-shadows, four motion verbs, donut retirement. One addition: **no motion during data entry** (nothing animates while a field has focus).

### 1.5 Islamic Finance Scholar & Product Advisor

**Verdict: the behavioral-identity doctrine is correct and must now survive contact with the new capabilities.**

1. **Zakat across asset classes is not one rule.** The capability list adds real estate, PE, gold, sukuk. Zakat treatment differs by *intent and class* (trading stock vs long-term, rental yield vs property value, gold by weight). The zakat design must include a **per-asset zakat treatment** setting (trading / long-term investment / personal use / income-producing) feeding the M4 engine — and the UI must explain each treatment in plain fiqh with the standing disclaimer. Designing zakat as one formula would be a religious correctness bug.
2. **Forecast purification with forecast income.** If the income calendar predicts dividends (Sharesight/Snowball idea — adopted below), it must predict the purification owed alongside, brass-marked. Purification is not an afterthought of income; render them together.
3. **AI adab (etiquette) rules, binding for M6:** the AI may summarize *my* notes, question *my* thesis, and challenge *my* reasoning — this is praiseworthy intellectual honesty. It may never issue rulings; questions that are fiqh-shaped receive the consult-your-scholar response with the disclaimer. "AI challenge to thesis" is adopted enthusiastically — an app that argues *against* your confirmation bias is deeply aligned with amanah.
4. **The WSJ workflow's copyright compliance is itself an Islamic feature.** Respecting intellectual property is respecting rights (huquq). State it in-product: "We store your links and your notes — never the publisher's content." Ethics as identity, again.
5. Far-future seat, record only: family sharing eventually implies **inheritance awareness** (a wasiyya/beneficiary note on the household, Kubera's beneficiary idea in Islamic form). Not designed now; named so the object model doesn't preclude it.

### 1.6 Product Growth Strategist

**Verdict: the sprint designed a beautiful product for week 1. Nothing in it makes week 40 inevitable. The capability additions fix that — if framed as rituals, not features.**

- **The retention problem:** zakat is annual, trading is sporadic. Daily value must come from elsewhere. The product has four natural time-scales — make them explicit rituals:
  1. **Capture (10 seconds, any moment):** research inbox via ⌘K/share — the habit hook. Every article saved is a reason to return.
  2. **The Morning Review (60 seconds, daily):** the dashboard *is* this ritual — name it in-product ("Morning review — 8 Jul"), one screen, no scroll on desktop. Koyfin/Copilot lesson: a dashboard that answers rather than displays gets opened daily.
  3. **The Weekly Review (5 minutes):** journal review flow (M5) — unannotated decisions, thesis follow-ups due, research inbox triage.
  4. **The Hawl (annual):** the zakat ceremony — the trust moment that makes the product uninstallable.
- **Activation:** first-session "aha" = live-priced portfolio + one saved research item, inside 5 minutes. The onboarding checklist should be exactly: add account → first transaction (or backdated few) → save one article → see the Morning Review assembled.
- **The income calendar is the feature people will screenshot** (Snowball's lesson): forthcoming dividends + purification, month grid — emotionally, "my wealth works while I sleep, and I know what I owe on it." Adopt into Insights→Income.
- **Two red lines I accept and endorse:** no streaks/gamification (the rituals are calendar-anchored, not guilt-anchored) and no engagement notifications — **"we notify to inform, never to engage"** should be written policy. Trust is the retention strategy; for this audience, dark patterns are churn.
- One request the chair will likely refuse (on record): a subtle "reviews completed this month" indicator. If it smells like a streak, kill it.

---

## 2. Design Director (Chair) — synthesis

**Agreements (unanimous or near):** object model with universal behaviors · Research as a top-level area absorbing Journal · daily valuation series as a hard M2 requirement · provenance-quiet-by-default with actor included · D1 split into D1a/D1b · income calendar with purification forecast · reports as first-class · one global period selector · portfolio-level halal benchmark · WSJ-legal research workflow · AI adab rules · brass/amber separation · single-mark empty states.

**Disagreements resolved:**
- *Growth's "reviews completed" indicator* — **rejected.** It's a streak in a thobe. The rituals are anchored to the calendar and the attention queue, not to self-measurement.
- *PM's wish for FX exposure now* — **partially deferred:** the exposure band gets its currency + liquidity splits at D4, but FX-adjusted performance waits for M2 fx data (layout reserves it).
- *Product Director's instinct to design sharing/roles now* — **deferred to a named post-1.0 milestone.** Only its two cheap prerequisites land now: actor-in-provenance and portfolio-pivoted access (already true).

**Hidden weaknesses found in Sprint 1:**
1. Performance promises with no valuation-history mechanism (fatal; fixed by amendment A2).
2. Allocation bar has no rule for 50+ positions → **top-8 + "other" roll-up, expandable** (amendment A6).
3. Statements/exports named a trust pillar but never given a design phase → assigned to D6 with a print stylesheet commitment.
4. Single-user language ("you") baked into provenance copy → actor-aware copy from D2.
5. No offline/degraded-data doctrine → adopted Portfolio Performance's honesty: the app must be fully readable with zero providers up (cached + manual everywhere labeled, nothing blank).

**Overengineering trimmed:**
- Provenance popover on *every* figure at D2 → Figure primitive supports it universally, but it's *enabled* on Wealth + Home first; long-tail surfaces follow.
- ⌘K action registry stays minimal (≤15 actions) until usage teaches us.
- Density toggle ships but for tables only (as decided), and is not promoted in onboarding.

**Missing opportunities adopted:** the four rituals (§1.6) as the product's explicit rhythm · reconciliation as a trust ritual (per-account, quarterly nudge — an *integrity* attention item) · thesis-with-revisions as the memory of the product (§6) · "we notify to inform, never to engage" as written policy.

## 3. Inspiration ledger (ideas, never UI)

| Platform | Idea adopted | Explicitly not taken |
| --- | --- | --- |
| Sharesight | Reconciliation against broker records; income forecast; tax/activity reports | Its visual density-without-hierarchy |
| Morningstar | Reports as persistent objects; portfolio "x-ray" (our diversity/exposure report) | Star-rating culture |
| Bloomberg Terminal | Command line as power-path (⌘K as our terminal); density discipline; keyboard chords | Multi-pane chrome, color floods, jargon |
| FactSet | Contribution/attribution table as the explanation tool | Everything else |
| Interactive Brokers | Account-centric truth; statement-style cash | Its UX entirely |
| Koyfin | Dashboard-that-answers; chart contract discipline | Watchlist-first IA |
| Snowball Analytics | Income calendar as emotional anchor; dividend forecast | Gamified goals |
| Yahoo Finance | Watchlist simplicity; symbol-first search | Ads/news-feed engagement model |
| TradingView | (Studied, largely rejected) — only: symbol search speed | Social feed, ideas-stream, chart-first identity |
| Portfolio Performance | Cost-basis rigor; works-offline honesty; data ownership | Desktop-era ergonomics |
| Kubera | Unlisted/illiquid assets as first-class; net-worth simplicity; beneficiary concept (→ future wasiyya seat) | Its pricing-page-driven feature sprawl |
| Delta | Mobile position cards; capture speed | Crypto-hype aesthetics |
| Copilot Money | Interaction quality bar; quick-capture ergonomics; empty states that teach | Consumer budgeting frame |
| Linear | Product polish bar; keyboard-completeness; opinionated defaults | — (already in doc) |
| Notion | Object model with universal behaviors; calm IA | Infinite flexibility (we stay opinionated) |
| Apple HIG | Motion restraint; spacing; touch standards | — (already in doc) |

## 4. Capability coverage map

Every capability from the brief → its design surface and roadmap home. ✅ = already designed · 🔷 = designed in this review · 📌 = seat reserved (named milestone).

**Portfolio Core:** multiple portfolios ✅ (M1 schema; switcher D2) · holdings ✅ · broker accounts ✅ (+Accounts tab D2) · cash accounts ✅ · portfolio sharing 📌 (post-1.0 "Household" milestone; prerequisites landed: portfolio-pivot access, actor provenance) · family portfolios 📌 (same) · advisor access 📌 (same, read-only role first) · custom groups 🔷 (label-based groupings → grouping dimension, D2/M5) · labels 🔷 (universal object behavior, M5) · attachments 🔷 (universal behavior; Supabase Storage; ships with Research v1) · notes ✅/🔷 (exists on transactions; universalized) · investment thesis 🔷 (§6) · unlisted investments ✅ (manual_custom tier) · private equity 🔷 (asset_class extension + liquidity flag, M4-era ALTER) · real estate 🔷 (same + zakat treatment) · sukuk ✅ · gold ✅ (commodity class; zakat-by-weight treatment M4) · crypto record-only ✅.

**Portfolio Intelligence:** benchmarking 🔷 (portfolio-level setting, halal default; D6/M2) · allocation analysis ✅ (bar + grouping dimensions) · diversity report 🔷 (Reports, M5) · exposure report 🔷 (+liquidity & currency splits, D4) · contribution analysis ✅ seat (D6/M5) · historical performance 🔷 (**requires A2 valuation series, M2**) · drawdown ✅ (engine exists; real data M2) · multi-currency valuation ✅ (M2) · future income forecast 🔷 (from dividend history + declared yields, M5) · dividend forecast 🔷 (same) · income calendar 🔷 (with purification forecast — Insights→Income, D6/M5) · historical cost ✅ (ledger-native) · tax reports 📌 (Reports, M5; jurisdiction-aware later) · risk reports 🔷 (concentration/liquidity/currency/compliance composite, Reports M5).

**Research System:** fully specified in §6; roadmap home: **M5.5 "Research Desk"** (v1, no AI) + M6 (AI layer).

## 5. Navigation (final)

```
  OVERVIEW      Home                       (the Morning Review)
  WEALTH        Wealth                     Positions · Accounts · Cash · Income · Activity
  THINKING      Research                   Inbox · Theses · Journal
  PURITY ◆      Zakat & Purify             Tracker · Purification · History
                Screener                   Screen · Watchlist
  UNDERSTAND    Insights                   Performance · Income · Behavior · Reports
  —             Settings
```
Seven areas preserved. Journal page (current /trades) migrates under Research at its rebuild (Phase 7 scope); routes redirect as before.

## 6. The Research System (new — full design)

**Objects.**
- **Research Item**: url · title · source (domain-derived, e.g. *wsj.com*) · publish date · my note (the heart of it) · stance (bullish/bearish/neutral/uncertain) · confidence (1–5) · linked assets · linked portfolios · linked transactions ("this informed that trade") · linked thesis revision · follow-up reminder date · labels · attachments (user-uploaded screenshots/PDFs) · created_by/at.
- **Thesis** (per asset, optionally per portfolio): current statement + stance + confidence, and an append-only **revision history** — each revision records what changed, why, and which research items drove it. The thesis is the product's memory of *why you own what you own*. Journal annotations may cite a thesis revision; the loop closes: read → revise thesis → act → review.
- Universal behaviors apply (labels, attachments, ⌘K, provenance).

**Workflows.**
- *Capture (≤10s):* ⌘K → "Save link" → paste URL → save. Title/date auto-filled from the page's **public metadata only** (standard Open Graph/title tags — the same data the publisher offers every link-sharing surface); everything else optional. Items land in **Inbox**.
- *Triage (weekly ritual):* Inbox list → assign assets/stance/note or archive. Zero-inbox is a calm state, not a scored one.
- *Thesis work:* asset drawer gains a Thesis section (current stance + "revise"); revising prompts "what changed?" and offers recent linked research as evidence checkboxes.
- *Decision linking:* the transaction dialog's note row gains "link research/thesis" (optional, one tap from recent items for that asset).
- *Follow-up:* reminders surface in the attention queue (housekeeping tier).
- *Retrieval:* structural search first (filter: asset=AAPL, source=wsj.com, stance-changed) — which **already answers "which WSJ articles changed my opinion about Apple?"** as a filter over thesis revisions citing wsj.com items, before any AI exists.
- *AI layer (M6, adab rules binding):* summaries **of my notes**, thesis challenge ("what evidence would change your mind?", "your last three revisions raised confidence while the position fell — review?"), question generation for further research, natural-language retrieval over items/theses/journal. Inputs: my notes, my metadata, my theses, my ledger. **Never** publisher content; attachments excluded from AI unless the user affirms rights to that content.

**The WSJ-legal workflow (explicit).** The app stores: the URL, public page metadata, and *the user's own* notes/screenshots/files (private, never redistributed, excluded from AI by default). The app never scrapes, caches, or displays WSJ article content; opening an article is always a link out to wsj.com where the user's subscription authenticates. The subscription's value is maximized by *connection*, not extraction: every article becomes a permanent node linked to assets, theses, and trades — searchable forever even though the content lives at the publisher. In-product statement (also an ethics feature, per §1.5): *"Your links, your notes, your thinking — the publisher's content stays with the publisher."*

## 7. The final unified direction

Forget "a trading journal." Forget "a portfolio tracker." The question was: *what would the best Islamic wealth operating system in the world be?* The council's answer — five layers on one ledger, moving through four rituals:

**The layers:** ① the **Ledger of Record** (every money event, engine-computed, reconciled, provenanced — M1, done) · ② the **Conscience** (screening, boundaries, purification — M3/M4) · ③ the **Obligation** (zakat as a living system with per-class fiqh treatment — M4) · ④ the **Thinking Desk** (research, theses, journal — M5.5) · ⑤ the **Intelligence** (performance, income, risk, reports, AI-with-adab — M2/M5/M6).

**The rituals:** capture (10s) → morning review (60s) → weekly review (5m) → the hawl (annual).

**The covenant** (written policy, in-product): every number can explain itself · we notify to inform, never to engage · no leverage, no shorts, no fake certainty, no fake urgency · your data and your reading are yours.

One sentence: **a private wealth desk for the Muslim household — where the numbers are honest, the obligations are alive, and the thinking is remembered.**

---

## 8. Chief Investment Officer — review and verdict

*"If I were responsible for managing billions of dollars, would I trust this product every single day?"*

**Examination.**
What earns trust in this direction: the ledger discipline (append-mostly, trial-recompute, no-shorts structurally) is how real books are kept. Provenance-with-actor is how real desks answer "where did this number come from." Reconciliation is how real operations catch drift. Honest degradation ("unpriced, excluded from totals") is rarer and more valuable than the industry's silent zeros. The refusal of engagement mechanics tells me the designers understand whose money this is.

What would have broken trust, had the council not caught it: performance figures without a valuation series (a chart drawn on sand); provenance noise (a trust feature that cries wolf); zakat as a single formula across asset classes (wrong in a way that matters religiously); research AI touching content it doesn't own.

**Conditions — binding, non-negotiable:**
1. **No performance figure ships before the daily valuation series exists** (M2). Until then, surfaces say "insufficient history," never an approximation.
2. **Reconciliation ships with import (M4)** — an unreconcilable book is an opinion, not a record.
3. **Provenance includes the actor** on every ledger-derived figure from D2 onward.
4. **Statements must stand alone** — a zakat statement or performance report readable by a family member or advisor with no app access (M4/D6, print-grade).
5. **The covenant (§7) is written policy** — any future feature that violates it is rejected at design review, not debated at implementation.

**Verdict: YES — conditionally, and the conditions are hereby part of the design direction.** With A1–A9 (§9) applied and the five conditions bound to their milestones, I would open this product every morning, and I would let it hold my family's book.

---

## 9. Binding amendments to DESIGN_SPRINT_1_PRODUCT_DIRECTION.md

| # | Amendment | Where it lands |
| --- | --- | --- |
| A1 | Navigation: **Research** area (Inbox · Theses · Journal) replaces standalone Journal; "THINKING" group added | Sprint §8; Phase 7 scope note |
| A2 | **Daily valuation snapshot series = hard M2 requirement**; no performance figures before it exists | Sprint §9/§17; PRD M2 |
| A3 | D1 split into **D1a** (tokens/themes/Figure/primitives/motion) and **D1b** (shell/⌘K/mobile nav/shield icons) | Sprint §28 |
| A4 | Provenance **quiet-by-default** + **actor included**; enabled Wealth+Home first | Sprint §6/§22 |
| A5 | Attention queue: severity tiers, cap 5, snooze rules (obligations reschedulable, never dismissible) | Sprint §9 |
| A6 | AllocationBar: top-8 + expandable "other"; exposure band gains **liquidity & currency splits** | Sprint §9/§10 |
| A7 | Income calendar (dividends **+ purification forecast**) committed to Insights→Income | Sprint §17 |
| A8 | Reports = first-class objects (Insights→Reports); print stylesheet in D6; brass/amber separation; single-mark empty states; qty-formatting & compact-type rules; no-motion-during-entry | Sprint §6/§17/§19/§26 |
| A9 | Roadmap inserts: **M5.5 Research Desk** (v1 no-AI: items, theses, inbox, attachments, universal labels/notes); M6 gains AI-research with adab rules; post-1.0 gains **Household** (sharing/roles/wasiyya seat) and reconciliation lands in M4 | Sprint §28; PRD roadmap |

## 10. Sign-off

- [x] Six consultants reviewed independently; conflicts resolved by the chair (§2)
- [x] CIO examined and issued conditional YES; conditions bound (§8)
- [x] Product owner approved this direction and the CIO conditions
- [x] **AMANAH_DESIGN_SYSTEM.md** authored — the mandatory design-language prerequisite (see header addendum); Design System Architect seated; Irreplaceability Doctrine bound
- [ ] **Product owner approval of AMANAH** — the final gate before D1a code
- On approval: implementation begins at **D1a**, governed by AMANAH, with Phase 5 flows as the untouchable regression baseline, the five CIO conditions and the Irreplaceability Doctrine in force from the first commit.
