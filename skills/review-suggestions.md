# Skill: Review Community Suggestions

Review pending community-submitted insights, check quality and overlap against the existing knowledge base, then approve or reject each one. Admin-only. Works without the MCP server — uses the Supabase REST API directly.

---

## When to Use This

- Admin wants to process the insight suggestion queue
- After `admin-briefing` reports pending suggestions
- Periodic review (weekly or whenever the queue has > 5 pending items)
- User says "review suggestions" or "process the queue"

## What It Needs

- `.env` with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY`
- Admin access (service role key required)
- No Meta API or Google Ads connection needed

## What It Produces

- Summary table of pending suggestions
- Quality assessment per suggestion (completeness, accuracy, overlap with existing KB)
- Approve/reject decision with reviewer notes for each
- New insight rows in the `insights` table for approved suggestions (with embeddings)

---

## Prerequisites

- `.env` must contain `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY`
- Never print, log, or expose these values — load them with `export $(grep -v '^#' .env | grep -v '^$' | xargs)`

---

## Step 1: Fetch Pending Suggestions

```bash
export $(grep -v '^#' .env | grep -v '^$' | xargs)
curl -s "${SUPABASE_URL}/rest/v1/suggested_insights?status=eq.pending&order=id.asc&select=*" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

Present a summary table to the user:

```
## Pending Suggestions ([count])

| ID | Platform | Conf | Title (truncated) | Author | Date |
|----|----------|------|--------------------|--------|------|
```

If 0 pending, report "No pending suggestions" and stop.

---

## Step 2: Quality Assessment

For each suggestion, evaluate these criteria:

### 2a. Completeness Check

| Field | Required | Check |
|-------|----------|-------|
| `title` | Yes | Non-empty, descriptive (not clickbait) |
| `insight` | Yes | 2+ sentences, specific and actionable |
| `source_author` | Yes | Named person or organization |
| `source_type` | Yes | Valid enum value |
| `platform` | Yes | `meta`, `google`, `tiktok`, or `cross_platform` |
| `topics` | Yes | At least 1 tag from the vocabulary in `skills/extract-insights.md` |
| `confidence` | Yes | 1-5 integer |
| `actionable_steps` | Recommended | Array of concrete steps (null OK for conceptual insights) |
| `source_date` | Recommended | YYYY-MM-DD format |
| `raw_excerpt` | Optional | Original text from source |

Flag suggestions missing required fields as **needs-edit**.

### 2b. Confidence Calibration

Cross-check the stated confidence against these criteria:

| Score | Criteria |
|-------|----------|
| 5 | Practitioner-tested, backed by data, multiple sources agree |
| 4 | Expert opinion with strong reasoning or partial data |
| 3 | Expert opinion from a credible source, limited data shown |
| 2 | Anecdotal or single mention from a credible source |
| 1 | Theoretical, speculative, or unverified |

If the insight text doesn't support the stated confidence (e.g., anecdotal claim marked as 5), note the suggested adjustment.

### 2c. Actionability Check

- Does the insight contain **specific, concrete advice**?
- "Creative diversity helps scaling" → too vague, needs improvement
- "Splitting creative types into separate ad sets prevents self-cannibalization" → actionable
- Are `actionable_steps` present and practical?

### 2d. Source Credibility

