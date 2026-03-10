-- Semantic search only
create or replace function match_insights(
  query_embedding extensions.vector(1536),
  match_threshold float default 0.5,
  match_count int default 10,
  filter_topics text[] default null,
  filter_applies_to text[] default null
)
returns table (
  id bigint,
  slug text,
  title text,
  insight text,
  raw_excerpt text,
  source_type text,
  source_author text,
  source_title text,
  source_date date,
  platform text,
  topics text[],
  applies_to text[],
  confidence smallint,
  actionable_steps text[],
  similarity float
)
language plpgsql
set search_path = public, extensions
as $$
begin
  return query
  select
    i.id, i.slug, i.title, i.insight, i.raw_excerpt,
    i.source_type, i.source_author, i.source_title, i.source_date,
    i.platform,
    i.topics, i.applies_to, i.confidence, i.actionable_steps,
    1 - (i.embedding <=> query_embedding) as similarity
  from public.insights i
  where
    i.embedding is not null
    and (1 - (i.embedding <=> query_embedding)) > match_threshold
    and (filter_topics is null or i.topics && filter_topics)
    and (filter_applies_to is null or i.applies_to && filter_applies_to)
  order by i.embedding <=> query_embedding asc
  limit least(match_count, 200);
end;
$$;


-- Hybrid search: keyword + semantic via Reciprocal Rank Fusion
create or replace function hybrid_search_insights(
  query_text text,
  query_embedding extensions.vector(1536),
  match_count int default 10,
  filter_topics text[] default null,
  filter_applies_to text[] default null,
  full_text_weight float default 1.0,
  semantic_weight float default 1.0,
  rrf_k int default 50
)
returns table (
  id bigint,
  slug text,
  title text,
  insight text,
  raw_excerpt text,
  source_type text,
  source_author text,
  source_title text,
  source_date date,
  platform text,
  topics text[],
  applies_to text[],
  confidence smallint,
  actionable_steps text[],
  score float
)
language plpgsql
set search_path = public, extensions
as $$
begin
  return query
  with full_text as (
    select
      i.id,
      row_number() over(order by ts_rank_cd(i.fts, websearch_to_tsquery('english', query_text)) desc) as rank_ix
    from public.insights i
    where
      i.fts @@ websearch_to_tsquery('english', query_text)
      and (filter_topics is null or i.topics && filter_topics)
      and (filter_applies_to is null or i.applies_to && filter_applies_to)
    order by rank_ix
    limit least(match_count, 30) * 2
  ),
  semantic as (
    select
      i.id,
      row_number() over (order by i.embedding <=> query_embedding) as rank_ix
    from public.insights i
    where
      i.embedding is not null
      and (filter_topics is null or i.topics && filter_topics)
      and (filter_applies_to is null or i.applies_to && filter_applies_to)
    order by rank_ix
    limit least(match_count, 30) * 2
  )
  select
    i.id, i.slug, i.title, i.insight, i.raw_excerpt,
    i.source_type, i.source_author, i.source_title, i.source_date,
    i.platform,
    i.topics, i.applies_to, i.confidence, i.actionable_steps,
    (
      coalesce(1.0 / (rrf_k + ft.rank_ix), 0.0) * full_text_weight +
      coalesce(1.0 / (rrf_k + s.rank_ix), 0.0) * semantic_weight
    )::float as score
  from
    full_text ft
    full outer join semantic s on ft.id = s.id
    join public.insights i on coalesce(ft.id, s.id) = i.id
  order by score desc
  limit least(match_count, 30);
end;
$$;


-- List insights: lightweight summaries for LLM reasoning
create or replace function list_insights(
  filter_topic text default null,
  filter_applies_to_value text default null
)
returns table (
  id bigint,
  slug text,
  title text,
  source_type text,
  source_author text,
  platform text,
  topics text[],
  applies_to text[],
  confidence smallint,
  created_at timestamptz
)
language sql
set search_path = public, extensions
as $$
  select
    i.id, i.slug, i.title, i.source_type, i.source_author,
    i.platform,
    i.topics, i.applies_to, i.confidence, i.created_at
  from public.insights i
  where
    (filter_topic is null or filter_topic = any(i.topics))
    and (filter_applies_to_value is null or filter_applies_to_value = any(i.applies_to))
  order by i.created_at desc;
$$;
