-- 018: Community suggestions workflow + private (per-key) insights

-- =============================================================
-- 1. Suggested insights — staging table for community submissions
-- =============================================================

CREATE TABLE public.suggested_insights (
  id                bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

  -- Full insight schema (mirrors insights table)
  title             text NOT NULL,
  insight           text NOT NULL,
  raw_excerpt       text,
  source_type       text NOT NULL,
  source_author     text,
  source_title      text,
  source_date       date,
  platform          text,
  topics            text[] NOT NULL DEFAULT '{}',
  applies_to        text[] NOT NULL DEFAULT '{}',
  confidence        smallint NOT NULL DEFAULT 3
                    CHECK (confidence BETWEEN 1 AND 5),
  actionable_steps  text[],

  -- Workflow
  submitted_by      bigint NOT NULL REFERENCES public.api_keys(id),
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_notes    text,
  reviewed_at       timestamptz,

  -- Timestamps
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX suggested_insights_status_idx ON public.suggested_insights (status);
CREATE INDEX suggested_insights_submitted_by_idx ON public.suggested_insights (submitted_by);

-- Auto-update updated_at (reuse existing trigger function)
CREATE TRIGGER suggested_insights_updated_at
  BEFORE UPDATE ON public.suggested_insights
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS: service_role only (all access goes through Edge Function)
ALTER TABLE public.suggested_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suggested insights managed by service role"
  ON public.suggested_insights FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================
-- 2. Private insights — owner_key_id on insights table
-- =============================================================

ALTER TABLE public.insights
  ADD COLUMN owner_key_id bigint REFERENCES public.api_keys(id);

CREATE INDEX insights_owner_key_idx ON public.insights (owner_key_id)
  WHERE owner_key_id IS NOT NULL;

-- =============================================================
-- 3. Update search functions to respect ownership
-- =============================================================

-- Semantic search: add viewer_key_id filter
CREATE OR REPLACE FUNCTION match_insights(
  query_embedding extensions.vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
  filter_topics text[] DEFAULT NULL,
  filter_applies_to text[] DEFAULT NULL,
  viewer_key_id bigint DEFAULT NULL
)
RETURNS TABLE (
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
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id, i.slug, i.title, i.insight, i.raw_excerpt,
    i.source_type, i.source_author, i.source_title, i.source_date,
    i.platform,
    i.topics, i.applies_to, i.confidence, i.actionable_steps,
    1 - (i.embedding <=> query_embedding) AS similarity
  FROM public.insights i
  WHERE
    i.embedding IS NOT NULL
    AND (1 - (i.embedding <=> query_embedding)) > match_threshold
    AND (filter_topics IS NULL OR i.topics && filter_topics)
    AND (filter_applies_to IS NULL OR i.applies_to && filter_applies_to)
    AND (i.owner_key_id IS NULL OR i.owner_key_id = viewer_key_id)
  ORDER BY i.embedding <=> query_embedding ASC
  LIMIT least(match_count, 200);
END;
$$;


-- Hybrid search: add viewer_key_id filter
CREATE OR REPLACE FUNCTION hybrid_search_insights(
  query_text text,
  query_embedding extensions.vector(1536),
  match_count int DEFAULT 10,
  filter_topics text[] DEFAULT NULL,
  filter_applies_to text[] DEFAULT NULL,
  full_text_weight float DEFAULT 1.0,
  semantic_weight float DEFAULT 1.0,
  rrf_k int DEFAULT 50,
  viewer_key_id bigint DEFAULT NULL
)
RETURNS TABLE (
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
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  WITH full_text AS (
    SELECT
      i.id,
      row_number() OVER(ORDER BY ts_rank_cd(i.fts, websearch_to_tsquery('english', query_text)) DESC) AS rank_ix
    FROM public.insights i
    WHERE
      i.fts @@ websearch_to_tsquery('english', query_text)
      AND (filter_topics IS NULL OR i.topics && filter_topics)
      AND (filter_applies_to IS NULL OR i.applies_to && filter_applies_to)
      AND (i.owner_key_id IS NULL OR i.owner_key_id = viewer_key_id)
    ORDER BY rank_ix
    LIMIT least(match_count, 30) * 2
  ),
  semantic AS (
    SELECT
      i.id,
      row_number() OVER (ORDER BY i.embedding <=> query_embedding) AS rank_ix
    FROM public.insights i
    WHERE
      i.embedding IS NOT NULL
      AND (filter_topics IS NULL OR i.topics && filter_topics)
      AND (filter_applies_to IS NULL OR i.applies_to && filter_applies_to)
      AND (i.owner_key_id IS NULL OR i.owner_key_id = viewer_key_id)
    ORDER BY rank_ix
    LIMIT least(match_count, 30) * 2
  )
  SELECT
    i.id, i.slug, i.title, i.insight, i.raw_excerpt,
    i.source_type, i.source_author, i.source_title, i.source_date,
    i.platform,
    i.topics, i.applies_to, i.confidence, i.actionable_steps,
    (
      coalesce(1.0 / (rrf_k + ft.rank_ix), 0.0) * full_text_weight +
      coalesce(1.0 / (rrf_k + s.rank_ix), 0.0) * semantic_weight
    )::float AS score
  FROM
    full_text ft
    FULL OUTER JOIN semantic s ON ft.id = s.id
    JOIN public.insights i ON coalesce(ft.id, s.id) = i.id
  ORDER BY score DESC
  LIMIT least(match_count, 30);
END;
$$;


-- List insights: add viewer_key_id filter
CREATE OR REPLACE FUNCTION list_insights(
  filter_topic text DEFAULT NULL,
  filter_applies_to_value text DEFAULT NULL,
  viewer_key_id bigint DEFAULT NULL,
  viewer_is_admin boolean DEFAULT FALSE
)
RETURNS TABLE (
  id bigint,
  slug text,
  title text,
  source_type text,
  source_author text,
  platform text,
  topics text[],
  applies_to text[],
  confidence smallint,
  created_at timestamptz,
  owner_key_id bigint
)
LANGUAGE sql
SET search_path = public, extensions
AS $$
  SELECT
    i.id, i.slug, i.title, i.source_type, i.source_author,
    i.platform,
    i.topics, i.applies_to, i.confidence, i.created_at,
    i.owner_key_id
  FROM public.insights i
  WHERE
    (filter_topic IS NULL OR filter_topic = ANY(i.topics))
    AND (filter_applies_to_value IS NULL OR filter_applies_to_value = ANY(i.applies_to))
    AND (
      i.owner_key_id IS NULL           -- shared: everyone sees
      OR i.owner_key_id = viewer_key_id -- private: owner sees
      OR viewer_is_admin                -- admin sees all
    )
  ORDER BY i.created_at DESC;
$$;
