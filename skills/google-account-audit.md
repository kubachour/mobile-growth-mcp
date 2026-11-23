# Skill: Google App Campaigns Account Audit

## What It Does

Audits a Google App Campaigns account against the best practices in the knowledge base: tracking and conversion signal, conversion windows and tROAS targets, account settings, audience signals and exclusions, ad group and asset coverage, and iOS measurement. Every finding is tied to an insight ID so the user can read the source.

Data comes from the **official Google Ads MCP** (read-only GAQL `search` tool). Settings the API can't see (MMP toggles, SDK versions, Consent Mode) are asked as checklist questions.

## When to Use This

- User asks to "audit my Google Ads", "review my UAC setup", "what am I doing wrong on Google"
- Onboarding a new client account, or before scaling Google spend
- Performance dropped and the cause isn't in creatives or network mix
- After `google-campaign-health` flags several campaigns at once

## What It Needs

- **Google Ads MCP** (official, `googleads/google-ads-mcp`) connected: use its `list_accessible_customers` and `search` tools. If a field in a query below errors, check the MCP's field-metadata resources and adjust; don't drop the check.
- `customer_id` of the account (no dashes needed)
- App type: **subscription**, **games / IAP**, or **ads-monetized**. Ask if unknown — several checks differ.
- Answers to the manual questions in Step 7 (the user can answer "don't know"; mark those as unverified).

No Google Ads credentials are needed in this MCP for the audit; it only reads through Google's MCP.

## What It Produces

- A scorecard: each check marked ✅ pass, ⚠️ warning, ❌ fail or ❔ unverified, with the evidence and the insight ID
- Top 5 fixes in priority order (tracking and signal first, then structure, then creatives)
- A list of tests worth running, from the knowledge base

## Knowledge Base Grounding

Before Step 1, run these searches and use the results alongside the IDs below, so that newly added knowledge shapes the audit:

```
search_insights(query="Google App Campaigns conversion window tROAS target", limit=8)
search_insights(query="Google App Campaigns audience signals exclusions", limit=8)
search_insights(query="Google App Campaigns asset refresh creative coverage", limit=8)
search_insights(query="Google ODM ICM iOS measurement setup", limit=8)
```

Key insights:
- **ab-vt-002**: one optimization event per campaign; mixing events hides the real CPA of the valuable one
- **tp-se-009**, **gg135-002**: subscription apps need an event inside 24h of install; if trial-to-paid is under 30–40%, optimize to a qualified trial or purchase
- **tp-se-012**: one signal source per platform (Firebase or MMP), or deduplicate properly
- **gg124-018**: value bidding and ODM only work with Firebase events
- **ab-pt-010**: tROAS on a 7-day window max; start the target 20%+ below the real goal
- **ab-pt-011**: tROAS needs Firebase, volume and a 2–6 week learning window
- **ab-pt-019**: aim for 100 installs/day or 30 actions/day per campaign
- **ab-pt-012**: run CPA and tROAS side by side, different bid types per geo
- **ab-pt-009**: Google doesn't auto-exclude existing users
- **ab-pt-001**: iOS needs real budget ($500+/day, subscription apps $1,000+/day for tROAS/value); Android $200+/day
- **gg-gem-1294**: $100/day is too small to test properly; 2,000–5,000 impressions per ad to judge it
- **goog-pdf-011**, **goog-pdf-012**: fill every asset slot; each asset type unlocks inventory
- **goog-pdf-018**, **goog-pdf-019**, **ab-pt-008**: refresh rules and what asset ratings mean
- **ab-pt-005**, **ab-pt-017**: network buckets and placement blocking
- **ab-vt-005**: naming convention AppName_Event_Country_OS
- **da-ot-004**, **pp-ot-001**, **ab-pt-014**, **da-ot-006**: ODM/ICM setup and iOS discrepancies
- **dt-ot-004**: avoid Performance Max for app installs

## Procedure

All queries run through the Google Ads MCP `search` tool. Money fields are in micros (divide by 1,000,000). App campaigns have `advertising_channel_type = MULTI_CHANNEL`.

