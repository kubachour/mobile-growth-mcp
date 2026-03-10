# Skill: Placement Efficiency Audit

How to identify and quantify placement waste in Meta app install campaigns.

---

## Knowledge Base Grounding

- **mb-li-006** (Marcus Burke): "App Promotion campaigns are Reels-heavy and skew young. Web campaigns have better placement distribution and scale on Feed."
- **mb-li-009** (Marcus Burke): "Placement-level Value Rules — bid differently on each placement within the same broad targeting ad set. Don't create separate placement-targeted campaigns."

---

## When to Use This

- Campaign has high CPI and you suspect placement waste
- Comparing an efficient vs inefficient campaign
- After enabling Advantage+ placements and wanting to check what Meta chose
- Before deciding whether to restrict placements or keep them broad

---

## Step 1: Pull Placement Breakdown

```
get_meta_insights(
  ad_account_id="act_123456789",
  level="campaign",
  fields="spend,impressions,cpm,ctr,actions,cost_per_action_type",
  breakdowns="publisher_platform,platform_position",
  date_preset="last_7d"
)
```

Returns one row per `publisher_platform` × `platform_position` combination.

---

## Step 2: Calculate CPI Per Placement

For each placement row:
```
installs = actions where action_type == "mobile_app_install"
cpi = spend / installs (if installs > 0, else ∞)
```

Build a table sorted by spend descending:

| Placement | Spend | Impressions | Installs | CPI | % of Total Spend |
|---|---|---|---|---|---|

---

## Step 3: Flag Waste Placements

**Rule of thumb**: Flag any placement where CPI > 3x the campaign average CPI.

### Common Waste Placements for iOS App Install Campaigns

| Placement | Typical Behavior | Why It's Wasteful |
|---|---|---|
| `facebook/instream_video` | Very high impressions, very low installs | Users watching videos don't want to leave; accidental clicks |
| `facebook/facebook_reels_overlay` | High impressions, very low installs | Overlay ads get impressions but no meaningful engagement |
| `threads/threads_feed` | Low volume, near-zero installs | Threads audience isn't app-install-receptive (yet) |
| `audience_network/classic` | Can drive volume but often low quality | Third-party apps, less intent |

**Campaign type context** [mb-li-006]: App Promotion campaigns are inherently Reels-heavy. If you need better placement distribution, consider Web Sales campaigns which scale more on Feed.

### Example from ROLA vs MX Analysis

**Efficient campaign (ROLA)** — only 6 placements, CPI range $3.06 - $6.86:
- instagram/reels: $3.37
- facebook/reels: $3.64
- instagram/stories: $3.64
- facebook/stories: $3.94
- instagram/feed: $3.06
- facebook/feed: $6.86

**Inefficient campaign (MX)** — 8 placements, CPI range $8.64 - $83.66:
- facebook/instream_video: **$83.66** (29 installs for $2,426)
- facebook/reels_overlay: **$56.98** (31 installs for $1,766)
- threads/threads_feed: **∞** (0 installs for $53)
- instagram/stories: $31.07
- facebook/feed: $20.93
- facebook/stories: $14.02
- instagram/reels: $10.12
- facebook/reels: $8.64

The 3 waste placements in MX burned **$4,245 for 60 installs ($70.75 CPI)** — but even without them, MX's core placements are 2-4x more expensive than ROLA's.

---

## Step 4: Quantify the Waste

Calculate:
- **Total waste spend**: Sum of spend on placements with CPI > 3x average
- **Waste installs**: Sum of installs from those placements
- **Waste CPI**: waste spend / waste installs
- **What-if CPI**: (total spend - waste spend) / (total installs - waste installs)

### Example
```
MX total: $36,934 spend, 2,434 installs, $15.17 CPI

Waste placements: $4,245 spend, 60 installs
Without waste: $32,689 spend, 2,374 installs = $13.77 CPI

Savings: $1.40 CPI improvement (9.2% better)
But still 3.5x worse than ROLA — waste is a symptom, not the full cause
```

---

## Step 5: Compare Placement Mix Between Campaigns

| Placement | Campaign A (% spend) | Campaign B (% spend) |
|---|---|---|
| instagram/reels | | |
| facebook/reels | | |
| facebook/feed | | |
| instagram/stories | | |
| facebook/stories | | |
| instagram/feed | | |
| [waste placements] | | |

**Watch for**:
- Campaign A has 80% spend on reels/stories (video-first, high-intent placements)
- Campaign B has 40% on feed + 12% on junk placements (broader, lower-intent)

---

## Step 6: Decision — Restrict vs Advantage+ vs Value Rules

### Option 1: Restrict Placements
**When**: Clear waste placements with CPI > 5x average, waste >10% of total budget, >30 days of data.

**Warning**: Restricting placements resets the learning phase. Monitor closely for 3-5 days.

### Option 2: Keep Advantage+ Broad
**When**: All placements within 2x of average CPI, campaign is new (<14 days), Advantage+ is still learning.

### Option 3: Placement Value Rules [mb-li-009]
**When**: You want to keep broad targeting but bid differently per placement. "This avoids fragmentation from creating separate placement-targeted campaigns."

Set up Placement-level Value Rules to bid lower on wasteful placements and higher on efficient ones, within the same ad set. This is the preferred approach when:
- You want to maintain broad delivery
- Waste is moderate (not extreme)
- You have enough data to know which placements work

---

## Step 7: Monitor After Changes

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
- Did CPI improve within 3-5 days?
- Did impression volume drop significantly?
- Did install volume stay stable or improve?
- Did CPM increase? (expected — higher-quality placements cost more)

---

## Output Template

```markdown
## Placement Audit: [Campaign Name]

### Placement Performance
| Placement | Spend | Installs | CPI | Flag |
|---|---|---|---|---|
| | | | | OK / WASTE |

### Waste Summary
- Total waste: $X on Y placements
- Waste CPI: $Z (vs campaign average $W)
- Impact if removed: CPI improves from $A to $B

### Recommendation
[Restrict placements / Keep broad / Use Placement Value Rules [mb-li-009]]

### Knowledge Base References
- mb-li-006, mb-li-009
```
