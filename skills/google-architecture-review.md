# Skill: Google App Campaign Architecture Review

Structure-only audit of Google App Campaigns — checks whether campaign setup, ad group structure, bidding approach, and audience exclusions support efficient scaling.

---

## When to Use This

- User is setting up Google App Campaigns for the first time
- User's campaigns are running but results are inconsistent or below expectation
- User wants to sanity-check their account structure before scaling budget
- After onboarding to Google Ads from another platform
- User mentions running only one campaign type (CPA only, or tROAS only)

## What It Needs

**Option A — Google Ads MCP connected** (official `googleads/google-ads-mcp`, read-only): run the GAQL queries below with its `search` tool. Money fields are in micros; App campaigns are `advertising_channel_type = MULTI_CHANNEL`. If a field errors, check the MCP's field-metadata resources and adjust the query.

Queries: campaigns, ad groups with their App ad assets, and audience criteria (see Procedure).

**Option B — CSV / manual input:** Export from Google Ads UI:
- **Campaigns report**: Columns: `Campaign`, `Campaign type`, `Bidding strategy`, `Target CPA / Target ROAS`, `Budget`, `Status`, `Start date`
- **Ad groups report**: Columns: `Campaign`, `Ad group`, `Status`, `Assets count (video/image/text)`
- **Audiences**: Go to Audiences → check which audience segments are added as exclusions

Paste both exports, or describe your campaign structure in plain text.

## What It Produces

- Structural assessment across 5 dimensions: campaign types, bid strategies, ad group structure, audience exclusions, and asset coverage
- Specific gaps with KB-grounded reasoning
- Prioritized list of structural changes to make before scaling

---

## Knowledge Base Grounding

- **ab-pt-001** (Ashley Black): "Android is a must — Play Store is uniquely high-intent inventory. iOS requires $500+/day minimum, $1,000+/day for subscription apps. Don't run iOS on Google if budget is under that."
- **ab-pt-009** (Ashley Black): "Google does not auto-exclude existing users — you must manually add your existing user list as an audience exclusion in every campaign. Without this, you're paying for re-installs."
- **ab-pt-012** (Ashley Black): "Run CPA and tROAS campaigns side by side. tROAS alone struggles to scale — it optimizes for revenue quality but limits volume. CPA drives install volume, tROAS maximizes value from the best users."
- **ab-pt-007** (Ashley Black): "Algorithms get fatigued. Campaigns running > 90 days with stagnant performance often need a full duplicate (new campaign) to reset the algorithm's optimization state."
- **gg-gem-1293** (ex-Googler): "Add new ad groups rather than increasing bids to scale — new ad groups open new inventory pockets without disturbing the existing campaign's optimization."
- **ab-pt-011** (Ashley Black): "tROAS requires Firebase integration, high event volume (10+ revenue events/day), and risk tolerance. Don't set up tROAS without these prerequisites."
- **ab-pt-019** (Ashley Black): "Google needs 50 installs/day or 10 target events/day to optimize. Below that, the algorithm is guessing. Consolidate campaigns rather than spreading budget too thin."

---

## Procedure

### Step 1: Pull Campaign and Ad Group Structure

**If the Google Ads MCP is connected:**

```sql
# Google Ads MCP → search
SELECT campaign.id, campaign.name, campaign.status, campaign.start_date,
  campaign.advertising_channel_sub_type, campaign.bidding_strategy_type,
  campaign.target_cpa.target_cpa_micros, campaign.target_roas.target_roas,
  campaign_budget.amount_micros, campaign.app_campaign_setting.app_store,
  campaign.app_campaign_setting.bidding_strategy_goal_type,
  campaign.selective_optimization.conversion_actions
FROM campaign
WHERE campaign.advertising_channel_type = MULTI_CHANNEL AND campaign.status != REMOVED

SELECT campaign.name, ad_group.id, ad_group.name, ad_group.status,
  ad_group_ad.ad.app_ad.headlines, ad_group_ad.ad.app_ad.descriptions,
  ad_group_ad.ad.app_ad.images, ad_group_ad.ad.app_ad.youtube_videos
FROM ad_group_ad
WHERE ad_group_ad.ad.type = APP_AD AND ad_group_ad.status != REMOVED
```

**If manual:** Use the CSV exports or description the user provided.