### Step 1: Campaigns, bidding and settings

```sql
SELECT campaign.id, campaign.name, campaign.status, campaign.start_date,
  campaign.advertising_channel_type, campaign.advertising_channel_sub_type,
  campaign.bidding_strategy_type, campaign.target_cpa.target_cpa_micros,
  campaign.target_roas.target_roas, campaign_budget.amount_micros,
  campaign.app_campaign_setting.app_id, campaign.app_campaign_setting.app_store,
  campaign.app_campaign_setting.bidding_strategy_goal_type,
  campaign.selective_optimization.conversion_actions,
  campaign.geo_target_type_setting.positive_geo_target_type
FROM campaign
WHERE campaign.status = ENABLED
```

Then 30-day volume per campaign:

```sql
SELECT campaign.id, campaign.name, metrics.cost_micros, metrics.conversions,
  metrics.conversions_value, metrics.biddable_app_install_conversions,
  metrics.biddable_app_post_install_conversions
FROM campaign
WHERE campaign.status = ENABLED AND segments.date DURING LAST_30_DAYS
```

| Check | Pass | Source |
|---|---|---|
| Every App campaign has a target (tCPA or tROAS) | No campaign on plain Maximize conversions without a target | ab-pt-017 |
| Each campaign optimizes ONE conversion action | `selective_optimization.conversion_actions` has 1 entry | ab-vt-002 |
| Volume per campaign | ≥ 30 target events/day (ab-pt-019); for purchases ~10–15/day minimum. Below that → consolidate | ab-pt-019 |
| Budget | ≥ $200/day Android; iOS: ~$250/day on tCPA is a workable start (US + tier 1 combined), $500+/day (subscription $1,000+) before tROAS/value bidding. Under $100/day = ❌ | ab-pt-001, gg-gem-1294 |
| CPA and tROAS side by side | Both bid types present where volume allows; not two campaigns with the same bid type in the same geo | ab-pt-012 |
| tROAS prerequisites | Firebase events + volume + accepted 2–6 week learning | ab-pt-011 |
| No Performance Max for installs | No PMax campaign promoting the app | dt-ot-004 |
| Location setting | `positive_geo_target_type`: flag `PRESENCE_OR_INTEREST` (the default) as ⚠️ and ask if it's intended. The KB has no source on the right choice yet, so report, don't prescribe | (gap) |
| Naming convention | Names encode app, event, country, OS | ab-vt-005 |

### Step 2: Conversion actions and windows

```sql
SELECT conversion_action.id, conversion_action.name, conversion_action.status,
  conversion_action.type, conversion_action.category, conversion_action.origin,
  conversion_action.primary_for_goal, conversion_action.counting_type,
  conversion_action.click_through_lookback_window_days,
  conversion_action.firebase_settings.event_name,
  conversion_action.third_party_app_analytics_settings.event_name,
  conversion_action.value_settings.default_value,
  conversion_action.value_settings.always_use_default_value
FROM conversion_action
WHERE conversion_action.status = ENABLED
```

Join the optimized actions from Step 1 with this list.

| Check | Pass | Source |
|---|---|---|
| Window changed from the 90-day default | Optimized actions use 7 or 14 days. 90 = ❌. 28–60 = ⚠️ (games may test 28) | ab-pt-010; KB search "conversion window" |
| tROAS target matches the window | Target was back-calculated for the window (e.g. D7 ROAS). Ask the user what payback day the target means | ab-pt-010 |
| tROAS start point | Target set ≥ 20% below the real goal at launch | ab-pt-010 |
| Signal source | Firebase events for UAC (needed for value bidding and ODM); one source per platform, no Firebase + MMP duplicates of the same event | gg124-018, tp-se-012 |
| Purchases carry values | Purchase action has real values (not `always_use_default_value`). Without values, no tROAS | gg124-018 |
| Clean list | No duplicate or oddly named actions; primary goals are the ones being optimized | ab-vt-002 |
| Subscription apps only | The optimized event fires within 24h of install (trial start, qualified trial, or a day-1 proxy), not a day-7 trial conversion. If trial-to-paid < 30–40%, use a qualified trial or purchase | tp-se-009, gg135-002 |
| first_open over install | First open (or an engagement event) tracked, not only installs | KB search "first open" |

