# Skill: Google Bid Strategy Advisor

Evaluate whether the current bid strategy setup is correct, whether the algorithm has sufficient signal to optimize, and how to safely adjust bids when performance needs to change.

---

## When to Use This

- User wants to switch from CPA to tROAS (or vice versa)
- User's CPI is above target and they want to lower bids
- User wants to scale and is considering raising bids or budgets
- User is setting up Google App Campaigns for the first time and asking which bid strategy to use
- tROAS campaign is underperforming or not spending its budget
- User asks "should I increase my bids?"

## What It Needs

**Option A — Google Ads MCP connected** (official `googleads/google-ads-mcp`, read-only): run the GAQL queries below with its `search` tool. Money fields are in micros; App campaigns are `advertising_channel_type = MULTI_CHANNEL`. If a field errors, check the MCP's field-metadata resources and adjust the query.

```sql
SELECT campaign.id, campaign.name, campaign.bidding_strategy_type,
  campaign.target_cpa.target_cpa_micros, campaign.target_roas.target_roas,
  campaign_budget.amount_micros, metrics.conversions, metrics.conversions_value,
  metrics.cost_micros, metrics.cost_per_conversion
FROM campaign
WHERE campaign.advertising_channel_type = MULTI_CHANNEL AND campaign.status = ENABLED AND segments.date DURING LAST_30_DAYS

# Conversion windows of the optimized actions
SELECT conversion_action.id, conversion_action.name, conversion_action.category,
  conversion_action.click_through_lookback_window_days,
  conversion_action.firebase_settings.event_name,
  conversion_action.value_settings.always_use_default_value
FROM conversion_action
WHERE conversion_action.status = ENABLED

# Recent bid / budget changes (change_event needs a LIMIT; max 30 days back)
SELECT change_event.change_date_time, change_event.change_resource_type,
  change_event.changed_fields, change_event.old_resource, change_event.new_resource,
  campaign.name
FROM change_event
WHERE change_event.change_date_time DURING LAST_14_DAYS
  AND change_event.change_resource_type IN (CAMPAIGN, CAMPAIGN_BUDGET)
ORDER BY change_event.change_date_time DESC
LIMIT 200
```

**Option B — Manual input / CSV:** Ask the user for:
- Current bid strategy per campaign (Target CPA / Target ROAS)
- Current target CPA value or target ROAS value
- Last 30-day actuals: daily installs average, daily revenue events average (if tROAS), actual CPI or ROAS
- Firebase integration: yes/no
- Recent bid changes: when and by how much

## What It Produces

- Assessment of whether each campaign's bid strategy is appropriate for its signal volume
- Specific bid adjustment recommendations with safe change sizes
- Go/no-go verdict on switching to tROAS
- Scaling path if user wants to grow spend

---

## Knowledge Base Grounding

- **ab-pt-006** (Ashley Black): "Never adjust bids or budgets more than 20% in a single day. Larger changes cause campaigns to tank and struggle to recover. This is Google's own guidance — believe it."
- **ab-pt-019** (Ashley Black): "Google recommends 50 installs/day or 10 target events/day. Aim for double (100 installs/day or 30 events/day). Below threshold = the algorithm is guessing, not learning."
- **ab-pt-010** (Ashley Black): "tROAS campaigns: start your target 20%+ below your actual ROAS target. Use 7-day conversion windows. Expect a 2–6 week learning window before evaluating [ab-pt-011]."
- **ab-pt-011** (Ashley Black): "tROAS requires Firebase integration, high event volume (10+ revenue events/day), and risk tolerance. Don't set up tROAS without all three — it will underperform and you'll incorrectly blame the strategy."
- **ab-pt-012** (Ashley Black): "Run CPA and tROAS campaigns side by side. tROAS alone struggles to scale — it chases quality over volume. CPA provides the volume floor, tROAS extracts value from the best users."
- **ab-pt-020** (Ashley Black): "tROAS campaigns tend to have higher CPMs but deliver better-quality traffic. The higher CPI is often justified by better retention and monetization — measure downstream, not just install cost."
- **gg-gem-1218** (community): "When increasing bids, use the hamburger approach — small increase, let it stabilize, small increase again. Don't jump to your target bid in one move."
- **gg-gem-1293** (ex-Googler): "Scaling via new ad groups is safer than raising bids — new ad groups open new inventory pockets without disturbing existing campaign optimization signals."
- **gg-gem-1215** (community): "A high ROAS target means a longer ramp-up period. If you set tROAS too aggressively, the campaign will underspend during learning."

---

