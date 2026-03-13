-- Pass EMBED_SECRET from vault to the embed Edge Function
-- This authenticates pg_cron → embed calls so the public URL is protected.
--
-- Setup: store the secret in both places:
--   supabase secrets set EMBED_SECRET=<random-value>
--   INSERT INTO vault.secrets (name, secret) VALUES ('embed_secret', '<same-value>');

CREATE OR REPLACE FUNCTION util.invoke_edge_function(
  name text,
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
    FROM vault.decrypted_secrets
    WHERE name = 'supabase_anon_key';

    IF anon_key IS NOT NULL THEN
      auth_header := 'Bearer ' || anon_key;
    END IF;
  END IF;

  request_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', auth_header
  );

  -- For the embed function, include the shared secret
  IF name = 'embed' THEN
    SELECT decrypted_secret INTO embed_secret
    FROM vault.decrypted_secrets
    WHERE vault.decrypted_secrets.name = 'embed_secret';

    IF embed_secret IS NOT NULL THEN
      request_headers := request_headers || jsonb_build_object(
        'x-embed-secret', embed_secret
      );
    END IF;
  END IF;

  PERFORM net.http_post(
    url => util.project_url() || '/functions/v1/' || name,
    headers => request_headers,
    body => body,
    timeout_milliseconds => timeout_milliseconds
  );
END;
$$;
