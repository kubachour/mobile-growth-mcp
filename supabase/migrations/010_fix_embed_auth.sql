-- Fix: invoke_edge_function sends null Authorization when called from pg_cron
-- Use the SUPABASE_SERVICE_ROLE_KEY stored in Supabase secrets (already exists as 'service_role')
-- The anon key is available in vault as 'supabase_anon_key' by default

-- Update invoke_edge_function to use anon key from env when no request context
-- Since the embed function will be deployed with --no-verify-jwt, any valid-looking
-- auth header works. We use the service role key from vault.
create or replace function util.invoke_edge_function(
  name text,
  body jsonb,
  timeout_milliseconds int = 5 * 60 * 1000
)
returns void
language plpgsql
security definer
as $$
declare
  headers_raw text;
  auth_header text;
  anon_key text;
begin
  headers_raw := current_setting('request.headers', true);

  auth_header := case
    when headers_raw is not null then
      (headers_raw::json->>'authorization')
    else
      null
  end;

  -- When called from pg_cron there's no request context
  -- Use the anon key from vault (auto-created by Supabase)
  if auth_header is null then
    select decrypted_secret into anon_key
    from vault.decrypted_secrets
    where name = 'supabase_anon_key';

    if anon_key is not null then
      auth_header := 'Bearer ' || anon_key;
    end if;
  end if;

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
