# Deployment Checklist (GitHub + Vercel)

Work through this top to bottom. Each step is quick; the whole thing is ~20 minutes.

## Before you deploy

- [ ] Supabase project created and [`supabase/schema.sql`](../supabase/schema.sql) applied — see [SUPABASE_SETUP.md](SUPABASE_SETUP.md)
- [ ] App runs locally against that project (`npm run dev`, sign up, log a trade)
- [ ] All checks pass locally:
  ```bash
  npm run typecheck && npm run lint && npm run build
  ```
- [ ] `.env.local` is **not** committed (it's gitignored; double-check with `git status`)

## Push to GitHub

- [ ] Create an empty repository on GitHub (no README/gitignore — the project has both)
- [ ] From the `humaid-trading-journal` folder:
  ```bash
  git remote add origin https://github.com/<you>/<repo>.git
  git push -u origin main
  ```

## Deploy on Vercel

- [ ] [vercel.com](https://vercel.com) → **Add New → Project** → import the GitHub repo
- [ ] Framework preset: **Next.js** (auto-detected — no build settings to change)
- [ ] Add environment variables (Production, and Preview if you want preview deploys to work):
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Click **Deploy** and wait for the build to go green

## Connect Supabase to the deployed URL

In Supabase → **Authentication → URL Configuration**:

- [ ] **Site URL** → `https://<your-app>.vercel.app` (or your custom domain)
- [ ] **Redirect URLs** → add `https://<your-app>.vercel.app/auth/callback`
- [ ] Keep the localhost entries if you still develop locally

## Post-deploy smoke test (do all of these on the live URL)

- [ ] Landing page loads; no console errors
- [ ] Sign up with a real email → confirmation email arrives → link logs you in
- [ ] Visiting `/dashboard` while logged out redirects to `/login`
- [ ] Create, edit, and delete a trade
- [ ] Add a holding, a dividend, a watchlist item, a Shariah screening
- [ ] Save a zakat record and export the summary
- [ ] Update settings (currency/nisab) and confirm values change across pages
- [ ] Export all data as JSON from Settings
- [ ] Check the whole flow once on a phone

## After launch

- [ ] Add a custom domain in Vercel (optional) and update Supabase URL config to match
- [ ] Enable [Supabase backups](https://supabase.com/docs/guides/platform/backups) appropriate to your plan
- [ ] Review [PRODUCTION_NOTES.md](PRODUCTION_NOTES.md) for security and operational notes
