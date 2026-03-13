-- Feedback from LLMs reporting knowledge gaps and missing capabilities
CREATE TABLE public.feedback (
  id                   bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  key_id               bigint NOT NULL REFERENCES public.api_keys(id),
  category             text NOT NULL CHECK (category IN ('missing_knowledge', 'missing_feature', 'search_quality', 'other')),
  summary              text NOT NULL,
  search_queries_tried text[],
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX feedback_created_at_idx ON public.feedback (created_at);
