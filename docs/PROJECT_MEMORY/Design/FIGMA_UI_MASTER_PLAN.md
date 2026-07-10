# The UI Master File — Tool Evaluation & Figma Migration Plan

Status: **Plan only — nothing implemented.** Authority: supplements AMANAH_DESIGN_SYSTEM.md (which remains design law); logged as D-017.
Scope: choose the long-term design environment for Humaid Wealth OS; if Figma, define the complete project architecture so the UI system scales for years without redesign.

---

## 1. Council evaluation — Canva vs Figma

Criteria scored against *production UI system* needs (not presentation needs):

| Criterion | Canva | Figma | Notes |
| --- | --- | --- | --- |
| Design systems / published libraries | Weak (brand kits ≈ colors/fonts/logos) | **Purpose-built** (team libraries, publish/subscribe, swap) | Decisive |
| Components with variants & properties | Basic groups/templates | **Variants, component properties, slots, nested instances** | Decisive |
| Variables / design tokens | None (no token concept) | **Variables with modes** — one `semantic` collection flips Light/Dark exactly like our CSS `[data-theme]` | Decisive — our dual-theme architecture literally maps to Figma modes |
| Auto layout / constraints | Limited positioning | **Auto layout = flexbox** — mirrors our Tailwind structure 1:1 | Decisive |
| Responsive design | Manual per-size copies | Constraints + min/max + breakpoint frames | Clear |
| Developer handoff | None meaningful | **Dev Mode** (inspect, measurements, code snippets, Code Connect to our repo components) | Decisive |
| Version control | Linear history | **Branching + merge + library versioning** — maps to our D-phase workflow | Clear |
| Scalability / years of maintenance | Degrades into page sprawl | Library-first; refactor via component swap | Clear |
| Team collaboration | Good for docs | Industry standard for product teams; future hires assume it | Clear |
| AI workflows | Generation-oriented (what we just used, well) | **Figma MCP** (design context into AI dev), plugin API, token export | Clear |
| Presentations / marketing / documents | **Excellent** — where it just proved itself | Mediocre | Canva keeps this lane |

**Council voices (condensed):**

- **Design Director:** "Canva gave us a beautiful *argument* for the design. Figma is where the design *lives*. Different instruments; stop asking one to be the other."
- **Senior Product Designer:** "Variants and auto layout aren't features, they're the medium. Designing FinTable states in Canva means redrawing; in Figma it's a property switch. Over five years that's the difference between a system and a scrapbook."
- **Frontend Design Engineer (the load-bearing caveat):** "Yes, Figma — but hear this: **our code is already the most complete design artifact we own.** Tokens live in `globals.css`, components in `components/ui`, the laws in AMANAH. If Figma becomes a *second* source of truth, we will spend years reconciling drift. Condition: Figma **mirrors** code — same token names, same component names — and where they disagree, **code + AMANAH win**. Figma is the design workspace, not the constitution."
- **Design System Architect:** "Accepted, and I'll enforce it: token parity (Figma variables ≡ CSS custom properties, name-for-name) joins my quarterly audit. Also: we do *not* rebuild 39 screens in Figma up front — that's the Canva mistake in a new tool. The library is built completely; screens are built **just-in-time per D-phase**."
- **CIO:** "Approved with both conditions binding: code-canonical, and just-in-time screens. Canva is demoted to presentations, documentation, marketing, and investor material — where it performed excellently. One more condition: the Figma file must make the *trust furniture* first-class — shields, provenance popovers, freshness dots are library components, not screen decorations."

**VERDICT: Figma — unanimously, with three binding conditions:**
1. **Code-canonical:** Figma mirrors the repo (names identical); disagreements resolve toward code + AMANAH.
2. **Just-in-time screens:** foundations + library built fully; screen files grow with each D-phase, never speculatively.
3. **Canva demoted** to presentations / documentation / marketing / investor material only. The existing 34-page deck remains valuable as the *communication* artifact of AMANAH.

---

## 2. Figma project architecture

