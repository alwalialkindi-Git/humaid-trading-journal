# D1b — Navigation Shell & Command Layer (2026-07-10)

Scope per NEXT_TASK.md; constitution refs: Council §5 (IA), sprint §7/§28 D1b, AMANAH §10 (shields), §12 (governance).

**Shipped:** grouped sidebar (PURITY spine visually distinct; THINKING houses Journal+Calendar until M5.5 Research); shared `nav-config.ts` feeding sidebar/palette/bottom-tabs; hand-rolled ⌘K palette (Dialog-based, ARIA combobox; Actions ≤15: Add transaction → same TransactionDialog, Toggle theme; Navigate from config); mobile bottom tab bar with center + (FAB and hamburger drawer retired; toaster raised; safe-area); ShieldBadge (4 shapes + labels + override dot — color never sole carrier; `ComplianceBadge` now wraps it, upgrading legacy pages in place); glossary registry (15 terms) + GlossaryTerm popover, wired at two dialog touchpoints.

**Notable decisions:**
- Palette owns its own TransactionDialog instance — same component as every other door; no action duplication.
- Nav renames are label-only (Wealth/Journal/Screener/Insights); routes and pages untouched — page redesigns belong to D2–D6.
- Assets-in-palette deferred to D2/D3 (needs designed hand-off into the dialog's asset state).
- Keyboard chords (N, G-then-X) deferred — only ⌘K in D1b to avoid form-typing conflicts.

**Incident during verification:** the long-running local dev server 500'd — cause: `.next` was deleted mid-session (for a prod build) under the running process. Fresh server clean. Lesson: restart dev server after cache deletion; production build was never affected.

**Checks:** typecheck/lint/build/80 tests green; login verified locally in both themes. Authenticated shell verification = owner production pass post-push.
