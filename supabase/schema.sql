-- ============================================================================
-- Humaid Trading Journal — Supabase schema
-- Run this in the Supabase SQL Editor (or `supabase db push`).
-- Creates all tables, triggers, and Row Level Security policies.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user, created automatically on signup
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  currency text not null default 'AED',
  cash_balance numeric(18, 2) not null default 0,
  nisab_method text not null default 'gold' check (nisab_method in ('gold', 'silver')),
  risk_preference text not null default 'medium' check (risk_preference in ('low', 'medium', 'high')),
  screening_preference text not null default 'standard',
  hawl_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile whenever a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', null));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- trades
-- ---------------------------------------------------------------------------

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  asset_name text,
  market text,
  asset_type text not null default 'stock'
    check (asset_type in ('stock', 'etf', 'crypto', 'sukuk', 'cash', 'other')),
  side text not null default 'buy' check (side in ('buy', 'sell')),
  quantity numeric(18, 6) not null check (quantity > 0),
  entry_price numeric(18, 6) not null check (entry_price >= 0),
  exit_price numeric(18, 6),
  current_price numeric(18, 6),
  fees numeric(18, 2) not null default 0,
  entry_date date not null,
  exit_date date,
  strategy text,
  setup_quality int check (setup_quality between 1 and 5),
  trade_status text not null default 'open' check (trade_status in ('open', 'closed')),
  notes text,
  tags text[] not null default '{}',
  emotion text check (emotion in ('confident', 'fearful', 'greedy', 'patient', 'rushed', 'neutral')),
  mistakes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trades_user_id_idx on public.trades (user_id);
create index trades_entry_date_idx on public.trades (user_id, entry_date desc);

alter table public.trades enable row level security;

create policy "trades_select_own" on public.trades
  for select using (auth.uid() = user_id);
create policy "trades_insert_own" on public.trades
  for insert with check (auth.uid() = user_id);
create policy "trades_update_own" on public.trades
  for update using (auth.uid() = user_id);
create policy "trades_delete_own" on public.trades
  for delete using (auth.uid() = user_id);

create trigger trades_updated_at
  before update on public.trades
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- holdings
-- ---------------------------------------------------------------------------

