# Skill: Google Network Mix Audit

Analyze how Google App Campaign spend is distributed across its 5 networks — and whether that distribution is working for you or against you.

---

## When to Use This

- CPI suddenly spiked and the cause isn't obvious
- User suspects traffic quality has degraded
- After enabling a new campaign and wanting to understand where Google is sending spend
- User is comparing two campaigns with different CPI and wants to rule out network mix as the cause
- Before deciding whether to add placement exclusions

## What It Needs

**Option A — Google Ads MCP connected** (official `googleads/google-ads-mcp`, read-only): run the GAQL queries below with its `search` tool. Money fields are in micros; App campaigns are `advertising_channel_type = MULTI_CHANNEL`. If a field errors, check the MCP's field-metadata resources and adjust the query.

Queries: spend by `segments.ad_network_type` per week, plus `group_placement_view` (see Procedure).

**Option B — CSV export:** Export from Google Ads UI:
- Go to the **Campaigns** report → click **Segment** → **Network (with search partners)**
- Columns: `Campaign`, `Network`, `Impressions`, `Clicks`, `Conversions`, `Cost`, `CPI`, `CTR`
- Date range: last 14 days. Export as CSV and paste below.
- Note: Google's UI shows 4 buckets — Search, Display Network, YouTube, Cross-network. The full 5-network breakdown (including Play Store separately) requires a Google rep.

## What It Produces

- Network spend distribution table with CPI per network
- Identification of underperforming networks pulling the average up
- Flags for abnormal traffic shifts
- Placement exclusion recommendations where warranted

---

## Knowledge Base Grounding

- **ab-pt-005** (Ashley Black): "Google App Campaigns serve across 5 networks but the dashboard only shows 4 buckets. 'Search' includes both google.com AND Play Store search. 'Display Network' includes AdMob, MGDN (mobile browser), AND Play Store browse. 'YouTube' includes Shorts, in-stream, homepage, and bumper ads."
- **ab-pt-018** (Ashley Black): "Each traffic source has very different quality characteristics. Play Store search = high-intent (users actively searching). AdMob/MGDN = low-intent (interruption ads in other apps). Understanding the mix explains most unexplained CPI swings."
- **gg-gem-1177** (community): "Dig deep in the Google UI — the app placement report shows which specific apps/sites are serving your ads. Most advertisers never look at this. It's under Insights → Where ads showed."
- **gg-gem-1292** (ex-Googler): "You can see the 'Devices' breakdown under Insights → Where and When ads are shown → Devices. Sudden shifts between phone/tablet can explain CPI changes."
- **ab-pt-005** actionable: "Use Network segmentation to monitor traffic shifts. If you see a performance drop, check if traffic shifted to low-quality display/web placements."

---

## Procedure

### Step 1: Pull Network Distribution

**If the Google Ads MCP is connected:**

```sql
SELECT campaign.name, segments.ad_network_type, segments.week,
  metrics.impressions, metrics.clicks, metrics.conversions, metrics.cost_micros
FROM campaign
WHERE campaign.advertising_channel_type = MULTI_CHANNEL AND segments.date BETWEEN '[today-28]' AND '[yesterday]'
# Compare the last 2 weeks with the 2 before to spot share shifts

# Placements (impressions only; no detail inside Google-owned inventory)
SELECT group_placement_view.placement_type, group_placement_view.display_name,
  group_placement_view.target_url, metrics.impressions, metrics.cost_micros, metrics.conversions
FROM group_placement_view
WHERE campaign.advertising_channel_type = MULTI_CHANNEL AND segments.date DURING LAST_30_DAYS
ORDER BY metrics.impressions DESC LIMIT 100
```

**If CSV:** Use the network-segmented export the user pasted.

### Step 2: Map Buckets to Real Traffic

Explain what each bucket actually contains to the user:

| UI Bucket | What's Actually Inside |
|-----------|------------------------|
| Search | google.com search results + Play Store search (high-intent) |
| Display Network | AdMob (in-app ads) + MGDN (mobile browser) + Play Store browse |
| YouTube | In-stream, YouTube Shorts, homepage, bumper ads |
| Cross-network | Mixed; often a small residual bucket |

### Step 3: Calculate CPI by Network

For each bucket:
- Spend share (% of total)
- CPI relative to campaign average
- Install share (% of total installs)

Flag any bucket where:
- Spend share > 30% AND CPI > 1.5× campaign average → **High-cost network drag**
- Spend share increased > 10pp WoW → **Traffic shift** — likely cause of any CPI change

### Step 4: Check Placement Report (API or Manual)

**If the Google Ads MCP is connected:** Look for specific underperforming app/site placements within Display Network.

**If manual:** Advise user to check: Google Ads UI → **Insights** → **Where ads showed** → filter by Display Network → sort by Cost desc → look for non-app placements (web URLs) with high cost and zero installs.

Placement exclusion is warranted when:
- A specific app/site accounts for > 5% of Display spend with CPI > 3× target
- Web (non-app) placements are appearing in an app install campaign

### Step 5: Check Device Split

Advise user to check: Google Ads UI → **Insights** → **Devices**. A sudden shift from phone to tablet traffic frequently explains CPI increases — tablets convert at a much lower rate for most apps.

### Step 6: Output

```
## Google Network Mix Audit — [campaign] — [date range]

### Network Distribution

| Network | Spend Share | CPI | vs Avg | Trend |
|---------|-------------|-----|--------|-------|
| Search (google.com + Play search) | 42% | $1.80 | -28% | Stable |
| Display (AdMob + MGDN + Play browse) | 38% | $3.90 | +56% | ↑ +8pp WoW |
| YouTube | 20% | $2.20 | -12% | Stable |

### Diagnosis

Display Network is pulling the overall CPI up significantly. Its spend share grew 8pp last week — this shift likely explains the overall CPI increase.

Within Display, check your placement report for non-app (web) URLs — these tend to be low-quality for app install campaigns.

### Recommended Actions
1. Run the placement report (Insights → Where ads showed → Display) and exclude any web URLs with >$X spend and zero installs.
2. Do not exclude the entire Display Network — Play Store browse is high-intent inventory within that bucket.
3. Monitor the network split weekly — a 5pp+ shift is worth investigating.

### What You Can't Control
Google's algorithm automatically shifts spend across networks based on auction signals. You can exclude specific placements but cannot directly cap network-level spend. The levers are: bid adjustments, placement exclusions, and creative quality (better creatives attract better placements).
```
