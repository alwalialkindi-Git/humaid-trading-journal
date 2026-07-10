# AMANAH — The Design System

**Status: SINGLE SOURCE OF TRUTH for the product's design language.**
Authority chain: this document » `DESIGN_COUNCIL_FINAL_REVIEW.md` » `DESIGN_SPRINT_1_PRODUCT_DIRECTION.md`. Where documents conflict, the higher authority wins. Reading this document is a **mandatory prerequisite** for anyone implementing any design phase (D1a onward).
Custodian: the **Design System Architect** (§13). Changes to this document require their sign-off plus product-owner approval.

*Amanah* (أمانة): a trust — something placed in your care, for which you will answer. Wealth is amanah. So is the user's attention, their data, and their belief that our numbers are true. Every rule below exists to honor one of those trusts.

---

## 1. Design Philosophy

**The product must create five feelings, in this order:**

1. **Calm** — one focal point per screen; generous space; nothing blinks, bounces, or begs. The user should be able to review their wealth at 11pm after a hard day and feel *quieter* afterward.
2. **Trust** — every number aligned, sourced, timestamped, explainable. Trust is built in details: a true minus sign, a footer total that matches, a stale price that admits it.
3. **Professionalism** — the register of a private banker, not a fintech app. The product never performs enthusiasm. It performs competence.
4. **Precision** — exact words, exact figures, exact states. "About" and "roughly" appear only where the data is genuinely estimated — and then they are *labeled* estimates.
5. **Transparency** — the product shows its work, admits its gaps, and never fakes certainty. Honesty about limitation is a feature, not an apology.

**Never:** playful, noisy, cute, urgent, congratulatory, gamified, decorative. If a design choice would feel wrong in a leather-bound family ledger, it is wrong here.

**The test for any new surface:** *Would a person managing their family's wealth for thirty years find this respectful of that task?*

## 2. Financial Language

The product speaks in **past-tense verbs of record**. It is a ledger; ledgers state what happened.

| Banned | Use instead |
| --- | --- |
| Awesome! / Great job! / Congratulations! 🎉 | *(nothing — the record is the acknowledgment)* |
| Oops! / Uh oh! / Whoops | the error template (§8) |
| Success! | **Recorded.** / **Updated.** / **Saved.** |
| Your portfolio is crushing it | **Portfolio up 4.2% this month.** |
| Let's get started! | **Record your first transaction.** |
| You're all set! | **Setup complete.** |

**The verb set** (system actions always use these): *Recorded · Updated · Calculated · Recomputed · Verified · Reconciled · Imported · Reviewed · Deleted · Archived · Estimated · Scheduled.*

**Voice rules:**
- No exclamation marks, anywhere, ever. (Including errors.)
- The system has no "I". "We" appears only in covenant/policy statements ("We store your links and your notes…").
- Feedback pattern: `<Verb> — <object/consequence>.` → *"Recorded — 1,000 EMAAR bought, positions recomputed."* / *"Deleted — positions recomputed."*
- Numbers speak for themselves: never editorialize a figure ("a healthy 12%"). State it; let provenance explain it.
- **Two sanctioned exceptions to the neutral register** (the only ones): the sacred-moment line *"May Allah accept it from you."* and the all-clear queue state *"All quiet, alhamdulillah."*
- Product nouns, fixed: **Wealth · Position · Account** (broker account) **· Cash · Activity · Transaction** (Trade = buy/sell only) **· Obligation · Screening · Override · Thesis · Research Item · Report · Provenance.** Synonym drift is a bug.

## 3. Motion System

Motion exists to explain state change — never to entertain.

**The four verbs (closed set — adding a fifth requires DSA sign-off):**

| Verb | Spec | Used for |
| --- | --- | --- |
| **Appear** | fade + scale 0.98→1, 160ms, ease-out (exit: ease-in, 120ms) | dialogs, popovers, menus |
| **Slide** | translate, 240ms, decelerate | drawers, sheets, mobile nav |
| **Settle** | crossfade of tabular digits + 2s background highlight decay | a figure changing while watched; a new row entering a table |
| **Nudge** | 3 × 4px horizontal, 240ms total | rejected submission (with the error, never instead of it) |

