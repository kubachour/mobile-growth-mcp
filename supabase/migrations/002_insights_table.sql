create table public.insights (
  id            bigint primary key generated always as identity,

  -- Human-readable slug (used as upsert key from JSON files)
  slug          text not null unique,

  -- Core content
  title         text not null,
  insight       text not null,
  raw_excerpt   text,

  -- Source metadata
  source_type   text not null,
  source_author text,
  source_title  text,
  source_date   date,
  growth_gems_edition text,

  -- Classification
  platform      text,
  topics        text[] not null default '{}',
  applies_to    text[] not null default '{}',
  confidence    smallint not null default 3
    check (confidence between 1 and 5),

  -- Actionable content
  actionable_steps text[],

  -- Search infrastructure
  embedding     extensions.vector(1536),
  fts           tsvector generated always as (
                  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(insight, '') || ' ' || coalesce(raw_excerpt, ''))
                ) stored,

  -- Timestamps
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Vector similarity search (HNSW)
create index insights_embedding_idx on public.insights
  using hnsw (embedding extensions.vector_cosine_ops);

-- Full-text search
create index insights_fts_idx on public.insights
  using gin (fts);

-- Array filters
create index insights_topics_idx on public.insights
  using gin (topics);

create index insights_applies_to_idx on public.insights
  using gin (applies_to);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger insights_updated_at
  before update on public.insights
  for each row
  execute function update_updated_at();
