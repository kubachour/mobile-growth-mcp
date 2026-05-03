# Skill: Campaign Comparison

Reusable step-by-step framework for comparing any two Meta campaigns to identify why one outperforms the other.

---

## When to Use This

- User points to two campaigns with different CPIs and asks why
- User wants to understand what makes a winning campaign different
- Before scaling one campaign and pausing another — validate the reason
- User says "campaign A is doing better than B, what's different?"
- Testing a new campaign structure against an existing one

## What It Needs

**Option A — Meta Ads MCP connected** (recommended): Use Meta's official Meta Ads AI connector. Provide `ad_account_id` and optionally the two `campaign_id` values. If IDs aren't provided, list campaigns via the connector and ask the user to pick two.

**Option B — CSV export** (no API needed):
- Export from **Meta Ads Manager** → **Campaigns** tab, then drill into each campaign for its ad sets and ads
- For each campaign export: `Campaign name`, `Objective`, `Bid strategy`, `Budget type`, `Budget`, `Start date`, `Spend`, `Impressions`, `Frequency`, `CPM`, `CTR`, `CPA`, `Conversions`
- Also export **Ad sets** for each campaign: `Ad set name`, `Targeting type`, `Optimization goal`, `Bid strategy`, `Budget`, `Placements`, `Spend`, `CPA`
- Paste both campaign exports below, labeled by campaign name.

## What It Produces

- Side-by-side comparison across: settings, targeting, creative count/format, performance metrics
- Root cause identification for the performance gap
- Specific hypothesis for what's driving the difference

---

## Knowledge Base Grounding

- **wk-tw-001** (William Kast): 4 diagnostic metric patterns — Frequency↑+CPA↑ (fatigue), CPM↑+CPA↑ (saturation), CPA↑+CVR↓ (LP mismatch), CTR↓+CPA↑ (creative fatigue).
- **lp-pt-003** (Lauren Petrullo): "Contribution vs attribution — ads feed conversions without getting last-click credit."
- **jl-pt-004** (Jon Loomer): "Don't turn off underperforming ads if aggregate performance is good — they may play a halo role."
- **oh-li-001** (Olly Hudson): "Andromeda treats ads with similar first 3 seconds as identical."

---

## Step 1: Pull Campaign Settings Side-by-Side

Via Meta's MCP or CSV: list of campaigns. Filter for the two being compared. Compare: objective, bid strategy, daily budget, buying type, how long each has been running.

**Watch for**: Budget set at campaign level vs ad set level. One campaign may have 2x the budget — that alone can explain saturation effects.

---

## Step 2: Pull Ad Set Targeting & Placement Differences

Via Meta's MCP or CSV: ad sets for each of the two campaigns. Compare:
- **Geo-targeting**: Single country vs multi-country
- **Placements**: Which publisher_platforms and positions are enabled
- **Audience**: Age range, exclusions, Advantage+ settings
- **Bid amount**: Same cost cap? Different?

**Watch for**: Extra placements in the underperformer (instream_video, reels_overlay, threads are common waste placements for iOS app installs).

---

## Step 3: Pull Aggregate Insights

Via Meta's MCP or CSV: campaign-level last-7-days data with `campaign_id`, `campaign_name`, `spend`, `impressions`, `clicks`, `cpm`, `cpc`, `ctr`, `reach`, `frequency`, conversions, cost per conversion. Build comparison table:

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

Pull campaign-level last-7-days data with breakdowns `publisher_platform` × `platform_position`, fields `spend`, `impressions`, `cpm`, `ctr`, conversions, cost per conversion. For each placement, calculate CPI. Compare:
- Which placements exist in one campaign but not the other?
- What's the CPI range? Tight ($3-$6) = healthy. Wide ($8-$84) = waste.
- How much spend goes to the worst placements?

See `skills/placement-audit.md` for the full placement audit methodology.

---

## Step 6: Break Down by Country (Multi-Geo Campaigns)

Pull campaign-level last-7-days data with breakdown `country`. **Watch for**: One country eating the majority of budget with poor results.

---

## Step 7: Compare Same Creatives Across Campaigns

Pull ad-level data for top 50 ads by spend with `ad_name`, `adset_name`, `spend`, `impressions`, conversions, cost per conversion. Match ads by creative name across campaigns.

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
