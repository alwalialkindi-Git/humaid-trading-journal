-- ============================================================================
-- Migration 002 — Ledger Foundation (M1)
-- Frozen architecture per docs/M1_LEDGER_FOUNDATION.md (§1, §2.4, §11).
--
-- Prerequisite: the MVP schema (supabase/schema.sql — "001") is applied:
-- this migration reuses public.set_updated_at() and extends handle_new_user().
--
-- Creates: exchanges, assets, asset_overrides, portfolios, brokers,
--          transactions, journal_annotations, positions
-- Legacy tables (trades/holdings/dividends/…) are NOT touched here;
-- data migration is a separate, later step (design doc §5).
-- ============================================================================

-- Defensive: ensure the shared trigger helper exists even on partial installs.
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
-- exchanges — global reference data (design doc §2.4)
-- Service-role writable only; readable by all authenticated users.
-- Deliberately NOT foreign-keyed from assets: custom assets may carry an
-- empty/unknown exchange code.
-- ---------------------------------------------------------------------------

create table public.exchanges (
  code        text primary key,          -- 'DFM', 'ADX', 'NASDAQ_DUBAI', …
  mic         text not null,             -- ISO 10383 MIC
  name        text not null,
  country     text not null,
  currency    text not null,             -- primary trading currency ('*' = per instrument)
  created_at  timestamptz not null default now()
);

alter table public.exchanges enable row level security;

create policy "exchanges_read_authenticated" on public.exchanges
  for select to authenticated using (true);
-- no insert/update/delete policies: writes happen via service role only

insert into public.exchanges (code, mic, name, country, currency) values
  ('DFM',          'XDFM', 'Dubai Financial Market',           'UAE',           'AED'),
  ('ADX',          'XADS', 'Abu Dhabi Securities Exchange',    'UAE',           'AED'),
  ('NASDAQ_DUBAI', 'DIFX', 'Nasdaq Dubai',                     'UAE',           '*'),
  ('TADAWUL',      'XSAU', 'Saudi Exchange (Tadawul)',         'Saudi Arabia',  'SAR'),
  ('NASDAQ',       'XNAS', 'Nasdaq',                           'United States', 'USD'),
  ('NYSE',         'XNYS', 'New York Stock Exchange',          'United States', 'USD'),
  ('NYSE_ARCA',    'ARCX', 'NYSE Arca',                        'United States', 'USD'),
  ('CRYPTO',       'CRYP', 'Crypto (pseudo-exchange)',         '*',             '*');

-- ---------------------------------------------------------------------------
-- assets — global instrument master (design doc §1.2)
-- Clients: SELECT only. All writes via server routes using the service role.
-- ---------------------------------------------------------------------------

create table public.assets (
  id                uuid primary key default gen_random_uuid(),
  symbol            text not null,
  exchange          text not null default '',
  name              text not null,
  currency          text not null default 'AED',
  asset_class       text not null default 'stock'
                    check (asset_class in ('stock','etf','crypto','sukuk','fund','commodity','cash','other')),
  data_tier         text not null default 'manual_custom'
                    check (data_tier in ('automated','semi_automated','manual_custom')),
  isin              text,
  sector            text,
  industry          text,
  country           text,
  is_listed         boolean not null default true,
  provider          text,
  provider_symbol   text,
  latest_price      numeric(20,6) check (latest_price is null or latest_price >= 0),
  price_as_of       timestamptz,
  price_is_manual   boolean not null default false,
  metadata          jsonb not null default '{}',
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (symbol, exchange)
);

create index assets_provider_symbol_idx on public.assets (provider, provider_symbol);
create index assets_isin_idx on public.assets (isin) where isin is not null;

alter table public.assets enable row level security;

create policy "assets_read_authenticated" on public.assets
  for select to authenticated using (true);
-- no client write policies: service role only

create trigger assets_updated_at
  before update on public.assets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- asset_overrides — per-user manual corrections (design doc §1.3)
-- ---------------------------------------------------------------------------

create table public.asset_overrides (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  asset_id         uuid not null references public.assets (id) on delete cascade,
  display_name     text,
  sector           text,
  manual_price     numeric(20,6) check (manual_price is null or manual_price >= 0),
  manual_price_at  timestamptz,
  shariah_status   text check (shariah_status in ('compliant','doubtful','non_compliant','not_reviewed')),
  override_reason  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, asset_id)
);