**Team:** `Humaid Wealth OS` → **Project:** `AMANAH Design System` — five files, strict roles:

```
📁 AMANAH Design System
├─ 01 · AMANAH Foundations      ← variables, styles, icons, laws (LIBRARY, published)
├─ 02 · AMANAH Components       ← the UI kit (LIBRARY, published)
├─ 03 · Screens — Desktop       ← per-area pages, grows per D-phase
├─ 04 · Screens — Mobile & Tablet
└─ 05 · Lab                     ← explorations; NEVER published, cleared quarterly
```

### File 01 — AMANAH Foundations (pages)
1. `Cover & Laws` — one-page condensation of AMANAH (five feelings, three green grammars, number laws) + links to the repo doc
2. `Variables` — documentation frames for every collection (see §3)
3. `Typography` — text styles incl. the Figure scale, with the tabular-numerals specimen
4. `Color` — swatch sheets rendering every semantic variable in both modes, token name + hex on each
5. `Spacing · Radius · Elevation` — the 4px grid, radius law, two shadows
6. `Iconography` — Lucide usage rules + the **shield set as components** (the only custom icons)
7. `Motion` — the four verbs, durations, reduced-motion rule (spec frames; prototype examples)

### File 02 — AMANAH Components (pages)
1. `_Cover & Changelog`
2. `Primitives` — Button, Input, Select, Field, Badge, Chip, Checkbox, Switch, Tabs
3. `Figures & Trust` — **Figure** (kind × size props), TrustChip, FreshnessDot, **ProvenancePopover**, ShieldBadge (4 states + `override` boolean) — the CIO's trust furniture, first-class
4. `FinTable` — Cell components (all 10 column types) → Row (density variants, hover/selected/focused states) → Header/Footer → assembled table examples
5. `Overlays` — Dialog, Sheet, Popover, Toast, Command Palette, the draft-guard confirm
6. `Cards & Blocks` — SummaryCard, StatBlock, AttentionQueue row, EmptyState, error banners
7. `Charts` — chart contract as styled examples: AllocationBar, performance curve, heatmap cell, threshold gauge, hawl ring (assets, not autogenerated)
8. `Navigation` — sidebar (grouped), bottom tab bar, topbar

### Files 03/04 — Screens (pages per area, mirroring the nav)
`Home` · `Wealth` · `Transactions` · `Journal & Research` · `Purity (Zakat/Purification/Screener)` · `Insights & Reports` · `Settings` · `States & Flows`. Each screen appears in the states that matter (default, empty, error, key interaction) — not every permutation.

---

## 3. Variables (design tokens) — mirrors `globals.css` name-for-name

| Collection | Modes | Contents (names identical to code) |
| --- | --- | --- |
| `primitives` | — | `p/paper/50…400`, `p/ink/400…900`, `p/night/600…950`, `p/mist/*`, `p/emerald/*`, `p/up`, `p/down`, `p/brass/*`, `p/warn/*` |
| `semantic` | **Light · Dark** | `surface/page`, `surface/raised`, `surface/sunken`, `ink`, `ink/muted`, `ink/faint`, `brand`, `brand/surface`, `pnl/up`, `pnl/down`, `compliance/ok|doubtful|blocked|unknown`, `sacred`, `sacred/surface`, `warn/*`, `danger/*`, `border`, `border/strong`, `ring` — aliases into `primitives`, exactly as the CSS alias layer works |
| `spacing` | — | `space/1…10` on the 4px grid; `gutter/mobile`, `gutter/desktop` |
| `radius` | — | `radius/sm=4`, `md=6`, `lg=8` |
| `density` | Comfortable · Compact | `row/height` (44/32), `cell/py` — table-only, matching the code |