### Step 3: Audience signals and exclusions

```sql
SELECT campaign.name, ad_group.id, ad_group.name,
  ad_group_criterion.type, ad_group_criterion.negative,
  ad_group_criterion.user_list.user_list,
  ad_group_criterion.custom_audience.custom_audience,
  ad_group_criterion.audience.audience
FROM ad_group_criterion
WHERE campaign.advertising_channel_type = MULTI_CHANNEL
  AND ad_group.status = ENABLED
  AND ad_group_criterion.type IN (USER_LIST, CUSTOM_AUDIENCE, AUDIENCE)
```

If this returns nothing, also query `campaign_criterion` with the same types before concluding there are none.

| Check | Pass | Source |
|---|---|---|
| Existing users excluded | A negative user list of existing users / recent purchasers on install campaigns | ab-pt-009 |
| Audience signal in every ad group | ≥ 1 positive audience per ad group; strongest is a custom segment of ~10 competitor app bundle IDs; also Firebase payers, other apps' users | KB search "audience signals" |
| Broad / competitor / payer split | Same creatives tested across broad, competitor and payer ad groups | KB search "audience signals" |

### Step 4: Ad groups and asset coverage

```sql
SELECT campaign.name, ad_group.id, ad_group.name, ad_group.status,
  ad_group_ad.ad.app_ad.headlines, ad_group_ad.ad.app_ad.descriptions,
  ad_group_ad.ad.app_ad.images, ad_group_ad.ad.app_ad.youtube_videos,
  ad_group_ad.ad.app_ad.html5_media_bundles
FROM ad_group_ad
WHERE ad_group_ad.ad.type = APP_AD AND ad_group_ad.status = ENABLED
```

Then image and video formats in use:

```sql
SELECT asset.id, asset.name, asset.type,
  asset.image_asset.full_size.width_pixels, asset.image_asset.full_size.height_pixels,
  asset.youtube_video_asset.youtube_video_id, asset.youtube_video_asset.youtube_video_title
FROM asset
WHERE asset.type IN (IMAGE, YOUTUBE_VIDEO)
```