create index asset_overrides_user_idx on public.asset_overrides (user_id);

alter table public.asset_overrides enable row level security;

create policy "asset_overrides_select_own" on public.asset_overrides
  for select using (auth.uid() = user_id);
create policy "asset_overrides_insert_own" on public.asset_overrides
  for insert with check (auth.uid() = user_id);
create policy "asset_overrides_update_own" on public.asset_overrides
  for update using (auth.uid() = user_id);
create policy "asset_overrides_delete_own" on public.asset_overrides
  for delete using (auth.uid() = user_id);

create trigger asset_overrides_updated_at
  before update on public.asset_overrides
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- portfolios (design doc §1.4)
-- ---------------------------------------------------------------------------

create table public.portfolios (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  base_currency  text not null default 'AED',
  cost_method    text not null default 'average' check (cost_method in ('average','fifo')),
  is_default     boolean not null default false,
  is_archived    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index portfolios_user_idx on public.portfolios (user_id);

alter table public.portfolios enable row level security;

create policy "portfolios_select_own" on public.portfolios
  for select using (auth.uid() = user_id);
create policy "portfolios_insert_own" on public.portfolios
  for insert with check (auth.uid() = user_id);
create policy "portfolios_update_own" on public.portfolios
  for update using (auth.uid() = user_id);
create policy "portfolios_delete_own" on public.portfolios
  for delete using (auth.uid() = user_id);

create trigger portfolios_updated_at
  before update on public.portfolios
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- brokers (design doc §1.5) — one row per broker *account*
-- ---------------------------------------------------------------------------

create table public.brokers (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  name              text not null,
  country           text,
  account_number    text,
  account_currency  text not null default 'AED',
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index brokers_user_idx on public.brokers (user_id);

alter table public.brokers enable row level security;

create policy "brokers_select_own" on public.brokers
  for select using (auth.uid() = user_id);
create policy "brokers_insert_own" on public.brokers
  for insert with check (auth.uid() = user_id);
create policy "brokers_update_own" on public.brokers
  for update using (auth.uid() = user_id);
create policy "brokers_delete_own" on public.brokers
  for delete using (auth.uid() = user_id);

create trigger brokers_updated_at
  before update on public.brokers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- transactions — THE ledger (design doc §1.6)
-- ---------------------------------------------------------------------------

create table public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  portfolio_id  uuid not null references public.portfolios (id) on delete cascade,
  broker_id     uuid references public.brokers (id) on delete set null,
  asset_id      uuid references public.assets (id),
  type          text not null check (type in
                  ('buy','sell','dividend','deposit','withdrawal','fee',
                   'zakat_payment','purification_payment','adjustment',
                   -- reserved (service-gated in M1; see design doc §11):
                   'split','transfer_in','transfer_out')),
  quantity      numeric(20,8),
  price         numeric(20,6),
  amount        numeric(20,2),
  fees          numeric(20,2) not null default 0 check (fees >= 0),
  currency      text not null default 'AED',
  fx_rate       numeric(20,8) not null default 1,
  trade_date    date not null,            -- market execution date (≠ created_at)
  trade_time    time,                     -- market execution time, optional
  purification_percentage numeric(6,3) default 0
                check (purification_percentage is null
                       or (purification_percentage >= 0 and purification_percentage <= 100)),
  notes         text,
  metadata      jsonb not null default '{}',
  external_ref    text,                   -- broker's transaction id (imports)
  import_batch_id uuid,                   -- one id per import run
  realized_pnl  numeric(20,2),            -- engine-written cache (portfolio cost_method)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- NOTE: every column is guarded with `is not null` BEFORE its comparison —
  -- otherwise a NULL comparison makes the whole OR evaluate to NULL, and
  -- Postgres CHECK constraints PASS on NULL (caught by Phase 1 validation).
  constraint tx_shape check (
    (type in ('buy','sell')      and asset_id is not null
                                 and quantity is not null and quantity > 0
                                 and price is not null and price >= 0) or
    (type = 'dividend'           and asset_id is not null
                                 and amount is not null and amount > 0) or
    (type = 'adjustment'         and asset_id is not null
                                 and quantity is not null
                                 and price is not null and price >= 0) or
    (type = 'split'              and asset_id is not null) or
    (type in ('transfer_in','transfer_out')
                                 and asset_id is not null
                                 and quantity is not null and quantity > 0) or
    (type in ('deposit','withdrawal','fee','zakat_payment','purification_payment')
                                 and asset_id is null
                                 and amount is not null and amount > 0)
  )
);

create index tx_portfolio_asset_idx
  on public.transactions (portfolio_id, asset_id, trade_date, trade_time, created_at);
create index tx_user_idx on public.transactions (user_id, trade_date desc);
create index tx_broker_idx on public.transactions (broker_id) where broker_id is not null;
create unique index tx_external_ref_uq
  on public.transactions (portfolio_id, external_ref) where external_ref is not null;

alter table public.transactions enable row level security;

create policy "transactions_select_own" on public.transactions
  for select using (auth.uid() = user_id);

-- Inserts must reference the caller's own portfolio (and broker, when set).
create policy "transactions_insert_own" on public.transactions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.user_id = auth.uid()
    )
    and (
      broker_id is null
      or exists (
        select 1 from public.brokers b
        where b.id = broker_id and b.user_id = auth.uid()
      )
    )
  );