**Absolute rules:** no bouncing, no springs with overshoot, no confetti, no parallax, no looping/ambient animation, no motion on shields/disclaimers/sacred surfaces (fade only), **no motion while a form field has focus**, stagger ≤ 40ms and ≤ 6 items, numbers never tick-count on page load. `prefers-reduced-motion`: everything collapses to ≤120ms opacity. Implementation is CSS transitions only — no animation library.

## 4. Number System

Money is the product. These rules are law.

1. **Tabular numerals** (`font-variant-numeric: tabular-nums`) on every money, quantity, percentage, and date-numeral surface. No exceptions, including toasts and tooltips.
2. **Alignment:** numeric table columns right-aligned; figures in stat blocks left-aligned as a block; decimal points in a column always vertically aligned (guaranteed by fixed precision per column).
3. **Money:** always 2 decimals (`1,234.50`, never `1,234.5`); thousands separators always; ISO currency code (not symbols), rendered one type-step smaller and lighter than the figure: `12,120.00 AED`. Compact notation (`1.2M`) permitted only on chart axes — never in tables, stats, or copy.
4. **Unit prices:** up to 4 decimals, trailing zeros trimmed to minimum 2 (`12.10`, `27.1650`).
5. **Quantities:** up to 8 decimals, trailing zeros fully trimmed (`1,000` · `0.15` BTC — never `0.15000000`).
6. **Percentages:** 1 decimal in tables/stats (`+4.2%`); 0 decimals ≥10% in labels; always signed in delta contexts.
7. **Negatives & deltas:** true minus U+2212 (−), never a hyphen; deltas *always* signed both directions (`+290.00` / `−125.50`); color (`pnl-*`) never appears without the sign — color-blind users get the same information. Parentheses-negatives are not used.
8. **Timestamps:** same-day figures carry `HH:MM` (24h, user-local); older carry `8 Jul`; provenance popover always carries the full form `8 Jul 2026, 12:31 GST`. Relative time ("2h ago") only in the attention queue and inbox, never on financial figures.
9. **Mixed currencies:** amounts in different currencies are **never summed without FX**. Until M2 FX: per-currency lines, always. After M2: converted totals are marked `≈ 61,430 AED` with rate source + as-of in provenance. The `≈` is mandatory on every converted figure, forever.
10. **Rounding:** display-boundary only (engine holds full precision); half-up; a displayed total must equal the sum of displayed components or carry a rounding footnote — visible arithmetic must never look wrong.
11. **Provenance (the flagship rule):** every financial figure is rendered through the `Figure` primitive and can answer four questions on hover/long-press — **Source** (Yahoo / manual / calculated / imported) · **As-of** · **Actor** (who recorded/overrode) · **Derivation** ("qty × price − fees", "computed from 4 transactions, average cost"). Quiet by default: visible indicators only for exceptional states (§9).
12. **Estimates** (zakat accrual, forecasts) always carry the word *Estimated* and their method in provenance. An unlabeled estimate is a lie.

## 5. Table Design System

Tables are the core experience — institutional software is tables done with respect (Bloomberg's density, IBKR's truthfulness, Morningstar's aggregates, FactSet's attribution — ideas, not pixels).

**Anatomy (top to bottom):** toolbar (filters left · density/export right) → sticky header → rows → **footer aggregates** (labeled: `Σ Total`, `Avg`; only where summing is meaningful — never sum mixed currencies, §4.9).

**Column types (closed set; every column declares one):**

| Type | Align | Format | Notes |
| --- | --- | --- | --- |
| Text/Entity | left | primary + secondary line | truncate + title tooltip |
| Money | right | §4.3 | footer-summable per currency |
| Quantity | right | §4.5 | |
| UnitPrice | right | §4.4 | may carry freshness dot |
| Delta | right | §4.7 signed + colored | optional sub-% |
| Percent | right | §4.6 | |
| Date | left | §4.8 | time icon when trade_time set |
| Badge/Shield | left | closed vocabularies | never color-only |
| Provenance | icon | dot states §9 | popover on hover |
| Actions | right | hover-reveal (desktop) / visible (touch) | ≥44px targets |

