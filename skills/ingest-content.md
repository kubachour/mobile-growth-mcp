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

Check for errors. If validation fails, fix the JSON and retry.

### Step 5: Verify Embeddings

After ingestion, check that embeddings were generated for the new insights:

```bash
source .env
# Check new insights for embeddings (replace slugs with your new ones)
curl -s "${SUPABASE_URL}/rest/v1/insights?select=slug&embedding=is.null&slug=in.(xx-li-001,xx-li-002)" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

**If the response is `[]` (empty):** Embeddings exist. Proceed to Step 6.

**If slugs are returned:** Embeddings are missing. The pg_cron auto-embed pipeline may not have run yet (runs every 30s). Wait 60 seconds and check again. If still missing after 2 minutes, generate them manually:

```bash
source .env
# Get IDs of insights missing embeddings
MISSING=$(curl -s "${SUPABASE_URL}/rest/v1/insights?select=id,slug&embedding=is.null" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")

# Build jobs array and call embed function directly (batches of 10)
echo "$MISSING" | python3 -c "
import sys, json
rows = json.load(sys.stdin)
batch_size = 10
for i in range(0, len(rows), batch_size):
    batch = rows[i:i+batch_size]
    jobs = [{'jobId': 900000+i+j, 'id': r['id'], 'schema': 'public', 'table': 'insights', 'contentFunction': 'embedding_input', 'embeddingColumn': 'embedding'} for j, r in enumerate(batch)]
    print(json.dumps(jobs))
" | while IFS= read -r batch; do
  curl -s -X POST "${SUPABASE_URL}/functions/v1/embed" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    -d "$batch" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Completed: {len(d[\"completedJobs\"])}, Failed: {len(d[\"failedJobs\"])}')"
done
```

### Step 6: Verify Search

Pick a distinctive keyword or phrase from one of the new insights and run:

```bash
./scripts/test-search.sh "your query here"
```

**If results include the new insight(s):** Done. Report success with the result count.

**If 0 results:** Follow the troubleshooting checklist below.

---

## Troubleshooting: 0 Search Results After Ingestion

Work through this checklist in order:

### 1. Check embedding count

```bash
source .env
# Count rows missing embeddings
curl -s "${SUPABASE_URL}/rest/v1/insights?select=slug&embedding=is.null" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'{len(d)} insights missing embeddings')"
```

If most rows have `null` embeddings, the embedding pipeline isn't running.

### 2. Generate embeddings manually

The auto-embed pipeline (pg_cron → pg_net → embed function) can fail silently if the auth chain breaks. The reliable fix is to call the embed function directly with the service role key (see Step 5 above).

### 3. Known infrastructure issues

| Problem | Fix |
|---------|-----|
| `embed` function not deployed | `npx supabase functions deploy embed --no-verify-jwt` |
| `embed` rejects pg_cron calls | Redeploy with `--no-verify-jwt` (pg_cron has no auth context) |
| Missing `project_url` vault secret | Insert via SQL Editor: `select vault.create_secret('https://<ref>.supabase.co', 'project_url');` |
| OpenAI key not set | `npx supabase secrets set OPENAI_API_KEY=sk-...` |
| pg_cron sends null auth header | Migration 010 fixes this — `util.invoke_edge_function()` falls back to anon key from vault |

### 4. Fallback

Even without embeddings, keyword-based results should still appear (the hybrid search includes full-text keyword matching). If keyword results show up but semantic results don't, the issue is specifically in the embedding pipeline. Use the manual embed script in Step 5 to unblock.

---

## Key Files

| File | Role |
|------|------|
| `skills/extract-insights.md` | Extraction methodology, schema, vocabularies |
| `packages/ingestion/src/ingest.ts` | Ingestion CLI (upserts to Supabase) |
| `packages/ingestion/src/validate.ts` | Validation rules |
| `packages/shared/src/types.ts` | Canonical types, topic/applies_to vocabulary |
| `scripts/test-search.sh` | Search verification script |
| `data/insights/` | Where JSON files live |
