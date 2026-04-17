# Skill: Google Asset Performance Report

Categorize every active asset (video, image, text) by health status and provide specific next steps — grounded in how Google actually scores and serves assets, not how the UI reports them.

---

## When to Use This

- User asks "which Google creatives are working?"
- CPI is rising and creative fatigue is suspected
- User wants to know what to pause, keep, or replace in Google Ads
- User is planning a new creative batch and wants to understand gaps
- After running `google-campaign-health` and a campaign is flagged as degrading

## What It Needs

**Option A — Google Ads connected:**

```
get_google_assets(customer_id="123-456-7890", campaign_id="...")
get_google_asset_fatigue(customer_id="123-456-7890", campaign_id="...")
```

**Option B — CSV export:** Export from Google Ads UI:
- Go to **Ads & Assets** → **Assets** tab
- Columns: `Asset`, `Asset type`, `Campaign`, `Ad group`, `Performance label` (Low/Good/Best/Learning), `Impressions`, `Clicks`, `Conversions`, `Cost`, `CPI`
- Also export the **Ad groups** report with the same date range for context
- Date range: last 14 days. Export as CSV and paste below.

## What It Produces

- Asset-level health table with category per asset
- Creative gap analysis (which formats/placements are underserved)
- Specific assets to pause, test differently, or replace
- Next creative batch recommendations grounded in iOS/Android traffic split

---

## Knowledge Base Grounding

- **ab-pt-008** (Ashley Black): "Ignore Google's built-in creative performance label — it measures scalability potential, not value delivered. A 'Low' asset may still be driving installs efficiently."
- **ab-pt-003** (Ashley Black): "iOS: ~60% video traffic (YouTube-heavy). Android: ~30% video (Play Store absorbs most traffic with text/image). Creative priorities differ by platform."
- **ab-pt-004** (Ashley Black): "Text assets function like keywords — Google indexes them against search queries. Different keywords have drastically different CPMs. Analyze cost by text asset."
- **gg-gem-1295** (ex-Googler): "Use IPM (installs per 1000 impressions) to compare assets of the same type — it normalizes for spend differences."
- **gg-gem-1178** (community): "You need different creative for each of Google's inventory types — what works on YouTube Shorts doesn't work on Play Store browse or AdMob."
- **ab-pt-015** (Ashley Black): "Don't copy Meta creative strategy to Google — Meta optimizes for scroll-stop, Google optimizes for intent-match. Different hooks, different pacing."
- **gg-gem-1181** (community): "In Conversion settings you can opt-in for 6-second bumper ads — a separate format that can unlock new inventory."

---

## Procedure

### Step 1: Pull Asset Data

**If API connected:**

```
get_google_assets(
  customer_id="123-456-7890",
  campaign_id="[campaign_id]"
)

get_google_asset_fatigue(
  customer_id="123-456-7890",
  campaign_id="[campaign_id]"
)
```

**If CSV:** Use the assets export the user pasted.

### Step 2: Determine Target CPI

Ask the user for their target CPI, or calculate account average from the data.

### Step 3: Categorize Each Asset

**Critical rule**: Do not use Google's "Performance label" (Low/Good/Best) as the primary signal [ab-pt-008]. Use actual CPI and impression share instead.

| Category | Criteria | Action |
|----------|----------|--------|
| **Top performer** | CPI ≤ target, high impressions (>15% of campaign total) | Keep running. Extract what makes it work — hook, format, message angle. |
| **Efficient but limited** | CPI ≤ target, low impressions (<5%) | Google has deprioritized it — likely similar to a higher-spend asset [oh-li-001 analogy]. Don't force it. Analyze what's different. |
| **Learning** | < 7 days live or < 500 impressions | Too early to judge. Leave running. |
| **Fatiguing** | IPM declining over last 7 days, CPI rising | Flag for replacement. Don't pause yet — wait until a replacement is ready [ab-pt-007 analogy]. |
| **Underperforming** | CPI > 2× target for > 14 days, significant impressions | Candidate for pause. Check if it's covering a unique placement before pausing. |
| **Low label, efficient** | Google says "Low" but CPI ≤ target | Keep it — Google's label means it won't scale further, not that it's wasting money [ab-pt-008]. |

### Step 4: Format Gap Analysis

Check coverage across asset types, grounded in platform traffic split:

**For iOS campaigns** (60% video traffic):
- Do you have videos in multiple durations: 6s, 10s, 20s, 30s, 30s+?
- Do you have portrait/vertical videos for YouTube Shorts?
- Fewer than 3 video variants = high fatigue risk

**For Android campaigns** (30% video, 70% text/image):
- Do you have landscape images (1.91:1)?
- Do you have 5 distinct text headline assets with different keyword angles [ab-pt-004]?
- Are text assets using specific search terms (pain points, features, long-tail) rather than generic copy?

**Bumper ads**: Are 6-second bumpers enabled? If not, you may be missing inventory [gg-gem-1181].

### Step 5: Text Asset Keyword Analysis

For each text asset with significant impressions:
- What keyword/intent does it signal?
- Is the CPM or CPI noticeably different from other text assets?
- Flag high-CPM text assets (likely expensive keyword territory) vs low-CPM high-performers

### Step 6: Output

```
## Google Asset Performance — [campaign] — [date range]

### Asset Health Summary

| Asset | Type | CPI | vs Target | IPM | Category |
|-------|------|-----|-----------|-----|----------|
| [name] | Video 30s | $2.10 | -15% | 4.2 | Top performer |
| [name] | Text | $4.80 | +92% | 1.1 | Underperforming |

### Creative Gaps
- iOS: Missing portrait video for YouTube Shorts (high-traffic placement)
- Android: Only 2 text asset variants — recommend 3 more with different keyword angles

### Assets to Pause
- [name]: CPI $4.80 (+92% above target) for 18 days. Confirm it's not the only asset covering a key placement before pausing.

### Next Batch Recommendations
1. [Format]: [rationale grounded in gap analysis]
2. ...

### Note on Google's Labels
[X] assets are labeled "Low" by Google but have CPI at or below target — these are working ads that Google has chosen not to scale further. Do not pause them based on the label alone.
```
