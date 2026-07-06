-- ============================================================================
-- Humaid Trading Journal — sample data
--
-- HOW TO USE:
-- 1. Sign up in the app first (this creates your auth user + profile).
-- 2. Find your user id: Supabase Dashboard → Authentication → Users → copy UUID
--    (or run: select id, email from auth.users;)
-- 3. Replace YOUR_USER_ID_HERE below (one place) and run this file in the
--    SQL Editor.
-- ============================================================================

do $$
declare
  uid uuid := 'YOUR_USER_ID_HERE';
begin

  -- Profile defaults + trading cash
  update public.profiles
  set cash_balance = 25000,
      currency = 'AED',
      nisab_method = 'gold',
      hawl_date = '2026-03-20'
  where id = uid;

  -- -------------------------------------------------------------------------
  -- 10 trades (7 closed, 3 open) — UAE, Saudi, and US markets
  -- -------------------------------------------------------------------------
  insert into public.trades
    (user_id, symbol, asset_name, market, asset_type, side, quantity, entry_price, exit_price, current_price, fees, entry_date, exit_date, strategy, setup_quality, trade_status, notes, tags, emotion, mistakes)
  values
    (uid, 'EMAAR', 'Emaar Properties', 'DFM', 'stock', 'buy', 2000, 7.85, 8.60, null, 35, '2026-01-12', '2026-02-18', 'Breakout', 4, 'closed', 'Clean breakout above resistance with strong volume.', array['real-estate','uae'], 'patient', array[]::text[]),
    (uid, 'SALIK', 'Salik Company', 'DFM', 'stock', 'buy', 3000, 3.10, 3.02, null, 28, '2026-02-02', '2026-02-10', 'Swing', 2, 'closed', 'Entered without a clear setup. Cut quickly.', array['toll','uae'], 'rushed', array['no_plan','fomo']),
    (uid, '2222.SR', 'Saudi Aramco', 'Tadawul', 'stock', 'buy', 400, 27.20, 28.90, null, 42, '2026-01-20', '2026-03-05', 'Position', 4, 'closed', 'Dividend support and steady accumulation zone.', array['energy','saudi'], 'confident', array[]::text[]),
    (uid, 'AAPL', 'Apple Inc.', 'NASDAQ', 'stock', 'buy', 30, 228.50, 219.10, null, 15, '2026-02-15', '2026-02-27', 'Earnings play', 2, 'closed', 'Chased the pre-earnings run-up. Bad entry.', array['tech','us'], 'greedy', array['fomo','ignored_stop_loss']),
    (uid, 'MSFT', 'Microsoft Corp.', 'NASDAQ', 'stock', 'buy', 25, 415.00, 452.30, null, 15, '2026-01-08', '2026-03-12', 'Trend follow', 5, 'closed', 'Rode the trend with a trailing stop. Textbook.', array['tech','us'], 'patient', array[]::text[]),
    (uid, 'DEWA', 'Dubai Electricity & Water', 'DFM', 'stock', 'buy', 4000, 2.55, 2.48, null, 30, '2026-03-01', '2026-03-09', 'Support bounce', 3, 'closed', 'Support level failed. Took the small loss.', array['utilities','uae'], 'neutral', array['exited_too_early']),
    (uid, 'SPUS', 'SP Funds S&P 500 Shariah ETF', 'NYSE Arca', 'etf', 'buy', 60, 38.40, 41.75, null, 12, '2026-01-05', '2026-04-02', 'Core allocation', 5, 'closed', 'Quarterly rebalance of halal ETF core.', array['etf','halal-core'], 'patient', array[]::text[]),
    (uid, 'ADIB', 'Abu Dhabi Islamic Bank', 'ADX', 'stock', 'buy', 1500, 12.30, null, 13.15, 32, '2026-04-14', null, 'Position', 4, 'open', 'Islamic banking exposure. Holding for dividends.', array['islamic-finance','uae'], 'confident', array[]::text[]),
    (uid, 'SUKUK-EMIRATES', 'Emirates Islamic Sukuk 2029', 'Nasdaq Dubai', 'sukuk', 'buy', 10, 1000.00, null, 1012.00, 25, '2026-05-02', null, 'Income', 4, 'open', 'Fixed-income sleeve via sukuk.', array['sukuk','income'], 'neutral', array[]::text[]),
    (uid, 'BTC', 'Bitcoin', 'Crypto', 'crypto', 'buy', 0.15, 61000.00, null, 58200.00, 45, '2026-05-20', null, 'Swing', 2, 'open', 'Small speculative position. Sized it too large initially, trimmed later.', array['crypto'], 'greedy', array['over_position','held_loser_too_long']);

  -- -------------------------------------------------------------------------
  -- 5 holdings
  -- -------------------------------------------------------------------------
  insert into public.holdings
    (user_id, symbol, asset_name, market, sector, asset_type, quantity, average_cost, current_price, shariah_status, notes)
  values
    (uid, 'ADIB', 'Abu Dhabi Islamic Bank', 'ADX', 'Islamic Financials', 'stock', 1500, 12.30, 13.15, 'compliant', 'Core Islamic banking position.'),
    (uid, 'EMAAR', 'Emaar Properties', 'DFM', 'Real Estate', 'stock', 1200, 8.05, 8.72, 'compliant', 'Re-entered after breakout retest.'),
    (uid, 'SPUS', 'SP Funds S&P 500 Shariah ETF', 'NYSE Arca', 'Diversified', 'etf', 120, 39.10, 41.75, 'compliant', 'Halal core allocation.'),
    (uid, 'SUKUK-EMIRATES', 'Emirates Islamic Sukuk 2029', 'Nasdaq Dubai', 'Fixed Income', 'sukuk', 10, 1000.00, 1012.00, 'compliant', 'Income sleeve.'),
    (uid, '2222.SR', 'Saudi Aramco', 'Tadawul', 'Energy', 'stock', 250, 27.60, 28.40, 'not_reviewed', 'Needs screening refresh for latest financials.');

  -- -------------------------------------------------------------------------
  -- 3 dividends
  -- -------------------------------------------------------------------------
  insert into public.dividends
    (user_id, symbol, asset_name, amount, payment_date, purification_percentage, notes)
  values
    (uid, 'ADIB', 'Abu Dhabi Islamic Bank', 1085.00, '2026-04-28', 0, 'Annual dividend.'),
    (uid, '2222.SR', 'Saudi Aramco', 620.00, '2026-03-30', 2.5, 'Quarterly dividend; small purification for incidental interest income.'),
    (uid, 'SPUS', 'SP Funds S&P 500 Shariah ETF', 96.50, '2026-06-25', 1.2, 'ETF distribution; purification per fund report.');

  -- -------------------------------------------------------------------------
  -- 5 watchlist items
  -- -------------------------------------------------------------------------
  insert into public.watchlist
    (user_id, symbol, asset_name, market, target_price, current_price, shariah_status, risk_level, notes)
  values
    (uid, 'DIB', 'Dubai Islamic Bank', 'DFM', 6.80, 7.25, 'compliant', 'low', 'Buy on pullback to support zone.'),
    (uid, 'STC', 'Saudi Telecom', 'Tadawul', 38.00, 41.20, 'compliant', 'medium', 'Waiting for better entry after earnings.'),
    (uid, 'TSLA', 'Tesla Inc.', 'NASDAQ', 220.00, 248.60, 'doubtful', 'high', 'Check debt ratio in latest screening before entry.'),
    (uid, 'SPSK', 'SP Funds Dow Jones Global Sukuk ETF', 'NYSE Arca', 18.20, 18.85, 'compliant', 'low', 'Add to income sleeve below target.'),
    (uid, 'ETH', 'Ethereum', 'Crypto', 2400.00, 2610.00, 'not_reviewed', 'high', 'Scholars differ; review before any position.');

  -- -------------------------------------------------------------------------
  -- 5 Shariah screenings
  -- -------------------------------------------------------------------------
  insert into public.shariah_screenings
    (user_id, symbol, asset_name, market, business_activity, compliance_status, debt_ratio, interest_income_ratio, cash_and_receivables_ratio, purification_percentage, screening_source, last_reviewed_date, warning_categories, notes)
  values
    (uid, 'ADIB', 'Abu Dhabi Islamic Bank', 'ADX', 'Islamic banking and financial services', 'compliant', 12.4, 0.0, 28.0, 0.0, 'Manual — AAOIFI method', '2026-05-15', array[]::text[], 'Fully Shariah-governed institution with its own board.'),
    (uid, 'EMAAR', 'Emaar Properties', 'DFM', 'Real estate development and hospitality', 'compliant', 21.8, 1.4, 19.5, 1.4, 'Manual — AAOIFI method', '2026-05-15', array[]::text[], 'Ratios well under thresholds.'),
    (uid, 'AAPL', 'Apple Inc.', 'NASDAQ', 'Consumer electronics and services', 'compliant', 26.3, 2.1, 22.7, 2.1, 'Manual — AAOIFI method', '2026-04-20', array[]::text[], 'Interest income requires purification.'),
    (uid, 'TSLA', 'Tesla Inc.', 'NASDAQ', 'Electric vehicles and energy storage', 'doubtful', 31.2, 3.8, 18.9, 3.8, 'Manual — AAOIFI method', '2026-04-20', array['excessive_debt'], 'Debt ratio hovering near the 33% threshold; monitor quarterly.'),
    (uid, 'JPM', 'JPMorgan Chase', 'NYSE', 'Conventional banking', 'non_compliant', 88.0, 62.0, 55.0, null, 'Manual — AAOIFI method', '2026-03-10', array['conventional_banking','interest_based_income','excessive_debt'], 'Core business is interest-based lending. Avoid.');

  -- -------------------------------------------------------------------------
  -- 1 zakat record (last hawl)
  -- -------------------------------------------------------------------------
  insert into public.zakat_records
    (user_id, hawl_date, nisab_method, gold_price_per_gram, silver_price_per_gram,
     cash_at_home, bank_cash, trading_cash, compliant_stock_value, doubtful_stock_value,
     dividends_received, gold_value, silver_value, business_inventory, receivables,
     immediate_debts, zakatable_total, nisab_threshold, zakat_due, purification_amount, notes)
  values
    (uid, '2026-03-20', 'gold', 295.00, 3.65,
     5000, 42000, 18000, 96500, 0,
     1450, 12000, 0, 0, 3000,
     2500, 175450, 25075, 4386.25, 36.25,
     'Hawl 1447 — paid via local zakat fund.');

end $$;
