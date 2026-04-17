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

**Option A — Google Ads connected**: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN` configured.

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

**If API connected:**

```
# This week
get_google_insights(
  customer_id="123-456-7890",
  date_range="THIS_WEEK_MON_TODAY",
  level="CAMPAIGN",
  metrics=["impressions","clicks","conversions","cost_micros","cost_per_conversion"]
)

# Last week
get_google_insights(
  customer_id="123-456-7890",
  date_range="LAST_WEEK",
  level="CAMPAIGN",
  metrics=["impressions","clicks","conversions","cost_micros","cost_per_conversion"]
)
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

### Step 4: Pull Campaign Structure (API only)

```
get_google_ads_campaigns(customer_id="123-456-7890")
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
