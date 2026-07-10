# DECISIONS — Structured Decision Log

Format: `D-###` · date · decision · why · where it's binding. New entries append; reversals reference the original.

| ID | Date | Decision | Why | Authority |
| --- | --- | --- | --- | --- |
| D-001 | 2026-07-08 | **Holdings are computed from transactions, never manually entered.** Positions/cash/P&L derive from the ledger via the pure engine. | Kills double-entry; one source of truth; enables reconciliation, FIFO-later, audit. | M1 doc §1/§3 |
| D-002 | 2026-07-08 | **The ledger is the source of truth**; `positions` is a rebuildable cache; every mutation is validated by trial recompute before persistence. | The cache can never disagree with the engine; impossible ledgers are unrepresentable. | M1 doc §3.4; services |
| D-003 | 2026-07-08 | **Assets are a global instrument master** (one row per instrument; service-role writes only; per-user overrides with reasons). | Kills symbol-string duplication; single home for price/screening truth. | M1 doc §1.2–1.3 |
| D-004 | 2026-07-09 | **Every number must explain itself** — provenance (source · as-of · actor · derivation) on financial figures; quiet by default, exceptions speak. | The PM/CIO trust condition; trust is shown work. | Council §8 cond. 3; AMANAH §4.11/§9 |
| D-005 | 2026-07-08 | **Deterministic engines compute; AI explains/questions/retrieves** — AI never produces a number the engine didn't; fiqh-shaped questions get scholar referral. | Safety + trust in a religious-finance product. | PRD §10; AMANAH §11 |
| D-006 | 2026-07-09 | **Shariah identity is behavioral, not decorative** — no crescents/domes/ornament; star at 3 sites only; ethics/transparency ARE the identity. | Premium ≠ themed; trust ≠ texture. | AMANAH §10 |
| D-007 | 2026-07-09 | **Green never means halal.** Compliance uses the shield grammar (icon+label); `pnl-*` green/red reserved for signed deltas with mandatory signs. | Resolves the brand/halal/profit semantic collision. | Sprint §3; AMANAH §4.7/§10 |
| D-008 | 2026-07-10 | **AMANAH_DESIGN_SYSTEM.md is design law**; closed sets (motion/columns/charts/trust states/nouns) grow only via DSA sign-off. | Consistency across hundreds of pages for a decade. | AMANAH §12–13 |
| D-009 | 2026-07-08 | **No fake certainty**: unpriced = "—" + excluded-from-totals note (never silent 0); estimates labeled; "Not screened" until the engine exists; no performance figures before the valuation series (M2). | Honesty is the product. | Phase 5 review; CIO cond. 1; AMANAH §1/§4.12 |
| D-010 | 2026-07-08 | **No leverage/shorts/derivatives pathways** — engine rejects oversells; no UI can express them; read-only import someday = flagged non-compliant, never analyzable. | Structural impossibility beats warnings. | PRD §5; M1 §3.2 |
| D-011 | 2026-07-09 | **Research respects copyright; WSJ is never scraped** — links + public metadata + user notes only; content always opens at the publisher; AI excluded from attachments without affirmed rights. | Legal + huquq (rights) as an ethics feature. | Council §6; AMANAH §11 |
| D-012 | 2026-07-09 | **Data export remains available and free, forever.** | Irreplaceability comes from value, not lock-in; "hostages are resented, not missed." | AMANAH §14 doctrine |
| D-013 | 2026-07-08 | Fees capitalized into cost basis on buys; sell fees reduce proceeds; average-cost method (FIFO reserved via strategy seam + `cost_method`). | Owner-approved accounting convention. | M1 §3.2/§9 |
| D-014 | 2026-07-08 | Negative cash warns, never blocks; cash tracked per (portfolio, currency); engine computes in asset currency, conversion is read-layer only. | Real users back-fill imperfectly; FX correctness for a decade. | M1 §3.3/§11 review |
| D-015 | 2026-07-09 | Mutations = Server Actions → services; `SUPABASE_SERVICE_ROLE_KEY` server-only, scoped to assets + positions cache; RLS everywhere. | Security boundary of the ledger. | Phase 4; Phase 5 review |
| D-016 | 2026-07-10 | Planning is frozen: the six constitution documents govern; no new product-planning docs; deviations need strong justification + owner approval, logged here. | End of design churn; execution mode. | Owner directive |
