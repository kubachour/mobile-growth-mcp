-- Track per-key usage of tools and prompts
create table public.api_key_usage (
  id          bigint primary key generated always as identity,
  key_id      bigint not null references public.api_keys(id),
  method      text not null,       -- 'tool' or 'prompt'
  name        text not null,       -- tool/prompt name
  is_error    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index api_key_usage_key_id_idx on public.api_key_usage (key_id);
create index api_key_usage_created_at_idx on public.api_key_usage (created_at);

-- Summary view: usage counts per key, per day
create or replace view public.api_key_usage_summary as
select
  k.team_name,
  u.key_id,
  date_trunc('day', u.created_at)::date as day,
  u.method,
  u.name,
  count(*) as call_count,
  count(*) filter (where u.is_error) as error_count
from public.api_key_usage u
join public.api_keys k on k.id = u.key_id
group by k.team_name, u.key_id, day, u.method, u.name
order by day desc, k.team_name, call_count desc;

-- Quick lookup: total usage per key
create or replace function public.get_usage_by_key(
  p_key_id bigint default null,
  p_days int default 30
)
returns table (
  key_id bigint,
  team_name text,
  method text,
  name text,
  call_count bigint,
  error_count bigint,
  first_call timestamptz,
  last_call timestamptz
)
language sql stable
as $$
  select
    u.key_id,
    k.team_name,
    u.method,
    u.name,
    count(*) as call_count,
    count(*) filter (where u.is_error) as error_count,
    min(u.created_at) as first_call,
    max(u.created_at) as last_call
  from public.api_key_usage u
  join public.api_keys k on k.id = u.key_id
  where u.created_at >= now() - (p_days || ' days')::interval
    and (p_key_id is null or u.key_id = p_key_id)
  group by u.key_id, k.team_name, u.method, u.name
  order by call_count desc;
$$;
