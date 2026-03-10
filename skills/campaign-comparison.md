# Skill: Campaign Comparison Methodology

Reusable step-by-step framework for comparing any two Meta campaigns to identify why one outperforms the other.

---

## Knowledge Base Grounding

- **wk-tw-001** (William Kast): 4 diagnostic metric patterns — Frequency↑+CPA↑ (fatigue), CPM↑+CPA↑ (saturation), CPA↑+CVR↓ (LP mismatch), CTR↓+CPA↑ (creative fatigue).
- **lp-pt-003** (Lauren Petrullo): "Contribution vs attribution — ads feed conversions without getting last-click credit."
- **jl-pt-004** (Jon Loomer): "Don't turn off underperforming ads if aggregate performance is good — they may play a halo role."
- **oh-li-001** (Olly Hudson): "Andromeda treats ads with similar first 3 seconds as identical."

---

## Step 1: Pull Campaign Settings Side-by-Side

```
get_meta_campaigns(ad_account_id="act_123456789")
```

Then filter for the two campaigns being compared.

Compare: objective, bid strategy, daily budget, buying type, how long each has been running.

**Watch for**: Budget set at campaign level vs ad set level. One campaign may have 2x the budget — that alone can explain saturation effects.

---

## Step 2: Pull Ad Set Targeting & Placement Differences

```
get_meta_adsets(ad_account_id="act_123456789", campaign_id="CAMPAIGN_A_ID")
get_meta_adsets(ad_account_id="act_123456789", campaign_id="CAMPAIGN_B_ID")
```

Compare:
- **Geo-targeting**: Single country vs multi-country
- **Placements**: Which publisher_platforms and positions are enabled
- **Audience**: Age range, exclusions, Advantage+ settings
- **Bid amount**: Same cost cap? Different?

**Watch for**: Extra placements in the underperformer (instream_video, reels_overlay, threads are common waste placements for iOS app installs).

---

## Step 3: Pull Aggregate Insights

```
get_meta_insights(
  ad_account_id="act_123456789",
  level="campaign",
  fields="campaign_id,campaign_name,spend,impressions,clicks,cpm,cpc,ctr,reach,frequency,actions,cost_per_action_type",
  date_preset="last_7d"
)
```

Build comparison table:

| Metric | Campaign A | Campaign B | Ratio |
|---|---|---|---|
| Spend | | | |
| Impressions | | | |
| CTR | | | |
| CPM | | | |
| Frequency | | | |
| Installs | | | |
| **CPI** | | | |

**Apply Kast's diagnostic framework** [wk-tw-001] to interpret the metric differences:
- If Campaign B has higher CPM AND higher CPA → audience saturation or poor engagement
- If Campaign B has declining CTR AND higher CPA → creative fatigue
- If Campaign B has higher CPA AND lower CVR → ad-to-landing-page mismatch

---

## Step 4: Run Funnel Analysis

Calculate conversion rates at each step:

| Step | Campaign A | Campaign B |
|---|---|---|
| Impressions | | |
| → Click Rate | | |
| → Install Rate from Impressions | | |

**Watch for**: If Campaign B sends MORE people to the app store but converts at a lower rate, Meta is sending low-intent traffic.

---

## Step 5: Break Down by Placement

```
get_meta_insights(
  ad_account_id="act_123456789",
  level="campaign",
  fields="spend,impressions,cpm,ctr,actions,cost_per_action_type",
  breakdowns="publisher_platform,platform_position",
  date_preset="last_7d"
)
```

For each placement, calculate CPI. Compare:
- Which placements exist in one campaign but not the other?
- What's the CPI range? Tight ($3-$6) = healthy. Wide ($8-$84) = waste.
- How much spend goes to the worst placements?

See `skills/placement-audit.md` for the full placement audit methodology.

---

## Step 6: Break Down by Country (Multi-Geo Campaigns)

```
get_meta_insights(
  ad_account_id="act_123456789",
  level="campaign",
  breakdowns="country",
  date_preset="last_7d"
)
```

**Watch for**: One country eating the majority of budget with poor results.

---

## Step 7: Compare Same Creatives Across Campaigns

```
get_meta_insights(
  ad_account_id="act_123456789",
  level="ad",
  fields="ad_name,adset_name,spend,impressions,actions,cost_per_action_type",
  sort="spend_descending",
  limit=50
)
```

Match ads by creative name across campaigns.

If the same creatives consistently perform 2-3x worse in one campaign, the problem is **not** creative quality — it's the campaign environment.

**Check for creative similarity** [oh-li-001]: Are ads in the underperforming campaign all variations of the same concept (similar first 3 seconds)? Andromeda treats them as identical, reducing effective creative diversity.

**Attribution contribution warning** [lp-pt-003, jl-pt-004]: Before pausing underperforming ads, check if aggregate ad set performance is good. Low-converting ads may be contributing to the funnel without getting last-click credit.

---

## Step 8: Identify Root Causes

Use this decision tree:

1. **Same creatives worse in one campaign?** → Problem is campaign-level, not creative
2. **Funnel leaks at app store step?** → Low-intent traffic
3. **Bad placements burning budget?** → Placement waste
4. **One campaign spends 2x+ in single market?** → Budget saturation
5. **CPM cheap but CPI high?** → Cheap impressions ≠ cheap installs

Apply Kast's diagnostic framework [wk-tw-001] to determine which pattern matches, then follow the recommended action for that pattern.

---

## Output Template

```markdown
## Campaign Comparison: [A] vs [B]

### Setup Differences
- [Key difference 1]
- [Key difference 2]

### Performance Gap
- CPI: $X vs $Y (Z× difference)

### Diagnosis [per wk-tw-001 framework]
- [Pattern identified and what it means]

### Root Causes
1. [Primary cause]
2. [Secondary cause]

### Recommended Actions
1. [Action 1]
2. [Action 2]

### Knowledge Base References
- wk-tw-001, lp-pt-003, jl-pt-004, oh-li-001
```
