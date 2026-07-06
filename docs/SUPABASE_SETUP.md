# Supabase Setup Guide

Everything the app needs from Supabase: a project, the schema, and two environment variables. Takes about 10 minutes.

## 1. Create the project

1. Sign in at [supabase.com](https://supabase.com) and click **New project**.
2. Pick any name (e.g. `humaid-trading-journal`), a strong database password, and the region closest to your users (e.g. `Middle East (Bahrain)` for the Gulf).
3. Wait for provisioning to finish (~1 minute).

## 2. Apply the database schema

1. In the Supabase dashboard, open **SQL Editor → New query**.
2. Paste the **entire contents** of [`supabase/schema.sql`](../supabase/schema.sql).
3. Click **Run**. You should see "Success. No rows returned".

This creates:

| Object | Purpose |
| --- | --- |
| `profiles` | One row per user (currency, cash balance, zakat preferences). Auto-created on signup by the `on_auth_user_created` trigger. |
| `trades` | Journal entries with strategy, emotion, mistakes, tags |
| `holdings` | Current positions with manual prices and Shariah status |
| `dividends` | Dividend income with purification percentages |
| `watchlist` | Symbols with target prices, risk, Shariah status |
| `shariah_screenings` | Compliance records with financial ratios and warnings |
| `zakat_records` | Saved zakat calculations per hawl |
| `journal_notes` | Free-form notes (reserved for a future feature) |
| `set_updated_at()` triggers | Keep `updated_at` current on every table that has it |

**Row Level Security is enabled on every table** with per-operation policies scoped to `auth.uid()`. Do not disable RLS — it is the data-isolation boundary between users.

> Re-running the schema on a non-empty project will fail on `create table` — it is written for a fresh project. To start over, create a new Supabase project (or drop the tables first).

## 3. Configure authentication

1. Go to **Authentication → Providers** and make sure **Email** is enabled (it is by default).
2. Decide on email confirmation:
   - **Confirm email ON** (default, recommended for production): users must click a link in their inbox before they can log in. The app handles this — it shows a "Check your email" screen and processes the callback at `/auth/callback`.
   - **Confirm email OFF** (convenient for local testing): signups log in immediately.
3. Go to **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000` for development; change to your production URL after deploying.
   - **Redirect URLs**: add `http://localhost:3000/auth/callback` (and later `https://your-domain/auth/callback`).

## 4. Copy the API credentials

Go to **Project Settings → API** and copy:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **`anon` `public` key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Put them in `.env.local` (copy from `.env.example`). The anon key is safe to expose in the browser **only because RLS is enabled** — never use the `service_role` key in this app.

## 5. Verify

1. `npm run dev`, open http://localhost:3000, sign up.
2. In Supabase: **Authentication → Users** should show your user, and **Table Editor → profiles** should show a row created by the trigger.
3. Log a trade in the app; it should appear in **Table Editor → trades** with your `user_id`.

If the profile row is missing, the schema (specifically the `handle_new_user` trigger) was applied *after* the account was created — delete the user and sign up again.
