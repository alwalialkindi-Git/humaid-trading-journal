# Production Notes

Operational and security notes for running Humaid Trading Journal in production.

## Security model

- **Row Level Security is the boundary.** Every user table has RLS enabled with per-operation policies on `auth.uid()`. The browser `anon` key is safe to ship *only* because of this — never disable RLS on any table, and never add a policy without a `user_id` check.
- **Defense in depth.** Route protection happens twice (the `src/proxy.ts` edge check and a server-side `getUser()` in the app layout), and every server query *also* filters by the signed-in user id even though RLS already enforces it.
- **No service-role key anywhere.** The app only uses the public anon key. If you ever add server-only admin features (e.g. account deletion), keep the `service_role` key in server-side env vars that are *not* prefixed `NEXT_PUBLIC_`.
- **Open-redirect guard.** The login `?next=` parameter is only followed if it starts with `/`.

## Environment

| Variable | Where | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | Project URL from Supabase API settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + `.env.local` | Public anon key (RLS-protected) |

If the variables are missing, the proxy logs a warning and lets requests through so the marketing page still renders; protected pages will fail. This is intentional for first-run DX — production must always have both set.

## Known limitations (current release)

1. **Manual prices.** Holdings, open trades, and watchlist prices are entered by the user. Unrealized P&L is only as fresh as the last manual update. A price-feed integration would slot into the holdings/watchlist update paths.
2. **Account deletion is a placeholder.** Real deletion needs a server route using the Supabase Admin API (`auth.admin.deleteUser`) with the service-role key; cascading deletes are already in place (`on delete cascade` from `auth.users`).
3. **Dashboard zakat estimate is approximate.** It applies 2.5% to cash + compliant holdings without a nisab check (no live metal prices). The Zakat Calculator page is the authoritative calculation.
4. **Insights are rule-based.** `src/lib/insights.ts` is deliberately shaped like an AI provider (single `generateInsights()` entry point returning `Insight[]`); swapping in a model API later requires no UI changes.
5. **English/LTR only.** Arabic support is structurally prepared (`lang`/`dir` set in one place in `src/app/layout.tsx`), not implemented.
6. **Email deliverability.** Supabase's built-in email service is fine for testing but rate-limited; for production sign-ups configure a custom SMTP provider in Supabase → Authentication → Emails.
7. **Seed script is per-user and not idempotent.** Running it twice duplicates rows (see [SEED_DATA.md](SEED_DATA.md) for cleanup SQL).

## Operational notes

- **Backups**: enable Supabase scheduled backups per your plan; the Settings page also gives users a self-service JSON export.
- **Migrations**: `supabase/schema.sql` is a from-scratch script for a fresh project. Once live, make schema changes as incremental SQL migrations instead of re-running the file.
- **Monitoring**: Vercel gives request/build logs; Supabase → Logs covers auth and Postgres. The app throws readable errors into the `(app)` error boundary rather than crashing the shell.
- **Sessions**: token refresh happens in the proxy on every request (`supabase.auth.getUser()`); if you see users logged out unexpectedly, check that the proxy matcher isn't excluding a route they visit.
- **Performance**: all app pages are server-rendered per request (`ƒ` routes) — appropriate for personal-finance data (no caching of one user's data for another). The landing, login, and signup pages are static.

## Shariah scope (product stance)

The app tracks **spot ownership only**. There is no data model for margin, leverage, shorts, CFDs, futures, or options, and the Shariah Filter page explicitly discourages them. The screening module stores *user-entered* ratios and statuses — it does not fetch or certify compliance data. The in-app disclaimer ("…does not provide a fatwa…") appears on the Shariah Filter, the Zakat Calculator, the auth screens, and the landing footer; keep it visible in any redesign.
