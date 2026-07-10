# PROJECT_CONTEXT — What This Product Is

**Humaid is the Islamic Wealth Operating System** — a private wealth desk for the Muslim household. It began as a trading journal MVP; that framing is retired. The product is the layer between a Muslim and their money: tracking (portfolio), conscience (screening & purification), obligation (zakat), discipline (journal), and understanding (research & insights).

## Core users

- **Ahmed, the long-term halal investor** (primary, ~60%): DCAs into halal ETFs/stocks/sukuk; cares about compliance, zakat, and honest valuations, not day-trading.
- **Mariam, the active trader** (~25%): wants discipline — journaling, mistake patterns, screening *before* entry.
- **Yusuf, the beginner** (~15%, growth engine): needs guided onboarding and inline education; his first investment should be halal because we made that the easy path.
- Future (post-1.0 "Household"): family portfolios, advisor read-access.

## Product philosophy — Amanah (أمانة)

Wealth is a trust. The design language (see `docs/AMANAH_DESIGN_SYSTEM.md`) enforces five feelings in order: calm, trust, professionalism, precision, transparency. Never playful, never noisy, never gamified. One sentence: **calm surfaces, truthful figures, structural Islam.**

## The Irreplaceability Doctrine (Book / Conscience / Mind)

The product must own three records nothing else keeps together — every phase deepens at least one:

1. **The Book** — the reconciled, provenanced, engine-true ledger across brokers, currencies, and asset classes (listed and unlisted).
2. **The Conscience** — the continuous record of a Muslim investor's religious-financial life: screening history, purification obligations and settlements, every hawl and zakat statement.
3. **The Mind** — theses with revision history, research linked to decisions, the journal of why.

Full data export stays free forever: a record you can't take with you is a hostage, and hostages are resented, not missed.

## Ledger-first architecture

- **Holdings are computed, never entered.** Users record transactions (buy/sell/dividend/deposit/withdrawal/fee/zakat payment/purification payment/adjustment; split/transfers reserved); positions, cash, and P&L derive from the ledger via a pure, tested engine (`src/lib/engine/positions.ts`).
- **Instrument master:** every asset exists once (`assets`), provider-resolved (Yahoo default; Twelve Data/EODHD stubs) or manual/custom (ADX tier). Manual assets participate identically — the engine never sees `data_tier`.
- Services layer owns all business rules (trial-recompute validation: an impossible ledger is rejected before persistence). RLS everywhere; service-role key only for the instrument master + positions cache.
- Every number can explain itself: source · as-of · actor · derivation (provenance, quiet by default).

## Islamic finance boundaries (structural, not decorative)

- No margin, leverage, short selling, CFDs, futures, options trading — the engine rejects oversells; no UI pathway exists. (Derivatives may someday be *imported read-only*, always flagged non-compliant, never analyzable.)
- Compliance is honest-or-absent: "Not screened" until the M3 engine; overrides require a written reason.
- Zakat is a system (hawl, nisab, per-asset-class treatment), not a formula. Purification is a first-class obligation ledger.
- The standing disclaimer: personal tracking and education only; no fatwa; consult a qualified scholar.

## Research & WSJ legal boundaries

The Research system stores the user's URL, public page metadata (OG/title), and the user's own notes/attachments — **never publisher content**. Opening an article always links out (the user's subscription authenticates at the publisher). AI operates only on the user's notes, metadata, theses, and ledger; attachments excluded unless the user affirms rights. This is policy and identity: *"Your links, your notes, your thinking — the publisher's content stays with the publisher."*

## Long-term roadmap (summary)

- **M1 Ledger Foundation** — done (schema, engine, market data, services, Phase 5 "The Loop").
- **Design phases D1a–D6** (current track): tokens/themes → Wealth redesign → transaction flow → dashboard (fuses M-Phase 6) → Islamic center → analytics/reports.
- **M2** market data at scale: cron prices, FX, **daily valuation snapshot series (hard requirement — no performance figures before it)**, gold/silver for nisab, alerts.
- **M3** Shariah intelligence: automated AAOIFI ratio engine, screening cards, methodology settings.
- **M4** Zakat OS: hawl engine, per-class treatments, payments/statements, purification lifecycle, broker CSV import + **reconciliation** (CIO condition).
- **M5** insights/behavior + hardening (2FA, audit trail, real deletion). **M5.5 Research Desk** (items, theses w/ revisions, inbox — no AI).
- **M6** AI layer (explains/questions under adab rules; never computes) + Arabic/RTL. **M7** mobile PWA + billing → 1.0.
- Post-1.0: Household (sharing/roles/wasiyya seat), broker APIs, payment rails.
