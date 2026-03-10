# Meta Editor

## Overview

A platform where users connect their LLM (Claude, ChatGPT, Gemini) and ad platform API key (Meta, Google Ads, TikTok) to get AI-powered campaign optimization. Backed by curated industry knowledge (shared) and per-account audit data (scoped).

Focused on **mobile campaigns**, especially subscription apps.

## Architecture

Three knowledge layers, all accessed via MCP server or REST API:

| Layer | What | Storage | Retrieval |
|-------|------|---------|-----------|
| What Works | Industry best practices | Supabase `insights` + pgvector | Hybrid RAG (semantic + keyword + RRF) |
| What Happened | Past audits, baselines | Supabase `account_audits` | SQL, scoped by api_key |
| What Is | Live campaign data | Not stored | User's ad platform API key |

## Tech Stack

- **Database**: Supabase (PostgreSQL + pgvector + pg_trgm + pgmq + pg_cron)
- **Embeddings**: OpenAI `text-embedding-3-small` (1536d), runs server-side in Supabase Edge Function
- **Interfaces**: MCP server (primary) + Supabase Edge Function (REST)
- **Auth**: Simple API key per team (SHA-256 hashed, no OAuth)
- **Monorepo**: npm workspaces with TypeScript

## Embedding Pipeline

Embeddings are generated **entirely server-side** in Supabase:
- OpenAI API key stored in Supabase secrets (not in local `.env`)
- On insert/update of insights → trigger → pgmq queue → `embed` Edge Function → OpenAI → updates row
- Search: `search` Edge Function embeds the query + runs hybrid search, all server-side
- No AI dependencies in the Node.js packages

## Project Structure

```
packages/shared/src/       — Types, Supabase client
packages/mcp-server/src/   — MCP server with search/list/get tools
packages/ingestion/src/    — CLI to validate & upsert insight JSONs (no embedding)
skills/                    — Prompt recipes (extract-insights, audit-meta-account)
data/insights/             — Curated insight JSON files (git-tracked)
supabase/migrations/       — SQL migrations (001-007)
supabase/functions/embed/  — Edge Function: processes embedding jobs from pgmq
supabase/functions/search/ — Edge Function: embeds query + hybrid search
```

## Commands

```bash
npm run build              # Build all packages
npm run ingest             # Validate & upsert insights to Supabase (embeddings auto-generated)
```

## Supabase Secrets Setup

```bash
supabase secrets set OPENAI_API_KEY=sk-your-openai-key
# project_url must also be set in Supabase Vault for the auto-embed pipeline
```

## Key Conventions

- Insight JSON files go in `data/insights/`, one file per source/topic group
- Each insight has a string `id` (slug like `mb-li-001`), stored as `slug` column, used for upsert
- Topics and applies_to tags: reference vocabulary in `packages/shared/src/types.ts` (not hard enforced)
- Confidence: numeric 1-5 scale
- Embeddings are generated from `# {title}\n\n{insight}` concatenation
- Upsert is idempotent on `slug` — safe to re-run ingestion after edits
- Ad platform API keys are never stored in Supabase — user provides them at connection time
- No UI framework — the MCP server and REST API are the product
