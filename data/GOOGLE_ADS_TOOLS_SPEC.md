# Google Ads MCP Tools — Implementation Specification

This document specifies 6 new MCP tools for querying Google Ads App Campaigns (UAC/ACi/ACe). These tools mirror the existing Meta Ads tools in the `mobile-growth-mcp` server and are grounded in practitioner knowledge from the Mobile Growth knowledge base.

The Google Ads API uses GAQL (Google Ads Query Language) for all queries. Costs are returned in micros (1,000,000 micros = $1.00 USD). Authentication requires OAuth2 with a refresh token + developer token + customer ID.

---

## Table of Contents

1. [get_google_campaigns](#1-get_google_campaigns)
2. [get_google_ad_groups](#2-get_google_ad_groups)
3. [get_google_assets](#3-get_google_assets)
4. [get_google_insights](#4-get_google_insights)
5. [get_google_network_mix](#5-get_google_network_mix)
6. [get_google_asset_fatigue](#6-get_google_asset_fatigue)

---

## 1. get_google_campaigns

### What It Does
Lists Google App Campaigns with status, bid strategy, budgets, channel sub-type, and app information. This is the structural entry point — equivalent to `get_meta_campaigns`.

### Why It Matters
- **Campaign naming conventions** encode dimensions (app, event, country, OS) that Google's reporting doesn't natively expose. Surfacing the raw name lets the LLM parse these. *(Knowledge base: `ab-vt-005` — Ashley Black recommends AppName_Event_Country_OS naming convention because Google's native reporting makes it hard to extract OS or country directly.)*
- **Bid strategy visibility** is critical. Practitioners run tCPI/tCPA and tROAS campaigns in parallel — tROAS for quality, CPA for volume. Seeing `bidding_strategy_type` per campaign lets users verify they have the right mix. *(Knowledge base: `ab-pt-012` — "Run CPI/CPA and tROAS campaigns side by side — tROAS alone struggles to scale.")*
- **Current bid/budget values** provide context for safe adjustments. Google's algorithm is extremely sensitive — never change bids or budgets more than 20% per day. *(Knowledge base: `ab-pt-006` — "Never change Google UAC bids or budgets more than 20% per day.")*

### GAQL Query
```sql
SELECT
  campaign.id,
  campaign.name,
  campaign.status,
  campaign.advertising_channel_type,
  campaign.advertising_channel_sub_type,
  campaign.bidding_strategy_type,
  campaign.target_cpa.target_cpa_micros,
  campaign.target_roas.target_roas,
  campaign.campaign_budget,
  campaign_budget.amount_micros,
  campaign_budget.type,
  campaign.app_campaign_setting.app_id,
  campaign.app_campaign_setting.app_store,
  campaign.app_campaign_setting.bidding_strategy_goal_type,
  campaign.start_date,
  campaign.end_date
FROM campaign
WHERE campaign.advertising_channel_type = 'MULTI_CHANNEL'
  AND campaign.advertising_channel_sub_type IN ('APP_CAMPAIGN', 'APP_CAMPAIGN_FOR_ENGAGEMENT')
  AND campaign.status IN ('ENABLED')
```

### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `customer_id` | string | Yes | — | Google Ads customer ID (format: `1234567890`, no dashes) |
| `status` | string[] | No | `["ENABLED"]` | Filter by campaign status. Options: `ENABLED`, `PAUSED`, `REMOVED` |
| `channel_sub_type` | string[] | No | `["APP_CAMPAIGN", "APP_CAMPAIGN_FOR_ENGAGEMENT"]` | Filter by sub-type. Set to `null` or omit to include all campaign types (not just app campaigns) |
| `limit` | number | No | 50 | Results per page (max 100) |
| `page_token` | string | No | — | Pagination token from previous response |

### Output Format
Markdown table with one row per campaign:

```
## Google Campaigns (12 found)

| Campaign | Status | Type | Bid Strategy | Target | Daily Budget | App |
|---|---|---|---|---|---|---|
| MyApp_Install_US_iOS | ENABLED | ACi | TARGET_CPA | $5.00 | $500.00 | com.myapp (iOS) |
| MyApp_Trial_US_Android | ENABLED | ACi | TARGET_ROAS | 150% | $1,000.00 | com.myapp (Android) |
| MyApp_Purchase_UK_iOS | PAUSED | ACe | MAXIMIZE_CONVERSIONS | — | $200.00 | com.myapp (iOS) |
```

Fields per campaign:
- `id` — campaign ID
- `name` — full campaign name (parseable for naming convention dimensions)
- `status` — ENABLED / PAUSED / REMOVED
- `channel_sub_type` — displayed as "ACi" (APP_CAMPAIGN) or "ACe" (APP_CAMPAIGN_FOR_ENGAGEMENT)
- `bidding_strategy_type` — TARGET_CPA / TARGET_ROAS / TARGET_SPEND / MAXIMIZE_CONVERSIONS / MAXIMIZE_CONVERSION_VALUE
- `target_cpa` or `target_roas` — converted from micros to dollars, or shown as percentage for ROAS
- `daily_budget` — converted from micros. Show `budget_type` if TOTAL (lifetime budget)
- `app_id` — the app package name / bundle ID
- `app_store` — displayed as "iOS" (APPLE_APP_STORE) or "Android" (GOOGLE_APP_STORE)
- `bidding_goal` — readable version: "Installs", "In-App Actions", or "ROAS"
- `start_date`, `end_date` — if set

### Error Handling
- Invalid customer ID → "Invalid customer ID format. Use 10-digit number without dashes (e.g., 1234567890)"
- Auth errors → "Authentication failed. Check your Google Ads OAuth2 refresh token and developer token."
- No campaigns found → "No campaigns found matching filters. Try expanding status filter to include PAUSED."

---

## 2. get_google_ad_groups

### What It Does
Lists ad groups within Google App Campaigns. In UAC, ad groups represent **creative themes** (e.g., "at_home_workouts", "meal_planning", "ease_of_use"). This is the equivalent of `get_meta_adsets`.

### Why It Matters
- **Ad groups = creative themes.** The algorithm allocates spend across ad groups based on which themes resonate with users. Observing spend distribution reveals winning messaging angles. *(Knowledge base: `ab-vt-005` — "Structure ad groups by creative theme (3-5 themes). Observe which ad groups receive the most algorithmic spend to identify winning themes, then expand those.")*
- **Scaling via ad groups.** The recommended way to scale Google campaigns is to add new ad groups with different text-asset strategies, rather than aggressively increasing bids on existing campaigns. *(Knowledge base: `ab-pt-006` — "To scale faster, add new ad groups with different text asset strategies. Add English-language assets in non-English markets to unlock additional inventory.")*

### GAQL Query
```sql
SELECT
  ad_group.id,
  ad_group.name,
  ad_group.status,
  ad_group.type,
  campaign.id,
  campaign.name,
  campaign.status
FROM ad_group
WHERE campaign.advertising_channel_sub_type IN ('APP_CAMPAIGN', 'APP_CAMPAIGN_FOR_ENGAGEMENT')
  AND ad_group.status IN ('ENABLED')
  AND campaign.id = {campaign_id}  -- optional, omit if not provided
```

### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `customer_id` | string | Yes | — | Google Ads customer ID |
| `campaign_id` | string | No | — | Scope to a specific campaign. If omitted, returns ad groups across all app campaigns |
| `status` | string[] | No | `["ENABLED"]` | Filter by ad group status |
| `limit` | number | No | 50 | Results per page (max 100) |
| `page_token` | string | No | — | Pagination token |

### Output Format
```
## Ad Groups for "MyApp_Install_US_iOS" (4 found)

| Ad Group | Status | Type | Campaign |
|---|---|---|---|
| at_home_workouts | ENABLED | APP_CAMPAIGN_AD | MyApp_Install_US_iOS |
| meal_planning | ENABLED | APP_CAMPAIGN_AD | MyApp_Install_US_iOS |
| ease_of_use | ENABLED | APP_CAMPAIGN_AD | MyApp_Install_US_iOS |
| social_proof | ENABLED | APP_CAMPAIGN_AD | MyApp_Install_US_iOS |
```

---

## 3. get_google_assets

### What It Does
Lists creative assets linked to a campaign or ad group with full metadata: asset type, dimensions, YouTube video IDs, text content, Google's performance label, and a **slot utilization audit**. This is the creative inventory tool — equivalent to `get_meta_ads` but adapted for Google's asset-based creative system.

### Why It Matters
- **Slot utilization drives Ad Strength.** Google allows up to 5 headlines (30 chars), 5 descriptions (90 chars), 20 images, 20 videos, and 20 HTML5 assets per ad group. Missing asset types mean missing inventory channels (no video = no YouTube TrueView, no images = no Display). The slot audit flags gaps. *(Knowledge base: `goog-pdf-011` — asset caps; `goog-pdf-017` — "Excellent" Ad Strength requires 5 headlines, 5 descriptions, 1 landscape image, and videos in 3 orientations.)*
- **Performance labels are misleading.** Google's built-in asset ratings (Low/Good/Best) measure the algorithm's ability to scale an asset, not whether it drives valuable conversions. Practitioners universally recommend ignoring these labels and evaluating by your own CPA/ROAS. This tool surfaces the label alongside raw metadata so users can make informed decisions. *(Knowledge base: `ab-pt-008` — "Google's asset performance rating measures scalability, not value. An asset rated 'low' can actually have the cheapest CPI." Also `goog-pdf-019` — "Ratings are strictly relative to other assets of the same type within that campaign — not compared to benchmarks.")*
- **Creative refresh decisions.** Google recommends refreshing assets every 2-3 months, replacing Low-rated first, and never removing within the first 2 weeks. This tool provides the inventory data needed for those decisions. *(Knowledge base: `goog-pdf-018` — "Refresh creative assets every 2-3 months. Never replace all creatives at once. Never remove a creative within its first 2 weeks.")*

### GAQL Query
```sql
SELECT
  asset.id,
  asset.name,
  asset.type,
  asset.text_asset.text,
  asset.image_asset.full_size.url,
  asset.image_asset.full_size.width_pixels,
  asset.image_asset.full_size.height_pixels,
  asset.youtube_video_asset.youtube_video_id,
  asset.youtube_video_asset.youtube_video_title,
  ad_group_ad_asset_view.field_type,
  ad_group_ad_asset_view.performance_label,
  ad_group.id,
  ad_group.name,
  campaign.id,
  campaign.name
FROM ad_group_ad_asset_view
WHERE campaign.id = {campaign_id}
  AND campaign.status = 'ENABLED'
  AND ad_group.id = {ad_group_id}  -- optional, omit if not provided
```

When `asset_type` filter is provided, add:
```sql
  AND asset.type IN ('{asset_type_1}', '{asset_type_2}')
```

### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `customer_id` | string | Yes | — | Google Ads customer ID |
| `campaign_id` | string | No | — | Scope to a specific campaign |
| `ad_group_id` | string | No | — | Scope to a specific ad group |
| `asset_type` | string[] | No | all | Filter: `IMAGE`, `YOUTUBE_VIDEO`, `TEXT`, `MEDIA_BUNDLE` |
| `include_slot_audit` | boolean | No | `true` | Include summary of filled vs. max slots per ad group |
| `limit` | number | No | 50 | Results per page |
| `page_token` | string | No | — | Pagination token |

### Output Format

**Asset List:**
```
## Assets for "at_home_workouts" in "MyApp_Install_US_iOS" (23 found)

### Text Assets
| Asset | Field | Content | Label |
|---|---|---|---|
| headline_1 | HEADLINE | Get fit at home | BEST |
| headline_2 | HEADLINE | 5-min daily workouts | GOOD |
| headline_3 | HEADLINE | No equipment needed | LOW |
| desc_1 | DESCRIPTION | Transform your body with personalized home workouts... | GOOD |
| desc_2 | DESCRIPTION | Join 2M+ users achieving their fitness goals... | BEST |

### Image Assets
| Asset | Dimensions | Ratio | Label |
|---|---|---|---|
| hero_landscape | 1200x628 | 1.91:1 | BEST |
| app_screenshot_1 | 1080x1350 | 4:5 | GOOD |
| results_square | 1080x1080 | 1:1 | LEARNING |

### Video Assets
| Asset | YouTube ID | Title | Label |
|---|---|---|---|
| 30s_ugc_workout | dQw4w9WgXcQ | Quick Home Workout | BEST |
| 15s_results | xvFZjo5PgG0 | Before & After | GOOD |
```

**Slot Audit** (when `include_slot_audit` = true):
```
### Slot Utilization — "at_home_workouts"
| Asset Type | Filled | Max | Status |
|---|---|---|---|
| Headlines | 3 | 5 | ⚠️ Below Excellent (need 5) |
| Descriptions | 2 | 5 | ⚠️ Below Excellent (need 5) |
| Images | 8 | 20 | ✅ OK |
| Videos | 6 | 20 | ✅ OK (has landscape + portrait + square) |
| HTML5 | 0 | 20 | — Not required |

**Ad Strength: Good** (missing 2 headlines and 3 descriptions for Excellent)
```

For the slot audit, check video orientations to determine if the "3 orientations" requirement for Excellent is met. Classify by aspect ratio:
- Landscape: width > height (16:9 etc.)
- Portrait: height > width (9:16 etc.)
- Square: width ≈ height (1:1)

---

## 4. get_google_insights

### What It Does
Pulls performance metrics from Google Ads with configurable aggregation level, breakdowns, date ranges, and time granularity. This is the core reporting workhorse — equivalent to `get_meta_insights`.

### Why It Matters
- **Network segmentation is the #1 diagnostic lever.** Google serves across 5 networks (Search, Display/AdMob, YouTube, Play Store, MGDN) but the dashboard blends them. Traffic shifts between networks signal performance problems — e.g., a sudden shift to low-quality Display inventory tanks CPA. *(Knowledge base: `ab-pt-005` — "Use Network segmentation to monitor traffic distribution. Watch for sudden shifts — they can signal performance problems." Also `ab-pt-018` — "Google App Campaigns serve across 5 distinct traffic sources with very different quality.")*
- **The four measurement pillars.** Google's own creative measurement framework maps to the metrics this tool returns: Scale (impressions, cost), Install Efficiency (CTR, IPM, CPI), Post-Install Efficiency (CvR, CPA), Total Efficiency (ROAS). *(Knowledge base: `goog-pdf-020` — "Evaluate creative performance across all four pillars — a low-CPI asset that drives low-LTV users is not actually efficient.")*
- **Bid strategy validation.** tROAS campaigns show higher CPMs but better quality traffic. Surfacing `average_cpm` alongside conversion metrics lets users validate this. *(Knowledge base: `ab-pt-020` — "Higher CPMs in tROAS context signal higher-quality traffic. Don't chase the cheapest CPM.")*
- **Inventory identification > creative volume.** On Google, success is driven by identifying the right inventory placement, not just cycling through creatives. CPM and traffic quality analysis (via network breakdown) accelerates learnings. *(Knowledge base: `gg135-005` — "Focusing on CPM and traffic quality can accelerate learnings and lead to more efficient acquisition than simply cycling through creatives.")*

### GAQL Queries

The query is dynamically assembled based on the `level` and `breakdown` parameters.

**Campaign-level (default):**
```sql
SELECT
  campaign.id,
  campaign.name,
  metrics.impressions,
  metrics.clicks,
  metrics.ctr,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value,
  metrics.all_conversions,
  metrics.video_views,
  metrics.interactions,
  metrics.average_cpm,
  metrics.average_cpc,
  metrics.biddable_app_install_conversions,
  metrics.biddable_app_post_install_conversions
FROM campaign
WHERE campaign.advertising_channel_sub_type IN ('APP_CAMPAIGN', 'APP_CAMPAIGN_FOR_ENGAGEMENT')
  AND campaign.status = 'ENABLED'
  AND segments.date BETWEEN '2025-03-01' AND '2025-03-14'
```

**Ad group-level:** Replace `FROM campaign` with `FROM ad_group` and add `ad_group.id, ad_group.name` to SELECT.

**Asset-level:** Use `FROM ad_group_ad_asset_view` and add `asset.id, asset.name, asset.type, ad_group_ad_asset_view.field_type, ad_group_ad_asset_view.performance_label`.

**Breakdown additions** (add to SELECT):
- `network` → `segments.ad_network_type`
- `device` → `segments.device`
- `age` → use `FROM age_range_view` with `ad_group_criterion.age_range.type`
- `gender` → use `FROM gender_view` with `ad_group_criterion.gender.type`
- `geo` → use `FROM geographic_view` with `geographic_view.country_criterion_id`

**Time granularity:** When `time_increment` is `daily`, add `segments.date` to SELECT. For `weekly` or `monthly`, the tool should aggregate client-side after fetching daily data.

### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `customer_id` | string | Yes | — | Google Ads customer ID |
| `level` | enum | No | `"campaign"` | Aggregation: `account`, `campaign`, `ad_group`, `asset` |
| `campaign_id` | string | No | — | Scope to specific campaign |
| `ad_group_id` | string | No | — | Scope to specific ad group |
| `breakdown` | enum | No | — | Segmentation: `network`, `device`, `age`, `gender`, `geo`. Only one at a time (GAQL restriction — cannot combine segment types from different resources) |
| `date_range` | object | No | — | `{ "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD" }`. Overrides `date_preset` if provided |
| `date_preset` | enum | No | `"LAST_7_DAYS"` | Predefined: `LAST_7_DAYS`, `LAST_14_DAYS`, `LAST_30_DAYS`, `THIS_MONTH`, `LAST_MONTH`. Converted to date range before query |
| `time_increment` | enum | No | `"summary"` | Granularity: `daily`, `weekly`, `monthly`, `summary` (fully aggregated) |
| `sort` | enum | No | `"cost_desc"` | Sort: `cost_desc`, `conversions_desc`, `impressions_desc`, `ctr_desc` |
| `limit` | number | No | 50 | Results per page (max 500) |
| `page_token` | string | No | — | Pagination token |

### Output Format

**Campaign-level, summary:**
```
## Google Ads Performance — Last 7 Days (5 campaigns)

| Campaign | Spend | Impr | Clicks | CTR | CPM | CPC | Installs | CPI | Post-Install | CPA | ROAS |
|---|---|---|---|---|---|---|---|---|---|---|---|
| MyApp_Install_US_iOS | $3,500 | 580K | 12.4K | 2.14% | $6.03 | $0.28 | 1,240 | $2.82 | 310 | $11.29 | 185% |
| MyApp_Trial_US_Android | $5,200 | 1.2M | 28.1K | 2.34% | $4.33 | $0.19 | 3,100 | $1.68 | 890 | $5.84 | 220% |
```

**With network breakdown:**
```
## Google Ads Performance — MyApp_Install_US_iOS — By Network

| Network | Spend | Impr | Clicks | CTR | CPM | Installs | CPI |
|---|---|---|---|---|---|---|---|
| SEARCH | $1,200 | 95K | 5.2K | 5.47% | $12.63 | 620 | $1.94 |
| YOUTUBE | $1,500 | 280K | 4.1K | 1.46% | $5.36 | 380 | $3.95 |
| DISPLAY | $800 | 205K | 3.1K | 1.51% | $3.90 | 240 | $3.33 |
```

**Computed fields** (calculate in the tool, not via GAQL):
- `cpi` = cost_micros / biddable_app_install_conversions / 1,000,000
- `cpa` = cost_micros / biddable_app_post_install_conversions / 1,000,000
- `ipm` = biddable_app_install_conversions × 1000 / impressions (Installs per Mille)
- `roas` = conversions_value / (cost_micros / 1,000,000) × 100 (as percentage)
- `cpm` = already provided by `metrics.average_cpm` (in micros, convert)
- `cpc` = already provided by `metrics.average_cpc` (in micros, convert)

### GAQL Notes
- GAQL does not support `BETWEEN` for dates in `WHERE` — use `segments.date BETWEEN 'YYYY-MM-DD' AND 'YYYY-MM-DD'`
- Breakdown dimensions add implicit segmentation. Only one segment type can be used per query (e.g., you cannot combine `segments.ad_network_type` with `segments.device` in the same query)
- For `level: "account"`, aggregate all campaign rows client-side (there is no account-level resource with metrics in GAQL)
- `metrics.biddable_app_install_conversions` and `metrics.biddable_app_post_install_conversions` are the Google-specific install/post-install metrics for app campaigns
- For sorting, translate to GAQL `ORDER BY metrics.{field} DESC`

---

## 5. get_google_network_mix

### What It Does
Analyzes traffic distribution across Google's ad networks (Search, Display/AdMob, YouTube) over time for a campaign or account. Computes **spend share percentages** per network per day and **flags significant shifts** between the first and second half of the date range.

This tool has **no Meta equivalent** — it exists because Google's multi-network distribution is a unique characteristic. Meta serves across placements (Feed, Stories, Reels, Audience Network) but these are all within Meta's ecosystem. Google distributes across fundamentally different networks with very different user intent and traffic quality.

### Why It Matters
- **Traffic shifts signal performance problems.** When Google's algorithm shifts spend from Search (high-intent) to Display/MGDN (low-quality), CPA rises. Catching this shift early prevents budget waste. *(Knowledge base: `ab-pt-005` — "Watch for sudden shifts in display vs search vs YouTube — they can signal performance problems.")*
- **Google optimizes for Google, not for you.** The algorithm prioritizes Google's revenue alongside advertiser performance. If a campaign isn't hitting your CPA target, Google won't automatically stop spending. It may shift to cheaper inventory (Display) to maintain volume while your CPA inflates. *(Knowledge base: `ab-pt-017` — "Google positions UAC as fully automated, but the algorithm still prioritizes Google's revenue. Use Network segmentation to detect traffic shifts to low-quality inventory.")*
- **Inventory identification is the primary lever.** On Google, success is driven more by finding the right inventory than by creative volume. CPM and traffic quality analysis via network breakdown is the most actionable diagnostic. *(Knowledge base: `gg135-005` — "Focusing on CPM and traffic quality can accelerate learnings and lead to more efficient acquisition than simply cycling through creatives.")*
- **Network quality hierarchy.** The 5 traffic sources have distinct quality profiles: Play Store search/browse = highest intent (Android only); Google.com search = high intent; YouTube = mid-quality, multiple sub-placements; AdMob = variable quality (great for games, mixed for utilities); MGDN = lowest quality (mobile browser display). *(Knowledge base: `ab-pt-018` — detailed breakdown of all 5 traffic sources.)*

### GAQL Query
```sql
SELECT
  campaign.id,
  campaign.name,
  segments.ad_network_type,
  segments.date,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.conversions_value,
  metrics.average_cpm,
  metrics.biddable_app_install_conversions,
  metrics.biddable_app_post_install_conversions
FROM campaign
WHERE campaign.advertising_channel_sub_type IN ('APP_CAMPAIGN', 'APP_CAMPAIGN_FOR_ENGAGEMENT')
  AND campaign.status = 'ENABLED'
  AND campaign.id = {campaign_id}  -- optional
  AND segments.date BETWEEN '{start_date}' AND '{end_date}'
ORDER BY segments.date ASC
```

### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `customer_id` | string | Yes | — | Google Ads customer ID |
| `campaign_id` | string | No | — | Scope to one campaign. If omitted, aggregates at account level across all app campaigns |
| `date_range` | object | No | last 14 days | `{ "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD" }` |
| `shift_threshold_pct` | number | No | 10 | Flag networks whose spend share changed by more than this % between the first and second half of the date range |

### Output Format

**Daily Network Distribution:**
```
## Network Mix — MyApp_Install_US_iOS — Last 14 Days

| Date | Search | Search % | Display | Display % | YouTube | YouTube % | Total |
|---|---|---|---|---|---|---|---|
| 2025-03-01 | $150 | 42% | $80 | 22% | $130 | 36% | $360 |
| 2025-03-02 | $145 | 40% | $95 | 26% | $122 | 34% | $362 |
| ... | ... | ... | ... | ... | ... | ... | ... |
| 2025-03-14 | $110 | 28% | $165 | 42% | $120 | 30% | $395 |
```

**Shift Analysis:**
```
### Network Shift Analysis (first 7 days vs. last 7 days)

| Network | First Half | Second Half | Shift | Status |
|---|---|---|---|---|
| SEARCH | 41% | 29% | -12% | ⚠️ FLAGGED — Search share declining |
| DISPLAY | 23% | 40% | +17% | ⚠️ FLAGGED — Display share increasing |
| YOUTUBE | 36% | 31% | -5% | ✅ Stable |
```

**Interpretation guidance** (include in output when shifts are flagged):
```
⚠️ Significant network shift detected: Display spend share increased by 17% while Search decreased by 12%.
This may indicate the algorithm is shifting to lower-quality Display/MGDN inventory.

Recommended actions:
- Check the placement report for underperforming apps/sites
- Cross-reference with MMP data to verify conversion quality per network
- If CPA has risen, the network shift is likely the cause

Sources: ab-pt-005, ab-pt-017, gg135-005
```

### Computation Logic
1. Fetch daily data with network segmentation
2. For each day, compute `cost_share_pct` = network_cost / total_daily_cost × 100
3. Split date range into first half and second half
4. For each network, compute `first_half_avg_share` and `second_half_avg_share`
5. `shift_pct` = second_half_avg_share - first_half_avg_share
6. Flag if `abs(shift_pct) > shift_threshold_pct`

---

## 6. get_google_asset_fatigue

### What It Does
Detects creative asset fatigue in Google UAC campaigns by analyzing per-asset impression trends, CTR decline, and CPA deterioration over a rolling window. Also checks asset age against Google's 2-week learning minimum and 2-3 month refresh cadence. This is the equivalent of `get_meta_ad_fatigue`.

### Why It Matters
- **Google doesn't expose per-asset frequency.** Unlike Meta where frequency is the primary fatigue signal, Google UAC doesn't report frequency at the asset level. Instead, we use **impression volume decay** (the algorithm deprioritizing an asset) as the primary fatigue signal, alongside CTR decline and CPA deterioration.
- **The 2-week learning period is sacred.** Never remove an asset within its first 2 weeks — it needs time to graduate from LEARNING status. This tool flags assets that are still in the learning window so users don't prematurely kill them. *(Knowledge base: `goog-pdf-018` — "Never remove a creative within its first 2 weeks after upload, as it needs time for the learning phase.")*
- **2-3 month refresh cadence.** Google recommends refreshing assets every 2-3 months. Assets older than ~75 days should be evaluated for replacement, starting with Low-rated ones. *(Knowledge base: `goog-pdf-018` — "Refresh creative assets every 2-3 months. Replace only 'Low' rated assets, never 'Best' or 'Good'.")*
- **Google's algorithm can burn out.** Campaigns and their assets degrade over time even without changes. Detecting this at the asset level catches fatigue before the whole campaign needs to be duplicated. *(Knowledge base: `ab-pt-007` — "Google App Campaign algorithms can burn out over time — scale degrades even without changes.")*
- **Don't trust Google's performance label for this.** The built-in asset rating measures the algorithm's scaling preference, not whether the asset is fatigued. An asset can be rated "Good" but have declining CTR and rising CPA. *(Knowledge base: `ab-pt-008` — "Google's asset performance rating in the Ads dashboard is based on an asset's ability to scale and drive high CTR — not on whether it drives valuable conversions.")*

### GAQL Queries

**Query 1 — Daily asset performance (last N days):**
```sql
SELECT
  asset.id,
  asset.name,
  asset.type,
  ad_group_ad_asset_view.field_type,
  ad_group_ad_asset_view.performance_label,
  ad_group.id,
  ad_group.name,
  segments.date,
  metrics.impressions,
  metrics.clicks,
  metrics.cost_micros,
  metrics.conversions,
  metrics.biddable_app_install_conversions
FROM ad_group_ad_asset_view
WHERE campaign.id = {campaign_id}
  AND ad_group.id = {ad_group_id}  -- optional
  AND segments.date BETWEEN '{start_date}' AND '{end_date}'
ORDER BY segments.date ASC
```

**Query 2 — Asset creation dates (for age check):**

Note: The Google Ads API does not expose `asset.creation_time` in all cases. As a fallback, use the earliest `segments.date` with impressions > 0 from historical data as a proxy for when the asset started serving. Alternatively, if `asset.creation_time` is not available, the tool should note that age-based recommendations are approximate.

### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `customer_id` | string | Yes | — | Google Ads customer ID |
| `campaign_id` | string | Yes | — | Campaign to analyze |
| `ad_group_id` | string | No | — | Scope to specific ad group |
| `lookback_days` | number | No | 14 | Days of daily data to analyze (min 7, max 90) |
| `ctr_decline_threshold_pct` | number | No | 30 | CTR decline from peak to flag fatigue |
| `impression_decay_threshold_pct` | number | No | 50 | Impression volume drop from peak daily avg to recent daily avg |
| `asset_type` | string[] | No | all | Filter: `IMAGE`, `YOUTUBE_VIDEO`, `TEXT` |

### Fatigue Detection Logic

For each asset:

1. **Collect daily metrics** over the lookback window
2. **Skip assets with insufficient data** (fewer than 3 days with impressions)
3. **Compute peak vs. recent metrics:**
   - `peak_daily_impressions` = highest 3-day rolling average in the window
   - `recent_daily_impressions` = last 3 days average
   - `impression_decay_pct` = (peak - recent) / peak × 100
   - `peak_ctr` = highest CTR in any 3-day window
   - `recent_ctr` = CTR over last 3 days
   - `ctr_decline_pct` = (peak_ctr - recent_ctr) / peak_ctr × 100
   - `peak_cpa` = lowest CPA in any 3-day window (best performance)
   - `recent_cpa` = CPA over last 3 days
   - `cpa_change_pct` = (recent_cpa - peak_cpa) / peak_cpa × 100 (positive = worse)

4. **Determine fatigue status:**

| Status | Condition |
|---|---|
| **LEARNING** | Asset first appeared < 14 days ago — do not touch |
| **FATIGUED** | impression_decay > threshold AND (ctr_decline > threshold OR cpa_change > 50%) |
| **WARNING** | impression_decay > threshold OR ctr_decline > threshold OR cpa_change > 30% |
| **NEEDS_REFRESH** | Asset age > 75 days (approaching 2-3 month window), regardless of metrics |
| **HEALTHY** | All metrics stable |

5. **Priority ranking:** FATIGUED > NEEDS_REFRESH > WARNING > LEARNING > HEALTHY

### Output Format

```
## Asset Fatigue Analysis — MyApp_Install_US_iOS — Last 14 Days

### Summary
- Total assets analyzed: 18
- 🔴 FATIGUED: 3 (replace these first)
- 🟡 WARNING: 4 (monitor closely)
- 🟢 HEALTHY: 8
- 📘 LEARNING: 2 (do not remove — need more time)
- 🔄 NEEDS_REFRESH: 1 (approaching 75+ day age)

### Fatigued Assets (Action Required)
| Asset | Type | Field | Label | Impr Decay | CTR Decline | CPA Change | Age | Action |
|---|---|---|---|---|---|---|---|---|
| hero_landscape | IMAGE | IMAGE | LOW | -62% | -41% | +55% | 89 days | Replace — past refresh window, declining on all signals |
| 30s_ugc_old | VIDEO | VIDEO | GOOD | -58% | -33% | +38% | 78 days | Replace — note: still rated "Good" by Google but fatigued by actual metrics |
| headline_generic | TEXT | HEADLINE | LOW | -71% | -45% | +62% | 92 days | Replace with new headline variant |

### Warning Assets (Monitor)
| Asset | Type | Field | Label | Impr Decay | CTR Decline | CPA Change | Age | Note |
|---|---|---|---|---|---|---|---|---|
| meal_plan_square | IMAGE | IMAGE | GOOD | -35% | -22% | +15% | 45 days | Impression decay beginning — watch next 7 days |

### Learning Assets (Do Not Remove)
| Asset | Type | Field | Age | Note |
|---|---|---|---|---|
| new_video_shorts | VIDEO | VIDEO | 5 days | In learning phase — evaluate after day 14 |
| headline_v2 | TEXT | HEADLINE | 8 days | In learning phase — evaluate after day 14 |

### Recommendations
Based on the analysis and Mobile Growth knowledge base:

1. **Replace 3 fatigued assets** — prioritize the 2 that are past the 75-day refresh window
2. **Do NOT remove the 2 learning assets** — they need at least 14 days before evaluation (goog-pdf-018)
3. **Replace 2-3 assets at a time**, not all at once — maintain algorithmic stability (goog-pdf-018)
4. **Add variants inspired by your "Best" rated assets** when replacing (goog-pdf-018)
5. Note: "30s_ugc_old" is rated "Good" by Google but is fatigued by actual CTR/CPA metrics — Google's label measures scalability, not value (ab-pt-008)

Sources: goog-pdf-018, ab-pt-008, goog-pdf-019, ab-pt-007
```

---

## Implementation Notes

### Authentication
Google Ads API requires:
- **OAuth2 refresh token** — for the Google Ads account
- **Developer token** — from the Google Ads API Center
- **Customer ID** — the Google Ads account ID (10 digits, no dashes)
- **Login customer ID** (optional) — for MCC (manager account) access

These should be configured similarly to how `META_ACCESS_TOKEN` is set today — via environment variables:
```
GOOGLE_ADS_DEVELOPER_TOKEN=xxx
GOOGLE_ADS_CLIENT_ID=xxx
GOOGLE_ADS_CLIENT_SECRET=xxx
GOOGLE_ADS_REFRESH_TOKEN=xxx
```

### API Client
Use the `google-ads-api` npm package (or direct REST API calls to `https://googleads.googleapis.com/v19/customers/{customerId}/googleAds:searchStream`).

GAQL queries are sent via the `searchStream` or `search` endpoint. `searchStream` returns all results in a single response (no pagination). `search` supports pagination with `page_token` and `page_size`.

### Micros Conversion
All monetary values from Google Ads API are in micros. Convert: `value_dollars = value_micros / 1_000_000`. Format to 2 decimal places for display.

### Error Handling Pattern
Follow the existing Meta tool pattern:
```javascript
{
  content: [{ type: "text", text: "Error: ..." }],
  isError: true
}
```

Common Google Ads API errors:
- `AUTHENTICATION_ERROR` → invalid credentials
- `AUTHORIZATION_ERROR` → insufficient permissions
- `REQUEST_ERROR` → malformed GAQL
- `QUOTA_ERROR` → rate limited (respect `Retry-After` header)
- `INTERNAL_ERROR` → retry once

### Knowledge Base Citation Pattern
Follow the existing pattern from `get_meta_ad_fatigue` — reference specific insight IDs (e.g., `ab-pt-005`, `goog-pdf-018`) in tool descriptions and output recommendations. This grounds the tool's logic in practitioner knowledge.

### Implementation Order
1. **Phase 1:** `get_google_campaigns` + `get_google_ad_groups` — establish GAQL execution pattern and auth
2. **Phase 2:** `get_google_insights` — dynamic query builder, most complex tool
3. **Phase 3:** `get_google_assets` + `get_google_asset_fatigue` — creative intelligence
4. **Phase 4:** `get_google_network_mix` — shift detection logic
