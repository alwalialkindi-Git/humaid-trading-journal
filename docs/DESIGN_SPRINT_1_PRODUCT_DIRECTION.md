# Design Sprint 1 — Product Direction

> **AMENDED by the Design Council Final Review** (`docs/DESIGN_COUNCIL_FINAL_REVIEW.md`, amendments A1–A9 + five binding CIO conditions). Where the two documents differ, the Council review is the authority. Amendments are marked ◇ inline below.

Status: **Awaiting product-owner approval. No code until approved.**
Goal: transform Humaid from a competent MVP into a **premium Islamic wealth operating system** trusted by serious investors, traders, and family portfolio stewards.
Constraint: everything here must be implementable in the current Next.js / Tailwind v4 / shadcn-style architecture, incrementally, without breaking Phase 5's working flows.

---

## 1. Brutally honest audit of the current UI

The current UI is a **clean MVP** — and it looks like one. Specific failures, judged against "would someone trust this with family wealth for a decade":

1. **Numbers are typographically careless.** Proportional figures everywhere: columns of money don't align, digits shift width when values update, magnitudes are hard to scan. For a financial product this is the equivalent of a bank misspelling your name. There is no numeric type scale at all — a portfolio total and a table cell are the same voice.
2. **Green means three things.** Brand, halal, and profit all render emerald. When a non-compliant position is up 40%, the screen argues with itself. Semantic collision is a trust bug, not a style choice.
3. **The warm sand palette reads "wellness app."** Calm was the right instinct; the execution lacks authority. Contrast is timid (muted-gray text on warm paper hovers near AA), surfaces don't establish hierarchy (cards float on sand with near-invisible borders + soft shadows — three depth systems doing one job weakly).
4. **No dark mode.** Serious portfolio review happens at night and next to terminals that are all dark. Its absence marks the product as casual.
5. **Density is consumer-grade and fixed.** Tables spend vertical space like a marketing site. A ten-position portfolio fills a screen; a fifty-position one is a scrolling exercise. No compact mode, no sticky headers, no footer totals.
6. **Interaction is mouse-only.** No command palette, no keyboard path through the transaction flow beyond browser defaults, a floating action button (a consumer-mobile pattern) as the primary verb on a desktop wealth product.
7. **Charts are library defaults.** Recharts out of the box: default tooltips, arbitrary colors by index, donuts that waste their centers. No visual contract between charts.
8. **No provenance.** A price appears with no source, no timestamp at the point of use (Portfolio has one global "as of"). A PM's first question — "where did this number come from?" — has no answer in the UI.
9. **Motion is absent, not restrained.** Dialogs pop with zero transition (we removed the broken animate classes and replaced them with nothing). The product feels static rather than calm.
10. **The Islamic identity is a background pattern.** The 8-point star in empty states is tasteful, but it's decoration. Nothing about *how the product behaves* is distinctively Islamic yet — the zakat flow looks like every other form.