### Step 2: Assess Campaign Type Coverage

Check which campaign types are active:

| Campaign Type | What It Does | Check |
|---------------|--------------|-------|
| App installs (CPA) | Drives install volume, optimizes for cost per install | Should be the base for all accounts |
| App engagement | Re-engages existing users | Separate from install campaigns |
| tROAS (target ROAS) | Optimizes for revenue quality | Requires Firebase + 10+ events/day |

**Flag if:**
- No Android campaign → missing Play Store (highest-intent inventory) [ab-pt-001]
- iOS budget: ~$250/day on tCPA (US + tier 1 combined) is a workable start; below that the algorithm won't get enough signal. Plan $500+/day ($1,000+ for subscription apps) before moving to tROAS / value bidding [ab-pt-001]
- Only tROAS, no CPA campaign → volume will be constrained [ab-pt-012]
- Only CPA, no tROAS → may be leaving high-value user revenue on the table [ab-pt-012]

### Step 3: Check Ad Group Structure

Best practice: each ad group = one creative angle or audience segment. This lets Google learn what works without blending signals.

**Flag if:**
- Single ad group per campaign with all assets mixed → no learnings isolation
- Ad groups running > 90 days with no new assets added → creative pool is stale [ab-pt-007]
- Ad groups with < 3 video assets on iOS campaigns → missing YouTube Shorts and in-stream inventory [ab-pt-003]
- Ad groups with < 5 text asset variants → keyword coverage is thin [ab-pt-004]

### Step 4: Check Audience Exclusions and Signals

```sql
SELECT campaign.name, ad_group.name, ad_group_criterion.type,
  ad_group_criterion.negative, ad_group_criterion.user_list.user_list,
  ad_group_criterion.custom_audience.custom_audience
FROM ad_group_criterion
WHERE campaign.advertising_channel_type = MULTI_CHANNEL AND ad_group_criterion.type IN (USER_LIST, CUSTOM_AUDIENCE, AUDIENCE)
# empty? also check campaign_criterion with the same types
```

**Critical check**: Is the existing user base excluded from install campaigns?

Google does NOT do this automatically. Without exclusions, you're buying re-installs — wasted budget and inflated install numbers.

**What to check:**
- Is a Customer Match list (existing users) excluded from all install campaigns?
- Is a remarketing list (users who installed but didn't convert) used for engagement campaigns?
- Does every ad group have at least one positive audience signal (e.g. a custom segment of ~10 competitor app bundle IDs, Firebase payers)? Search the KB for "audience signals".

**Flag if:** No audience exclusions on any install campaign → almost certain budget waste [ab-pt-009].

### Step 5: Check Bidding Setup

| Signal | Issue |
|--------|-------|
| CPA campaign, < 50 installs/day | Budget too spread out; consider consolidating campaigns |
| tROAS campaign, no Firebase integration | tROAS can't work without Firebase events [ab-pt-011] |
| tROAS campaign, < 10 revenue events/day | Insufficient signal; tROAS will underperform [ab-pt-011] |
| Bids changed > 20% recently | Risk of campaign destabilization [ab-pt-006] |

### Step 6: Output

```
## Google Architecture Review — [date]

### Campaign Structure Overview
- [N] active campaigns: [list types]
- [N] total ad groups
- Budget concentration: [top campaign name] accounts for X% of total spend

### Critical Issues (Fix Before Scaling)

🔴 **No audience exclusions on install campaigns**
Existing users are not excluded — Google is buying re-installs. Add your existing user Customer Match list as an exclusion on all install campaigns immediately. [ab-pt-009]

🔴 **iOS budget below algorithm threshold**
iOS campaign is running at $X/day — below the $500/day minimum for Google to optimize. Either increase budget or pause iOS until budget allows. [ab-pt-001]

### Structural Gaps

🟡 **No tROAS campaign alongside CPA**
You're maximizing install volume but not optimizing for your highest-value users. Add a tROAS campaign once you reach 10+ revenue events/day in Firebase. [ab-pt-012]

🟡 **Single ad group per campaign**
No creative angle isolation. Add a second ad group with a different creative angle to let Google learn what resonates differently. [gg-gem-1293]

### What's Working Well
- [positives]

### Recommended Actions (Priority Order)
1. Add audience exclusions (today — zero cost, immediate budget efficiency gain)
2. ...
```
