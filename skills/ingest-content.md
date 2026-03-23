# Skill: Ingest Content End-to-End

Take raw content (transcript, post, article), extract insights, save to disk, upsert to Supabase, and verify they're searchable. One skill, full pipeline.

---

## Required Input

Before starting, collect from the user:

1. **Raw content** — pasted text (transcript, LinkedIn post, article, etc.)
2. **Source metadata:**
   - Author name
   - Source type (podcast_transcript, linkedin_post, linkedin_carousel, community_discussion, pdf_guide, notes, other)
   - Source title
   - Approximate date (YYYY-MM-DD)
3. **Platform** — `meta`, `google`, `tiktok`, or `cross_platform` (if applicable; omit if platform-agnostic)

If any of these are missing, ask before proceeding.

---

## Steps

### Step 1: Extract Insights

Apply the methodology from `skills/extract-insights.md` to produce a JSON array of insight objects. Follow its schema, ID format (`{initials}-{source_code}-{NNN}`), topic/applies_to vocabularies, and confidence scale exactly. Do not duplicate those definitions here — refer to `extract-insights.md` as the source of truth.

### Step 2: Review with User

Present a summary table before saving:

```
Extracted N insights:

| # | ID | Title | Topics | Confidence |
|---|-----|-------|--------|------------|
| 1 | mb-li-001 | ... | scaling, bid_strategy | 4 |
| 2 | mb-li-002 | ... | creative_strategy | 3 |
```

Ask the user to approve, edit, or remove specific insights. Do not proceed until they confirm.

### Step 3: Save JSON File

Write the JSON array to `data/insights/{filename}.json`.

**Naming convention:** `{author-slug}-{source-code}-{short-descriptor}.json`

- `author-slug`: lowercase, hyphenated author name (e.g., `marcus-burke`)
- `source-code`: `li` (LinkedIn), `pt` (podcast transcript), `cd` (community discussion), `pdf` (PDF guide), `ct` (conference talk), `gg` (Growth Gems), `nt` (notes), `ot` (other)
- `short-descriptor`: 1-3 word slug describing the content (e.g., `scaling-plateaus`)

Examples:
- `marcus-burke-li-scaling-plateaus.json`
- `nathan-hudson-ct-ai-agents.json`
- `growth-gems-gg-124.json`

### Step 4: Build & Ingest

Run:

```bash
npm run build && npm run ingest
```

This will:
1. Validate all JSON files against the schema
2. Upsert all insights to Supabase
3. Generate embeddings via OpenAI for any rows missing them (batched, 100 per API call)
4. Verify all insights have embeddings

Check the output for errors. If validation fails, fix the JSON and retry. If some embeddings fail (transient OpenAI errors), re-run — it's idempotent and only processes rows with NULL embeddings.

**Requires:** `OPENAI_API_KEY` set in `.env`. If not set, insights are upserted but embeddings are skipped (with a warning).

### Step 5: Verify Search

Pick a distinctive keyword or phrase from one of the new insights and run:

```bash
./scripts/test-search.sh "your query here"
```

**If results include the new insight(s):** Done. Report success with the result count.

**If 0 results:** Follow the troubleshooting checklist below.

---

## Troubleshooting: 0 Search Results After Ingestion

Work through this checklist in order:

### 1. Check embedding output

The ingestion script reports how many embeddings were generated and verifies zero NULL embeddings remain. If some failed (transient OpenAI errors), re-run `npm run ingest` — it only processes rows with NULL embeddings.

### 2. Known issues

| Problem | Fix |
|---------|-----|
| `OPENAI_API_KEY` not in `.env` | Add it — embeddings are generated locally during ingestion |
| OpenAI API transient failure | Re-run `npm run ingest` — idempotent, picks up failed rows |
| OpenAI key not in Supabase secrets | `npx supabase secrets set OPENAI_API_KEY=sk-...` (needed for search query embedding) |

### 3. Fallback

Even without embeddings, keyword-based results should still appear (the hybrid search includes full-text keyword matching). If keyword results show up but semantic results don't, re-run ingestion to regenerate embeddings.

---

## Key Files

| File | Role |
|------|------|
| `skills/extract-insights.md` | Extraction methodology, schema, vocabularies |
| `packages/ingestion/src/ingest.ts` | Ingestion CLI (upserts + embeds via OpenAI) |
| `packages/ingestion/src/validate.ts` | Validation rules |
| `packages/shared/src/types.ts` | Canonical types, topic/applies_to vocabulary |
| `scripts/test-search.sh` | Search verification script |
| `data/insights/` | Where JSON files live |
