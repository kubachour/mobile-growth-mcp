alter table public.insights enable row level security;
alter table public.api_keys enable row level security;

-- Insights: anyone with anon key can read (shared knowledge)
create policy "Insights are viewable by anyone"
  on public.insights for select
  using (true);

-- Only service_role can insert/update/delete insights
create policy "Insights are writable by service role"
  on public.insights for all
  using (auth.role() = 'service_role');

-- API keys: only service_role can manage
create policy "API keys managed by service role"
  on public.api_keys for all
  using (auth.role() = 'service_role');
