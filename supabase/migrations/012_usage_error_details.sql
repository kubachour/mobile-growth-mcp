-- Add error details, input summaries, and empty-result tracking to usage logs
ALTER TABLE public.api_key_usage
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS tool_input_summary text,
  ADD COLUMN IF NOT EXISTS is_empty_result boolean NOT NULL DEFAULT false;
