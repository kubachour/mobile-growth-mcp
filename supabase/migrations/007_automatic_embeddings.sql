-- Automatic embeddings pipeline
-- Based on: https://supabase.com/docs/guides/ai/automatic-embeddings
--
-- Requires vault secrets:
--   project_url  → your Supabase project URL (e.g. https://xxx.supabase.co)
-- Requires Edge Function env:
--   OPENAI_API_KEY → stored in Supabase secrets
--   SUPABASE_DB_URL → auto-available

-- Utility schema
create schema if not exists util;

-- Read project URL from vault
create or replace function util.project_url()
returns text
language plpgsql
security definer
as $$
declare
  secret_value text;
begin
  select decrypted_secret into secret_value from vault.decrypted_secrets where name = 'project_url';
  return secret_value;
end;
$$;

-- Invoke an Edge Function from Postgres via pg_net
create or replace function util.invoke_edge_function(
  name text,
  body jsonb,
  timeout_milliseconds int = 5 * 60 * 1000
)
returns void
language plpgsql
as $$
declare
  headers_raw text;
  auth_header text;
begin
  headers_raw := current_setting('request.headers', true);

  auth_header := case
    when headers_raw is not null then
      (headers_raw::json->>'authorization')
    else
      null
  end;

  perform net.http_post(
    url => util.project_url() || '/functions/v1/' || name,
    headers => jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', auth_header
    ),
    body => body,
    timeout_milliseconds => timeout_milliseconds
  );
end;
$$;

-- Clear a column on update (used to null out stale embeddings)
create or replace function util.clear_column()
returns trigger
language plpgsql as $$
declare
    clear_column text := TG_ARGV[0];
begin
    NEW := NEW #= hstore(clear_column, NULL);
    return NEW;
end;
$$;

-- Create the embedding jobs queue
select pgmq.create('embedding_jobs');

-- Generic trigger function: enqueue embedding jobs
create or replace function util.queue_embeddings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  content_function text = TG_ARGV[0];
  embedding_column text = TG_ARGV[1];
begin
  perform pgmq.send(
    queue_name => 'embedding_jobs',
    msg => jsonb_build_object(
      'id', NEW.id,
      'schema', TG_TABLE_SCHEMA,
      'table', TG_TABLE_NAME,
      'contentFunction', content_function,
      'embeddingColumn', embedding_column
    )
  );
  return NEW;
end;
$$;

-- Process queued embedding jobs in batches
create or replace function util.process_embeddings(
  batch_size int = 10,
  max_requests int = 10,
  timeout_milliseconds int = 5 * 60 * 1000
)
returns void
language plpgsql
as $$
declare
  job_batches jsonb[];
  batch jsonb;
begin
  with
    numbered_jobs as (
      select
        message || jsonb_build_object('jobId', msg_id) as job_info,
        (row_number() over (order by 1) - 1) / batch_size as batch_num
      from pgmq.read(
        queue_name => 'embedding_jobs',
        vt => timeout_milliseconds / 1000,
        qty => max_requests * batch_size
      )
    ),
    batched_jobs as (
      select
        jsonb_agg(job_info) as batch_array,
        batch_num
      from numbered_jobs
      group by batch_num
    )
  select array_agg(batch_array)
  from batched_jobs
  into job_batches;

  if job_batches is null then
    return;
  end if;

  foreach batch in array job_batches loop
    perform util.invoke_edge_function(
      name => 'embed',
      body => batch,
      timeout_milliseconds => timeout_milliseconds
    );
  end loop;
end;
$$;

-- Schedule embedding processing every 30 seconds
select
  cron.schedule(
    'process-embeddings',
    '30 seconds',
    $$
    select util.process_embeddings();
    $$
  );

-- Content function for insights: combines title + insight text for embedding
create or replace function embedding_input(rec public.insights)
returns text
language plpgsql
immutable
as $$
begin
  return '# ' || rec.title || E'\n\n' || rec.insight;
end;
$$;

-- Trigger: auto-embed on insert
create trigger embed_insights_on_insert
  after insert
  on public.insights
  for each row
  execute function util.queue_embeddings('embedding_input', 'embedding');

-- Trigger: auto-embed on update of content fields
create trigger embed_insights_on_update
  after update of title, insight, raw_excerpt
  on public.insights
  for each row
  execute function util.queue_embeddings('embedding_input', 'embedding');

-- Trigger: clear stale embedding when content changes
create trigger clear_insight_embedding_on_update
  before update of title, insight, raw_excerpt
  on public.insights
  for each row
  execute function util.clear_column('embedding');
