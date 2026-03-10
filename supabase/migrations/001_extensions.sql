-- Enable pgvector for semantic search
create extension if not exists vector
with schema extensions;

-- Enable trigram similarity for fuzzy text matching
create extension if not exists pg_trgm
with schema extensions;

-- Enable pgmq for embedding job queue
create extension if not exists pgmq;

-- Enable pg_net for async HTTP calls from Postgres
create extension if not exists pg_net
with schema extensions;

-- Enable pg_cron for scheduled embedding processing
create extension if not exists pg_cron;

-- Enable hstore for dynamic column clearing
create extension if not exists hstore
with schema extensions;
