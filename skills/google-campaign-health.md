# Skill: Google Campaign Health Check

Week-over-week performance comparison for Google App Campaigns — diagnoses spend, CPI, and install volume trends and flags campaigns that need action.

---

## When to Use This

- User asks "how are my Google campaigns doing?"
- User wants a Monday / start-of-week check on Google Ads
- Spend dropped or spiked unexpectedly on Google
- CPI is rising and the cause is unclear
- User wants to know if their Google campaigns are hitting algorithm thresholds

## What It Needs

**Option A — Google Ads MCP connected** (official `googleads/google-ads-mcp`, read-only): run the GAQL queries below with its `search` tool. Money fields are in micros; App campaigns are `advertising_channel_type = MULTI_CHANNEL`. If a field errors, check the MCP's field-metadata resources and adjust the query.

**Option B — CSV export**: No API needed. Export from Google Ads UI:
- Go to **Campaigns** → set date range to **This week (Mon–today)** and **Last week (Mon–Sun)**
- Columns to include: `Campaign`, `Campaign type`, `Status`, `Budget`, `Impressions`, `Clicks`, `Installs`, `Cost`, `CPI`, `Conversions`, `Cost/conv.`
- Export as CSV. Paste both exports (label which week each is).

## What It Produces

- Week-over-week delta table per campaign (spend Δ%, CPI Δ%, installs Δ%)
- Status per campaign: Healthy / Scaling / Degrading / Below threshold / Stalled
- Diagnosis for each flagged campaign
- Prioritized action list

---

## Knowledge Base Grounding

- **ab-pt-006** (Ashley Black): "Never change bids or budgets more than 20% per day — larger changes cause campaigns to tank and struggle to recover."
- **ab-pt-019** (Ashley Black): "Google recommends 50 installs/day or 10 actions/day — aim for double. Below threshold = algorithm can't optimize."
- **gg-gem-1293** (ex-Googler): "A way to scale without changing bids is to add a new ad group — new ad groups perform better than scaling bids on existing ones."
- **gg-gem-1294** (ex-Googler): "You can't go too small on Google UAC — $100/day is insufficient for the algorithm to work."
- **ab-pt-007** (Ashley Black): "Duplicate stale campaigns for a fresh start — the algorithm gets fatigued just like creative does."

---

## Procedure

### Step 1: Pull This Week and Last Week Data

**If the Google Ads MCP is connected:**

```sql
# This week
SELECT campaign.id, campaign.name, campaign.status, campaign_budget.amount_micros,
  metrics.impressions, metrics.clicks, metrics.conversions, metrics.cost_micros,
  metrics.cost_per_conversion, metrics.biddable_app_install_conversions
FROM campaign
WHERE campaign.advertising_channel_type = MULTI_CHANNEL AND segments.date DURING THIS_WEEK_MON_TODAY

# Last week: same query with DURING LAST_WEEK_MON_SUN
```

**If CSV:** Use the two exports the user pasted.

### Step 2: Compute Week-over-Week Deltas

For each campaign, calculate:
- Spend Δ%
- Installs / conversions Δ%
- CPI (cost per install) Δ%
- Daily install run rate this week vs last week

### Step 3: Apply Threshold Check

Flag any campaign where:
- Daily installs < 50 (or daily target events < 10) → **Below threshold** — algorithm can't optimize
- Daily budget < $100 → **Underfunded** — Google needs more signal
- CPI rose > 20% WoW with no bid change → **Degrading** — investigate creative or network shift
- Spend dropped > 30% WoW with no budget change → **Stalled** — check campaign status, bids, creative fatigue

### Step 4: Pull Campaign Structure (Google Ads MCP only)

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
```

Check for: campaigns that have been running > 90 days with no creative refresh (fatigue risk per ab-pt-007).

### Step 5: Diagnose and Recommend

For each flagged campaign, apply this logic:

| Signal | Diagnosis | Action |
|--------|-----------|--------|
| Below 50 installs/day | Insufficient signal | Increase budget OR consolidate campaigns |
| CPI up > 20%, impressions flat | Creative fatigue | Run `google-asset-performance` skill |
| CPI up > 20%, impressions down | Network shift | Run `google-network-audit` skill |
| Campaign running > 90 days, CPI rising | Algorithm fatigue | Duplicate campaign for a fresh start [ab-pt-007] |
| Spend dropped, status = active | Budget exhausted or low bid | Check budget cap; raise bid ≤ 20% [ab-pt-006] |

### Step 6: Output

Present:

```
## Google Campaign Health — [date range]

| Campaign | Spend Δ | CPI Δ | Installs Δ | Status |
|----------|---------|-------|------------|--------|
| [name]   | +12%    | -8%   | +22%       | Healthy |
| [name]   | -5%     | +31%  | -28%       | Degrading |

### Flagged Campaigns

**[Campaign name] — Degrading**
CPI rose 31% WoW. Impressions are flat, suggesting creative fatigue rather than a network shift.
→ Run google-asset-performance to identify underperforming assets.
→ Do not increase bids — fix creative first.

### Threshold Check
- [Campaign] is below 50 installs/day (currently [N]/day). Algorithm cannot optimize at this volume.
  → Consider consolidating with another campaign or increasing budget.

### Recommended Actions (Priority Order)
1. ...
```
