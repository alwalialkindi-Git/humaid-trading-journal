@AGENTS.md

# CLAUDE.md — Permanent Operating Manual

## Mission

Build **Humaid** — the Islamic Wealth Operating System: a private wealth desk for the Muslim household where the numbers are honest, the obligations are alive, and the thinking is remembered. Not a trading journal. Not a portfolio tracker.

## Product authority hierarchy (the constitution — FROZEN)

When guidance conflicts, higher wins:

1. `docs/AMANAH_DESIGN_SYSTEM.md` — design language law (philosophy, vocabulary, numbers, tables, charts, trust states, Islamic rules, AI rules, scalability)
2. `docs/DESIGN_COUNCIL_FINAL_REVIEW.md` — product direction, CIO's 5 conditions, Irreplaceability Doctrine
3. `docs/DESIGN_SPRINT_1_PRODUCT_DIRECTION.md` — design phases D1a–D6 (as amended ◇)
4. `docs/PRD.md` — product scope, personas, milestones M1–M7
5. `docs/M1_LEDGER_FOUNDATION.md` — ledger architecture (frozen after 10-year review)
6. `docs/PHASE_5_UX_CONSULTANT_REVIEW.md` — Phase 5 flows (the regression baseline)

Do not redesign the product, create new product-planning documents, or revisit architectural decisions without strong, explicitly-argued justification and product-owner approval. Log accepted deviations in `DECISIONS.md`.

## Session start ritual (mandatory)

**Always read `CURRENT_STATE.md` and `NEXT_TASK.md` before implementing anything.** Update both when a task completes. Record notable decisions in `DECISIONS.md` and domain notes in `docs/PROJECT_MEMORY/`.

## Coding rules

- TypeScript strict; no `any` without a comment defending it.
- **Deterministic engines compute every number** (`src/lib/engine/`, `src/lib/zakat.ts`). UI and AI only display/explain. Never re-derive financial math in components.
- All ledger reads/writes go through the service layer (`src/lib/services/`) — pages never query ledger tables directly.
- Mutations = Server Actions → services. Client components never touch the admin client or ledger tables.
- Repository pattern: business rules live in services, tested against `InMemoryRepository`.
- Pure modules stay pure (no I/O in engine/format/zakat).
- Comments only for constraints code can't express. Match existing idiom.

## Design rules

- **D-018 — Design Before Code (permanent):** every MAJOR feature is visualized in Figma FIRST (requirements → council → CIO → Figma → design review → code → verify-against-Figma → deploy). No major UI work starts directly in the repo. Token/naming authority remains code-canonical per D-017; minor fixes may go code-first.

- AMANAH is law: token-only colors (no raw hex in components), closed sets (4 motion verbs, 10 table column types, 10 trust states, chart usage table), tabular numerals on all figures, true minus U+2212, sign+color never color-alone, `≈` on every FX-converted figure.
- Vocabulary: past-tense verbs of record (Recorded/Updated/Calculated/Reconciled…); no exclamation marks; the two sanctioned phrases only.
- Islamic identity is behavioral: no crescents/domes/ornament; 8-point star only at its three permitted sites; brass only for sacred moments; compliance = shield grammar, never bare green.
- No fake certainty: unsourced numbers, unlabeled estimates, and silent fallbacks are bugs.

## Testing rules

- `npm test` (vitest) must pass before any commit. Engine and formatter rules get unit tests; services get InMemoryRepository tests.
- Phase 5 flows are the untouchable regression baseline: golden-path buy, ADIB-Egypt warning flow, sell preview ≡ persisted `realized_pnl`.
- Always run before commit: `npm run typecheck && npm run lint && npm run build && npm test`.

## Git rules

- Conventional, information-dense commit messages; body explains what and why.
- **Never push unless explicitly instructed by the product owner.**
- Never commit secrets; `.env.local` stays out of git. Migrations are one-shot files — never edit an applied migration; add a new one.

## Safety rules

- `SUPABASE_SERVICE_ROLE_KEY` is server-only, used solely for global `assets` writes + `positions` cache (via `lib/supabase/admin.ts`). Never `NEXT_PUBLIC_`, never imported client-side.
- RLS is the data boundary; services validate ownership on top. Every user table keeps RLS.
- No scraping; WSJ/publisher content is never stored — links + user notes + public metadata only.
- The engine structurally rejects shorts/oversells; never weaken `tx_shape`, trial-recompute, or the no-shorts invariant.
- Do not apply anything to live Supabase without explicit instruction.
- The covenant (CIO condition 5): every number can explain itself · notify to inform, never to engage · no leverage/shorts/fake certainty/fake urgency · user data and reading are theirs (export stays free).
