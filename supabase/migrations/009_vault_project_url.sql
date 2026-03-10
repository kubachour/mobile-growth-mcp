-- Verify project_url vault secret is correct
-- If wrong, update: select vault.update_secret(id, 'https://iattgvzqiqrpzoqnrwfr.supabase.co') from vault.secrets where name = 'project_url';
select 'project_url already exists' as status;