**Behavior:** row height 44px comfortable / 32px compact (compact uses `figure-sm`; a table-level, remembered preference); single-column sort with visible indicator; sticky header always; row hover = border-strong raise (no zebra striping — borders carry structure); row focusable, `Enter` opens detail; numeric cells never wrap; loading = shaped skeleton rows; error = inline row-band with the §8 template; empty = §7 state inside the table frame.
**Mobile transformation (defined once, applied always):** row → card: entity top-left, primary Money top-right, secondary figures in a 2-col grid below, badges inline with entity, actions behind tap-through. The primary figure is declared per table — never guessed.

## 6. Chart Philosophy

Charts are for *reading*, not decoration. Identity lives in chrome; ink lives in data. Every chart carries an as-of caption and honors the contract (1.5px ink lines, dashed `ink-faint` benchmarks, area fill ≤8%, horizontal hairline grid only, shared tooltip with tabular figures, `pnl-*` only for signed series, defined empty/insufficient states).

| Chart | Use when | Example |
| --- | --- | --- |
| **Line** | level over time | equity curve, price history |
| **Area** (single series, ≤8% fill) | level over time where volume-of-value aids reading | wealth strip sparkline |
| **Bar (vertical)** | discrete periods compared | monthly P&L, dividends by month |
| **Allocation Bar** (100% stacked horizontal — signature) | composition *now* | allocation by class/account/currency; top-8 + expandable "other" |
| **Stacked bar (vertical)** | composition across periods | income by position by month |
| **Calendar heatmap** | daily intensity | activity/P&L calendar, income calendar |
| **Treemap** | one place only: the interactive exposure explorer (post-M2), min-cell labels enforced | drill into concentration |
| **Threshold gauge (horizontal)** | value vs limit | screening ratios vs AAOIFI thresholds |
| **Hawl ring** | the sole radial — it is a calendar, not a comparison | zakat year progress |
| **Sparkline** | trend hint inside rows/stats | position trend column |

**Avoided, with reasons:** **pie/donut** (angle comparison is the weakest perceptual task; dead center space) · **radar** (unreadable axes) · **3D anything** (distortion = dishonesty) · **dual-axis** (implies false correlation — use small multiples) · **candlesticks/OHLC** (we are a wealth desk, not a charting terminal — link out for that) · **gauge dials** (skeuomorphic noise) · **word clouds, funnels** (not our questions).

## 7. Empty States

An empty state is the product teaching what a place is *for*. It is onboarding, not absence.

**Template (fixed):** single large partially-cropped 8-point star line-mark (one of its three permitted sites) → headline naming the purpose (*"Your cash statement"*) → one sentence of why it will matter → **exactly one** primary action → optional single text-link secondary.

**Banned:** "No data." / "Nothing here yet" alone · two competing buttons · people illustrations · sad-face iconography · any exclamation mark.

Every screen's empty state is specified at its design phase; the copy register follows §2. Insufficient-data is its own state, distinct from empty: *"Performance needs 30 days of history. First valuation: 8 Jul."*

## 8. Error Philosophy

**An error message is a trust-building opportunity: it proves the product knows what's happening even when something failed.** Errors inform; they never blame, panic, or vanish into "Oops."

**The template — every error answers up to four questions:**
1. What happened (plainly)
2. What you're seeing instead (the honest fallback)
3. When it last worked (the timestamp that proves we track truth)
4. What can be done (one action, if any)

**Canonical example (data degradation):**
> **Price unavailable.**
> Last successful update: 09:42.
> Showing cached value.

**Taxonomy → treatment:**

| Class | Treatment |
| --- | --- |
| Data-source degradation | inline + freshness dot, attention-queue item at data-freshness tier; **never a modal** |
| Field validation | inline under field, specific ("Quantity must be greater than zero"), nudge on submit |
| Engine rejection | form-level, **engine message verbatim** (they are written for humans), state preserved |
| Blocked destructive action | explain the dependency ("A later sell depends on this buy") + the path forward |
| Mutation failure | always states data safety: *"Nothing was changed. Try again."* |
| System/page | boundary with retry; ledger-not-initialized keeps its setup guidance |

Errors are never toast-only when the user must act; toasts may *echo* an error, not carry it.

