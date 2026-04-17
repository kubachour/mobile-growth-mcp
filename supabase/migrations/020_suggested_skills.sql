-- 020: Suggested skills — staging table for user-proposed skill workflows

CREATE TABLE public.suggested_skills (
  id                bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

  -- Skill identity
  name              text NOT NULL,           -- proposed slug (e.g. "google-weekly-health")
  description       text NOT NULL,           -- one-line summary for the LLM
  when_to_use       text[] NOT NULL DEFAULT '{}',  -- natural-language trigger phrases
  data_sources      text[] NOT NULL DEFAULT '{}',  -- e.g. ["meta_api", "google_ads_api", "csv"]

  -- Content
  content_md        text,                    -- full .md draft (may be null if only described)
  user_description  text,                    -- free-text description if no .md submitted

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

CREATE INDEX suggested_skills_status_idx ON public.suggested_skills (status);
CREATE INDEX suggested_skills_submitted_by_idx ON public.suggested_skills (submitted_by);

-- Auto-update updated_at
CREATE TRIGGER suggested_skills_updated_at
  BEFORE UPDATE ON public.suggested_skills
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS: service_role only (all access goes through Edge Function)
ALTER TABLE public.suggested_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Suggested skills managed by service role"
  ON public.suggested_skills FOR ALL
  USING (auth.role() = 'service_role');
