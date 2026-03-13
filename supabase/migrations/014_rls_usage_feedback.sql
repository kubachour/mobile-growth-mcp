-- Enable RLS on api_key_usage and feedback tables (defense-in-depth)
-- All access is through service role in Edge Functions, but RLS ensures
-- no accidental exposure via anon key or direct client access.

ALTER TABLE public.api_key_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usage managed by service role"
  ON public.api_key_usage FOR ALL
  USING (auth.role() = 'service_role');

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feedback managed by service role"
  ON public.feedback FOR ALL
  USING (auth.role() = 'service_role');