## 9. Trust Language

The provenance vocabulary — a **closed set** of states, each with fixed word, dot, and popover content. These words are reserved; using them loosely anywhere in the product is a bug.

| State | Meaning | Indicator (quiet-by-default rule) |
| --- | --- | --- |
| **Live** | provider price, fresh (<15m) | none visible — normal is silent |
| **Cached** | provider price, aged | none <24h; **amber dot** ≥24h, popover: "Last successful update 09:42" |
| **Manual** | human-entered value | neutral chip `manual` (always visible — human data is always labeled) |
| **Override** | user overrode provider/screening data | chip `override` + actor-dot on shield; reason in popover |
| **Calculated** | engine-derived | silent; popover shows derivation + input count |
| **Estimated** | modeled, not measured | word *Estimated* always visible adjacent |
| **Imported** | arrived via import batch | popover: source + batch date |
| **Pending** | awaiting recompute/reconciliation | subtle pulse on freshness dot |
| **Reconciled / Verified** | matched against broker statement | popover: "Reconciled to IBKR statement, 30 Jun" — the strongest word we have; used *only* for statement-matched data |
| **Updated** | the act (toast verb), not a persistent state | — |

Rule of visibility: **trust whispers, exceptions speak** — Live and Calculated are silent; Manual, Override, and Estimated always announce themselves; staleness announces itself past 24h.

## 10. Islamic Design Rules

The Islamic identity is **behavioral**: honest numbers, living obligations, structural boundaries (no leverage/short/derivative pathways), precise respectful language, and property rights honored (the WSJ rule). If a screenshot of the Positions table looks "Islamic-themed," we decorated; if it looks *trustworthy* and carries a shield column and a purification ledger, we succeeded.

- **No crescents. No domes. No lanterns. No prayer beads. No decorative Arabic-as-texture. No unnecessary ornament.**
- The 8-point star geometry: **three permitted sites only** — empty states (single cropped mark), the zakat/purification completion state, exported statements. Never behind data. Never tiled.
- Brass `sacred` accent: zakat/purification surfaces and the ceremony only.
- One ceremony in the whole product (recording zakat/purification payment): full-surface quiet state, slow fade only, amount in figures, the sanctioned line, then the permanent record. Gravity, never celebration.
- Language: Arabic terms (hawl, nisab, riba, amanah) in roman type with first-use glossary definitions; no Quranic verses as UI copy; the disclaimer rendered with dignity wherever compliance is shown.
- Compliance is the **shield grammar** (filled/half/slashed/outline + label), never bare green/red.

## 11. AI Rules

The hierarchy is absolute: **deterministic engines compute; AI explains, questions, and retrieves. AI never produces a number the engine didn't.** Any numeric claim in AI output cites the engine result it came from.

**AI speaks when:** the user asks · scheduled insight generation runs (max 3 cards, Home/Insights only) · a thesis is being revised (the challenge: "What evidence would change your mind?") · the weekly review runs · retrieval is requested ("which articles changed my view on AAPL?").

**AI stays silent:** during data entry · on sacred surfaces and ceremonies · on error states · when a deterministic answer exists (it quotes, not recomputes) · when confidence is low (silence over noise — no hedged filler).

**AI asks questions when** questioning serves the user's own thinking: thesis revisions, journal reviews, confirmation-bias patterns ("Confidence rose while the position fell — review the thesis?"). Questions are adab — respectful, specific, never rhetorical shaming.

**Hard rails:** no fiqh rulings, ever — fiqh-shaped questions get the scholar-referral response with the disclaimer · trained-on-nothing-of-the-user's, per the covenant · reads only user notes/metadata/ledger, never publisher content (attachments excluded unless rights affirmed) · every AI output visibly labeled `AI` · AI failure degrades to the deterministic layer, invisibly.

## 12. Scalability Rules

Rules that keep page #400 consistent with page #4, five years from now:

