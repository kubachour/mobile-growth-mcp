-- Fix: parameter "name" is ambiguous with vault.decrypted_secrets.name column
-- Rename parameter to "function_name" to avoid PL/pgSQL column resolution conflict

DROP FUNCTION IF EXISTS util.invoke_edge_function(text, jsonb, integer);

-- Also update process_embeddings to use the renamed parameter
CREATE OR REPLACE FUNCTION util.process_embeddings(
  batch_size int = 10,
  max_requests int = 10,
  timeout_milliseconds int = 5 * 60 * 1000
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  job_batches jsonb[];
  batch jsonb;
BEGIN
  WITH
    numbered_jobs AS (
      SELECT
        message || jsonb_build_object('jobId', msg_id) AS job_info,
        (row_number() OVER (ORDER BY 1) - 1) / batch_size AS batch_num
      FROM pgmq.read(
        queue_name => 'embedding_jobs',
        vt => timeout_milliseconds / 1000,
        qty => max_requests * batch_size
      )
    ),
    batched_jobs AS (
      SELECT
        jsonb_agg(job_info) AS batch_array,
        batch_num
      FROM numbered_jobs
      GROUP BY batch_num
    )
  SELECT array_agg(batch_array)
  FROM batched_jobs
  INTO job_batches;

  IF job_batches IS NULL THEN
    RETURN;
  END IF;

  FOREACH batch IN ARRAY job_batches LOOP
    PERFORM util.invoke_edge_function(
      function_name => 'embed',
      body => batch,
      timeout_milliseconds => timeout_milliseconds
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION util.invoke_edge_function(
  function_name text,
  body jsonb,
  timeout_milliseconds int = 5 * 60 * 1000
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  headers_raw text;
  auth_header text;
  anon_key text;
  embed_secret text;
  request_headers jsonb;
BEGIN
  headers_raw := current_setting('request.headers', true);

  auth_header := CASE
    WHEN headers_raw IS NOT NULL THEN
      (headers_raw::json->>'authorization')
    ELSE
      NULL
  END;

  -- When called from pg_cron there's no request context
  -- Use the anon key from vault (auto-created by Supabase)
  IF auth_header IS NULL THEN
    SELECT decrypted_secret INTO anon_key
    FROM vault.decrypted_secrets ds
    WHERE ds.name = 'supabase_anon_key';

    IF anon_key IS NOT NULL THEN
      auth_header := 'Bearer ' || anon_key;
    END IF;
  END IF;

  request_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', auth_header
  );

  -- For the embed function, include the shared secret
  IF function_name = 'embed' THEN
    SELECT decrypted_secret INTO embed_secret
    FROM vault.decrypted_secrets ds
    WHERE ds.name = 'embed_secret';

    IF embed_secret IS NOT NULL THEN
      request_headers := request_headers || jsonb_build_object(
        'x-embed-secret', embed_secret
      );
    END IF;
  END IF;

  PERFORM net.http_post(
    url => util.project_url() || '/functions/v1/' || function_name,
    headers => request_headers,
    body => body,
    timeout_milliseconds => timeout_milliseconds
  );
END;
$$;
