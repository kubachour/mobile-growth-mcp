# Meta Editor

## Overview

A platform where users connect their LLM (Claude, ChatGPT, Gemini) and ad platform API key (Meta, Google Ads, TikTok) to get AI-powered campaign optimization. Backed by curated industry knowledge (shared) and per-account audit data (scoped).

Focused on **mobile campaigns**, especially subscription apps.

## Architecture

Three knowledge layers:

| Layer | What | Storage | Retrieval |
|-------|------|---------|-----------|
| What Works | Industry best practices | Supabase `insights` + pgvector | Hybrid RAG (semantic + keyword + RRF) via Edge Function |
| What Happened | Past audits, baselines | Supabase `account_audits` | SQL, scoped by api_key |
| What Is | Live campaign data | Not stored | User's ad platform API key |

**MCP server architecture**: The npm package (`mobile-growth-mcp`) runs locally via stdio. KB tools (search, list, get) are proxied through the Supabase Edge Function `/functions/v1/mcp` using JSON-RPC + `x-api-key` header. Meta tools run locally (token never leaves user's machine). Tool definitions are fetched dynamically from the Edge Function on startup — adding a tool server-side makes it available to all users without republishing npm.

**Auth**: Per-person API key (`me_` prefix, SHA-256 hashed). Generate with `./scripts/generate-api-key.sh "Name"`. Users only need `API_KEY` env var (+ optional `META_ACCESS_TOKEN`). No `SUPABASE_URL`/`SUPABASE_ANON_KEY` needed for end users.

## Tech Stack

- **Database**: Supabase (PostgreSQL + pgvector + pg_trgm + pgmq + pg_cron)
- **Embeddings**: OpenAI `text-embedding-3-small` (1536d), runs server-side in Supabase Edge Function
- **Interfaces**: MCP stdio server (npm, proxies KB to Edge Function) + Edge Function (JSON-RPC MCP endpoint)
- **Auth**: Per-person API key (SHA-256 hashed, revocable)
- **Monorepo**: npm workspaces with TypeScript

## Embedding Pipeline

Embeddings are generated **entirely server-side** in Supabase:
- OpenAI API key stored in Supabase secrets (not in local `.env`)
- On insert/update of insights → trigger → pgmq queue → `embed` Edge Function → OpenAI → updates row
- Search: `search` Edge Function embeds the query + runs hybrid search, all server-side
- No AI dependencies in the Node.js packages

## Project Structure

```
packages/shared/src/                         — Types, Supabase client (used by ingestion)
packages/mcp-server/src/                     — MCP stdio server (proxies KB tools + prompts to Edge Function, runs Meta tools locally)
packages/ingestion/src/                      — CLI to validate & upsert insight JSONs (no embedding)
skills/                                      — Canonical skill .md files (source of truth for MCP prompts)
data/insights/                               — Curated insight JSON files (git-tracked)
supabase/migrations/                         — SQL migrations (001-007)
supabase/functions/embed/                    — Edge Function: processes embedding jobs from pgmq
supabase/functions/search/                   — Edge Function: embeds query + hybrid search
supabase/functions/_shared/prompts.ts        — Prompt manifest (metadata for each MCP prompt)
supabase/functions/_shared/prompt-content.ts — Generated from skills/*.md (DO NOT EDIT directly)
```

## Commands

```bash
npm run build              # Build all packages
npm run build:prompts      # Generate prompt-content.ts from skills/*.md
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

## Skills Workflow

Skill prompts (MCP prompts) are served from the Edge Function. The canonical source is `skills/*.md`. To add or update a skill:

1. Edit the `.md` file in `skills/`
2. Run `npm run build:prompts` to regenerate `supabase/functions/_shared/prompt-content.ts`
3. Deploy the Edge Function: `supabase functions deploy mcp --no-verify-jwt`

This propagates to all users without an npm republish. For a new prompt, also add its metadata to `supabase/functions/_shared/prompts.ts`.