create policy "transactions_update_own" on public.transactions
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.user_id = auth.uid()
    )
    and (
      broker_id is null
      or exists (
        select 1 from public.brokers b
        where b.id = broker_id and b.user_id = auth.uid()
      )
    )
  );

create policy "transactions_delete_own" on public.transactions
  for delete using (auth.uid() = user_id);

create trigger transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- journal_annotations — psychology decoupled from money (design doc §1.7)
-- ---------------------------------------------------------------------------

create table public.journal_annotations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  transaction_id  uuid not null references public.transactions (id) on delete cascade,
  strategy        text,
  thesis          text,
  setup_quality   int check (setup_quality between 1 and 5),
  emotion         text check (emotion in ('confident','fearful','greedy','patient','rushed','neutral')),
  mistakes        text[] not null default '{}',
  tags            text[] not null default '{}',
  review_status   text not null default 'unreviewed'
                  check (review_status in ('unreviewed','reviewed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (transaction_id)
);

create index journal_annotations_user_idx on public.journal_annotations (user_id);

alter table public.journal_annotations enable row level security;

create policy "journal_annotations_select_own" on public.journal_annotations
  for select using (auth.uid() = user_id);
create policy "journal_annotations_insert_own" on public.journal_annotations
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.transactions t
      where t.id = transaction_id and t.user_id = auth.uid()
    )
  );
create policy "journal_annotations_update_own" on public.journal_annotations
  for update using (auth.uid() = user_id);
create policy "journal_annotations_delete_own" on public.journal_annotations
  for delete using (auth.uid() = user_id);

create trigger journal_annotations_updated_at
  before update on public.journal_annotations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- positions — derived cache, engine-written only (design doc §1.8)
-- Clients: SELECT only. Written by the service layer (service role) after
-- every ledger change; rebuildable from transactions at any time.
-- ---------------------------------------------------------------------------

create table public.positions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  portfolio_id        uuid not null references public.portfolios (id) on delete cascade,
  asset_id            uuid not null references public.assets (id),
  quantity            numeric(20,8) not null default 0,
  average_cost        numeric(20,6) not null default 0,
  cost_basis          numeric(20,2) not null default 0,
  realized_pnl        numeric(20,2) not null default 0,
  dividends_received  numeric(20,2) not null default 0,
  first_acquired_at   date,
  last_transaction_at date,
  computed_at         timestamptz not null default now(),
  unique (portfolio_id, asset_id)
);

create index positions_user_idx on public.positions (user_id);

alter table public.positions enable row level security;

create policy "positions_select_own" on public.positions
  for select using (auth.uid() = user_id);
-- no client insert/update/delete policies: engine writes via service role only

-- ---------------------------------------------------------------------------
-- Signup trigger extension: every new user gets a default portfolio.
-- Replaces the 001 version of handle_new_user (profile + portfolio).
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', null));

  insert into public.portfolios (user_id, name, base_currency, is_default)
  values (new.id, 'Personal', 'AED', true);

  return new;
end;
$$;

-- Backfill: existing users (created under 001) get their default portfolio,
-- using their profile currency. Idempotent: only fills where none exists.
insert into public.portfolios (user_id, name, base_currency, is_default)
select p.id, 'Personal', coalesce(p.currency, 'AED'), true
from public.profiles p
where not exists (
  select 1 from public.portfolios pf where pf.user_id = p.id
);
