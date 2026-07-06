# Humaid Trading Journal

A professional, Islamic-focused trading journal and portfolio analytics platform for Muslim traders and investors. Track trades, analyze performance, monitor your portfolio, screen assets for Shariah compliance, and calculate zakat — in one calm, private workspace.

> **Disclaimer:** This tool is for personal tracking and educational purposes only. It does not provide a fatwa. Please consult a qualified Shariah advisor for final rulings.

## Features

- **Trades Journal** — strategy, setup quality, emotions, tags, and an honest mistake checklist; P&L, win rate, profit factor, holding period, and fees computed automatically
- **Portfolio & Holdings** — average cost, manual price updates, cash balance, allocation by asset type / market / sector, concentration checks
- **Dividends** — income tracking with per-payment purification percentages
- **Analytics** — monthly P&L, equity curve, max drawdown, strategy/emotion performance, mistake frequency, best & worst symbols
- **Trading Calendar** — green/red daily P&L with per-day trade details
- **Watchlist** — target buy prices, risk levels, Shariah status, "at target" alerts
- **Shariah Filter** — screening records (debt / interest income / cash-and-receivables ratios, purification %, warning categories) plus a clear stance against margin, leverage, short selling, CFDs, futures, options, and interest-based products
- **Zakat Calculator** — gold/silver nisab, hawl tracking, full breakdown, yearly records, export, and a separate purification calculator
- **Insights** — rule-based coaching cards, structured for future AI integration
- **Settings** — currency (AED default), nisab method, preferences, full JSON data export

## Tech stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · shadcn-style UI (Radix primitives) · Supabase (Auth + Postgres + RLS) · Recharts

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm run dev
```

You need a (free) Supabase project with the schema applied first — follow **[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)** (≈10 minutes). To populate the UI with realistic sample data, see **[docs/SEED_DATA.md](docs/SEED_DATA.md)**.

## Documentation

| Guide | What it covers |
| --- | --- |
| [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) | Creating the project, applying the schema + RLS, auth configuration, credentials |
| [docs/SEED_DATA.md](docs/SEED_DATA.md) | Loading and removing the sample data |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Step-by-step GitHub + Vercel deployment checklist with post-deploy smoke tests |
| [docs/PRODUCTION_NOTES.md](docs/PRODUCTION_NOTES.md) | Security model, known limitations, operational notes |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |

## Architecture

- **Auth & route protection** — `src/proxy.ts` (Next 16's middleware replacement) refreshes Supabase sessions and redirects unauthenticated users; the `(app)` layout re-checks server-side as defense in depth.
- **Row Level Security** — every table has RLS with per-operation `auth.uid()` policies; on top of that, every server query explicitly filters by the signed-in user.
- **Data flow** — server components fetch with the server Supabase client; client components handle forms/mutations with the browser client and `router.refresh()`.
- **Domain logic** — pure functions in `src/lib/`: `calculations.ts` (P&L, stats, allocation), `zakat.ts` (nisab, 2.5% rate, purification), `insights.ts` (rule-based insight generator with an AI-provider-shaped interface).
- **Currency** — AED default; formatters accept overrides and the profile stores the preference.
- **RTL readiness** — `lang`/`dir` centralized in `src/app/layout.tsx` for future Arabic support.

## Project structure

```
src/
  app/
    page.tsx              # Landing
    (auth)/               # Login, signup
    (app)/                # Protected app: dashboard, trades, portfolio,
                          # holdings, dividends, analytics, calendar,
                          # watchlist, shariah, zakat, settings
    auth/callback/        # Email-confirmation handler
  components/             # UI kit, app components, charts
  lib/                    # Types, Supabase clients, domain logic
  proxy.ts                # Session refresh + route protection
supabase/
  schema.sql              # Tables, triggers, RLS policies
  seed.sql                # Sample data (per user)
docs/                     # Setup, seeding, deployment, production notes
```

## License

Private project — all rights reserved.