create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  asset_name text,
  market text,
  sector text,
  asset_type text not null default 'stock'
    check (asset_type in ('stock', 'etf', 'crypto', 'sukuk', 'cash', 'other')),
  quantity numeric(18, 6) not null check (quantity >= 0),
  average_cost numeric(18, 6) not null default 0,
  current_price numeric(18, 6) not null default 0,
  shariah_status text not null default 'not_reviewed'
    check (shariah_status in ('compliant', 'doubtful', 'non_compliant', 'not_reviewed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index holdings_user_id_idx on public.holdings (user_id);

alter table public.holdings enable row level security;

create policy "holdings_select_own" on public.holdings
  for select using (auth.uid() = user_id);
create policy "holdings_insert_own" on public.holdings
  for insert with check (auth.uid() = user_id);
create policy "holdings_update_own" on public.holdings
  for update using (auth.uid() = user_id);
create policy "holdings_delete_own" on public.holdings
  for delete using (auth.uid() = user_id);

create trigger holdings_updated_at
  before update on public.holdings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- dividends
-- ---------------------------------------------------------------------------

create table public.dividends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  asset_name text,
  amount numeric(18, 2) not null check (amount >= 0),
  payment_date date not null,
  purification_percentage numeric(6, 3) not null default 0
    check (purification_percentage >= 0 and purification_percentage <= 100),
  notes text,
  created_at timestamptz not null default now()
);

create index dividends_user_id_idx on public.dividends (user_id);

alter table public.dividends enable row level security;

create policy "dividends_select_own" on public.dividends
  for select using (auth.uid() = user_id);
create policy "dividends_insert_own" on public.dividends
  for insert with check (auth.uid() = user_id);
create policy "dividends_update_own" on public.dividends
  for update using (auth.uid() = user_id);
create policy "dividends_delete_own" on public.dividends
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- watchlist
-- ---------------------------------------------------------------------------

create table public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  asset_name text,
  market text,
  target_price numeric(18, 6),
  current_price numeric(18, 6),
  shariah_status text not null default 'not_reviewed'
    check (shariah_status in ('compliant', 'doubtful', 'non_compliant', 'not_reviewed')),
  risk_level text not null default 'medium' check (risk_level in ('low', 'medium', 'high')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index watchlist_user_id_idx on public.watchlist (user_id);

alter table public.watchlist enable row level security;

create policy "watchlist_select_own" on public.watchlist
  for select using (auth.uid() = user_id);
create policy "watchlist_insert_own" on public.watchlist
  for insert with check (auth.uid() = user_id);
create policy "watchlist_update_own" on public.watchlist
  for update using (auth.uid() = user_id);
create policy "watchlist_delete_own" on public.watchlist
  for delete using (auth.uid() = user_id);

create trigger watchlist_updated_at
  before update on public.watchlist
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- shariah_screenings
-- ---------------------------------------------------------------------------

create table public.shariah_screenings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  symbol text not null,
  asset_name text,
  market text,
  business_activity text,
  compliance_status text not null default 'not_reviewed'
    check (compliance_status in ('compliant', 'doubtful', 'non_compliant', 'not_reviewed')),
  debt_ratio numeric(6, 3) check (debt_ratio >= 0),
  interest_income_ratio numeric(6, 3) check (interest_income_ratio >= 0),
  cash_and_receivables_ratio numeric(6, 3) check (cash_and_receivables_ratio >= 0),
  purification_percentage numeric(6, 3) check (purification_percentage >= 0),
  screening_source text,
  last_reviewed_date date,
  warning_categories text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shariah_screenings_user_id_idx on public.shariah_screenings (user_id);

alter table public.shariah_screenings enable row level security;

create policy "shariah_screenings_select_own" on public.shariah_screenings
  for select using (auth.uid() = user_id);
create policy "shariah_screenings_insert_own" on public.shariah_screenings
  for insert with check (auth.uid() = user_id);
create policy "shariah_screenings_update_own" on public.shariah_screenings
  for update using (auth.uid() = user_id);
create policy "shariah_screenings_delete_own" on public.shariah_screenings
  for delete using (auth.uid() = user_id);

create trigger shariah_screenings_updated_at
  before update on public.shariah_screenings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- zakat_records
-- ---------------------------------------------------------------------------

create table public.zakat_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  hawl_date date not null,
  nisab_method text not null default 'gold' check (nisab_method in ('gold', 'silver')),
  gold_price_per_gram numeric(18, 4) not null default 0,
  silver_price_per_gram numeric(18, 4) not null default 0,
  cash_at_home numeric(18, 2) not null default 0,
  bank_cash numeric(18, 2) not null default 0,
  trading_cash numeric(18, 2) not null default 0,
  compliant_stock_value numeric(18, 2) not null default 0,
  doubtful_stock_value numeric(18, 2) not null default 0,
  dividends_received numeric(18, 2) not null default 0,
  gold_value numeric(18, 2) not null default 0,
  silver_value numeric(18, 2) not null default 0,
  business_inventory numeric(18, 2) not null default 0,
  receivables numeric(18, 2) not null default 0,
  immediate_debts numeric(18, 2) not null default 0,
  zakatable_total numeric(18, 2) not null default 0,
  nisab_threshold numeric(18, 2) not null default 0,
  zakat_due numeric(18, 2) not null default 0,
  purification_amount numeric(18, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index zakat_records_user_id_idx on public.zakat_records (user_id);

alter table public.zakat_records enable row level security;

create policy "zakat_records_select_own" on public.zakat_records
  for select using (auth.uid() = user_id);
create policy "zakat_records_insert_own" on public.zakat_records
  for insert with check (auth.uid() = user_id);
create policy "zakat_records_update_own" on public.zakat_records
  for update using (auth.uid() = user_id);
create policy "zakat_records_delete_own" on public.zakat_records
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- journal_notes
-- ---------------------------------------------------------------------------

create table public.journal_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  note_date date not null default current_date,
  title text,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index journal_notes_user_id_idx on public.journal_notes (user_id);

alter table public.journal_notes enable row level security;

create policy "journal_notes_select_own" on public.journal_notes
  for select using (auth.uid() = user_id);
create policy "journal_notes_insert_own" on public.journal_notes
  for insert with check (auth.uid() = user_id);
create policy "journal_notes_update_own" on public.journal_notes
  for update using (auth.uid() = user_id);
create policy "journal_notes_delete_own" on public.journal_notes
  for delete using (auth.uid() = user_id);

create trigger journal_notes_updated_at
  before update on public.journal_notes
  for each row execute function public.set_updated_at();