Typography = **text styles** (Figma variables don't fully carry font features): `Display/30`, `Heading/24|18`, `Body/14`, `Caption/11`, `Figure/xl|lg|md|sm` (tabular numerals ON), `Mono/13`. Effects: exactly two shadow styles (`elevation/popover`, `elevation/overlay`).

**Parity rule (DSA-enforced, quarterly):** every semantic variable exists in `globals.css` and vice versa; a diff between the two is a defect with a name.

---

## 4. Naming conventions

- **Components:** `Category/Name` with variant properties, not name-suffixes — `Button` (props: `variant`, `size`, `state`), `ShieldBadge` (prop: `state: compliant|doubtful|nonCompliant|notReviewed`, `override: bool`), `Figure` (props: `kind`, `size`, `provenance: bool`). Component names = repo file names (`ShieldBadge` ↔ `shield-badge.tsx`) for Code Connect.
- **Theme is a MODE, never a variant** — no `Button/Dark` components, ever.
- **Screens/frames:** `{Area} / {Screen} — {state}` → `Wealth / Positions — default`, `Transactions / Buy — draft-guard`. Breakpoint in the frame size, not the name.
- **Pages:** numbered as in §2; `_` prefix = meta pages; `🧪` only in Lab.

## 5. Responsive strategy

- **Frames:** Desktop primary **1440** (design width; content max 1280 + rail 240 fits honestly) with a 1920 stress-check frame for Wealth and Dashboard only; Tablet **1024**; Mobile **430**.
- Auto layout everywhere; min/max widths on cards and table columns; tables get their mobile **card transform designed once** in Components and referenced, not re-invented per screen.
- A screen gets a second breakpoint frame **only when layout materially changes** (per the AMANAH responsive rules table) — otherwise the desktop frame + the rules suffice.

## 6. Developer handoff strategy

1. **Dev Mode** on for files 02–04; engineers inspect against token names they already have in code.
2. **Code Connect** (when the team grows): map library components to repo paths so Dev Mode shows real usage snippets.
3. **The handoff contract:** a screen is "ready for build" when it uses only published library components + semantic variables — any detached/raw-hex element blocks handoff (mirrors the code lint rule).
4. **AI workflow:** Figma MCP gives AI (me) read access to frames during D-phases — design context flows into implementation without screenshots. *Note: the Figma connector in this workspace is currently unauthenticated — authorize it via claude.ai connector settings before implementation begins.* Direction of generation stays **design→spec→code by hand**; no automated Figma-to-code, ever (condition 1 protects against its drift).
5. Small changes skip Figma entirely (code-first, then back-port to the library if the pattern is reusable) — the workspace serves the product, not the reverse.

## 7. Version control & library workflow

- **Branching per D-phase** (`D2-wealth`, `D4-dashboard`): design on branch → council/owner review → merge → **publish library with release notes** (one line per changed component, AMANAH register).
- Screens files consume the library; publishing is the only way styles reach screens.
- Quarterly DSA audit: token parity (Figma↔code), detached-instance sweep, Lab cleanup.

## 8. Migration steps (in order — executed when you say go, not now)

1. Create team/project/five files; set covers and page skeletons (½ day).
2. **Variables first:** transcribe `globals.css` primitives + semantic collections with Light/Dark modes; text styles; effects. Source: the code, not the Canva deck. (½–1 day)
3. **Foundations pages** from AMANAH doc §§1–10 (1 day).
4. **Components file:** primitives → trust furniture → FinTable cells/rows → overlays → charts-as-assets. Match the shipped Phase-5 components pixel-for-token first, *then* apply D2+ refinements on a branch. (2–3 days)
5. **Screens, just-in-time:** D2 begins by designing `Wealth / *` frames on the `D2-wealth` branch — the first real screens in the file. Canva deck pages 13–15 serve as directional reference only.
6. Demote Canva formally: deck retitled "AMANAH — Vision Deck (reference)"; all future *product UI* work in Figma; Canva reserved for decks/docs/marketing/investor material.
7. Log D-017; add the parity check to the DSA quarterly audit definition.

## 9. What NOT to do (the anti-plan)

No 39-screen upfront rebuild · no Figma-to-code generation · no second token vocabulary · no theme-as-variant components · no unpublished styles used in screens · no design work in Lab shipping directly · **no treating Figma as the constitution — AMANAH and the repo remain law.**
