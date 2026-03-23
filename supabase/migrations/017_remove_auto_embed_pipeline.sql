-- Remove the auto-embed pipeline: pg_cron, pgmq queue, and triggers.
-- Embeddings are now generated during ingestion via the OpenAI API directly.
--
-- Root cause: pg_cron never executed on this Supabase instance (launcher alive
-- but zero job_run_details since project creation). Rather than depend on an
-- unreliable background worker, embedding is now part of the ingestion step.

-- 1. Remove the cron job
SELECT cron.unschedule('process-embeddings');

-- 2. Remove triggers on insights table
DROP TRIGGER IF EXISTS embed_insights_on_insert ON public.insights;
DROP TRIGGER IF EXISTS embed_insights_on_update ON public.insights;
DROP TRIGGER IF EXISTS clear_insight_embedding_on_update ON public.insights;

-- 3. Remove the pgmq queue (also drops the q_embedding_jobs table)
SELECT pgmq.drop_queue('embedding_jobs');

-- 4. Remove utility functions that powered the pipeline
DROP FUNCTION IF EXISTS util.process_embeddings(int, int, int);
DROP FUNCTION IF EXISTS util.invoke_edge_function(text, jsonb, int);
DROP FUNCTION IF EXISTS util.queue_embeddings();
DROP FUNCTION IF EXISTS util.clear_column();

-- Keep: embedding_input(insights) — used by ingestion to build the text for embedding
-- Keep: util.project_url() — may be useful for other Edge Function calls
