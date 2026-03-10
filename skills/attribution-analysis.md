# Skill: Attribution & Conversion Validation

How to validate whether Meta-reported conversion numbers are real or inflated, using attribution window analysis and daily time-series data.

---

## Knowledge Base Grounding

- **lp-pt-003** (Lauren Petrullo): "Contribution vs attribution — ads feed conversions without getting last-click credit. Killing low-converting ads can collapse the funnel."
- **jm-pt-001** (related): Attribution modeling considerations for cross-channel measurement.

---

## When to Use This

- Comparing two campaigns with different CPI to rule out attribution as the cause
- Auditing a single campaign to understand conversion quality
- Investigating suspiciously high or low install numbers
- Validating whether view-through conversions are meaningful

---

## Step 1: Pull Multi-Window Attribution Data

```
get_meta_insights(
  ad_account_id="act_123456789",
  level="campaign",
  fields="actions,cost_per_action_type,action_values",
  date_preset="last_7d"
)
```

Note: For multi-window analysis, you may need direct API calls with `action_attribution_windows=1d_click,7d_click,28d_click,1d_view`.

Extract install counts for each window:

| Window | Installs | CPI |
|---|---|---|
| 1d_click (default) | | |
| 7d_click | | |
| 28d_click | | |
| 1d_view | | |

---

## Step 2: Check Delayed Conversion Uplift

Calculate:
- **1d → 7d uplift**: `(7d_installs - 1d_installs) / 1d_installs × 100`
- **7d → 28d uplift**: `(28d_installs - 7d_installs) / 7d_installs × 100`

### Interpretation

| 1d→7d Uplift | Signal |
|---|---|
| 10-20% | Healthy — users consider and return within a week |
| 3-5% | Low-intent — if they don't install immediately, they never will |
| >30% | Suspicious — investigate if attribution is overcounting |
| <1% | Either very direct-response creative, or very poor audience |

### Example from ROLA vs MX analysis
- ROLA: +14.0% (1d→7d) — healthy delayed consideration
- MX: +4.1% (1d→7d) — low-intent traffic confirmed

---

## Step 3: Analyze View-Through Ratio

Calculate: `1d_view installs / 1d_click installs × 100`

### Interpretation

| View-Through Ratio | Signal |
|---|---|
| 5-15% | Normal for app install campaigns |
| >25% | Possible attribution inflation — Meta counting impressions as conversions |
| <3% | Very click-driven campaign, view-through not a factor |

When comparing campaigns: if both have similar view-through ratios (~8-12%), attribution mechanics are comparable and the difference in CPI is real.

**Contribution vs attribution** [lp-pt-003]: Even if an ad has low direct conversions, it may be contributing to the funnel. View-through and assisted conversions indicate ads that are "feeding" the pipeline without getting last-click credit. Killing these ads can collapse the funnel.

---

## Step 4: Use Daily Time-Series for Consistency Check

```
get_meta_insights(
  ad_account_id="act_123456789",
  level="campaign",
  fields="spend,impressions,actions",
  time_increment="1",
  date_preset="last_14d"
)
```

Check:
- **Daily CPI consistency**: Stable CPI day-over-day = real performance. Wild swings = possible issues.
- **Install/impression ratio**: Should be relatively stable.
- **Weekend vs weekday patterns**: Normal to see dips; abnormal to see 5x swings.
- **Spend vs installs correlation**: If spend goes up but installs stay flat, Meta is buying junk inventory.

### Red flags in daily data
- Day with $800 spend and 34 installs next to day with $800 spend and 77 installs → inconsistent audience quality
- Steady spend but declining daily installs over 2 weeks → audience exhaustion
- Install spikes on specific days without corresponding spend increase → possible attribution lag

---

## Step 5: Cross-Reference with Creative Performance

```
get_meta_insights(
  ad_account_id="act_123456789",
  level="ad",
  fields="ad_name,spend,impressions,actions",
  sort="spend_descending",
  limit=20
)
```

For each top ad, check:
- Is the 1d_view count suspiciously close to 1d_click? (possible overcounting)
- Does the 7d_click show meaningful uplift over 1d_click? (delayed intent)
- Are there ads with very high spend but almost no 1d_click installs and lots of 1d_view? (view-through inflated)

---

## SKAN / iOS Attribution Notes

Meta does NOT expose raw SKAN data through the standard Insights API:
- `skan_cv_app_install`, `skan_conversion`, `skan_campaign_id`, `skan_conversion_id` → all return field validation errors
- `signal_source_bucket` breakdown → returns data but the field is always empty
- `conversions` field → no SKAN-specific action types appear

**What Meta does**: Receives SKAN postbacks from Apple and blends them into the modeled `mobile_app_install` numbers. The install counts you see are Meta's modeled estimates, not raw counts.

**To get raw SKAN postbacks**: You need an MMP (Adjust, AppsFlyer, Branch, Kochava) that receives SKAN postbacks independently from Apple.

---

## Output Template

```markdown
## Attribution Analysis: [Campaign Name]

### Attribution Windows
| Window | Installs | CPI |
|---|---|---|
| 1d_click | X | $Y |
| 7d_click | X | $Y |
| 28d_click | X | $Y |
| 1d_view | X | $Y |

### Delayed Uplift: X% (1d→7d) — [healthy/low-intent/suspicious]
### View-Through Ratio: X% — [normal/inflated/minimal]
### Daily Consistency: [stable/unstable/declining]

### Contribution Warning [lp-pt-003]
[Note any ads that may be contributing to the funnel without getting direct credit]

### Conclusion
[Is the conversion data trustworthy? What does the attribution pattern reveal?]

### Knowledge Base References
- lp-pt-003
```
