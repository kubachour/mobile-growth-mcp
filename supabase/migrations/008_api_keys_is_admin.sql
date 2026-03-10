alter table public.api_keys
  add column is_admin boolean not null default false;
