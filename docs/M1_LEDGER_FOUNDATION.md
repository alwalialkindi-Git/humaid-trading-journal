# M1 — Ledger Foundation: Technical Design Document

Status: **Design for approval — no code yet**
Scope: PRD Milestone 1 + the Instrument Master / computed-holdings requirements (agreed 2026-07)
Supersedes: MVP `trades` / `holdings` / `dividends` as sources of truth

---

## 0. Design goals & non-goals

**Goals**

1. A user never creates a holding by hand. Holdings are **derived** from a transaction ledger.
2. Every asset exists **once** (instrument master), auto-filled from a market data provider.
3. The market data provider is **swappable** behind an interface; the UI never knows which provider is active.
4. Weighted-average cost, realized P&L, and cash balances are computed by one pure, tested engine.
5. MVP data migrates losslessly; old tables are kept until parity is proven.

**Non-goals for M1** (explicitly deferred, with their milestone)

- FX conversion math and multi-currency portfolio totals → M2 (we *store* currency + fx_rate now, we don't convert yet)
- Scheduled/background price refresh (cron) → M2 (M1 refreshes on demand)
- Automated Shariah ratio screening → M3 (M1 carries status via link + override only)
- Purification obligation lifecycle → M4 (M1 preserves the percentage field on dividend events)
- Broker CSV import → M4 (but the `adjustment` event type is designed with import in mind)

---

## 1. Database schema

### 1.1 Overview

```
assets (global)  ←──────────┐
  ↑ asset_id                │ asset_id
portfolios (per user)       │
  ↑ portfolio_id            │
brokers (per user)          │
  ↑ broker_id (optional)    │
transactions (per user) ────┘   ← THE source of truth
  ↑ transaction_id
journal_annotations (per user)

positions (per user, derived cache — rebuildable at any time)
asset_overrides (per user — manual corrections, clearly labeled)
```

### 1.2 `assets` — instrument master (global)

One row per instrument, shared by all users.

```sql
create table public.assets (
  id                uuid primary key default gen_random_uuid(),
  symbol            text not null,             -- display symbol, e.g. 'EMAAR'
  exchange          text not null default '',  -- 'DFM', 'NASDAQ', 'TADAWUL', 'CRYPTO', '' for custom
  name              text not null,
  currency          text not null default 'AED',
  asset_class       text not null default 'stock'
                    check (asset_class in ('stock','etf','crypto','sukuk','fund','commodity','cash','other')),
                    -- 'commodity' covers gold/silver (nisab-relevant, first-class).
                    -- The check is deliberately an extendable constraint: adding
                    -- e.g. 'option' (read-only import tier) later is one ALTER.
  data_tier         text not null default 'manual_custom'
                    check (data_tier in ('automated','semi_automated','manual_custom')),
                    -- automated:      provider resolves symbol + quote + profile
                    -- semi_automated: provider resolves quote; profile manually enriched
                    -- manual_custom:  user/admin creates asset; price updated manually
  isin              text,                      -- universal id for imports/dual listings; non-unique
  sector            text,
  industry          text,
  country           text,
  is_listed         boolean not null default true,   -- false = user-created custom asset
  provider          text,                      -- 'yahoo' | 'twelvedata' | 'mock' | null (custom)
  provider_symbol   text,                      -- provider's canonical id, e.g. 'EMAAR.AE', '2222.SR'
  latest_price      numeric(20,6),
  price_as_of       timestamptz,
  price_is_manual   boolean not null default false,  -- true when latest_price was human-entered
  metadata          jsonb not null default '{}',     -- class-specific facts: sukuk face value/
                                                     -- coupon, option contract terms, property notes
  created_by        uuid references auth.users (id), -- null = system/provider-created
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (symbol, exchange)
);
create index assets_provider_symbol_idx on public.assets (provider, provider_symbol);
create index assets_isin_idx on public.assets (isin) where isin is not null;
```

Future-proofing notes (10-year review): dual-listed issuers (same ISIN, two exchanges) remain two asset rows — correct for pricing; issuer-level concerns (M3 screening) will add a nullable `issuer_id` FK, which is additive. Derivative classes may exist **for read-only import visibility only** — rendered flagged non-compliant, excluded from analytics, with no buy/sell flows; that rule is enforced in the service layer (the product philosophy applies to what we *do* with data, importing a user's real account must not silently hide rows).

**Write path (important):** clients never write `assets` directly. All inserts/updates go through **server-side Next.js Route Handlers** using the `service_role` key (server-only env var). This prevents one user poisoning the shared instrument master. RLS: `select` for all authenticated users; no client `insert/update/delete` policies at all.

Custom (unlisted) assets — private sukuk, local funds — are created through the same server route with `is_listed = false`, `created_by = user`, `provider = null`. They always use manual prices.

**Shariah link:** in M1 the asset's compliance status is *not* a column here (that was the MVP mistake — three copies of the truth). Status is resolved at read time: `screening for asset` (M3 table, M1 stub view over migrated MVP screenings) → overridden by `asset_overrides.shariah_status` if present. Until M3, the stub view maps the migrated `shariah_screenings` rows by asset.

### 1.3 `asset_overrides` — per-user manual corrections

The user may disagree with provider data or the screening verdict. Overrides are **per-user** (they don't pollute the global row) and **always visibly labeled** in the UI.

```sql
create table public.asset_overrides (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  asset_id         uuid not null references public.assets (id) on delete cascade,
  display_name     text,             -- null = no override
  sector           text,
  manual_price     numeric(20,6),
  manual_price_at  timestamptz,
  shariah_status   text check (shariah_status in ('compliant','doubtful','non_compliant','not_reviewed')),
  override_reason  text,             -- required by the UI when shariah_status is set
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, asset_id)
);
-- RLS: standard per-user policies on user_id (all four operations)
```

Effective-value resolution (one place, in the service layer): `override.field ?? asset.field`. Effective price: `override.manual_price ?? asset.latest_price`. If the effective price came from an override or `price_is_manual`, every UI surface shows a "manual" chip.

### 1.4 `portfolios`

```sql
create table public.portfolios (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  base_currency  text not null default 'AED',
  cost_method    text not null default 'average' check (cost_method in ('average','fifo')),
                 -- accounting method per portfolio. M1 implements 'average' only;
                 -- the ledger preserves every lot, so FIFO is recomputable later.
                 -- All stored realized_pnl is a CACHE under this method.
  is_default     boolean not null default false,
  is_archived    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- RLS: standard per-user policies. One default portfolio auto-created on signup
-- (extend the existing handle_new_user trigger).
```

**Authorization rule (10-year review — enables team/family accounts without rework):** the portfolio is the unit of access control. The service layer authorizes every ledger read/write by portfolio ownership — never by ad-hoc `user_id` comparisons scattered through pages. Family/team sharing later = an additive `portfolio_members` table plus swapping RLS policies from `user_id = auth.uid()` to `user_id = auth.uid() OR is_member(portfolio_id)`. No table redesign, no data migration.

### 1.5 `brokers` — where the account lives

Brokers are per-user reference data. A transaction *may* belong to a broker (recommended, not required — users back-filling history may not remember).

```sql
create table public.brokers (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  name              text not null,                    -- 'IBKR', 'EFG Hermes', 'Sarwa Trade'…
  country           text,
  account_number    text,                             -- optional, user's own reference
  account_currency  text not null default 'AED',
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- RLS: standard per-user policies (all four operations).
```

Broker vs portfolio: a **portfolio** is the user's *logical* grouping ("Personal", "Hajj fund"); a **broker** is the *physical* account where execution happened. They are orthogonal — one portfolio can span brokers and vice versa. M1 ships broker CRUD, selection on transactions, and filtering; **performance-by-broker** becomes a grouping dimension in Insights (M5) and needs no schema change beyond this.

### 1.6 `transactions` — the ledger

Three distinct timestamps, three distinct meanings:

| Column | Meaning | Example |
| --- | --- | --- |
| `trade_date` (+ optional `trade_time`) | When the trade **executed at the market** | Last Tuesday, 10:31 GST |
| `created_at` | When the user **entered it into Humaid** | Today |
| `updated_at` | Last edit | — |

A trade entered today that happened last week is the normal case, not the edge case; all engine ordering uses trade time, never entry time (except as tiebreaker).

```sql
create table public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  portfolio_id  uuid not null references public.portfolios (id) on delete cascade,
  broker_id     uuid references public.brokers (id) on delete set null,  -- optional, recommended
  asset_id      uuid references public.assets (id),   -- null for pure cash events
  type          text not null check (type in
                  ('buy','sell','dividend','deposit','withdrawal','fee',
                   'zakat_payment','purification_payment','adjustment',
                   -- reserved for corporate actions & account moves (10-year review);
                   -- present in the schema NOW so they never require faking as
                   -- buy/sell pairs (which would corrupt realized P&L). The M1
                   -- service layer rejects them until their engine strategies ship:
                   'split','transfer_in','transfer_out')),
  quantity      numeric(20,8),          -- 8 dp for crypto fractions
  price         numeric(20,6),          -- execution price per unit
  amount        numeric(20,2),          -- cash amount for cash-only events & dividends
  fees          numeric(20,2) not null default 0 check (fees >= 0),
  currency      text not null default 'AED',
  fx_rate       numeric(20,8) not null default 1,     -- to portfolio base ccy; M1 stores, M2 uses
  trade_date    date not null,                        -- market execution date
  trade_time    time,                                 -- market execution time (optional)
  notes         text,
  metadata      jsonb not null default '{}',          -- per-type extras without future
                                                      -- migrations: split ratio, ex-date,
                                                      -- withholding tax, rights terms…
  -- broker-import idempotency (10-year review): re-imports must dedup, and
  -- imported rows must be distinguishable from manual ones forever.
  external_ref    text,                               -- broker's own transaction id
  import_batch_id uuid,                               -- one id per import run
  -- derived, engine-written (never user-entered):
  realized_pnl  numeric(20,2),          -- cache: set on 'sell' rows by the engine,
                                        -- valid under the portfolio's cost_method
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Every column is guarded with `is not null` BEFORE its comparison: a NULL
  -- comparison would make the whole OR NULL, and CHECK constraints pass on
  -- NULL (three-valued logic; caught by Phase 1 validation).
  constraint tx_shape check (
    (type in ('buy','sell')      and asset_id is not null
                                 and quantity is not null and quantity > 0
                                 and price is not null and price >= 0) or
    (type = 'dividend'           and asset_id is not null
                                 and amount is not null and amount > 0) or
    (type = 'adjustment'         and asset_id is not null
                                 and quantity is not null
                                 and price is not null and price >= 0) or
    (type = 'split'              and asset_id is not null) or            -- ratio lives in metadata
    (type in ('transfer_in','transfer_out')
                                 and asset_id is not null
                                 and quantity is not null and quantity > 0) or
    (type in ('deposit','withdrawal','fee','zakat_payment','purification_payment')
                                 and asset_id is null
                                 and amount is not null and amount > 0)
  )
);
create index tx_portfolio_asset_idx on public.transactions (portfolio_id, asset_id, trade_date, trade_time, created_at);
create index tx_user_idx on public.transactions (user_id, trade_date desc);
create index tx_broker_idx on public.transactions (broker_id) where broker_id is not null;
create unique index tx_external_ref_uq on public.transactions (portfolio_id, external_ref)
  where external_ref is not null;   -- import idempotency
-- RLS: standard per-user policies on user_id; insert additionally checks that
-- the portfolio (and broker, when set) belong to auth.uid() (subselects in WITH CHECK).
```

Notes:
- `dividend` keeps a nullable `purification_percentage numeric(6,3) default 0` column — continuity with MVP data; the obligation lifecycle arrives in M4.
- `adjustment` is the escape hatch: opening balances, splits, broker-import reconciliation. Positive quantity adds units at the given unit cost; negative quantity removes units at current average cost (no P&L recognized). Cash adjustments use `asset_id null, amount ±` — represented as `deposit`/`withdrawal` with a `notes` convention in M1 (no extra type).
- **Sign convention:** all stored numbers are positive; the *type* determines cash direction. The engine, not the row, knows that a buy debits cash. This keeps forms and validation simple.
- Ledger is **append-mostly**: edits and deletes are allowed in M1 (personal tool, mistakes happen) but always trigger a full recompute for that (portfolio, asset) and set `updated_at`. A true audit trail is M5.

### 1.7 `journal_annotations` — psychology decoupled from money

```sql
create table public.journal_annotations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  transaction_id  uuid not null references public.transactions (id) on delete cascade,
  strategy        text,
  thesis          text,                -- "why" — the investor-persona field
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
-- RLS: standard per-user policies.
```

### 1.8 `positions` — derived cache

Never user-written. Rebuilt by the engine; safe to truncate and regenerate at any time.

```sql
create table public.positions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  portfolio_id        uuid not null references public.portfolios (id) on delete cascade,
  asset_id            uuid not null references public.assets (id),
  quantity            numeric(20,8) not null default 0,
  average_cost        numeric(20,6) not null default 0,
  cost_basis          numeric(20,2) not null default 0,
  realized_pnl        numeric(20,2) not null default 0,   -- lifetime, incl. closed
  dividends_received  numeric(20,2) not null default 0,
  first_acquired_at   date,
  last_transaction_at date,
  computed_at         timestamptz not null default now(),
  unique (portfolio_id, asset_id)
);
-- RLS: per-user SELECT only; writes happen via the server (service role) or a
-- SECURITY DEFINER recompute function — decided below (§3.4).
```

Market value, unrealized P&L, allocation %, and Shariah status are **not stored** — they're joined at read time from `assets`/`asset_overrides` (price moves shouldn't require rewriting positions). Rows with `quantity = 0` are kept (they hold lifetime realized P&L and dividend history for the position detail view).

### 1.9 Cash

No cash table. Cash is one aggregation over the ledger (see §3.3), grouped **per (portfolio, currency)** — a portfolio can legitimately hold AED and USD cash simultaneously, and collapsing them into one number would be wrong the moment a user buys a US stock from an AED account. If profiling ever shows this is slow (it won't at personal scale), we add a cached balance table — not before.

---

## 2. Market data layer

### 2.1 Provider evaluation

| Provider | Free tier | GCC coverage (DFM/ADX/Tadawul) | Key needed | Risk |
| --- | --- | --- | --- | --- |
| **Yahoo Finance** (unofficial, `yahoo-finance2` npm) | Unlimited-ish, no key | **Best free option**: Tadawul (`2222.SR`), UAE (`EMAAR.AE` etc.), US, crypto | No | Unofficial — can break or be blocked; not for a paid product tier |
| **Twelve Data** | 800 credits/day, 8/min | US good; GCC on paid "Grow" plan | Yes | Cost when scaling; credits burn fast with per-symbol calls |
| **Finnhub** | 60 calls/min | US-focused free tier; intl mostly paid | Yes | Weak GCC free coverage |
| **Alpha Vantage** | 25 req/**day** | Poor GCC | Yes | Free tier unusable for a portfolio app |
| **FMP** | 250 req/day | US-centric | Yes | Same |
| **Stooq** | Free CSV | EOD only, thin GCC | No | No search/profile endpoints |

**Decision:**
- **Default provider for M1: Yahoo (`yahoo-finance2`)** — free, keyless, and the only free option with credible DFM/ADX/Tadawul symbols. Its unofficial status is acceptable *because* the abstraction makes it disposable.
- **MockProvider** ships alongside it: deterministic fixtures (the seed-data symbols), used in tests and as automatic fallback when the network/provider fails.
- **TwelveDataProvider is specified but not implemented in M1** — a stub file documents the mapping and exactly where the key goes.
- First task of M1 implementation is a **coverage spike**: verify EMAAR/ADIB/DEWA/SALIK (`.AE`) and Tadawul (`.SR`) actually resolve on Yahoo. If UAE coverage fails, the fallback plan is Yahoo for US/Saudi/crypto + manual tier for UAE until a paid provider lands in M2.

### 2.2 Interface

```ts
// lib/market-data/provider.ts — the ONLY contract the rest of the app sees
interface MarketDataProvider {
  readonly id: string;                                  // 'yahoo' | 'twelvedata' | 'mock'
  searchSymbol(query: string): Promise<SymbolSearchResult[]>;  // symbol, name, exchange, currency, assetClass
  getQuote(providerSymbol: string): Promise<Quote>;            // price, currency, asOf, dayChangePct
  getCompanyProfile(providerSymbol: string): Promise<CompanyProfile>; // name, sector, industry, country
  getHistoricalPrices(providerSymbol: string, range: Range): Promise<PricePoint[]>; // M2 consumer; defined now
}
```

`updatePricesForPortfolio()` is deliberately **not** on the provider — it's an orchestration concern. It lives in `lib/services/market-data-service.ts`, which: resolves the active provider from config, batches distinct provider_symbols across a user's positions, applies per-provider throttling, writes `assets.latest_price/price_as_of`, and falls back to cache + `MockProvider` on failure.

### 2.3 Configuration & runtime placement

- `MARKET_DATA_PROVIDER=yahoo | twelvedata | mock` (server env; defaults to `yahoo`, falls back to `mock` if the provider errors at startup).
- `TWELVE_DATA_API_KEY=...` — **documented in `.env.example` with a comment marking exactly this slot**; unused until the provider is enabled.
- All provider calls run **server-side only** (Route Handlers: `/api/market/search`, `/api/market/quote`, `/api/market/refresh`), because (a) keys must not reach the client, (b) Yahoo calls from browsers get CORS-blocked and rate-limited per user, (c) the server can write the shared `assets` cache with the service role.
- Caching policy (M1, on-demand): serve `assets.latest_price` if `price_as_of` < 15 minutes old; otherwise refresh-on-read with a 3s budget, else serve stale with a staleness indicator. "Refresh prices" button on Portfolio triggers `refresh` for that portfolio's symbols. Cron refresh is M2.

### 2.4 Market coverage tiers & UAE market support

**Coverage tiers.** Every asset carries a `data_tier` (§1.2):

| Tier | Meaning | Price updates | Profile |
| --- | --- | --- | --- |
| `automated` | Provider resolves symbol + quote + profile | Provider | Provider |
| `semi_automated` | Provider resolves quote; profile is thin/absent | Provider | Manually enriched (labeled) |
| `manual_custom` | No provider resolution | Manual, with `price_as_of` date | Manual |

The tier is set when the asset is created (search result → `automated`/`semi_automated` based on profile completeness; custom creation → `manual_custom`) and can be upgraded later when a provider starts resolving the asset (M2 re-link job).

**UAE exchange metadata.** A global `exchanges` reference table (seeded in the migration, service-role writable only):

| Code | MIC | Name | Country | Currency |
| --- | --- | --- | --- | --- |
| `DFM` | `XDFM` | Dubai Financial Market | UAE | AED |
| `ADX` | `XADS` | Abu Dhabi Securities Exchange | UAE | AED |
| `NASDAQ_DUBAI` | `DIFX` | Nasdaq Dubai | UAE | USD/AED (per instrument — asset `currency` decides) |

(Also seeded: NASDAQ/XNAS, NYSE/XNYS, NYSE Arca/ARCX, Tadawul/XSAU, and a `CRYPTO` pseudo-exchange — so UAE rows aren't special cases.) `assets.exchange` stores the code; the table supplies MIC/country/display metadata. Deliberately **no FK** from assets → exchanges: custom assets may carry an empty or unknown exchange, and the reference table must be extendable without blocking asset creation.

**DFM (automated/semi_automated).** Yahoo is the M1 default where it resolves (`EMAAR.AE`, `DEWA.AE`, `SALIK.AE` — verified in §10). Tier per asset depends on profile quality: full profile → `automated`; quote-only → `semi_automated` with manual enrichment.

**ADX (manual_custom in M1).** Confirmed in §10: Yahoo has no ADX coverage, and its only "ADIB" is ADIB *Egypt* (Cairo). Hard rules:
- Never rely on Yahoo for ADX; never auto-select a match from another exchange/country.
- ADX assets require **exact exchange confirmation** by the user before creation.
- When the provider can't resolve an ADX symbol, the flow offers **"Create custom UAE asset"** pre-filled with exchange = ADX, currency = AED.

**Search UX rules (binding for §4.1 implementation):**
1. Every search result always displays **exchange + country + currency**.
2. A fuzzy match from a different exchange/country is never auto-selected — selection is always an explicit user click on a fully-labeled row.
3. If the user searches "ADIB" and only ADIB Egypt (`EGS60111C019.CA`, Cairo, EGP) appears, the UI shows a warning ("This is Abu Dhabi Islamic Bank **Egypt** on the Cairo exchange — not the ADX listing") and does **not** select it. This exact scenario is a required UI test case.
4. Every result list ends with **"Create custom UAE asset"** (and generic "create custom asset").

**Manual UAE asset creation** (fields → schema mapping): symbol → `symbol`; company name → `name`; exchange → `exchange` (picker from `exchanges`, UAE codes surfaced first); currency → `currency` (defaulted from exchange); sector → `sector`; industry → `industry`; ISIN (optional) → `isin`; latest price → `latest_price` (+ `price_is_manual = true`); price date → `price_as_of`; source note → `metadata.price_source_note`. Tier: `manual_custom`.

**Full participation guarantee:** the engine and services operate on `asset_id` and never branch on `data_tier` — manual/custom UAE assets participate identically in transactions, average cost (FIFO later), positions, P&L, allocation, zakat, Shariah screening (manual tier), and purification. `data_tier` affects only *where prices and profiles come from* and how they're labeled. This is a stated invariant, enforced by engine tests that run the same suite over an automated and a manual asset.

**Provider lineup (M1):** Yahoo = default (free, keyless). **Stubs (interface-complete, unimplemented): Twelve Data and EODHD** — each stub documents its symbol mapping and the exact env key slot (`TWELVE_DATA_API_KEY`, `EODHD_API_TOKEN`). No paid API is required in M1. **ADX automated coverage is an M2 decision requiring paid-provider validation** (both Twelve Data Grow and EODHD claim ADX; verify with a trial key against ADIB/FAB/ALDAR before purchase).

---

## 3. Calculation rules (the engine)

One pure module: `lib/engine/positions.ts`. Input: ordered transactions for one (portfolio, asset). Output: position state + per-sell realized P&L. No I/O, no Supabase — fully unit-testable. This is the most-tested code in the product.

Two structural rules from the 10-year review:

1. **The engine computes in the asset's currency.** Cost basis, average cost, and realized P&L for a USD stock are USD numbers — always. Conversion to the portfolio's base currency happens only in the read layer at display time (M2 fx). Anything else means a future base-currency change silently corrupts every historical cost basis.
2. **Cost method is a strategy parameter.** M1 ships `average` only, but the engine's interface takes the portfolio's `cost_method`, and per-sell `realized_pnl` is defined as "cache under that method" — switching a portfolio to FIFO later means recompute, not migration.

### 3.1 Ordering

Replay in `(trade_date asc, trade_time asc NULLS LAST, created_at asc)`. Execution time wins when provided; within a day, timed transactions come before untimed ones, and untimed ones follow entry order. The transaction form surfaces this ("add the execution time to control same-day ordering") and the position detail view shows the replay order explicitly. `created_at` never affects ordering across different trade dates — a trade entered today that happened last week replays in last week's place, and triggers the standard backdated recompute.

### 3.2 Rules

| Event | Effect on position | Effect on cash |
| --- | --- | --- |
| **buy** | `qty += q`; `cost_basis += q·price + fees` (fees capitalized); `avg_cost = cost_basis / qty` | `− (q·price + fees)` |
| **sell** | `realized = q·(price − avg_cost) − fees`; `qty −= q`; `cost_basis −= q·avg_cost` (avg_cost unchanged) | `+ (q·price − fees)` |
| **dividend** | `dividends_received += amount` (position unchanged) | `+ amount` |
| **adjustment (q > 0)** | like a buy at stated unit cost, no cash effect | none |
| **adjustment (q < 0)** | removes units at current avg_cost, **no P&L recognized**, no cash effect | none |
| **deposit / withdrawal** | — | `+ / − amount` |
| **fee / zakat_payment / purification_payment** | — | `− amount` |

Worked example (the agreed formula): buy 10 @ 100 (fees 0) → basis 1000; buy 20 @ 130 → basis 3600, qty 30, **avg = 120**. Sell 15 @ 140 (fees 10): realized = 15·(140−120) − 10 = **290**; remaining qty 15, basis 1800, avg still 120.

**Decisions made explicit (flag now if you disagree):**
1. **Fees are capitalized into cost basis on buys** and deducted from proceeds on sells (standard for average-cost accounting; keeps "unrealized P&L" honest about total cost).
2. **Average cost method, not FIFO lots.** Matches your formula, matches how retail investors think, and sidesteps lot-tracking UI. FIFO could be added later as a reporting view since the ledger preserves every lot.
3. **Selling more than held is rejected** at validation (form + service + engine). No shorts, structurally — per product philosophy. The error suggests an `adjustment` if the user is establishing history.
4. **Realized P&L is stored on the sell row** (`realized_pnl`) *and* accumulated on the position — stored values are engine-written and recomputed on any ledger change for that asset, never trusted from the client.

### 3.3 Cash balance

`cash(portfolio, currency) = Σ deposits − Σ withdrawals + Σ (sell proceeds − sell fees) − Σ (buy cost + buy fees) + Σ dividends − Σ (fee + zakat + purification payments)` — one SQL aggregation in the service layer, **grouped by transaction currency**. The Cash tab lists one balance line per currency held.

**Negative cash is allowed but warned** ("your ledger shows more spent than deposited — add a deposit or opening balance"). Blocking would punish users who don't back-fill deposits; silently allowing would hide errors. Warning is the correct middle.

### 3.4 Recompute strategy

- **When:** after any insert/update/delete of a transaction touching (portfolio, asset) — synchronously in the same server action/route, then `router.refresh()`. Recompute scope is per (portfolio, asset): replaying even thousands of rows is sub-millisecond.
- **How (M1):** the Next.js server (service layer) reads the transactions, runs the engine, upserts `positions` and the affected `realized_pnl` values using the **service role** client. Rationale vs. a `SECURITY DEFINER` SQL function: the engine must exist in TS anyway (form previews, tests); duplicating it in plpgsql doubles the bug surface. Tradeoff acknowledged: a direct-to-Postgres write bypassing our API would leave a stale cache — acceptable in M1 because all writes flow through our service layer; revisit if we ever open direct DB access.
- **Rebuild-all** maintenance path: service function that truncates a user's positions and replays the full ledger (used by migration verification and as a support tool).

---

## 4. UI flows

### 4.1 "Add Transaction" replaces "Add Holding" everywhere

Global primary button (topbar + Portfolio + Journal): **Add Transaction** → type selector (Buy · Sell · Dividend · Deposit · Withdraw · Fee/Payment) → per-type form in a dialog.

**Buy flow:**
1. Symbol field with typeahead → `/api/market/search` → results show `symbol · name · exchange · currency` (exchange disambiguates EMAAR on DFM vs anything similarly named). Selecting a result upserts the asset server-side and auto-fills name/exchange/currency/sector; a quote pre-fills price (editable — execution price ≠ current price).
2. "Can't find it?" → **create custom asset** inline (name, class, currency; manual price) — the unlisted tier.
3. Fields: portfolio (defaulted), broker (optional dropdown with inline **"+ new broker"** creation — name/country/currency in a mini-form), **trade date** and optional **trade time** (labeled "when the trade executed at the market", defaulting to today but explicitly editable for back-filled history), quantity, execution price, fees, currency (defaulted from asset), notes. Collapsed section: **"Journal this decision"** → strategy/thesis/tags (+ emotion/setup/mistakes when persona = trader). Basic entry ≤ 10 seconds.

**Sell flow:** asset picker limited to open positions in the selected portfolio; shows held qty + avg cost; qty validated ≤ held; **live realized P&L preview** computed by the same engine module the server uses.

**Dividend:** asset picker (open or previously-held positions), amount, date; purification % field carried over from MVP UX.

**Cash flows:** amount, date, notes.

### 4.2 Portfolio page (computed)

- **Positions tab:** table per §PRD — qty, avg cost, cost basis, effective price (+staleness/manual chip), market value, unrealized P&L (value & %), lifetime realized P&L, dividends, allocation %, Shariah badge. "Refresh prices" button with `price_as_of` timestamp. Row expand → position detail: transaction replay list (with per-sell realized P&L), dividends, annotations, override panel.
- **Override panel** (per asset): display name, sector, manual price, Shariah status (+ required reason). Every overridden value renders with a `manual` chip and "reset to provider value" affordance.
- **Cash tab:** balance + the cash-affecting ledger; negative-balance warning banner.
- **Income tab / Allocation tab:** as PRD §8.2, computed from ledger + positions.
- Old **Holdings** and **Dividends** routes 301 into Portfolio tabs; old **Trades** routes into Journal. No dead links.

### 4.3 Journal

The MVP trades table becomes the **Log**: ledger events filtered to buy/sell/dividend, annotation status visible, quick-annotate inline. Calendar becomes a tab. The MVP full trade form dies; annotation editing happens on the transaction.

### 4.4 Brokers in the UI

- **Management:** Settings → Brokers (CRUD list: name, country, account number, currency, notes). Also creatable inline from the transaction form (§4.1).
- **Selection:** optional broker dropdown on every transaction type (buys/sells especially); remembered as the default for the next transaction.
- **Filtering:** broker filter chip on the Journal Log and on Portfolio → Positions/Cash (positions filtered by broker are computed by replaying only that broker's transactions — a view over the ledger, not a second cache).
- **Later (M5):** performance-by-broker grouping in Insights; requires no schema change.

---

## 5. Migration plan (MVP → ledger)

### 5.1 Principles

Old tables are **renamed, never dropped** in M1 (`trades → legacy_trades`, etc., after verification passes). Migration is a one-time, per-user, idempotent script with a **dry-run mode** that prints its plan and parity report without writing.

### 5.2 Steps

1. **Portfolio bootstrap:** create default portfolio `"Personal"` (base currency = profile currency) per user.
2. **Asset extraction:** distinct `(symbol, market)` across `trades ∪ holdings ∪ dividends ∪ watchlist ∪ shariah_screenings` → `assets` rows (`exchange = market`, `provider = null` initially; a post-step tries to link each to a Yahoo symbol and backfills provider fields). MVP `holdings.current_price` → `assets.latest_price` with `price_is_manual = true`.
3. **Cash:** `profiles.cash_balance` → one `deposit` transaction ("Opening balance — migrated") dated at the user's earliest MVP record.
4. **Trades → ledger:**
   - closed trade → `buy` (entry_date, entry_price, fees) + `sell` (exit_date, exit_price, fees 0 — MVP stored one combined fee, attach it to the buy; documented) + one `journal_annotation` on the **buy** carrying strategy/emotion/mistakes/notes/tags.
   - open trade → `buy` + annotation.
   - MVP `side='sell'` rows (the pseudo-short) → migrated as a **note-flagged pair** (`adjustment` in + `sell`) preserving their P&L, with `notes = 'migrated from MVP sell-side trade'`. There are few of these by construction; they must not silently vanish.
5. **Dividends →** `dividend` transactions (amount, date, purification %, notes).
6. **Holdings reconciliation (the double-count problem):** after steps 4–5, compute positions from the migrated ledger, then diff against MVP `holdings` per asset:
   - ledger qty **<** holdings qty → create an `adjustment` (+diff at the holding's `average_cost`), noted "opening balance — migrated from holdings".
   - ledger qty **=** holdings qty → nothing (the trades already explain the position).
   - ledger qty **>** holdings qty → **do not delete user data**; keep ledger as truth, flag the asset in the migration report for user review.
   This rule set means a user whose ADIB appears as both an open trade *and* a holding ends up with exactly one correct position.
7. **Shariah:** `shariah_screenings` → M1 stub screening table keyed by `asset_id` (manual tier, feeds badges until M3). `holdings.shariah_status` / `watchlist.shariah_status` values that disagree with the screening → `asset_overrides` rows (reason: "migrated from MVP").
8. **Watchlist:** gets `asset_id` FK backfilled; page otherwise unchanged in M1.
9. **Brokers:** nothing to migrate — the MVP has no broker concept. `broker_id` stays null on all migrated rows; users attribute brokers going forward (or by editing history if they wish).

### 5.3 Verification (parity gates — migration fails loudly if any gate fails)

- Per-asset: position qty and avg cost equal MVP holdings (±0.01) wherever step-6 case 1 or 2 applied.
- Global: Σ engine `realized_pnl` equals MVP `computeTradeStats().realizedPnl` (±0.01) — the MVP calculator is kept temporarily as the test oracle.
- Cash: derived cash equals migrated `cash_balance` (no other cash events exist yet, so exact).
- Row counts: every MVP trade/dividend row maps to ≥1 ledger row; report lists any unmapped rows.

Rollback: migration writes only new tables; rollback = truncate new tables, nothing legacy was touched.

---

## 6. Edge cases (decided now, not discovered later)

| Case | Behavior |
| --- | --- |
| Sell qty > held | Rejected with actionable error (suggests `adjustment` for opening balances) |
| Backdated transaction inserted/edited/deleted | Normal case by design (`trade_date` ≠ `created_at`); full recompute of that (portfolio, asset); position detail shows replay order |
| Same-day ordering | `trade_time` when provided (timed before untimed), then `created_at` tiebreak; visible in replay view |
| Broker deleted while transactions reference it | `on delete set null` — history survives, broker attribution is simply removed (confirm dialog states this) |
| Fractional quantities | `numeric(20,8)`; forms allow 8 dp for crypto, 4 for equities |
| Asset with no price (custom, or provider gap) | Value shown as "—", excluded from totals *with a visible "n excluded" note* — never silently valued at 0 |
| Stale price | Timestamp chip; >24h turns amber; manual refresh available |
| Provider down / rate-limited | Serve cached price + staleness chip; search falls back to "create custom asset"; MockProvider in dev/tests |
| Same symbol on two exchanges | Uniqueness is (symbol, exchange); search results always show exchange; positions are per asset id, so no collision |
| Dividend on never-held asset | Allowed with a warning (users track external accounts imperfectly) |
| Negative cash | Warning banner, not a block (§3.3) |
| Currency mismatch (asset ccy ≠ portfolio base) | M1: value shown in asset currency with a ccy badge and excluded from base-currency totals (same "n excluded" note); M2 converts properly. Honest > wrong |
| Deleting an asset | Not allowed while any transaction references it; custom assets deletable when unreferenced |
| Timezones | `trade_date`/`trade_time` are plain date/time (market-local intent, as the user recorded them); engine never converts timezones |
| Float precision | DB is `numeric`; engine uses JS numbers with boundary rounding to 2dp (money) / 8dp (qty). Acceptable at personal-portfolio scale; parity gates in §5.3 would catch drift. A decimal lib is a contained future swap inside the engine module |

---

## 7. Implementation plan (order of work)

| # | Phase | Contents | Exit criterion |
| --- | --- | --- | --- |
| 0 | **Provider spike** (½ day) | Verify Yahoo coverage for seed symbols (.AE/.SR/US/crypto) | Coverage table documented; go/no-go on UAE symbols |
| 1 | Schema migration | `supabase/migrations/002_ledger.sql`: all §1 tables (incl. `brokers`, seeded `exchanges`) + RLS + `handle_new_user` extension | Applies cleanly to a fresh and an existing project |
| 2 | Engine | `lib/engine/positions.ts` + exhaustive unit tests (worked examples, edge cases §6) — first test infra in the repo (vitest) | Tests green incl. the §3.2 worked example |
| 3 | Market data layer | Provider interface, YahooProvider, MockProvider, TwelveData + EODHD stubs, `/api/market/*` routes, service-role asset upserts, §2.4 search UX rules | Search→select→asset-created works incl. the ADIB-Egypt warning case; keys documented in `.env.example` |
| 4 | Service layer | `lib/services/`: transactions (CRUD + recompute), positions (read models), cash, portfolios, brokers, overrides | Pages no longer query ledger tables directly |
| 5 | Transaction UI | Add-Transaction dialog (all types), symbol typeahead, sell preview, broker select + inline creation, trade date/time fields, annotation section | All 6 flows usable end-to-end |
| 6 | Portfolio v2 | Computed Positions/Cash/Income/Allocation tabs, broker filter, override panel, refresh button, redirects from old routes | Holdings/Dividends pages retired without dead links |
| 7 | Journal v1 | Log lens over ledger + annotations, broker filter, calendar tab, quick-annotate; Settings → Brokers CRUD | MVP journal parity for traders |
| 8 | Migration | §5 script with dry-run + parity gates; run on seed data | All gates green on seeded account |
| 9 | QA + docs | typecheck/lint/build/tests; README + PRD deltas; smoke test | Definition of done below |

**Definition of done for M1:** a new user can sign up → search "ADIB" → log a buy in <30s → see a live-priced computed position; an MVP user's data migrates with all parity gates green; `positions`/`realized_pnl` are engine-written only; no page writes or reads `trades`/`holdings`/`dividends`; typecheck/lint/build/tests all pass.

Estimated complexity: **L** — roughly 9 working phases; the risk-weighted long poles are phases 3 (provider reality) and 8 (migration correctness).

---

## 8. Risks & tradeoffs

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| **Yahoo unofficial API breaks or blocks** | Medium, ongoing | It's a cache-feeder, not a hard dependency: app degrades to stale prices + manual tier; provider swap is one adapter file; paid provider budgeted for M2 |
| **Yahoo lacks DFM/ADX symbols** | Medium — spike decides | Fallback: manual tier for UAE in M1, paid provider in M2; spike is phase 0 for exactly this reason |
| **Migration double-count / data loss** | Low with §5.6 rules | Dry-run, parity gates, legacy tables retained, per-user idempotency |
| Service-role key now required server-side | Certain (new) | Server-only env var, never `NEXT_PUBLIC_*`; used exclusively in Route Handlers/service layer; documented in PRODUCTION_NOTES |
| Engine-in-TS vs DB-triggers divergence (stale positions cache) | Low | All writes flow through the service layer; rebuild-all tool exists; revisit if direct DB access is ever opened |
| Scope creep toward FX/cron/screening | High (they're adjacent) | Non-goals list §0 is the contract; fx_rate and historical-prices interfaces exist but are consciously dormant |
| Average-cost method disagrees with some users' broker statements (FIFO) | Low | Ledger preserves lots; FIFO can ship later as a *reporting view* without schema change |

---

## 9. Product-owner decisions (RESOLVED — approved 2026-07-08)

1. **Fees capitalized into cost basis on buys** — ✅ approved.
2. **Negative cash warns but does not block** — ✅ approved.
3. **MVP single `fees` value attaches to the buy leg in migration** — ✅ approved.
4. **Default portfolio name: "Personal"** — ✅ approved.

Additional requirements incorporated in this revision (2026-07-08):

- `trade_date` / optional `trade_time` (market execution) are first-class and distinct from `created_at` (entry time); engine ordering uses execution time only (§1.6, §3.1).
- `brokers` table + optional `transactions.broker_id`; broker CRUD, selection, filtering in M1; performance-by-broker in M5 (§1.5, §4.4).

*Document approved. Implementation begins at Phase 0 (provider coverage spike).*

---

## 10. Phase 0 results — Yahoo coverage spike (executed 2026-07-08)

Method: `yahoo-finance2` v3 (Node), testing `search()`, `quote()`, and `quoteSummary(assetProfile)` per symbol. Prices observed were live/previous-close at run time.

| Target | Resolved? | Yahoo ticker | Quote | Profile (sector/industry/country) | Notes |
| --- | --- | --- | --- | --- | --- |
| AAPL (NASDAQ) | ✅ | `AAPL` | ✅ USD, intraday | ✅ full | — |
| MSFT (NASDAQ) | ✅ | `MSFT` | ✅ USD, intraday | ✅ full | — |
| TSLA (NASDAQ) | ✅ | `TSLA` | ✅ USD, intraday | ✅ full | — |
| EMAAR (DFM) | ✅ | `EMAAR.AE` | ✅ AED, same-day | ✅ sector/industry/country | Search on bare "EMAAR" resolves directly |
| ADIB (ADX) | ❌ | — | — | — | **No ADX coverage at all.** `ADIB.AE`/`ADIB.AD`/`FAB.AE`/`ALDAR.AE`/`IHC.AE` all unresolvable; search("Abu Dhabi Islamic Bank") returns only the *Egyptian* listing (`EGS60111C019.CA`, Cairo) — a dangerous near-miss the search UI must not auto-accept |
| 2222 / Aramco (Tadawul) | ✅ | `2222.SR` | ✅ SAR, same-day | ✅ (no employee count) | Tadawul suffix `.SR` |
| SPUS (NYSE Arca) | ✅ | `SPUS` | ✅ USD, intraday | ⚠️ empty (normal for ETFs) | ETF classification comes from search `quoteType`, not profile |
| HLAL (NASDAQ) | ✅ | `HLAL` | ✅ USD, intraday | ⚠️ empty (normal for ETFs) | — |

Additional DFM sanity checks: `SALIK.AE` ✅, `DEWA.AE` ✅ — **`.AE` on Yahoo means DFM only, not UAE generally.**

**Verdict: GO with Yahoo as the M1 default provider**, with these consequences baked into the design:

1. **DFM, Tadawul, US equities/ETFs, crypto: automated tier.** Suffix conventions: none (US), `.AE` (DFM), `.SR` (Tadawul).
2. **ADX: manual tier in M1.** ADIB and all Abu Dhabi listings are created as custom assets with manual prices (exactly the §2.3/§6 fallback). A paid provider with ADX coverage (Twelve Data Grow / EODHD — both claim ADX; verify before purchase) is the M2 decision.
3. **Search UX guard:** results must always display exchange + currency, and never auto-select a lone fuzzy match on a different exchange than the user typed (the ADIB→Cairo near-miss is the test case for this rule).
4. **ETF handling:** sector/industry left null for ETFs; `asset_class` comes from search `quoteType` (`EQUITY`→stock, `ETF`→etf).
5. Profile employee counts and some fields are absent for non-US listings — none are M1-required fields.

Phase 0 exit criterion met. Proceed to Phase 1 (schema migration) on product-owner go-ahead.

---

## 11. Ten-year architectural review (executed 2026-07-08, pre-implementation)

Every M1 schema decision was stress-tested against the long-horizon capability list (multi-portfolio/broker/currency/exchange/country, accounting methods, Shariah methodologies, AI, mobile, team/family, broker import, live data, dividends, corporate actions, splits, rights, spin-offs, read-only options, crypto, sukuk, real estate, gold, cash). Verdict: **the ledger + instrument-master core holds; six additive gaps were closed in this revision.**

| # | Change applied | Future capability it protects |
| --- | --- | --- |
| 1 | `transactions.external_ref` + `import_batch_id` + partial unique index | Broker import idempotency; imported vs manual rows distinguishable forever |
| 2 | Reserved types `split` / `transfer_in` / `transfer_out` (+ `tx_shape` clauses), service-gated in M1 | Corporate actions and inter-broker moves never faked as buy/sell (which would corrupt realized P&L) |
| 3 | `transactions.metadata jsonb` | Split ratios, ex-dates, withholding tax, rights terms — per-type extras without future migrations |
| 4 | `portfolios.cost_method` ('average' now, 'fifo' reserved); engine takes method as strategy; `realized_pnl` defined as cache-under-method | Multiple accounting methods by recompute, not migration |
| 5 | `assets.isin` (indexed) + `assets.metadata jsonb` + `'commodity'` asset class | Imports & dual listings keyed by ISIN; sukuk/option/real-estate specifics; gold/silver first-class for nisab |
| 6 | Cash per (portfolio, **currency**); engine computes in **asset currency**, conversion only at read time | Multi-currency correctness; base-currency changes can never corrupt historical cost bases |

Decisions confirmed as already future-proof (no change): portfolio as the access-control pivot (family/team accounts = additive `portfolio_members` + RLS policy swap); brokers as per-account rows; `(symbol, exchange)` asset identity with additive `issuer_id` path for M3 issuer-level screening keyed `(asset_id, methodology, as_of)`; service-layer-only writes enabling any future client (mobile, API).

Product tension resolved — **read-only options/derivatives**: importable for account fidelity, always rendered flagged non-compliant, excluded from halal analytics, no buy/sell flows. The "structurally impossible" philosophy is enforced where it truly lives: the service layer and the UI, not by hiding rows of a user's real brokerage history.

**Architecture is frozen. Next step: Phase 1 — `supabase/migrations/002_ledger.sql`.**
