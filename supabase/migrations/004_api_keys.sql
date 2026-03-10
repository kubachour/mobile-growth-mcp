create table public.api_keys (
  id          bigint primary key generated always as identity,
  key_hash    text not null unique,
  team_name   text not null,
  created_at  timestamptz not null default now(),
  is_active   boolean not null default true
);

create index api_keys_hash_idx on public.api_keys (key_hash) where is_active = true;