| Check | Pass | Source |
|---|---|---|
| Ad groups per campaign | 3–5 by creative theme (rough guide: ~5 at $1k/day, ~10 at $5k/day) | ab-vt-005 |
| Text slots full | 5 headlines (≤ 30 chars) and 5 descriptions (≤ 90 chars), written like long-tail search terms | goog-pdf-011, ab-pt-004 |
| Video coverage | ≥ 3 videos per ad group in landscape AND portrait; a range of lengths (6/10/20/30s+), not only one length | goog-pdf-012, ab-pt-003 |
| Images | Landscape, square and portrait in-app screenshots (~8/8/4), no text on the image. On Android, images and text matter more (~70% of traffic isn't video) | fs-em-001, ab-pt-003 |
| Every asset type present | No video = no YouTube/AdMob video; no images = no AdMob display, Discover, Play image units | goog-pdf-012 |

Fix missing assets with this MCP's `upload_google_image_assets`, `upload_google_video_assets` (YouTube ID) and `add_assets_to_app_ad`. Always dry-run first.

### Step 5: Asset ratings and refresh

```sql
SELECT campaign.name, ad_group.name, asset.id, asset.name, asset.type,
  ad_group_ad_asset_view.field_type, ad_group_ad_asset_view.performance_label,
  metrics.impressions, metrics.conversions, metrics.cost_micros
FROM ad_group_ad_asset_view
WHERE ad_group_ad_asset_view.enabled = TRUE AND segments.date DURING LAST_30_DAYS
```

| Check | Pass | Source |
|---|---|---|
| Low assets reviewed by CPI, not label alone | Google's label is relative and measures scalability (goog-pdf-019, ab-pt-008). **Before removing a "Low" asset, check its CPI/CPA**: remove only if it is Low AND above target. A Low asset with a cheap CPI stays | goog-pdf-018, goog-pdf-019, ab-pt-008 |
| All "Good", no "Best" | Means no clear winner: add more differentiated assets | goog-pdf-019 |
| Refresh cadence | New assets every 2–3 months; 2–3 swaps at a time; nothing removed in its first 2 weeks | goog-pdf-018 |

### Step 6: Network and placements

```sql
SELECT campaign.name, segments.ad_network_type, metrics.impressions,
  metrics.cost_micros, metrics.conversions
FROM campaign
WHERE campaign.advertising_channel_type = MULTI_CHANNEL AND segments.date DURING LAST_30_DAYS
```

Know what each bucket hides (Search = google.com + Play search; Display = AdMob + mobile web + Play browse) [ab-pt-005]. For a deeper read, run `google-network-audit`. Flag ⚠️ if non-Google-owned Display share jumped recently; block poor apps via the placement report [ab-pt-017].

Custom store listings only reach Display traffic, so ~50% of App campaign traffic still sees the default listing: segment install rate by network when reading a CSL test (KB search "custom store listings").

### Step 7: Manual checks (ask the user)

The Google Ads API can't see these. Ask them as one short list; mark unknowns ❔.

1. Is Firebase linked to Google Ads, with the GA4F SDK at 11.14.0 or higher? [da-ot-004]
2. Is the MMP connected too, so numbers can be cross-checked?
3. **iOS only.** ODM/ICM isn't available in Europe; skip for EU-only apps [da-ot-004]. Otherwise:
   - AppsFlyer: "Advanced Data Sharing" ON and "Aggregated Advanced Privacy" OFF. Adjust: "Probabilistic modeling" ON [da-ot-004]
   - AppsFlyer first_open and session_start imported as secondary goals [da-ot-004]
   - Consent Mode `ad_storage` granted; MMP SDK initializes after Firebase ODM; MMP SDK not gated behind ATT [da-ot-004, pp-ot-001]
4. **iOS only.** Google vs MMP revenue: a gap over 10x means iOS UAC isn't working for this app [da-ot-006]. Use Google's modeled data day to day and SKAN for cross-network comparison [ab-pt-014].
5. Custom columns: "All conv." segmented by conversion action, and network segmentation, in saved reports?
6. Brand keywords: excluded or not? If excluded, was the effect on installs tested?
7. Cadence: new campaigns left alone for 3 days; bids and budgets changed ≤ 20%/day [ab-pt-006].

### Step 8: Output

```
## Google App Campaigns Audit — [account] — [date]
App type: [subscription / games / ads] · Platforms: [Android / iOS] · 30-day spend: $X

### Scorecard
| Area | Check | Result | Evidence | Source |
|------|-------|--------|----------|--------|
| Signal | One event per campaign | ❌ | "MyApp_US_iOS" optimizes trial_start + purchase | ab-vt-002 |
| Window | 7/14-day window | ❌ | purchase action on 90 days | ab-pt-010 |
| ...

### Top 5 fixes (in order)
1. [fix] — why, expected effect, source ID
...

### Unverified (answers needed)
- [manual checks answered "don't know"]

### Worth testing
- Conversion window 7 vs 14 days in separate ad accounts (14 as control)
- Competitor-audience and payer ad groups with the same creatives
- CPA vs tROAS geo split [ab-pt-012]
```

Rules for the output:
- Tracking and signal problems go first: fixing structure or creatives on a broken signal wastes the effort.
- Name the insight ID on every finding. Distinguish KB-backed findings from your own reasoning.
- Where the KB has conflicting views (e.g. asset ratings, conversion window 7 vs 14), say so instead of picking one silently.
- If a check found a gap the KB doesn't cover, call `submit_feedback` with category `missing_knowledge`.