1. **Token-only color.** No raw hex/oklch in any component — semantic tokens only. Enforced by lint. If a needed color has no token, the design is wrong or the token set grows (DSA decision).
2. **Closed sets grow deliberately.** Motion verbs, column types, chart types, trust states, product nouns — all closed vocabularies. Additions require DSA sign-off with a written "why the existing set fails."
3. **One of each.** One table system, one chart wrapper set, one form system (Field), one dialog/sheet/toast/command implementation. A second implementation of anything is design debt by definition.
4. **Three page templates:** dashboard grid · table page · focus flow (wizard/ceremony). New pages compose these; a fourth template is a DSA + product-owner decision.
5. **Components before pages.** A new page built only from existing components needs no design review. A new *pattern* does.
6. **RTL-ready by construction:** logical properties (`ps-`/`pe-`, `start`/`end`) in all new code; no direction-encoded icons or layouts; the figure system already digit-direction-safe.
7. **Two themes, forever** (light/dark). Theming-as-a-feature is permanently out of scope.
8. **Documentation is part of done:** every component ships with a usage note (when to use, when not to, props of consequence).
9. **Deprecation, not accumulation:** replaced patterns get removed within one phase; the codebase never carries two generations of a primitive.
10. **Quarterly design-debt review** (DSA-run): drift audit vs this document; findings become fix tasks, not footnotes.

## 13. New Permanent Council Member — Design System Architect

**Charter.** The DSA does not design pages. The DSA protects the system.

- **Owns this document** — sole editor; changes require product-owner co-sign.
- **Reviews** every change to tokens, `components/ui/*`, chart wrappers, the table system, and any PR introducing a new visual pattern.
- **Vetoes** (with written reason): new colors outside tokens, new motion, new component duplicating an existing one, vocabulary drift, closed-set violations.
- **Maintains** the component inventory and its documentation; runs the quarterly audit (§12.10).
- **Advises** every design phase (D1a–D6) at kickoff and reviews at completion against this document.
- Explicitly **not** responsible for: page layouts, feature scope, milestone priorities — those belong to the Design Director and product owner. Tension between "ship the page" and "protect the system" is resolved by the product owner; the DSA's dissent is recorded either way.

The DSA joins the standing council alongside the Design Director and the CIO's conditions.

## 14. The CIO's Final Question

> *"If this product disappeared tomorrow, would professional investors genuinely miss it?"*

**First answer — honest: No.**
"Today, a professional would shrug. Prices exist elsewhere. Journals exist elsewhere. Even the zakat calculator, alone, is replaceable in an afternoon of spreadsheet work. Nothing yet *accumulates* here that cannot be reassembled elsewhere. Beauty is not missed; records are missed. Refine until the answer changes."

**The refinement — the Irreplaceability Doctrine (hereby binding on the roadmap):**
The product must own **three records that nothing else keeps, and keeps together** — and every phase must deepen at least one:

1. **The Book** — the reconciled, provenanced, engine-true ledger of the family's wealth across brokers, currencies, and asset classes, listed and unlisted. (M1 ✓, deepened by M2 valuations, M4 reconciliation/import.)
2. **The Conscience** — the only continuous record of a Muslim investor's *religious-financial life*: screening history with methods, every purification obligation and its settlement, every hawl, every zakat calculation and payment with statements. Years of this cannot be reconstructed anywhere else. (M3/M4/D5.)
3. **The Mind** — theses with revision history, research linked to decisions, the journal of why. The investor's own thinking, made permanent and searchable. (M5.5/M6.)

Supporting commitments: full export remains free forever (a record you can't take with you is a hostage, and hostages are resented, not missed) · statements stand alone (CIO condition 4) · the income calendar and morning review make the records *daily-useful*, not archival.

**Second answer — after the doctrine: Yes.**
"Miss it? By the second hawl, this product holds the family's book, its conscience, and its mind — years of zakat statements, purification settlements, screening decisions, theses, and a reconciled ledger no broker, spreadsheet, or competitor holds together. Losing it would feel like losing a decade of diaries *and* the accountant *and* the proof you paid what you owed. That is what 'missed' means. The doctrine is binding: any phase that deepens none of the three records should be questioned in design review."

**Verdict: YES — conditional on the Irreplaceability Doctrine remaining in force.** Recorded alongside the five conditions of the Final Review.

---

*End of AMANAH. Implementation of D1a may begin only after product-owner approval of this document.*