**Verdict: replace the visual layer, keep the bones.** The information architecture (Phase 5's Loop), the component approach (shadcn-style, in-repo), and the token mechanism (CSS variables + Tailwind v4 `@theme`) are all correct and survive. What gets replaced: the token *values*, the numeric typography, table/chart/badge systems, depth model, motion, and the primary-action pattern. This is a re-skin plus new primitives — not a rewrite of pages, and explicitly not a rewrite of the ledger UI logic.

---

## 2. The seven expert reviews

### 2.1 Product Designer (Linear school) — clarity, speed, friction

"The Loop is genuinely good — sub-30-second entry, engine-backed preview, honest errors. Now make the *product* as fast as the flow. My list:

- **⌘K is the front door.** Search an asset → screening card → act. Type 'buy' → transaction dialog. Type 'zakat' → tracker. One index over assets, actions, and navigation. The FAB stays only on mobile.
- **Keyboard-complete transaction flow**: open with `N`, tab order is the golden path, `⌘Enter` saves, `Esc` asks before discarding dirty state. Power users should never touch the mouse.
- **Speed is perceived through response, not spinners.** Optimistic row states (pending shimmer on the new transaction row), sub-150ms transitions, no full-page skeletons after first load — targeted ones.
- **Every list row is a workbench**: hover reveals actions, `Enter` opens detail, no hunting for kebab menus.
- Kill ceremony: the dialog's grouped chip rows are two decisions before the user types anything. Default to Buy with the cursor already in the asset field; the type switcher is secondary.

What I'd refuse to build: customizable dashboards, drag-and-drop anything. Opinionated beats configurable at this stage."

### 2.2 UX Designer (Notion school) — calm, hierarchy, beginners

"Calm is the correct brand and currently under-delivered — calm is not beige, it's *knowing where to look*. My review:

- **One focal point per screen.** Home currently offers six equal cards. The redesign needs a strict hierarchy: one hero (wealth + its change), one queue (needs attention), everything else quiet.
- **Progressive density**: beginners (Yusuf) see the same screens as the PM but with explanations available — every financial term gets a hover/tap definition (avg cost, cost basis, hawl, nisab, purification). One glossary system, not scattered helper text.
- **Empty states are the beginner's onboarding** and they're already the best-designed part of the MVP. Keep the pattern-background treatment; upgrade each to teach the *next action* with one primary button, never two.
- **Navigation must not grow.** Seven top-level areas is the ceiling. The Islamic areas need to feel like the spine of the product, not two more menu items — I support a visually distinct nav group.
- Warning fatigue risk: Phase 5 stacks amber banners (unpriced + negative cash + mixed currency = three banners). Collapse into one attention summary with expandable details.

My conflict with the Bloomberg reviewer is density. I'll lose that fight partially and I should — but the *default* must remain comfortable, and compact must be a remembered preference, not a mode people fall into by accident."

### 2.3 Design Systems Engineer (Stripe school) — tokens, components, scale

"The mechanism is right (CSS variables → `@theme` → utilities) and the values are wrong. Plan:

- **Two-layer tokens**: primitives (`--green-600`, `--sand-100`, full scales) → semantic aliases (`--surface-raised`, `--text-figure`, `--pnl-positive`, `--compliance-ok`). Components consume only semantics. Dark mode = swapping the alias layer under `[data-theme="dark"]` — zero component changes. This is a day of work now and a month saved later.
- **Numeric typography is a token concern**: `--font-figure` styles bundle `font-variant-numeric: tabular-nums`, defined sizes/weights for figure-xl (hero), figure-lg (stat), figure (cell), figure-sm (secondary). Geist supports tabular numerals; no new font needed.
- **The financial table is the flagship component** and must be built once, properly: column definition API, right-aligned numeric cells, sticky header, footer aggregate row, density variants, cell renderers (`MoneyCell`, `DeltaCell`, `BadgeCell`, `ProvenanceCell`). Every current table migrates onto it.
- **Form primitives already exist and are fine** — they need token updates, error/description slots standardized, and a `Field` wrapper to stop label/help/error markup drift (it's already drifting across five forms).
- **Depth model: borders first, shadows second.** One border color per theme, two shadow elevations total (overlay, popover). Delete per-component shadow improvisation.
- Accessibility is enforced at the primitive level (focus rings, target sizes, aria wiring) so pages inherit it.
- One rule I want written down: **no component defines its own colors.** If a page needs a color that has no semantic token, the design is wrong or the token set is incomplete."

### 2.4 Data Visualization Designer (Bloomberg/Koyfin school) — financial density & charts

"Where's the data? A wealth platform's dashboard should feel like standing in front of your holdings. Current charts are decorative. My spec:

- **Retire the donut.** Its center is dead space and angle comparison is the weakest perceptual task. The signature allocation visual becomes the **segmented horizontal bar** (100% stacked, labeled segments, compliance overlay mode) — denser, more legible, and ownable.
- **Chart contract**: one ink color for primary series (theme ink, not brand green — green is data, not chrome), dashed gray for benchmarks, area fills ≤8% opacity, no dots on lines, no legends when direct labeling fits, one shared tooltip component, y-axes with compact currency formatting, and every chart carries an as-of caption. Charts are for *reading*, identity lives in chrome.
- **P&L color discipline**: market green/red pair reserved exclusively for signed financial deltas, always accompanied by +/− (never color-only). These are *data colors*, distinct from brand emerald in both saturation and usage.
- **Tables are the primary visualization.** Sortable, sticky, totals row, sparkline column (position trend once history lands in M2). The Positions table should survive 100 rows.
- Numbers formatting standard: thousands separators everywhere, 2dp money, 4dp unit prices, compact notation (1.2M) only on axis labels, never in tables.
- What I concede to Notion: no multi-pane terminal layouts, no blinking anything. Density through information design, not clutter."

### 2.5 Senior Apple-school Designer — polish, motion, feel

"Premium is the accumulation of small correctnesses. Current app: static dialogs, uneven paddings (p-4/p-5 mixed on sibling cards), truncation without tooltips, focus states inconsistent between custom chips and inputs. My rules:

- **Motion system, four verbs only**: *appear* (fade+scale 0.98→1, 160ms, ease-out) for overlays; *slide* (240ms, decelerate) for drawers/sheets; *settle* (tabular digits crossfade 120ms) for updating figures; *nudge* (4px shake, 3 cycles) for rejected submissions. Nothing else animates. `prefers-reduced-motion` collapses all to opacity.
- **The moment of truth is saving a transaction.** The dialog shouldn't vanish — the toast confirms, and the new row *settles* into the table with a brief highlight that fades over 2s. The user should *see* their ledger accept the entry. That single detail sells the engine.
- **Spacing grid**: 4px base; card padding 20px always; section rhythm 24/32; page gutters 16 (mobile) / 32 (desktop). Audit every `p-*` against this.
- **Touch**: 44px minimum targets (several icon buttons are 36px), bottom-sheet drag affordance, safe-area insets, numeric keyboards (done), and the bottom tab bar on mobile — a FAB floating over content is a band-aid.
- Details ledger: currency symbols set slightly lighter than figures; timestamps in small-caps-feel gray; brass accent only at sacred moments. Restraint *is* the polish."

### 2.6 Islamic Finance Product Advisor — trust, not decoration

"The MVP's honesty is its best Islamic feature — 'Not screened' instead of fake green was exactly right. The redesign must elevate ethics into identity:

- **The Islamic identity is behavioral, not ornamental.** It shows up as: numbers that never lie (provenance), obligations that are never buried (zakat/purification in the attention queue with real dates), boundaries that are structural (no short/leverage anywhere), and language that is precise (hawl, nisab, purification — with definitions, in respectful register).
- **Sacred moments deserve distinct treatment.** Recording a zakat or purification payment is worship. Give it the product's only 'ceremony': the brass accent, a completion state with a short du'a line, and a permanent, beautiful record (the future statement). Never confetti. Gravity, not celebration.
- **Pattern policy**: the 8-point star geometry may appear in exactly three places — empty states (existing), the zakat/purification completion state, and printed/exported statements. Never as page wallpaper, never on data surfaces. If someone screenshots the Positions table, nothing 'Islamic-themed' should be visible — the Islam is in the *shield column and the purification ledger existing at all*.
- **Compliance visual grammar** must be unmistakable and color-independent: shield icons — filled (compliant), half (doubtful), slashed (non-compliant), outline (not screened) — always with text labels. I endorse separating this entirely from P&L colors.
- **Fake certainty remains forbidden**: screening chips carry method + date on hover once M3 lands; until then 'Not screened' stays. The disclaimer appears at compliance surfaces, styled with dignity (not a scary yellow box).
- Premium and Islamic are not in tension — think of the best Islamic institutions: restraint, geometry, light, generosity of space. That's this design."

### 2.7 Institutional Portfolio Manager / Wealth Account Manager — the decisive challenge

"I manage family money. Here's my honest read of the current product, question by question:

- **Would I trust this interface with millions?** Not yet. It's tidy, but trust markers are missing: no as-of on figures, no source attribution, no audit visibility, no statement output. Trust is built by the interface *showing its work*.
- **Can I review a portfolio in 60 seconds?** No. I'd need Positions + Cash + History + Settings→Brokers. I need ONE screen: total value, period change, cash by currency and account, top exposures, unrealized/realized/income split, compliance state, upcoming obligations, and anything abnormal. That's the dashboard spec. Time it.
- **Can I explain performance to a family member?** No. P&L exists but attribution doesn't: what came from which position, what from income, what did fees eat, what's FX noise vs. real return (M2 dependency, fine — but the *layout* must reserve the seat now).
- **Can I trust the numbers?** The engine underneath, yes — trial recompute and no-shorts is institutional thinking. The surface doesn't communicate it. I want: provenance on hover for any figure ('Price: Yahoo 12:31 · manual override' / 'Computed from 4 transactions, average cost'), visible recompute integrity, and the audit trail the moment M5 lands. **'Every number can explain itself' — build that and you have my trust.**
- **Cash, exposure, risk, income, zakat, compliance — visible?** Cash: good bones, needs statement-style running balances per account. Exposure: nothing — I need top-position weight, sector/currency concentration at a glance. Income: buried in History. Zakat: the tracker (M4) will do it; reserve its dashboard slot now.
- **Accounts are not a settings page.** Brokers as a CRUD table in Settings is backwards. Accounts are a *dimension of the portfolio* — I think in accounts all day. Wealth must group/filter by account natively.
- **Is it beautiful or useful?** Currently: pleasant and shallow. Fix the dashboard, the provenance, the tables, and account-centricity, and it becomes the thing I'd actually open every morning — which no consumer app and no terminal currently gives me for *family* wealth with zakat.

Do not build me a Bloomberg. I left that. Build me the calm version that respects my intelligence."

---

## 3. Conflicts between the experts

| # | Conflict | Sides | Resolution (final) |
| --- | --- | --- | --- |
| 1 | Density vs. calm | Bloomberg+PM want compact truth; Notion wants air | Density is a **user preference on tables only** (comfortable default, compact remembered); page layout stays calm. Dashboard resolves it by hierarchy, not crowding |
| 2 | FAB vs. command palette | Linear: ⌘K; Apple: bottom tab bar; current: FAB | Desktop: ⌘K + header button, FAB removed. Mobile: bottom tab bar with center **+**. FAB deleted everywhere |
| 3 | Green semantics | Brand vs. halal vs. profit all emerald | Three grammars: **brand emerald** (chrome, actions), **market green/red** (signed deltas only, always with +/−), **compliance shields** (icon+label grammar, color secondary). No surface uses two for the same meaning |
| 4 | Donut vs. bar | Dataviz kills donuts; current app has three | Donut retired. **Segmented horizontal allocation bar** becomes a signature component |
| 5 | Serif gravitas vs. single-font system | Apple flirted with a display serif; Stripe refused a second font | Sans-only (Geist). Gravitas via the figure type scale, weight discipline, and space. Arabic type revisited at the RTL milestone |
| 6 | Sand warmth vs. institutional neutrality | PM: "wellness app"; Notion: warmth is the identity | Keep warmth, add authority: light mode moves from beige toward **warm paper** (less yellow, more contrast); **dark mode ships as the co-equal 'night desk' theme** and carries the institutional register |
| 7 | Brokers in Settings vs. accounts as structure | PM adamant | PM wins. **Accounts become a first-class dimension of Wealth** (view/filter/group); Settings keeps only account editing |
| 8 | 'Portfolio' vs. 'Wealth' naming | Notion: familiar; identity: differentiating | **Wealth** as the nav label (route `/portfolio` unchanged); the word states the product's ambition |
| 9 | Ceremony vs. restraint | Advisor wants sacred moments; Apple warns against theatrics | One ceremony only (zakat/purification completion), brass-accented, motionless gravity. Everything else stays quiet |

---

## 4. Final design decision — Design Director × Institutional PM

**The product we are designing is a private wealth desk for the Muslim household.** Not a trading toy, not a terminal, not a wellness app. Every decision filters through four tests, in order:

1. **Truth test (PM):** does this surface make the numbers more trustworthy — aligned, sourced, timestamped, explainable?
2. **Calm test (Notion/Apple):** is there one focal point; does it work at 11pm after a long day?
3. **Amanah test (Advisor):** does it treat wealth as a trust — obligations visible, boundaries structural, certainty never faked?
4. **Speed test (Linear):** is the frequent path keyboard-fast and sub-30-seconds?

**The one-sentence direction:** *calm surfaces, truthful figures, structural Islam.*
**The flagship commitment** (the PM's condition for trust, adopted product-wide): **every number can explain itself** — any money figure offers provenance on hover/tap: its source, its timestamp, **the actor who recorded it** (◇ A4/CIO condition 3), and what it was computed from. ◇ A4: provenance is **quiet by default** — visible indicators appear only for exceptional states (stale, manual, overridden, reconciliation-pending); trust whispers, only exceptions speak. Enabled on Wealth + Home first, long-tail surfaces follow.

The current UI is **replaced at the visual layer, preserved at the structural layer** (verdict from §1 stands). Implementation proceeds in the six design phases of §28, each shippable, none blocking milestone work (M2 can proceed in parallel after Phase D1).

## 5. Product identity direction

- **Design language name:** **Amanah** (the trust) — wealth held in stewardship. The name is internal vocabulary that keeps decisions honest: "is this amanah or is this decoration?"
- **Personality:** a private banker who prays — precise, unhurried, discreet, incorruptible. Never gamified, never preachy, never loud.
- **Identity carriers** (in priority order): (1) truthful figures and provenance, (2) the compliance shield grammar and the purification ledger, (3) the warm-paper/night-desk dual themes, (4) the brass sacred-moment accent, (5) the 8-point star at its three permitted sites.
- **Anti-patterns (banned):** confetti/streaks/badges-of-engagement, crescent-and-dome clichés, decorative Arabic used as texture, red/green screen floods, dark-pattern upsells, fake precision (unsourced numbers).

## 6. Visual language

**Typography**
- Family: **Geist Sans** only (already shipped). Geist Mono reserved for raw ids/hashes, not money.
- Text scale: 12 / 13 / 14 (base) / 16 / 18 / 24 / 30 — nothing else.
- **Figure scale (new, the heart of the redesign):** all money/quantity rendering uses `tabular-nums` + defined styles: `figure-xl` 30px/semibold (page hero), `figure-lg` 20px/semibold (stat cards), `figure` 14px/medium (table cells), `figure-sm` 12px/regular (secondary). Currency codes render 1 step smaller and lighter than their figure. Negative values always carry −, positives in delta contexts always carry +.
- Labels/microcopy: 11–12px, uppercase tracking only for table headers and stat labels (existing habit, kept).

**Color** (semantic layer; primitives are full 50–950 scales)

| Semantic | Light | Dark | Use |
| --- | --- | --- | --- |
| `surface-page` | warm paper `#F6F5F1` | night `#101413` | page background |
| `surface-raised` | `#FFFFFF` | `#181D1B` | cards, tables |
| `surface-sunken` | `#EFEDE7` | `#0B0E0D` | wells, code, input bg (dark) |
| `ink` / `ink-muted` / `ink-faint` | `#1A1D1B` / `#5A5F5B` / `#8A8F8A` | `#ECEEEC` / `#A5ABA6` / `#6E736F` | text hierarchy (all AA on their surfaces) |
| `brand` | emerald `#0A6C52` | emerald `#3BA98A` | actions, links, focus, active nav |
| `pnl-up` / `pnl-down` | `#177A45` / `#B93A31` | `#4CC38A` / `#E5645A` | signed deltas ONLY |
| `compliance-*` | shield states: ok `#0A6C52`, doubtful `#9A6B15`, blocked `#B93A31`, unknown `ink-faint` | tuned equivs | always icon+label |
| `sacred` | brass `#8C6D2F` | brass `#C9A96A` | zakat/purification moments only |
| `border` / `border-strong` | `#E4E1D8` / `#CFCBBE` | `#242A27` / `#333A36` | depth model |
| `warn` / `danger` surfaces | amber/red tints | desaturated equivs | banners, destructive |

- **Dark mode is co-equal**, not an afterthought: shipped in Phase D1, toggle in sidebar + `⌘K`, respects system default, persisted per user.

**Spacing:** 4px grid. Card padding 20. Section gaps 24/32. Page gutters 16/32. Table rows: comfortable 44px / compact 32px.
**Radius:** 8 (cards, dialogs), 6 (inputs, buttons), 4 (chips, table controls), full (pills/avatars). Down from today's 10–12: a click more serious.
**Shadows:** exactly two — `overlay` (dialogs/drawers) and `popover` (menus/tooltips). Cards use **border, not shadow**.
**Borders:** 1px, one color per theme; `border-strong` for interactive affordance (inputs, hovered rows).
**Icons:** Lucide (kept), 16px in text/tables, 20px nav, 1.5px stroke; the **compliance shield set** is the only custom icon work.
**Motion:** the four verbs from §2.5 (appear/slide/settle/nudge); durations 120–240ms; ease-out enter, ease-in exit; `prefers-reduced-motion` → opacity-only.

## 7. Layout system

- **Desktop (≥1024):** icon-capable sidebar 240px (collapsible to 64px rail, persisted), slim topbar (breadcrumb/page title · global search field invoking ⌘K · theme toggle · Add Transaction button), content max 1280px except tables may bleed to 1440. Right-side drawers 480px.
- **Tablet (640–1024):** sidebar starts as rail; topbar persists; tables scroll within cards; drawers full-height 420px.
- **Mobile (<640):** **bottom tab bar** — Home · Wealth · **+** (center, raised, opens transaction sheet) · Zakat · More (sheet with remaining nav). Top bar reduces to title + search icon. Drawers become bottom sheets with drag handle. FAB deleted.
- **Command menu (⌘K / Ctrl-K / mobile search icon):** sections — Assets (live search → screening card → Buy/Watch), Actions (Add transaction, Refresh prices, Record zakat payment…), Navigate, Recent. Single component, fed by the existing search API + a static action registry.
- **Quick actions:** `N` new transaction, `G then P/H/Z/J` navigation chords, `/` focuses search, `?` shortcut sheet.

## 8. New navigation architecture

```
Sidebar (grouped):                                            ◇ A1 (Council)
  OVERVIEW      Home           (the Morning Review)
  WEALTH        Wealth         (route /portfolio: Positions · Accounts · Cash · Income · Activity)
  THINKING      Research       (Inbox · Theses · Journal — absorbs the Journal area; see
                                Council review §5–6. Journal rebuild remains Phase 7 scope,
                                landing under this area; Research Desk v1 = milestone M5.5)
  PURITY ◆      Zakat & Purify
                Screener       (absorbs Watchlist as its second tab — see §18)
  UNDERSTAND    Insights       (Performance · Income · Behavior · Reports — redesigned in D6)
  —             Settings
```
- The **Purity group** is visually distinct (hairline separator + shield glyph): the Islamic spine made structural, not two more menu rows.
- Legacy pages during transition (Trades, Calendar, Watchlist, Shariah, Zakat) remain reachable but re-skinned by tokens automatically; their redesigns land in D5/D6 + Phases 6–8. Dashboard/Analytics rebuilt in D4/D6 on ledger data (merging with milestone Phase 6 scope).

## 9. Dashboard redesign — "the 60-second review"

Organizing principle: the PM's six questions, answered top-to-bottom with strict hierarchy.

1. **Wealth strip** (hero): total per currency in `figure-xl` with settle animation, period change (`pnl-*`, one **global period selector** D/W/M/YTD/1Y shared across Home/Wealth/Insights), tiny sparkline, as-of + provenance. ◇ A2 + CIO condition 1: all period/performance figures **require the daily valuation snapshot series (hard M2 requirement)** — until it exists these slots render "insufficient history," never an approximation.
2. **Attention queue** (the product's pulse; single component, replaces banner stacks): zakat hawl countdown, unpaid purification, non-compliant/unscreened holdings, reconciliation due, stale prices, negative cash, unannotated trades, research follow-ups — each row = icon + one line + one action. ◇ A5: severity tiers (obligation > integrity > data-freshness > housekeeping), max 5 visible + "view all"; items are snoozable *except obligations*, which can only be honestly rescheduled. Empty state: "All quiet, alhamdulillah." — the only place the product speaks like that.
3. **Exposure band**: signature allocation bar (by asset/class/account/label toggle — one grouping-dimension system), top-3 concentration figures, compliance shield summary. ◇ A6: the bar rolls up beyond top-8 into an expandable "other"; the band additionally shows **liquidity split** (listed vs unlisted) and **currency split** — with real estate/PE incoming, hiding illiquidity is not a risk view.
4. **Flows row**: cash by currency+account (mini statement), income (dividends MTD/YTD + purification owed), zakat tile (accrual estimate + hawl date — brass-tinted, links to tracker).
5. **Recent activity** (5 rows, ledger-real) + insight cards (existing rule-based, restyled, max 3).
Legacy-data notice disappears with this page (it becomes ledger-native — this is milestone Phase 6 work fused with design D4).

## 10. Wealth page redesign

- Header: portfolio switcher (+ account filter chips — the PM's dimension: `All accounts · IBKR · Sarwa +`), totals per currency with provenance, refresh with per-source freshness popover, Add Transaction.
- Tabs: **Positions · Accounts · Cash · Income · Activity** (Income = milestone Phase 6 scope wearing this design; Activity = renamed History).
- **Positions:** flagship table (§22) — sticky header, footer totals, density toggle, columns: Asset (symbol+name+tier chip) / Qty / Avg cost / Price (+freshness dot) / Value / Day Δ (M2 slot) / Unrealized (+%) / Realized / Income / Weight / Shield. Row → drawer (§12). Group-by-account view option.
- **Accounts (new):** one card per broker account — holdings value, cash, currency, positions count, last activity → filters all tabs to that account. Settings keeps only the edit forms.
- **Cash:** statement layout per currency: opening (period) → signed events with **running balance** → closing; account column; negative balances red with the standing suggestion.
- **Activity:** current History on the new table, plus month group headers and a fees-total footer.

## 11. Add Transaction redesign

Keep the working dialog (it's correct); elevate its form and feel:
- **Entry:** ⌘K "buy…", `N`, header button, mobile center-tab. Desktop: dialog 560px; mobile: full sheet.
- **Layout:** type switcher becomes a single compact segmented row (Buy · Sell · Div · Cash ▾ · Obligation ▾) — one line, not four; Buy preselected, cursor in asset search.
- **The ticket line (new):** live summary above the footer, in figures: *"Buy 1,000 EMAAR @ 12.10 — AED 12,120.00 incl. AED 20 fees · Personal / IBKR · 8 Jul"*. The user confirms a sentence, not a form. For sells it carries the P&L preview. This line becomes the toast content on save.
- **Save moment:** dialog closes → row settles into the table with 2s highlight (§2.5). Errors: nudge + verbatim engine message (kept).
- Sacred payment types keep their copy; confirmation for them uses the brass accent.
- Asset search: results table-aligned (symbol / name / exchange / ccy columns), shield placeholder per row, warned rows amber with the confirm step (all existing logic kept — this is styling + keyboard polish only).

## 12. Asset detail drawer

480px drawer (bottom sheet on mobile), three zones:
1. **Identity:** symbol, name, exchange · ccy, tier chip, shield with method/date tooltip, price + freshness + provenance ("Yahoo · 12:31" / "manual — you, 3 Jul · 'ADX close'").
2. **Position figures:** 2-col stat grid in `figure-lg` — value, unrealized (+%), realized, income, qty, avg cost, cost basis, weight. Each figure provenance-enabled.
3. **Ledger:** replay list (kept) restyled as a timeline with type glyphs; per-sell P&L; row actions edit/delete. Footer: Buy · Sell · Dividend · Set price/override.
Full asset *page* (fundamentals, history chart, screening detail) is deliberately deferred to M3.

## 13. Broker account design

- Account card: name + country flag-dot, masked account no., currency, figures row (value · cash · positions), last activity, subtle brand-letter avatar. No logos scraping — typographic avatars.
- Account filter chips across Wealth; per-account cash statement; transaction rows show account chip.
- Settings → Accounts: the CRUD forms (existing) restyled; delete keeps the history-preserving copy.

## 14. Cash ledger design

Statement-first (§10): running balance, signed figures, account + type glyphs, per-currency sections, monthly group headers, export seat (M4). Zakat/purification payments render with the brass glyph — visible acts of worship inside the money statement, which is exactly the amanah identity.

## 15. Zakat & purification design (design now, full engine M4)

- **Tracker header:** hawl progress ring (the one permitted circular chart — it's a *calendar*, not a comparison), nisab status vs live metal prices (M2), accrual estimate in brass-tinted card.
- **Purification ledger:** obligations table (source event → amount → status), "mark paid" flow.
- **The ceremony:** on recording payment — full-surface quiet state, 8-point star watermark, brass rule line, amount in `figure-xl`, one line: *"May Allah accept it from you."*, then the permanent record row. No animation beyond a slow fade-in.
- Calculator (existing) restyled as the "what-if" mode; per-field fiqh help kept verbatim (it's excellent).

## 16. Shariah screening design (design now, engine M3)

- **Screening card** (the M3 centerpiece, spec'd today): shield verdict header; three ratio gauges as **horizontal threshold bars** (value marker vs limit line — not radial); business-activity warning chips; purification %; method + data date footer; disclaimer in the dignified style; actions Buy/Watch/Override.
- Override flow: reason required (kept), result badged `override` everywhere, shield gets a small user-dot.
- Screener page: search-first hero + results as screening rows; **Watchlist becomes tab two** of this page (see §18).

## 17. Analytics & reporting design (D6; data arrives M2/M5)

- Insights page: Performance (equity curve vs **portfolio-level halal benchmark** — a setting, default SPUS-class index, not a per-chart choice; monthly bars, drawdown — chart contract §23), Income, Behavior (existing psychology analytics restyled; persona-gated), Reports.
- ◇ A7: **Income calendar committed** — month grid of received + forecast dividends **with forecast purification alongside** (brass-marked). Forecasts from dividend history/declared yields (M5); the calendar is expected to be the product's most-screenshotted surface.
- ◇ A8: **Reports are first-class objects** (generated, persisted, listed, regenerable): zakat statement, performance review, activity/tax export, diversity & risk reports (concentration/liquidity/currency/compliance). Print stylesheet ships in D6 — CIO condition 4: statements must stand alone for a reader with no app access.
- Attribution table (PM): per-position contribution — price return / income / fees, per currency. Layout reserved even while FX-dependent columns wait for M2.

## 18. Watchlist design

Merged as **Screener → Watchlist tab**: the pre-trade workspace (advisor: "screen before you love it"). Table on the flagship component: symbol / shield / target vs current (+distance %) / risk chip / note / added. "At target ∧ compliant" rows get the only green row-tint in the product. Alerts delivery remains M2.

## 19. Empty states

Kept as the onboarding layer; standardized: pattern background (permitted site), one icon, one sentence of *why this screen will matter*, ONE primary action. Every screen defined: Home ("Your wealth desk is ready — record your first transaction"), Positions, Cash, Activity, Accounts ("Add the account you actually trade through"), Watchlist, Zakat ("Set your hawl date — we'll carry the year for you"), Insights (needs n≥5 events). Beginner glossary links where terms first appear.

## 20. Error states

- Form: inline under field, `danger` text + icon, nudge on submit.
- Engine rejections: form-level alert, verbatim message, never toast-only.
- Page: friendly boundary with retry (kept) restyled; ledger-not-initialized screen kept.
- Data-source degraded: freshness dots turn amber + one attention-queue row — never a modal.
- Destructive confirms: typed noun for account deletion only; standard confirm for rows.

## 21. Loading states

- First paint: skeletons ONLY for figure blocks and table rows (shaped like the real content, 1.2s shimmer).
- Navigation: instant shell, streamed content (server components already give this).
- Actions: button spinners (kept); table refresh = freshness dot pulse, not table blanking.
- Never a full-page spinner anywhere.

## 22. Financial data table design (flagship component)

- Anatomy: toolbar (filters · density · export seat) / sticky header (11px caps, sort affordances) / rows (44/32px) / footer aggregates (sum/avg where meaningful, always labeled).
- Cells: `MoneyCell` (right-aligned, tabular, ccy code light), `DeltaCell` (sign+color+optional %), `QtyCell` (4dp trim), `BadgeCell`, `ShieldCell`, `ProvenanceCell` (freshness dot + hover popover), `ActionsCell` (hover-reveal).
- Behavior: row hover raise (border-strong), keyboard row focus + Enter to open, click-through targets ≥44px, mobile transform to defined card mapping (primary figure top-right rule).
- All seven existing tables migrate onto it in their respective phases.

## 23. Charts & visualization style guide

Contract (all charts): ink primary line 1.5px; benchmark dashed `ink-faint`; area fill ≤8%; grid horizontal-only hairlines; no dots except single-point hover; shared tooltip (surface-raised, figures in tabular); axis text 11px `ink-muted`, compact currency; as-of caption bottom-right; empty and insufficient-data states designed; `pnl-*` colors only for signed series; allocation = segmented bar (donut banned); calendar heatmap keeps 5-step tint ramp; hawl ring is the sole radial. Recharts stays as the engine — this is a wrapper layer (`components/charts/` rebuilt once, in D6).

## 24. Islamic design guidelines

1. Identity through **behavior**: provenance, visible obligations, structural boundaries, precise respectful language. If the Islam is only visible in decoration, we have failed.
2. Pattern (8-point star): three permitted sites only — empty states, zakat/purification completion, exported statements. Never behind data.
3. Brass `sacred` accent: zakat/purification surfaces and moments only. Never for emphasis elsewhere.
4. Language: Arabic terms in italic-free roman with first-use definitions; du'a lines only at the ceremony and the all-clear queue state; no Quranic verses as UI copy (respect > branding).
5. No crescents, domes, lanterns, prayer-bead imagery. No "halal = green everywhere" — compliance is the shield grammar.
6. The disclaimer is part of the identity: present, dignified, never a scare-box.

## 25. Component library plan

| Component | Status | Phase |
| --- | --- | --- |
| Tokens v2 (2-layer, dual theme) | rebuild values | D1 |
| Button/Input/Select/Dialog/Sheet/Toast/Badge | re-token + Field wrapper + motion | D1 |
| `Figure` (money text primitive w/ provenance slot) | **new** | D1 |
| `FinTable` + cell renderers | **new (flagship)** | D2 |
| `StatBlock` / metric card (figure-lg + delta + provenance) | **new** | D2 |
| `AllocationBar` (segmented, signature) | **new** | D2 |
| `AttentionQueue` | **new** | D4 |
| `ShieldBadge` (compliance grammar + custom icons) | **new** | D1 (icons) / used D2+ |
| `ProvenancePopover` | **new** | D2 |
| `CommandMenu` (⌘K) | **new** | D1 |
| `BottomTabBar` (mobile) | **new** | D1 |
| Drawer/timeline (asset detail restyle) | restyle | D2 |
| `TicketLine` (transaction summary) | **new** | D3 |
| Charts wrapper set (line/bars/heatmap/hawl-ring/threshold-gauge) | rebuild | D6 (gauge D5) |
| `CeremonyState` (sacred completion) | **new** | D5 |
| Filters row / density toggle / group headers | **new** | D2 |

## 26. Motion design rules

Four verbs only (§6): appear 160ms / slide 240ms / settle 120ms / nudge 3×4px. Stagger children max 40ms, lists cap at 6 staggered rows. Numbers never tick-animate on load — settle is for *changes* while watching. Zero motion on: shields, disclaimers, sacred surfaces (fade only). Reduced-motion collapses everything to ≤120ms opacity. Implementation: CSS transitions + Tailwind utilities; **no animation library**.

## 27. Accessibility rules

- AA contrast enforced at token level (both themes, checked before merge — the current `ink-muted`-on-sand near-miss gets fixed by the new values).
- Never color-alone: deltas carry signs, shields carry labels, freshness dots carry tooltips+sr-text.
- Focus visible on every interactive element incl. table rows and chips (one ring token).
- Full keyboard map (§7) documented in the `?` sheet; dialogs trap focus, return focus, dirty-confirm on Esc (existing behavior kept).
- Targets ≥44px touch / ≥24px pointer; tables get row-level focus, not cell-maze.
- `aria-live` on toasts (exists), attention queue count, and figure settles (polite).
- Screen-reader money format: full words ("12,120 dirhams, up 290") via aria-label on Figure.

## 28. Implementation roadmap (design phases)

| Phase | Contents | Touches | Risk |
| --- | --- | --- | --- |
| **D1a — Tokens & primitives** ◇ A3 | Token v2 values (incl. brass/amber separation, contrast-gated) + dual themes + toggle; Figure primitive (+actor-aware provenance slot); re-tokened primitives + Field; motion verbs; qty/percent formatting rules | globals.css, ui/*, format | Visual regression across every page — mitigated by semantic-alias mapping from old names |
| **D1b — Shell & command** ◇ A3 | Sidebar groups (§8 incl. THINKING/Research) + topbar; ⌘K (assets/actions/navigate, ≤15 actions); mobile bottom tabs (FAB removed); shield icon set; glossary registry | layout, sidebar, command | Isolated from D1a; independently shippable |
| **D2 — Wealth redesign** | FinTable + cells + density; StatBlock; AllocationBar; ProvenancePopover; Wealth header + Accounts tab; Cash statement; drawer restyle | portfolio/*, components/portfolio | Largest phase; table migration is mechanical after FinTable exists |
| **D3 — Transaction flow** | Dialog compaction; TicketLine; save-settle moment; keyboard completeness; search-row alignment | components/transactions | Low — logic untouched |
| **D4 — Dashboard** | 60-second review layout; AttentionQueue; wealth strip; exposure band; ledger-native data (fuses milestone Phase 6 dashboard scope) | dashboard | Depends on D2 components |
| **D5 — Islamic finance center** | Zakat tracker/purification design + ceremony; screening card + threshold gauges; Screener+Watchlist merge; disclaimer restyle | zakat, shariah, watchlist | Partial until M3/M4 engines; ships with honest placeholders |
| **D6 — Analytics/reporting** | Charts wrapper set on the contract; Insights layout; attribution + reports seats | analytics/insights | Blocked on M2 history for full value; contract & wrappers land regardless |

Sequencing with milestones: D1a → D1b → D2 → D3 ship consecutively; M2 (market data/cron/FX **+ the daily valuation snapshot series — hard requirement ◇ A2**) can run in parallel after D1a; D4 fuses with milestone Phase 6; D5 pairs with M3/M4 (**reconciliation ships with M4 import — CIO condition 2**); D6 with M2/M5 data. ◇ A9 roadmap inserts: **M5.5 Research Desk v1** (items, theses with revision history, inbox, attachments, universal labels/notes — no AI); M6 gains the AI research layer under the adab rules; post-1.0 gains **Household** (sharing, family/advisor roles, wasiyya seat). Full Research System design: Council review §6.

## 29. What NOT to build yet

Custom theming beyond the two themes · dashboard customization/drag-drop · a charting engine (Recharts wrapped, not replaced) · animation library · full asset pages · PDF/statement engine (M4) · notifications UI (M2 scope) · AI surfaces (M6) · white-label/multi-tenant styling · icon font / custom typeface commissioning · marketing-site redesign (separate effort after D4 screenshots exist).

## 30. Final checklist before writing code

- [ ] Product owner approves this direction **and the Council Final Review** (naming: **Wealth** label, **Purity** + **THINKING/Research** nav groups, **Amanah** internal language).
- [ ] The five CIO conditions acknowledged as binding (valuation series before performance figures; reconciliation with import; actor in provenance; standalone statements; the covenant as written policy).
- [ ] Confirm the two names above or supply alternatives — they appear in D1 code.
- [ ] Token values reviewed once against a real screen mock (one Wealth-page sample render in both themes before mass application).
- [ ] Contrast-check pass on the §6 palette (automated, both themes).
- [ ] FinTable column/cell API sketched and reviewed before D2 begins.
- [ ] Agreement that Phase 5 flows are the regression baseline: golden-path buy, ADIB flow, sell preview parity must behave identically after every design phase.
- [ ] Screenshot baseline captured (current UI, both breakpoints) for before/after honesty.
- [ ] Confirm D-phase order vs. milestone pressure (recommended: D1+D2 before M2 UI surfaces, so new data lands on new tables).

---

*End of Design Sprint 1. Awaiting approval — no implementation until the product owner signs off on §4–§8 and the checklist above.*
