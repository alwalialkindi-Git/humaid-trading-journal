# Seed Data Guide

[`supabase/seed.sql`](../supabase/seed.sql) fills the app with realistic sample data so every page looks complete:

- **10 trades** — UAE (DFM/ADX), Saudi (Tadawul), and US markets; 7 closed, 3 open; a mix of wins, losses, strategies, emotions, and honest mistakes (FOMO, no plan, over-position…)
- **5 holdings** — including an Islamic bank, a halal ETF, and a sukuk
- **3 dividends** — with purification percentages
- **5 watchlist items** — with target prices, risk levels, and Shariah statuses
- **5 Shariah screenings** — compliant, doubtful, and non-compliant examples with ratios
- **1 zakat record** — a completed hawl with a full breakdown
- Sets your profile's cash balance (AED 25,000) and hawl date

## How to load it

Seeding is **per user**, so you must sign up first:

1. Run the app and **create your account** (and confirm the email if confirmation is on).
2. Find your user id in Supabase — either:
   - **Authentication → Users** → copy the UUID, or
   - SQL Editor: `select id, email from auth.users;`
3. Open `supabase/seed.sql` and replace `YOUR_USER_ID_HERE` (one place, near the top) with that UUID — keep the quotes.
4. Run the file in **SQL Editor**.
5. Refresh the app — the dashboard, analytics, calendar, and all other pages should be fully populated.

## Removing the sample data

Run this in the SQL Editor (replace the UUID):

```sql
do $$
declare
  uid uuid := 'YOUR_USER_ID_HERE';
begin
  delete from public.trades where user_id = uid;
  delete from public.holdings where user_id = uid;
  delete from public.dividends where user_id = uid;
  delete from public.watchlist where user_id = uid;
  delete from public.shariah_screenings where user_id = uid;
  delete from public.zakat_records where user_id = uid;
  update public.profiles set cash_balance = 0, hawl_date = null where id = uid;
end $$;
```

## Notes

- The seed can be run once per user; running it twice duplicates rows (delete first, see above).
- Never run the seed against another user's id — data belongs to whoever's UUID you paste.
- Sample prices and ratios are illustrative, not real market data or real screenings.
