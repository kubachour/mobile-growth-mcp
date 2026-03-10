# Skill: Audit a Meta Ad Account

Run a structured audit of a Meta ad account against industry best practices from the knowledge base. Produces findings, baseline metrics, and prioritized recommendations.

---

## Knowledge Base Grounding

- **mb-li-002** (Marcus Burke): "Force deconsolidation — split creative types into separate ad sets to prevent self-cannibalization."
- **mb-li-003** (Marcus Burke): "Signal quality > signal volume. Train the algorithm on the event that matters most."
- **mb-li-006** (Marcus Burke): "App Promotion and Web Sales campaigns access different audiences. Scaled brands use both."
- **mb-li-008** / **mb-li-009** (Marcus Burke): Value Rules — bid differently on age, gender, placement within the same ad set.
- **mb-cd-001** (Marcus Burke): "EAC — web campaigns with in-app conversion feedback for subscription apps."
- **ds-pt-005** (Dara Saeed): "ASC campaigns need minimum 20 creatives for optimal performance."
- **lp-pt-001** (Lauren Petrullo): "Meta requires at least 25% creative difference for Andromeda."
- **lp-pt-002** (Lauren Petrullo): "Minimum 6 creatives per offering — 6 unique concepts or 2 concepts × 3 formats."
- **oh-li-001** (Olly Hudson): "Andromeda treats ads with similar first 3 seconds as identical."
- **oh-li-003** (Olly Hudson): "Persona-based ads unlock new audiences 89% of the time."
- **br-li-001** (Ben Radack): "CBO scaling with monthly winner rotation."
- **wk-tw-001** (William Kast): 4 diagnostic metric patterns for performance issues.

---

## Prerequisites

- Meta Marketing API access token (user provides via META_ACCESS_TOKEN)
- Access to MCP tools: `get_meta_campaigns`, `get_meta_adsets`, `get_meta_ads`, `get_meta_insights`, `search_insights`, `get_insight`
- Ad account ID (e.g., `act_123456789`)

## Procedure

### Step 1: Gather Account Structure

Use the Meta tools to pull structure:

```
get_meta_campaigns(ad_account_id="act_123456789")
get_meta_adsets(ad_account_id="act_123456789")
get_meta_ads(ad_account_id="act_123456789")
```

Record:
- Total active campaigns, ad sets, and ads
- Campaign objectives in use
- Bid strategies in use
- Budget distribution across campaigns
- Creative format distribution (video, image, carousel)

### Step 2: Gather Performance Metrics

Pull last 7 days of performance data (rate-limit safe):

```
get_meta_insights(ad_account_id="act_123456789", level="campaign", date_preset="last_7d")
get_meta_insights(ad_account_id="act_123456789", level="account", breakdowns="age,gender", date_preset="last_7d")
get_meta_insights(ad_account_id="act_123456789", level="campaign", breakdowns="publisher_platform,platform_position", date_preset="last_7d")
```

Record baseline metrics:
- Total spend, CPA, ROAS
- CPA by age group
- CPA by placement
- Top/bottom performing campaigns and ad sets

### Step 3: Analyze Against Best Practices

Use `search_insights` and `get_insight` to pull relevant knowledge. Evaluate:

#### Campaign Architecture
- [ ] Is the account over-consolidated (too few campaigns)? [mb-li-002]
- [ ] Are creative types mixed within ad sets (self-cannibalization risk)? [mb-li-002]
- [ ] Is there a mix of App Promotion and Web campaigns? [mb-li-006]
- [ ] Are campaign objectives aligned with business goals?
- [ ] Does the ASC campaign have 20+ creatives? [ds-pt-005]

#### Creative Strategy
- [ ] How many distinct creative concepts are active? Minimum 6 per offering [lp-pt-002]
- [ ] What's the ratio of video to static to carousel?
- [ ] Are creatives at least 25% visually different? [lp-pt-001]
- [ ] Do ads have different first 3 seconds (hooks)? [oh-li-001]
- [ ] Are there persona-based ads targeting different motivators? [oh-li-003]
- [ ] Is there a creative testing structure in place?

#### Audience & Targeting
- [ ] What's the age composition of spend and conversions? [mb-li-010]
- [ ] Are high-value age segments (35+) being reached?
- [ ] Is targeting broad or narrow? Is it appropriate?

#### Bid Strategy & Value Rules
- [ ] What bid strategies are in use?
- [ ] Are Value Rules configured? On which dimensions? [mb-li-008, mb-li-009]
- [ ] Are bid/cost caps set appropriately for the campaign type? [br-li-001]

#### Signal Quality
- [ ] What optimization events are campaigns using? [mb-li-003]
- [ ] Is the account optimizing for the deepest funnel event possible?
- [ ] Is CAPI configured for web campaigns?

#### Funnel Strategy
- [ ] Is the account app-only or does it include web funnels?
- [ ] For subscription apps: are there web-to-app campaigns reaching older demographics? [mb-li-006]
- [ ] Is EAC (External Attribution) being used? [mb-cd-001]

### Step 4: Score and Prioritize

Rate each category on a scale:
- **Green**: Well-optimized, minor tweaks only
- **Yellow**: Room for improvement, moderate impact
- **Red**: Significant issue, high-impact fix needed

### Step 5: Generate Output

Produce a structured output with:

```json
{
  "ad_account_id": "act_123456789",
  "platform": "meta",
  "audit_date": "2026-03-10T00:00:00Z",
  "findings": {
    "campaign_architecture": {
      "score": "yellow",
      "issues": ["All creatives in single ad set — self-cannibalization risk [mb-li-002]"],
      "positives": ["Good campaign objective selection"]
    },
    "creative_strategy": { "score": "...", "issues": [], "positives": [] },
    "audience_targeting": { "score": "...", "issues": [], "positives": [] },
    "bid_strategy": { "score": "...", "issues": [], "positives": [] },
    "signal_quality": { "score": "...", "issues": [], "positives": [] },
    "funnel_strategy": { "score": "...", "issues": [], "positives": [] }
  },
  "baseline_metrics": {
    "total_spend_7d": 12000,
    "avg_cpa": 12.50,
    "cpa_by_age": { "18-24": 18.00, "25-34": 14.00, "35-44": 10.00, "45+": 8.50 },
    "top_placements": ["instagram_reels", "facebook_feed"],
    "active_campaigns": 5,
    "active_ad_sets": 12,
    "active_ads": 45
  },
  "recommendations": [
    {
      "priority": 1,
      "category": "campaign_architecture",
      "action": "Split creative types into separate ad sets to prevent self-cannibalization [mb-li-002]",
      "expected_impact": "high",
      "effort": "low",
      "related_insights": ["mb-li-002", "lp-pt-001"]
    }
  ]
}
```

---

## Notes

- Always explain WHY each finding matters, referencing specific insight IDs from the knowledge base
- Prioritize recommendations by impact/effort ratio
- Compare the account's patterns against the knowledge base, not just generic best practices
- Use `get_insight` to read full insight text when citing specific recommendations
- This audit is a starting point — encourage the user to run it periodically to track improvement
