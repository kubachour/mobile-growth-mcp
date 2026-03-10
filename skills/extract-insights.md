# Skill: Extract Insights from Raw Content

Process raw content (podcast transcripts, LinkedIn posts, PDFs, community discussions) into structured insight JSON for the Meta Editor knowledge base.

---

## When to Use This

- You have a new podcast transcript, LinkedIn post, PDF, or community discussion
- You want to add its knowledge to the shared Supabase knowledge base
- Run this recipe, then save the output as a JSON file in `data/insights/`

## Input

Raw text content. Can be:
- A podcast transcript (with speaker labels, timestamps)
- A LinkedIn post, carousel, or article
- A PDF export (text)
- A community forum/Slack discussion

## Instructions

Given the raw content below, extract individual insight chunks. Each chunk should be a **single, distinct, actionable piece of knowledge** about mobile advertising. Don't combine unrelated ideas into one chunk.

For each insight, output a JSON object with these fields:

```json
{
  "id": "mb-li-001",
  "title": "Concise name for this insight (descriptive, not clickbait)",
  "insight": "The actual knowledge in 2-5 sentences. Be specific and actionable. Include numbers, thresholds, or concrete advice where available.",
  "raw_excerpt": "The original text this insight came from (1-3 sentences, direct quote or close paraphrase)",
  "source_type": "podcast_transcript | linkedin_post | linkedin_carousel | community_discussion | pdf_guide | notes | other",
  "source_author": "Person who said/wrote this",
  "source_title": "Name of the podcast episode, post, or document",
  "source_date": "YYYY-MM-DD (best estimate if not exact)",
  "growth_gems_edition": null,
  "platform": "meta | google | tiktok",
  "topics": ["array", "of", "topic", "tags"],
  "applies_to": ["array", "of", "applicability", "tags"],
  "confidence": 4,
  "actionable_steps": ["Step 1", "Step 2"]
}
```

### ID format

Use the pattern: `{author_initials}-{source_code}-{number}`

- Author initials: e.g. `mb` for Marcus Burke, `es` for Eric Seufert
- Source code: `li` (LinkedIn), `pt` (podcast transcript), `cd` (community discussion), `pdf` (PDF guide)
- Number: sequential within the file, zero-padded to 3 digits

### Topic vocabulary (prefer these, but add new tags if needed):

| Tag | Meaning |
|-----|---------|
| `scaling` | Breaking spend ceilings, budget scaling |
| `creative_strategy` | Ad creative, formats, iterations, testing |
| `campaign_architecture` | Campaign structure, consolidation vs fragmentation |
| `funnel_strategy` | App vs web funnels, web2app, landing pages |
| `audience_targeting` | Demographics, interests, custom audiences, lookalikes |
| `bid_strategy` | Cost cap, bid cap, lowest cost, value optimization |
| `value_rules` | Meta Value Rules feature |
| `cpi_optimization` | Cost per install optimization |
| `creative_testing` | A/B testing, creative iteration methodology |
| `aso` | App Store Optimization, organic multiplier |
| `measurement` | Attribution, SKAN, AEM, signal quality |
| `attribution` | Attribution models, match rates, WDYHAU |
| `pricing` | Subscription pricing, offer strategy |
| `onboarding` | Trial conversion, user activation |
| `advantage_plus` | ASC, AAC, Advantage+ campaigns |
| `eac` | External Attribution Campaigns (web2app with CAPI) |
| `ad_ranking` | How Meta's auction and ad ranking works |
| `retention` | User retention, LTV optimization |
| `first_party_data` | First-party data collection and usage |
| `surveys` | WDYHAU, post-install surveys |

### Applies_to vocabulary (prefer these, but add new tags if needed):

| Tag | Meaning |
|-----|---------|
| `subscription_apps` | Subscription-based mobile apps |
| `mobile_gaming` | Mobile games |
| `ios` | iOS-specific |
| `android` | Android-specific |
| `mobile` | Generic mobile (both platforms) |
| `web2app` | Web-to-app funnel campaigns |
| `ecommerce` | Web-based sales |

### Confidence (1-5 scale):

| Score | When to use |
|-------|-------------|
| `5` | Practitioner-tested, backed by data, multiple sources agree |
| `4` | Expert opinion with strong reasoning or partial data |
| `3` | Expert opinion from a credible source, but limited data shown |
| `2` | Anecdotal or single mention from a credible source |
| `1` | Theoretical, speculative, or unverified |

### Platform

The ad platform this insight primarily applies to: `meta`, `google`, or `tiktok`. Omit if platform-agnostic.

### Growth Gems Edition

If this insight comes from a Growth Gems newsletter edition, include the edition number or identifier. Otherwise set to `null`.

## Output Format

Output a JSON array of insight objects. Wrap in a code block:

```json
[
  { ... insight 1 ... },
  { ... insight 2 ... }
]
```

## Cross-Reference with Existing Knowledge

After generating the insight JSON, **query the Supabase database** to compare new insights against what's already stored. This step catches duplicates, surfaces contradictions, and upgrades confidence when multiple sources agree.

### How to query

Use the Supabase REST API directly (credentials in `.env`):

```bash
# List all existing insights (slug, title, insight text, metadata)
curl -s "${SUPABASE_URL}/rest/v1/insights?select=slug,title,insight,source_author,topics,confidence,platform" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"

# Or fetch specific slugs for deeper comparison
curl -s "${SUPABASE_URL}/rest/v1/insights?select=slug,title,insight,source_author,confidence&slug=in.(slug-1,slug-2)" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"
```

### What to look for

For each new insight, find existing DB insights that share **topic tags AND keyword overlap** (title + insight text). Then classify each match:

| Category | Criteria | Action |
|----------|----------|--------|
| **Near-duplicate** | Same core point, same or similar author | **Don't add** the new one, or merge new detail into the existing insight |
| **Reinforcement** | Same point from a different source | **Add it** — note the existing slug in the new insight's `raw_excerpt`. Consider bumping the existing insight's confidence if now multi-source confirmed |
| **Complementary** | Related topic, different angle or tactic | **Add it** — both are valuable, they cover different ground |
| **Contradiction** | Directly opposes an existing insight | **Add it** — flag the tension in `raw_excerpt` (e.g., "Note: contradicts [slug] which recommends X — the difference is likely context-dependent: this applies to BAU campaigns while [slug] applies to test campaigns"). Lower confidence if the contradiction is unresolved |
| **Genuinely new** | No meaningful overlap in DB | **Add it** — this is the most valuable type |

### Output

After the JSON file, produce a **comparison summary table** with columns:

- New insight ID
- Related DB slug(s)
- Category (duplicate / reinforcement / complementary / contradiction / new)
- Notes (what's different, what's confirmed, what conflicts)

This table helps the operator decide whether to adjust confidence scores, merge insights, or flag contradictions for further investigation.

## Guidelines

- **One insight per distinct idea**. If a post covers 5 different strategies, that's 5 insights.
- **Be specific**. "Creative diversity helps scaling" is too vague. "Splitting creative types into separate ad sets prevents self-cannibalization and unlocks unique reach per placement" is actionable.
- **Include numbers** when available. Conversion rates, thresholds, budget levels.
- **Skip filler**. Ignore sponsor reads, greetings, small talk in podcasts.
- **Preserve attribution**. Always credit the original speaker/author.
- **actionable_steps can be null** if the insight is conceptual (e.g., explaining how ad ranking works).
- **Context matters for confidence**. If the source is from a different vertical (e.g., ecommerce vs mobile apps), lower confidence by 1-2 points. Note the context gap in the insight text.