- Is the author a known practitioner or expert in this space?
- Is the source type accurate (e.g., a podcast transcript shouldn't be marked as `linkedin_post`)?
- Is the date plausible?

---

## Step 3: Overlap Detection

For each suggestion, search the existing knowledge base for semantic overlap. Use the hybrid search endpoint (semantic + keyword):

```bash
./scripts/test-search.sh "key phrase from the suggestion title" --limit 5
```

Run this for each suggestion using its title or the most distinctive phrase from its insight text. You can also query by topic:

```bash
./scripts/test-search.sh "key phrase" --topics '["topic_tag"]'
```

### Classification

Compare each suggestion against the search results:

| Category | Criteria | Action |
|----------|----------|--------|
| **Near-duplicate** | Same core point, same or very similar wording | **Reject** — note the existing slug |
| **Reinforcement** | Same point from a different source/author | **Approve** — note the related slug. Consider bumping the existing insight's confidence if now multi-source confirmed |
| **Complementary** | Related topic, different angle or detail | **Approve** — both are valuable |
| **Contradiction** | Directly opposes an existing insight | **Approve with note** — flag the tension (e.g., "context-dependent: applies to X while [slug] applies to Y") |
| **Genuinely new** | No meaningful overlap found | **Approve** — highest-value additions |

### Present Review Table

```
## Review Results

| ID | Title | Quality | Overlap | Decision | Notes |
|----|-------|---------|---------|----------|-------|
| 38 | Signal optimization... | ✓ OK | New | Approve | No overlap found |
| 39 | Always start signal... | ✓ OK | Complementary to tp-se-004 | Approve | Different angle |
| 40 | Day30 case study... | ✓ OK | Reinforces tp-se-008 | Approve | Multi-source confirmed |
| 41 | Picnic case study... | Conf 3→2 | New | Approve with edit | Single case study, lower confidence |
```

Ask the user to confirm or adjust decisions before proceeding.

---

## Step 4: Execute Approvals and Rejections

### Batch Approve

Use the batch approval script for all suggestions marked "Approve":

```bash
# Approve all pending (default behavior)
export $(grep -v '^#' .env | grep -v '^$' | xargs) && node scripts/batch-approve-suggestions.mjs

# Approve specific IDs only
export $(grep -v '^#' .env | grep -v '^$' | xargs) && node scripts/batch-approve-suggestions.mjs --ids 38,39,40,42

# Dry run first (shows what would happen without writing to DB)
export $(grep -v '^#' .env | grep -v '^$' | xargs) && node scripts/batch-approve-suggestions.mjs --dry-run
```

The script:
1. Fetches each pending suggestion
2. Generates a `cs-` prefixed slug from the title
3. Calls OpenAI to generate the embedding (`text-embedding-3-small`)
4. Upserts into the `insights` table (shared, `owner_key_id: null`)
5. Marks the `suggested_insights` row as `status: 'approved'`

### Reject

```bash
export $(grep -v '^#' .env | grep -v '^$' | xargs) && node scripts/batch-approve-suggestions.mjs --reject --ids 45,46 --notes "Near-duplicate of existing insight tp-se-004"
```

### Approve with Edits

For suggestions that need field overrides before approval, edit them directly via the REST API before running the batch script:

```bash
export $(grep -v '^#' .env | grep -v '^$' | xargs)
curl -s -X PATCH "${SUPABASE_URL}/rest/v1/suggested_insights?id=eq.41" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"confidence": 2, "title": "Improved title here"}'
```

Then approve as normal with the batch script.

---

## Step 5: Verify Ingestion

After approval, verify the new insights are searchable:

1. **Check counts**: Confirm all approved suggestions appear in the `insights` table with embeddings:

```bash
export $(grep -v '^#' .env | grep -v '^$' | xargs)
curl -s "${SUPABASE_URL}/rest/v1/insights?slug=like.cs-*&select=id,slug,embedding&order=id.desc&limit=50" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
has_emb = sum(1 for d in data if d.get('embedding') and len(d['embedding']) > 10)
print(f'Community insights: {len(data)} total, {has_emb} with embeddings, {len(data)-has_emb} missing')
"
```

2. **Search test**: Pick a distinctive phrase from one of the newly approved insights:

```bash
./scripts/test-search.sh "distinctive phrase from new insight"
```

If the new insight appears in results, ingestion is complete. If not, check:
- Was the embedding generated? (check for NULL embedding on the row)
- Is the OpenAI key set in Supabase secrets? (needed for query-time embedding in the search Edge Function)

3. **Confirm no pending remain**:

```bash
export $(grep -v '^#' .env | grep -v '^$' | xargs)
curl -s "${SUPABASE_URL}/rest/v1/suggested_insights?status=eq.pending&select=id" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Pending: {len(d)}')"
```

---

## Quick Reference

| What | How |
|------|-----|
| List pending | `curl ...suggested_insights?status=eq.pending` |
| Search for overlap | `./scripts/test-search.sh "query"` |
| Dry-run approval | `node scripts/batch-approve-suggestions.mjs --dry-run` |
| Approve all | `node scripts/batch-approve-suggestions.mjs` |
| Approve specific | `node scripts/batch-approve-suggestions.mjs --ids 1,2,3` |
| Reject specific | `node scripts/batch-approve-suggestions.mjs --reject --ids 4,5 --notes "reason"` |
| Edit before approve | `curl -X PATCH ...suggested_insights?id=eq.N -d '{...}'` |
| Verify searchable | `./scripts/test-search.sh "phrase from new insight"` |

## Key Files

| File | Role |
|------|------|
| `scripts/batch-approve-suggestions.mjs` | Batch approve/reject script |
| `scripts/test-search.sh` | Hybrid search verification |
| `skills/extract-insights.md` | Quality criteria, topic vocabulary, confidence scale |
| `supabase/functions/_shared/tools.ts` | Canonical tool definitions (approve/reject logic) |
| `supabase/migrations/018_suggestions_and_private_insights.sql` | `suggested_insights` schema |
