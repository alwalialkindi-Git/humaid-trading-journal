# D1a — Design Foundation (2026-07-10)

**Scope delivered** (per NEXT_TASK.md / AMANAH):

- `globals.css` rewritten: two-layer tokens (primitives `--p-*` → semantic aliases), all legacy names preserved and re-pointed; dark theme under `[data-theme="dark"]`; Tailwind `dark:` custom variant; radius law (8/6/4); depth law (shadow-sm flattened — borders carry cards; two real elevations); the four motion verbs as `--animate-*` (+ reduced-motion collapse); `figure-xl/lg/md/sm` utilities.
- Theme boot script in root layout (no-FOUC, default light — system-follow deferred until legacy pages lose hardcoded tints); stateless `ThemeToggle` (both icons + `dark:` visibility) in the sidebar footer.
- `src/lib/amanah/number.ts` — AMANAH §4 as code (true minus U+2212, money 2dp, price ≤4dp→min2, qty ≤8dp trimmed, signed deltas, `≈`, timestamps); `src/lib/amanah/trust.ts` — closed 10-state set + "trust whispers, exceptions speak" visibility law. 20 rule tests in `amanah.test.ts`.
- `Figure` primitive (tabular figure, lighter code, delta sign+color, provenance popover: state/source/as-of/actor/derivation/note); `Popover` primitive added (@radix-ui/react-popover); `TrustChip`/`FreshnessDot`/`ProvenanceContent`.
- `components/fin-table/` — presentational FinTable primitives (density context 44/32px, sticky header, labeled footer) + cell renderers (Text/Money/Delta/Qty/UnitPrice/Percent/Date). No existing table migrated (D2).
- `Field` form-row wrapper (label/help/error + aria wiring).
- Dialog/Sheet wired to appear/slide verbs (appear keyframe uses standalone `scale` so it composes with the dialog's centering transform); Badge dark tints; EmptyState → single cropped 8-point star mark (Council A8).

**Verified:** typecheck/lint/build clean; 80/80 tests; both themes checked in browser (light `#F6F5F1`/brand `#0A6C52`; dark `#101413`/brand `#3BA98A`); zero console errors; dark landing page acceptable (bonus — token surfaces adapt well).

**Deliberate deviations/deferrals:** theme default is light (not system) until legacy hardcoded tints are gone; provenance enabled per-surface starting D2; ⌘K/bottom-tabs/shield icons are D1b.
