-- Per-account audit results (What Happened)
create table public.account_audits (
  id              bigint primary key generated always as identity,
  api_key_id      bigint not null references public.api_keys(id),
  ad_account_id   text not null,
  platform        text not null check (platform in ('meta', 'google', 'tiktok')),
  audit_date      timestamptz not null default now(),
  findings        jsonb not null default '{}',
  baseline_metrics jsonb not null default '{}',
  recommendations jsonb not null default '[]',
  created_at      timestamptz not null default now()
);

create index account_audits_key_idx on public.account_audits (api_key_id);
create index account_audits_account_idx on public.account_audits (ad_account_id);
create index account_audits_date_idx on public.account_audits (audit_date desc);

-- Per-account learned preferences (What Happened — patterns)
create table public.account_preferences (
  id                  bigint primary key generated always as identity,
  api_key_id          bigint not null references public.api_keys(id),
  ad_account_id       text not null,
  platform            text not null check (platform in ('meta', 'google', 'tiktok')),
  naming_pattern      text,
  architecture_style  text check (architecture_style in ('consolidated', 'split', 'advantage_plus', 'hybrid')),
  typical_budgets     jsonb,
  custom_rules        jsonb,
  updated_at          timestamptz not null default now(),

  unique (api_key_id, ad_account_id, platform)
);

create index account_prefs_key_idx on public.account_preferences (api_key_id);

-- RLS for account tables
alter table public.account_audits enable row level security;
alter table public.account_preferences enable row level security;

-- Service role has full access
create policy "Account audits managed by service role"
  on public.account_audits for all
  using (auth.role() = 'service_role');

create policy "Account preferences managed by service role"
  on public.account_preferences for all
  using (auth.role() = 'service_role');

-- Auto-update updated_at on preferences
create trigger account_preferences_updated_at
  before update on public.account_preferences
  for each row
  execute function update_updated_at();