## Procedure

### Step 1: Gather Current Setup

Collect:
- Bid strategy per campaign (Target CPA or Target ROAS)
- Current target values
- Actual 30-day performance (CPI, daily install volume, daily revenue events if tROAS)
- Firebase connected: yes/no
- Any bid changes in the last 14 days

### Step 2: Check Algorithm Signal Sufficiency

For each campaign:

| Volume | Assessment |
|--------|------------|
| < 50 installs/day (CPA) | Below threshold — algorithm can't optimize. Must consolidate or increase budget before adjusting bids. |
| 50–100 installs/day | Functional but fragile. Any bid change will disrupt learning. Be conservative. |
| > 100 installs/day | Sufficient signal. Standard 20% bid change rule applies. |
| < 10 revenue events/day (tROAS) | tROAS cannot function. Switch to CPA or add Firebase events [ab-pt-011]. |
| > 10 revenue events/day (tROAS) | Functional. Evaluate ROAS target vs actual. |

### Step 3: Evaluate CPA Bid Setting

If actual CPI is above target CPA:
- **First check**: Is it a volume problem (< 50 installs/day)? Fix volume before touching bids.
- **If volume is fine**: Calculate safe bid reduction. Max 20% down from current [ab-pt-006].
- **Wait time**: 7–14 days after a change before evaluating impact.

If CPI is at or below target CPA:
- **Scaling path**: Raise budget first (safer than raising bid). Budget increase ≤ 20%/day.
- **If budget is not the constraint**: Raise bid in 10-15% increments, let stabilize for 7 days [gg-gem-1218].
- **Alternative to bid raises**: Add a new ad group to open new inventory [gg-gem-1293].

### Step 4: Evaluate tROAS Readiness (if user is considering switching)

**Window first:** the tROAS target is judged against the campaign's conversion window. A 20% target on the 90-day default means 20% at day 90. Check the window with the query in Step 1, move it to 7 days (14 at most), then back-calculate the target for that window [ab-pt-010].

tROAS requires ALL of these:
- [ ] Conversion window set to 7 days (14 max) and target back-calculated for it [ab-pt-010]
- [ ] Firebase integrated and sending events
- [ ] 10+ revenue events/day average over last 30 days
- [ ] Willing to accept higher CPI in exchange for better user quality [ab-pt-020]
- [ ] CPA campaign(s) will continue running alongside tROAS [ab-pt-012]

If all checked: tROAS is appropriate. Set initial target at 20% below actual ROAS [ab-pt-010], use 7-day conversion window, expect 2–3 week learning phase.

If any unchecked: Do not switch to tROAS. Flag which prerequisites are missing.

### Step 5: Check for Recent Destabilizing Changes

If bids or budgets changed > 20% in the last 14 days and performance is volatile:
- The campaign is likely in a disrupted learning phase
- **Do not make further changes** — let it stabilize for 7–14 more days
- Only intervene if spend collapses to near zero (then a small +10% bid nudge is warranted)

### Step 6: Output

```
## Google Bid Strategy Assessment — [date]

### Campaign Snapshot

| Campaign | Strategy | Target | Actual | Daily Vol | Signal |
|----------|----------|--------|--------|-----------|--------|
| [name] | Target CPA | $2.50 | $3.10 | 45/day | ⚠️ Below threshold |
| [name] | Target ROAS | 200% | 180% | 12 events/day | ✅ Functional |

### Assessments

**[Campaign A] — Below algorithm threshold**
45 installs/day is below Google's 50/day minimum. The algorithm cannot optimize meaningfully at this volume. Increasing the budget to reach 80–100 installs/day will do more than any bid adjustment.
→ Do not reduce bids — it will worsen volume further.
→ Consolidate with [Campaign B] or increase daily budget by 20% increments.

**[Campaign B] — tROAS functioning but ROAS target too aggressive**
Actual ROAS is 180% vs 200% target. The campaign is underspending because the target is too high.
→ Lower target to 150% (20% below actual) to enter the learning zone, then raise gradually [ab-pt-010, gg-gem-1218].

### tROAS Readiness Check
[✅/❌ each prerequisite with notes]

### Scaling Path for [Campaign C]
Current: $X/day, [N] installs/day, CPI at target.
Recommended sequence:
1. Raise daily budget by 20% → wait 7 days → evaluate
2. If CPI holds: raise another 20% → wait 7 days
3. If CPI holds and budget is no longer the constraint: add a new ad group with a different creative angle [gg-gem-1293]
4. Only raise bids after budget increases stop generating volume gains
```
